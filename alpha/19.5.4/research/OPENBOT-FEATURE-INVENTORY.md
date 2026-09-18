# Both OpenBots — full feature inventory, and what it means for Vouch Harbor

Read against: `CopilotKit/OpenBot` (`README.md`, `docs/architecture.md`, `docs/coworkers.md`, `docs/configuration.md`, `docs/routines.md`, repo tree) and `openbot.run` / `NorbertBodziony/openbot` (`README.md`). Verified 18 Sep 2026.

---

## Part 1 — What each one *is* (the part that matters more than the feature list)

### CopilotKit/OpenBot — a governance platform wearing a coworker UI
Its own words: *"AI coworkers you can hand real work to, and actually trust with the access... Anything a Bot does to a computer, a file, an MCP server or a component goes through one gateway that decides and records it. That is the difference between an agent that can use your tools and an agent you can let near them."*

The whole product is built outward from one sentence: **"There is no path that acts without the record existing first."** Everything else — the per-Bot containers, the CEL policy, the audit table, the handover events — is a consequence of that. It is a **server platform** (Hono + Postgres + Docker + Helm), and it's explicitly *"a template, not a product"*: you clone it, replace the tenant package under `examples/fintech`, and ship your own. Three coworkers ship as **configuration, not code** (General Assistant, Knowledge, Risk Analyst).

Its most important architectural decision: **governance rides the protocol, not the framework.** A "Bot" is any endpoint speaking AG-UI. LangGraph, Mastra, CrewAI, Pydantic AI, Google ADK or hand-written — all arrive the same way. They never own the agent loop; they own the boundary around it. That is proof from a well-funded team that your "don't touch the core" instinct is the correct architecture.

### openbot.run — a desktop workspace for orchestrating CLI agents, plus multiplayer
Its thesis: *"Persistent AI teammates for real work. Run Codex, Claude and Grok side by side, each with its own workspace, queue, and context."*

It is an **Electron desktop app** (SolidJS renderer, typed IPC, sandboxed `WebContentsView` browser) whose real job is to sit on top of the **CLI agents you already pay for** — Codex App Server over stdio JSONL, Claude Agent SDK over stream JSON, Grok via ACP, plus a managed OpenCode CLI — and give each one an independent session, a workspace under `~/OpenBot/Agents/<id>`, a FIFO queue, and a way to talk to the other agents, with channels and mobile/remote access layered on top.

Where CopilotKit governs *what agents may do*, openbot.run engineers *how you run many agents all day without losing your mind* — and its engineering discipline is the strongest thing in either repo. Its own warning is equally important: agents run with `danger-full-access` and `approvalPolicy: never`, and *"Full local access is an explicit current product decision, not a security boundary."* That is the posture Vouch Harbor exists to invert.

---

## Part 2 — CopilotKit/OpenBot: complete feature inventory

### 2.1 The gateway (its crown jewel)

| Feature | Detail |
|---|---|
| **Single action boundary** | resolve target from a **server-held snapshot** → evaluate policy → **write the audit row** → only then call the computer → **second audit row** if a forwarded action fails |
| **CEL policy engine** | Rules inspect `tool.name`, `intent`, `bot.id`, `actor.id`, `page.url`, `page.host`, `element.ref/role/name/type`, `key`, `command`, `file.path/name/extension`, `mcp.server`, `mcp.tool`, `mcp.effect`, `initiator.kind/id` |
| **Fail-closed semantics** | deny evaluated **before** allow; missing/empty policy permits **nothing**; a broken deny rule **denies**; a broken allow rule **does not permit**; a **malformed policy stops server startup** |
| **Refusals name the rule** | `/admin/boundaries` to author presets and deny rules; every refusal in the trail carries the rule that caused it |
| **Readable audit** | `/admin/audit` — permitted, refused, failed. `AUDIT_RETENTION_DAYS` optional |
| **Desktop-computer policy** | Policy fields exist for keys pressed and element identity, so "type into this field on this host" is expressible |

### 2.2 Initiator attribution (the idea worth stealing first)

- Every audit row records **what caused the run**, not just whose authority it carried: `person`, `deployment`, `routine` (with the routine's id), `handoff` (with the handing Bot's id).
- Rationale, in their words: *"An interactive run has somebody watching who will notice a wrong tool call; an unattended one does not, which is the case worth being able to find."*
- Filter: **"Nobody watching" = routine + handoff.** `deployment` deliberately excluded — a boundary held at start-up is the system holding its own line, not work done on someone's behalf.
- The value travels **inside a signed run assertion** beside `depth`, so a tool call, a hop, a refusal, a human-help pause and a stalled stream all say the same thing without being told separately. **A Bot cannot relabel its own run** — the assertion is signed by the deployment, and an unknown kind reads as `person` rather than being kept.
- Honest edge: computer actions carry **no** initiator, because they're executed by the person's own browser session.

### 2.3 Isolation and the computer plane

- **A computer per Bot**: own container, own `/workspace` volume, own browser profile, built by a supervisor.
- **Supervisor** exposes only `ensure / stop / reset / list`, holds the Docker socket, and is **loopback-bound** (4500 host / 4300 container) because its token is a shared secret rather than a network boundary.
- `COMPUTER_RUNTIME=runsc` → containers run under **gVisor** where supported.
- **Loopback by default**: the computer binds `127.0.0.1` and requires a per-container `COMPUTER_TOKEN`; only `/health` works without it.
- **Network separation**: Postgres sits on its own Docker network carrying only itself and `migrate`; everything else on `default`. *"A Bot has a shell, and a shell reaches whatever its container reaches."*
- **Shell hygiene**: a command inherits **only** PATH, locale, terminal names and proxy vars (userinfo stripped from the proxy URL); `COMPUTER_SHELL_ENV` names anything else.
- **A shell, not just a browser**: run commands, install what it needs, process files — all through the same gate, so a rule can refuse a shell outright or refuse specific commands.

### 2.4 Watching and taking the wheel (human-in-the-loop)

- **Watch**: live browser proxied over a websocket, gated on the same question as every route about that Bot.
- **Activity tab**: every command with its output and exit code, every file read/write/listing, newest first. **A saved file shows path and size, never contents** — "a Bot may be saving something it was told in confidence."
- Explicitly framed: *"Activity is a window rather than a record; the record is the audit trail, which is server-side, survives restarts, and is what an investigation reads."*
- **Take the wheel**: a Bot hitting a login wall or 2FA **asks for help**; handover is audited as `computer.help_requested`, `computer.control_taken`, `computer.control_released`. **While a person drives, Bot actions are refused rather than queued.**
- **Secrets never enter the transcript**: the trail records that a secret was requested and *how long it was*, not what it said.
- **`ask_person`**: offered to **every** run whether or not the Bot was granted anyone — because reaching a second Bot costs a model call and may wake a machine, while asking the person already in the conversation costs nothing and cannot be aimed anywhere they can't see. *"A deployment able to switch off the safe exit and keep the expensive one would be backwards."* Audited as `agent.escalated` / `agent.escalation_failed`.

### 2.5 Multi-agent handoff

- **`message_bot`** is an ordinary grant (which Bots may reach which).
- **Handoffs are typed** — task, constraints, what a good answer looks like — because *"free text is the commonest way a handoff goes quietly wrong: the receiving Bot infers the intent, guesses the constraints, and when it guesses wrong it does not fail, it answers something else confidently."*
- **Four things decided by the deployment, never by the model**: who is addressed (intersected with what the asking person may see — a non-existent Bot and a not-theirs-to-see Bot are refused **in the same words**, so it can't enumerate the roster); where the answer lands (from the signed assertion); who is asking (stamped by the deployment); how deep the chain is (from the assertion — stops A→B→C→A forever).
- **Caps refuse rather than truncate**: `BOT_HANDOFF_MAX_DEPTH`, `BOT_HANDOFF_MAX_PER_RUN`; `=0` switches the capability off entirely.
- The answer lands in **the answering Bot's own conversation**, not the asking one (a thread is owned by exactly one agent), so the person gets both halves.
- **A hop is claimed work, not a callback** — a row on the shared queue, because the addressed Bot is unlikely to be on the same pod. Lease renewed for the run's duration.
- **A hop that fails for good is said out loud** — otherwise "a question handed on and never answered is indistinguishable from a slow one."

### 2.6 The shared work queue (infrastructure lesson)

One Postgres table `work_items`, claimed with `select ... for update skip locked`, leases timed on **the database's own clock**, with an attempt cap. Used by the routines sweep, the idle-computer culler, and handoffs. Rationale: *"Neither runs as a timer inside the API, because a timer fires in every replica and each would decide independently that the same firing is due."*

### 2.7 Detecting absence (a genuinely rare idea)

`AGENT_STALL_TIMEOUT_MS` watches for *"the failure a Bot has that nothing else in the trail can show: a stream that stops producing anything. Every other audit row is something that happened, and this one is the absence of anything happening, which leaves no trace of its own."* Ending the turn writes `agent.stream_stalled`.

Same instinct elsewhere in the repo: the Routines page tells a person **"no worker has ever checked in"** (via `routine_sweeps`) rather than silently showing a schedule nobody fires; a refused hop is a row *"because a hop that happened is visible in the transcript and one that was refused is invisible everywhere else."* They are careful about the difference between "nothing happened" and "nothing was watching."

### 2.8 Coworkers, channels, identity

- **Coworker** = durable profile (name, title, role description, avatar seed, owner, visibility) + **standing role** sent as a system message on every run, so the job isn't restated per channel.
- A **deployment-level provenance block** is appended to every coworker: say where each answer came from, mark plainly what comes from its own knowledge rather than a source, never present the latter as the former. *"Being deployment-wide, it cannot be forgotten from the next coworker somebody adds."*
- **Visibility** `private` / `public`; **soft delete** with tombstones; **hide** is per-user roster state only.
- **Channels**: each is a conversation + thread; a channel-local proxy agent id is pinned to that thread.
- **Sign-in**: Google/Microsoft/Okta from env, or a company's own **SAML/OIDC provider registered while the deployment runs, routed by email domain**. `/admin/people` promotes, demotes, removes (ending the live session), every change audited.
- **Bring your own agent**: any AG-UI endpoint. Endpoints validated by the same target checks as browser navigation, at registration and on **every redirect**; cloud metadata addresses refused always; private addresses refused unless explicitly listed in `AGENT_ENDPOINT_ALLOWED_HOSTS` (exact match, no wildcards; a URL or a `*` in that list **stops startup**). Auth header is **write-only** — sending replaces, omitting keeps, APIs never return it.

### 2.9 Tools, skills, MCP, components

- **Governed MCP**: curated catalogue (Google Drive, Notion) + **Composio** brokering a few hundred apps behind one key. Custom servers pass URL checks; **unknown tools and custom-server tools are treated as writes unless positively classified as reads**. Every MCP call: check grant → evaluate the same policy engine with MCP context → audit.
- **Credential model per connector** and it's honest about the distinction: a deployment-wide token answers the same for everybody; Google Drive and Notion are `user-oauth`, so a Bot reaches them **as the person asking and sees only what that person can see**. Enabling the connector and connecting your account are two separate decisions.
- **Skills are instructions, not capabilities**: invoked with `/`; personal skills attach only to Bots their author owns; deployment skills are admin-owned.
- **`skill-creator`** is a shipped skill: four tools (`list_skills`, `read_skill`, `list_skill_tools`, `save_skill`) that **suspend the run on a card** showing the command, title and whole instruction — nothing is written until the person presses the button. Those tools are offered **only while the Bot holds `skill-creator`**, and they run in the browser as the signed-in person through the same endpoint the Skills page uses, so ownership rules and audit rows are the endpoint's rather than a second copy.
- **Tool narrowing** (a directly transferable insight): *"A model picks the right tool reliably out of about ten, and unreliably out of thirty."* Before a run, the deployment asks **its own model** which skills the message needs and offers only those skills' tools plus every granted tool no skill claims. A declaration grants nothing — the offer is intersected with existing grants. **It fails open to the full catalogue**, because *"a narrowing that failed closed would remove capability an administrator granted, silently."* Audited as `mcp.tools_discovered`.
- **Components instead of prose**: compiled React components, plus sandboxed ones authored in `/admin/playground` and published **with no deployment**. Every call asks the server whether the component exists, is published, and is not withheld from that Bot; data functions need a **separate per-component grant**. Shipped data functions read the audit trail: `botActivity`, `recentRefusals`.
- **Generative UI**: streamed HTML/CSS/JS in a sandboxed iframe + **A2UI** declarative interfaces whose buttons send named actions back into the conversation. Toggleable (`OPENBOT_GENERATIVE_UI=false`). Honest caveat documented: generated HTML has no session/same-origin access, and **can load CDN libraries**, so deployments that prohibit that traffic should disable it.

### 2.10 Routines (unattended work, done carefully)

- Created **conversationally** — *"There is no form for this... Turning a sentence into a five-field cron expression and a channel is conversational work."*
- **Prerequisites as governance**: routines is a catalogue entry; `create_routine` / `update_routine` / `delete_routine` are granted per Bot. *"An administrator decides which Bots may schedule future work at all, before deciding what that work is."*
- **15-minute floor** — because a model can be talked into anything a sentence can describe, *"including 'every minute', and the floor is what a sentence cannot talk its way past."*
- **20-enabled cap** — because a conversation is an easy place to accumulate standing work without noticing.
- **Fatigue rule**: a failing routine posts **once** (first failure after a success), and **ten consecutive failures switch it off** with a second final message. Explicitly *not* a retry policy — retry asks "did this attempt get through a flaky dispatch", fatigue asks *"is this routine worth firing at all."* A Notion token that expired in March fails cleanly every night and no retry fixes it.
- **Missed windows are skipped, not replayed** — *"catching up is a silent drain, not a burst"*; thirty stale summaries of thirty different mornings must never arrive at once.
- **Runs as its creator**, with that person's own grants: *"it can do in the middle of the night exactly what they could do by typing the same instruction in chat themselves, and nothing more."* Its reply lands in the channel as an ordinary message from that Bot.
- **Worker requirement is surfaced, not hidden**: nothing fires without a second process; the page says when the last sweep was; `WORKER_SHARED_SECRET` is required on both sides, and the worker refuses to start without it *"rather than firing routines nobody could ever prove came from it."*
- One code path, two clocks: a CronJob on Kubernetes, a loop on a laptop.
- **Stated open limits**: no admin view of other people's routines, no per-deployment cap beyond the sweep's claim limit, tenant packages can't ship routines yet.

### 2.11 Deployment & ops

- Docker Compose for every part; **one image** carries app + API + the browser Bots drive + optional embedded Postgres (`EMBEDDED_POSTGRES=on`), or point at your own `DATABASE_URL`; **Helm chart** for Kubernetes (`routines.enabled` → CronJob).
- **Tenant package as configuration**: `brand.yaml`, `agents.yaml`, `channels.yaml`, `model.yaml`, `knowledge.yaml`, validated at startup; connector credentials referenced by id from the vault, never inline in YAML.
- `OPENBOT_SINGLE_USER=true` admits everything as one administrator so a fresh clone works before you wire OAuth — and **sign-in turns it off**; `NODE_ENV=production` refuses the example encryption key.
- Config that **refuses to start** rather than half-works: missing `DATABASE_URL`/`KEY_ENCRYPTION_KEY`/the three `INTELLIGENCE_*`, a partial Intelligence set, `MANAGED_AGENT_AG_UI_URL` without its token, a malformed policy, a bad `AGENT_ENDPOINT_ALLOWED_HOSTS` entry.

### 2.12 What it depends on that you must not

**CopilotKit Intelligence** — durable threads, memory and a realtime gateway, managed or self-hosted, with a `cpk-...` project key and an entitlement. It's a licensed external service at the centre of their memory model. For Vouch Harbor's local-first, "keys in memory only" contract, this is the wrong shape — and the thread-ownership rule (a thread belongs to exactly one agent) is a constraint that shows up in their multi-agent design.

---

## Part 3 — openbot.run: complete feature inventory

### 3.1 Agent orchestration (its core value)

| Feature | Detail |
|---|---|
| **Multi-provider agents** | Independent sessions on **Codex App Server** (stdio JSONL), **Claude Agent SDK** (stream JSON), **Grok CLI** (ACP), and a managed **OpenCode** CLI with free models plus paid Zen models |
| **Managed runtimes** | Can download and **pin** a provider CLI; explicit `OPENBOT_*_PATH` overrides; a compatible system CLI is used when no managed copy exists; updates never touch your system CLI |
| **Per-agent workspace** | `~/OpenBot/Agents/<agent-id>` plus a shared `~/OpenBot/Shared` |
| **Persistent conversation across providers** | One stable local conversation when an agent switches between Codex, Grok and Claude; native session ids stay private and are used only to resume runtime state |
| **Context management** | Per-agent context monitoring with **automatic compaction before long threads exhaust the model window** |
| **Queues** | FIFO message queues with **pause, resume, cancellation**, crash-safe persistence |
| **Prompt-driven agent creation** | Create/edit agents by describing them (desktop and mobile), with editable instructions, avatar, and section review before saving |
| **Per-agent settings** | Model, reasoning, profile, notification, browser, and panel state |

### 3.2 Collaboration and multiplayer

- **Agent-to-agent**: messages, replies, reactions, images, **managed file transfers** with an `.openbot-transfer.json` manifest carrying ownership, recipients, size and **SHA-256**.
- **Channels**: shared desktop chats with **one task owner, explicit delegation, shared history**, and **Stop / Resume / Reassign / Archive / Restore**.
- **Publishing / remote access**: the host keeps its Team API on loopback; a hidden sandboxed Electron page connects invited clients over **WebRTC** (direct DataChannels, **coturn** fallback); Signal carries only connection setup.
- **Honest privacy boundary, documented**: Cloudflare stores accounts, configuration, memberships, invitations, logical session records and public assets — **not** chats, files, commands or remote-desktop media.
- **Mobile**: an Expo Go app (iOS via TestFlight pipeline, plus iOS simulator tooling), **Mobile Connect QR codes**, remote desktop (macOS/mobile; not Linux).

### 3.3 Accounts & data

- Optional accounts via **one-time email codes** (10-minute expiry, stored **only as hashes**), on Cloudflare Workers + D1 + R2 avatars.
- **SQLite is the canonical event log** (`openbot.db`) with read projections for agents, conversations, provider session bindings, queues, reactions and attachment indexes; legacy `bots.json`/`mailbox.json` kept as unchanged backups after migration.
- **Provider logins are never copied** — `~/.codex`, `~/.claude`, `~/.grok` stay the CLIs' business; `XAI_API_KEY` and per-session MCP bearer tokens are **never persisted or logged**.
- **Deletion is scoped**: removing an agent removes its workspace, its owned generated attachments, and deliveries addressed only to it — a transfer survives while another agent still uses it.
- Attachments: MP3/MOV, 100 MB per file, 250 MB per message, 10 files per message — and it states plainly that it does not play, decode, transcribe or validate them.

### 3.4 Engineering discipline (the best thing in the repo)

| Mechanism | What it does |
|---|---|
| `bun run check` | Biome + **11 typecheck projects in parallel** (per-worktree incremental caches) + offline tests + browser smoke test + production build |
| `check:ui` | **Design-system enforcement** — shared primitives only, Kobalte/Lucide confined to `components/ui`, palette tokens instead of colour/size/radius/transition literals — reads the whole renderer in **60 ms** |
| `test:browser` | Browser smoke test with isolated scenarios: `controls`, `tool-boundary`, `evaluation`, `wait-deadlines` |
| `dev:status` | Prints, as JSON, **every** dev stack and instance on the machine: services, ports, pids, which belong to this worktree, and **which are orphaned** (a supervisor that is gone with its children still holding ports) |
| `dev:stop` | Signals **only** a pid whose **start time still matches** the record, so a recycled pid is never killed; anything it cannot confirm is reported, left running, and the command exits non-zero |
| `dev:forget` | Drops a stack record without signalling — the one case `dev:stop` refuses to resolve itself |
| `dev:automation` | Drives the running app over **CDP**: instances, pages, snapshot, screenshot, click/type **by accessible role**; mutations require `--allow-mutations` and a named instance |
| `package:verify` | Builds and verifies a real app bundle: icon, metadata, **ASAR, fuses** (mac ARM64 / win x64 / linux x64 under xvfb) |
| `release:preflight` | Verifies version, git state and release secrets before tagging |
| Releases | Tag-driven; **signed and notarized macOS**, unsigned Windows/Linux; **GitHub build attestation** and checksums published; updates checked from GitHub Releases |
| `dev:seed` / `dev:reset` | Showcase data with records **dated backwards** so transcripts read "Today"/"Yesterday"; reset scoped to dev profiles only |
| `dev:test-client` | A complete **two-client harness** for team testing |
| `remote:up` / `remote:check` | Self-hosted **Signal + coturn + ACME** stack |
| Linux sandbox | Ships an **AppArmor profile** for restricted unprivileged user namespaces, and warns **never** to start with `--no-sandbox` |
| Marketplace | Skills + agents catalog with seed/build/publish commands; production publish is a dry run unless explicitly flagged, needs admin credentials |

### 3.5 UX surface

Persistent embedded browser agents can open, inspect and control · optional macOS **Computer Use** via a locally installed Codex plugin (needs Screen Recording + Accessibility permissions) · privacy-safe **diagnostics exports** · account popover with update download/restart · Storybook · workspace isolation for parallel dev (`dev --isolated` gives a worktree its own profile).

---

## Part 4 — Side by side

| Dimension | CopilotKit/OpenBot | openbot.run | Vouch Harbor |
|---|---|---|---|
| **Shape** | Server platform, self-hosted Docker/Helm | Desktop app (Electron) + mobile | Desktop app (Tauri 2) + A2A/MCP hosts |
| **Agent model** | Any AG-UI endpoint (framework-agnostic) | Wraps Codex/Claude/Grok/OpenCode CLIs | Own engine, 1,150-specialist fleet + BYOA |
| **Governance** | ⭐ Gateway: CEL policy, fail-closed, audit rows, initiator, human handover | None claimed — full access, no approvals | ⭐ Risk tiers, human gate, signed receipts, autonomy exam |
| **Proof of work** | Audit rows in Postgres | Local event log | ⭐ Offline-verifiable signed receipts, ledger chains |
| **Isolation** | ⭐ Container per Bot, gVisor option, split networks | Per-agent workspace, AppArmor, CLI sandboxes | Hybrid browser plane + allowlisted process exec |
| **Unattended work** | ⭐ Routines: floor, cap, fatigue rule, worker honesty | Queues (manual triggers) | Workflows / Shipyard work orders |
| **Memory** | CopilotKit Intelligence (external, licensed) | Local SQLite + per-agent context compaction | Local ledger, opt-in cloud sync (honestly non-operational) |
| **Multiplayer** | Channels + per-person membership + SAML/OIDC | ⭐ WebRTC peer access + mobile + shared channels | Team-Evolve, signed invitations, VouchMesh (local) |
| **UX differentiators** | Watch the screen, take the wheel, components/generative UI | Multi-agent desktop, queues, marketplace, mobile | Proof/Audit doors, Ghost Sweep, Backtest, Hindsight |
| **License** | **MIT** | **PolyForm NC** (≤0.1.11 Apache-2.0) | Proprietary |
| **Maturity** | Alpha, actively developed | Dev preview | 19.5.4, 125 probe suites |

---

## Part 5 — What I actually understood (ten lessons worth taking)

1. **Governance belongs at the boundary, never in the agent.** They govern LangGraph, CrewAI, ADK and hand-written agents without owning any of them, purely because they own the gateway. This is the strongest external validation of "don't touch the core" I've seen — and it's why you can extract their ideas without extracting their stack.
2. **Attribute the run, not just the action.** `person / deployment / routine / handoff` in a **signed assertion** answers "was anyone watching?" — and forbidding a Bot from relabelling its own run is what makes the answer trustworthy. This is the single best addition to your receipts: your receipts prove *what* happened; this proves *whether it happened unsupervised*.
3. **Detect absence, don't just record events.** A stalled stream leaves no trace, so they write a row for it. Nobody's standup notes not arriving should be a queryable fact, not a mystery. Your Ghost Agent Sweep is already this instinct applied to keys — apply it to runs.
4. **Budget the safe exit, not the expensive one.** `ask_person` costs nothing and can't be aimed anywhere the person can't see, so it's offered to every run; `message_bot` costs a model call and may wake a machine, so it's granted per Bot. If escalation to a human is ever harder than escalation to another agent, you built it backwards.
5. **Type your handoffs.** Free-text delegation doesn't fail loudly — the receiving agent guesses the constraints and *confidently answers something else*. Your A2A/TeamExecutor envelopes should carry task, bounds, and what a good answer looks like, as fields.
6. **Narrow the tool offer, fail open.** ~10 tools is reliable, ~30 is not. Match tools to the message per run — but if matching fails, offer **everything granted**, because a narrowing that fails closed silently removes what an admin granted.
7. **Refuse, don't truncate — and refuse in the same words.** Depth caps that refuse rather than quietly drop; and a non-existent target and a not-yours-to-see target refused identically, so the refusal can't be used to enumerate your roster.
8. **Spend controls are not retry policies.** Ten consecutive failures → switch the thing off and say so. Retries answer "did this attempt get through"; the fatigue rule answers "is this worth firing at all". Your token optimizer is the natural home for this on the cost side.
9. **While a human drives, refuse rather than queue.** Their control handover doesn't buffer agent actions to replay later — a queued action firing the moment you release the wheel is exactly the surprise a gate exists to prevent.
10. **Say what you don't have.** Both projects document their own gaps — *"a template, not a product", "alpha", "not a security boundary", "no admin view of other people's routines", "cloud sync honestly non-operational until it ships"*. Your README already does this; it's the reason a serious buyer trusts the rest of the page. Keep it.

---

## Part 6 — Extraction verdict, feature by feature

| Feature | Source | Verdict for Vouch Harbor |
|---|---|---|
| CEL policy engine, fail-closed | CopilotKit (MIT) | ✅ **Take** — item E1, kit already built (`extraction-kit/`) |
| Initiator attribution + "Nobody watching" | CopilotKit (MIT) | ✅ **Take** — item E2, kit already built |
| Two-row audit (decision + outcome) | CopilotKit (MIT) | ✅ **Take** — folded into `governAction()` |
| Container/gVisor exec + supervisor topology | CopilotKit (MIT) | ✅ **Adapt** — item E3; adapter swap behind `pc.exec`, not a rewrite |
| Credentials: encrypted at rest, never returned, redacted from audit | CopilotKit (MIT) | ✅ **Take** — item E4; keep your keychain as root of trust |
| AG-UI ingress (third protocol beside BYOA/A2A) | CopilotKit (MIT) | ✅ **Take** — item E5; pure distribution |
| Routines (floor, cap, fatigue, skipped windows, worker honesty) | CopilotKit (MIT) | ✅ **Take** — item E6, **only after E2** |
| Shell-env allowlist for exec | CopilotKit (MIT) | ✅ **Take** — item E7, ~1 day |
| Headless container + Helm | CopilotKit (MIT) | ✅ **Adapt** — item E8, "Harbor Node" |
| Per-run tool narrowing (fail open) | CopilotKit (MIT) | ✅ **Take** — directly applicable to your 1,150-specialist routing and 20 MCP tools |
| Typed handoff envelopes | CopilotKit (MIT) | ✅ **Take** — into your A2A/TeamExecutor seam |
| Control handover: refuse-not-queue | CopilotKit (MIT) | ✅ **Take** — into your gate modal |
| Secrets: log length, never content | CopilotKit (MIT) | ✅ **Take** — 5-line audit invariant |
| CopilotKit Intelligence as your memory | CopilotKit (licensed service) | ❌ **Skip** — contradicts local-first; you have your own ledger |
| Their Hono/Postgres/Drizzle stack wholesale | CopilotKit | ❌ **Skip** — adopting it *is* changing your core |
| Their shipped policy default (`allow: ["true"]`) | CopilotKit | ❌ **Skip** — take the engine, invert the default |
| Per-specialist container for 1,150 specialists | CopilotKit | ❌ **Skip** — their economics are ~10 Bots; isolate per mission/hand/order |
| Crash-safe FIFO queues with pause/resume | openbot.run | ⚠️ **Concept only** (PolyForm NC) — your own queue + gate already cover this |
| Per-agent context compaction | openbot.run | ⚠️ **Concept only** — genuinely useful for your long missions; build it yourself |
| `check:ui` design-system enforcement | openbot.run | ⚠️ **Concept only** — but adopt the *idea*: a fast lint that pins your Horizon token sheet, in the spirit of `probe/theme` |
| `dev:status` / `dev:stop` (pid start-time match, orphan detection) | openbot.run | ⚠️ **Concept only** — excellent model for your probe/verify tooling |
| `package:verify` (ASAR/fuses/icon/metadata) | openbot.run | ⚠️ **Concept only** — you have byte-pinned bundles; extend that mindset to Tauri packaging |
| CDP automation harness (`dev:automation`) | openbot.run | ⚠️ **Concept only** — a role-based UI automation probe would strengthen your 125 suites |
| Marketplace (skills + agents catalog) | openbot.run | ⚠️ **Concept only** — but you already have SKILL.md ecosystem import; a governed catalog is a real product idea |
| WebRTC peer access + mobile client | openbot.run | ⚠️ **Concept only** — big build; only if mobile becomes a business requirement |
| `danger-full-access` / never-ask execution | openbot.run | ❌ **Never** — it is the antithesis of your product |
| Any code at HEAD | openbot.run | ❌ **License: PolyForm Noncommercial.** Only tags ≤ v0.1.11, verified at the tag |

---

## Part 7 — What neither has (your moat, for the record)

Neither project has: **offline-verifiable signed receipts** (SHA-256/HMAC/Ed25519, zero-dep verifier), **ledger chains**, **Ghost Agent Sweep with zero-residual receipts**, **Backtest Replay / The Drill**, **Hindsight Ledger**, **earned-and-revocable autonomy with a 90% exam**, **fleet-level provenance self-proof**, or **byte-pinned verification bundles**. CopilotKit's audit is rows in Postgres that require the server; yours travels with the artifact.

Read together, the two OpenBots answer "how do I let agents near my tools" and "how do I run many agents all day" — and neither answers **"how do I prove to someone else what my agent did."** That question is your entire product, and it is the one an enterprise auditor actually asks.

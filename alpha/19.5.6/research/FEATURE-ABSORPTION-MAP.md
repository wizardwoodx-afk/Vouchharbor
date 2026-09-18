# FEATURE ABSORPTION MAP — everything worth taking from the OSS agent landscape

For **Vouch Harbor 19.5.4** (proprietary, Tauri 2 + React 18 + Vite 6, TypeScript core).
Verified 18 Sep 2026. Every row names the license **because the license decides whether you may take it**.

Legend: **TAKE** = absorb now · **ADAPT** = absorb the pattern, reimplement · **INSPIRE** = study only, write your own · **SKIP** = do not ingest (license or strategy) · **WATCH** = matters later.

---

## 0. The three rules that govern this whole document

1. **MIT / Apache-2.0** → may be copied into a proprietary product with attribution + NOTICE row. This is your quarry.
2. **AGPL / SSPL / PolyForm-NC / "Sustainable Use" / custom-with-conditions** → never linked into your product. At most a separately deployed service you don't resell.
3. **UI is code.** "Nice UI" is not takeable from a repo whose license forbids commercial use. You may copy the *layout idea* and rebuild it; you may copy *code* only from MIT/Apache.

---

## 1. The UI question (asked directly, answered directly)

| Source | UI stack | License | What you may actually do |
|---|---|---|---|
| **CopilotKit/OpenBot** `app/` | React + Vite (same as yours) | **MIT** | ✅ **Copy code.** Attribution + NOTICE. This is your UI quarry. |
| **openbot.run** renderer | SolidJS + Electron | **PolyForm Noncommercial** | ❌ **Do not copy code.** Study the layout, flows and information architecture, then rebuild in your own React/Horizon components. |
| **LibreChat** | React | **MIT** | ✅ Usable. Multi-provider picker, side-by-side compare, presets. |
| **Open WebUI** | Svelte | Modified license with branding clause | ⚠️ Not OSI-approved; check before reuse. |
| **Dify / Flowise / Langflow** | React | Apache-2.0 / Apache-2.0 / MIT | ✅ Usable, but they carry a whole product shape you don't want. |

**What to absorb into the VH UI** (patterns, re-skinned in your Horizon tokens, pinned by `probe/theme`):

| Pattern | From | Why it matters |
|---|---|---|
| Agent roster + durable profile (name, title, standing role, visibility) | CopilotKit (MIT) | Your 1,150 specialists have no human-facing roster. This is the missing front layer. |
| **Watch the screen** panel + **Activity tab** (commands, exit codes, files touched) | CopilotKit (MIT) | Your receipts are after-the-fact. This is the "watch it work" feeling users rate highest. |
| **Take the wheel** handover (`help_requested` / `control_taken` / `control_released`) | CopilotKit (MIT) | The 2FA/login-wall moment. No competitor does this well. |
| **Boundaries** admin (author the policy rules, see refusals named) | CopilotKit (MIT) | Turns your gate into something a CISO can read and sign. |
| **Audit** viewer filtered by permitted / refused / failed / *Nobody watching* | CopilotKit (MIT) | Your Audit door, deepened. |
| Per-agent **queue** with pause / resume / cancel | openbot.run (INSPIRE) | Users understand queues; "run" is abstract. |
| **Workspace + file transfer** panel with SHA-256 manifests | openbot.run (INSPIRE) | Evidence-friendly file handling. |
| **Marketplace** for skills/agents | openbot.run (INSPIRE) | You already have SKILL.md import; a governed catalog is the productised form. |
| **Live viewport + activity feed + console** in one dashboard | vercel-labs/agent-browser (MIT) | Best-in-class pattern, Apache-2.0, directly reusable for your browser plane. |
| **Command palette / RSI proposal cards** with apply-reject + revert | yours | Already better than both. Keep as the signature interaction. |

**Verdict on the UI plan:** take CopilotKit's *React code* (MIT), take openbot.run's *layout ideas* (no code), render everything through your Horizon design system, and let `probe/theme` pin it so it cannot drift. That gives you the "nice UI" without the license bomb and without a rewrite — your shell stays Tauri/React.

---

## 2. Coworker / teammate platforms (your exact category)

| Project | License | Features worth absorbing | Verdict |
|---|---|---|---|
| **CopilotKit/OpenBot** | **MIT** | Gateway policy (CEL, fail-closed), initiator attribution, per-Bot container + gVisor, loopback+token, split networks, watch screen / take wheel, secrets-by-length, typed handoff, `ask_person`, routines (floor/cap/fatigue/skip-not-replay), credentials vault, components + generative UI, tool narrowing (fail open), shared `work_items` queue, stall detection, SAML/OIDC by email domain, tenant package as config | **TAKE** — your primary quarry (items E1–E8) |
| **Eigent** | Apache-2.0 | Multi-agent "AI workforce" desktop: parallel worker pool, task assignment across agents, M365 tool integrations | **TAKE (ideas)** — you have the fleet; the *worker pool concurrency* model is the gap |
| **OpenClaw** | MIT | A single personal agent reachable over **29 messaging channels** (WhatsApp, Telegram, Discord, Slack, iMessage), skill marketplace, full computer access | **ADAPT** — channel reach is the distribution lesson; you have BYOA/A2A but no messaging surface |
| **OpenWork** | MIT | Execution-plan timeline, skill manager, 75+ providers via OpenCode, BYO-key | **ADAPT** — the *plan timeline* UI beats a chat transcript for auditable work |
| **Orca** | MIT | Each agent in its **own git worktree** — parallel isolation without containers | **TAKE (pattern)** — cheap isolation for code missions |
| **Nimbalyst** | MIT (individual-use features — verify) | Claude + Codex side by side, embedded Monaco/Lexical editors, kanban/planning layer | **WATCH** |
| **Paseo** | **AGPL-3.0** | Mobile steering of agents | **SKIP code** — AGPL. Build your own mobile surface if needed |
| **Kuse / AionUi** | mixed | Rust-native core; CLI→GUI bridge for CLI-agent users | **INSPIRE** |

---

## 3. Computer-use & browser agents

| Project | License | Features worth absorbing | Verdict |
|---|---|---|---|
| **browser-use** | **MIT** | Full autonomy loop, Playwright/CDP, local models via Ollama, structured extraction | **TAKE (ideas)** — the autonomy loop pattern for your `pc.browser` plane |
| **Stagehand** | **MIT · TypeScript** | `act()` / `extract()` / `observe()`; **Zod-typed extraction**; hybrid AI+code — deterministic steps, AI only where selectors break | **TAKE** — same language as VH; the hybrid model is exactly your honest-hybrid browser philosophy, productised |
| **vercel-labs/agent-browser** | **Apache-2.0 · Rust** | Snapshot with element refs (`@e1`), **tab pinning** (two agents, one Chrome), dialog auto-handling, WebMCP, live viewport dashboard, activity feed, console capture, session providers (AgentCore/Browserbase/Kernel), CAPTCHA plugin hook, **WebSocket pair-browsing**, React introspection + Web Vitals, Windows job-object cleanup | **TAKE** — richest computer-use toolkit in the set; MIT-class license |
| **open-browser-use** | MIT | Browser-extension + CLI architecture, platform-neutral SDKs, skills packaging | **TAKE (pattern)** — distribute your browser plane as a skill |
| **Skyvern** | **AGPL-3.0** | Vision-first automation, Docker stack | **SKIP embed** — copyleft |
| **BrowserAct skills** | open (verify) | self-building web tools, stealth, session isolation, human-in-the-loop remote assist, **claims 90% fewer retry loops / 93% fewer tokens** vs raw HTML | **ADAPT (pattern)** — token cost of raw DOM is your `pc.browser` weak spot; distill DOM to refs |
| **Web Bot Auth** (IETF draft) | open standard | Cryptographic agent identity replacing IP-based bot verification; Cloudflare/Amazon/Akamai/OpenAI | **WATCH** — your ECDSA identity could speak this |
| **Agent Name Service (ANS)** | open standard | Agent naming, verification, discovery (Cloudflare + GoDaddy) | **WATCH** — pairs with your AgentCards |

---

## 4. Sandboxed execution & coding agents

| Project | License | Features worth absorbing | Verdict |
|---|---|---|---|
| **OpenHands** | **MIT** | **Event-stream architecture** (typed Action → Runtime → Observation), **microagents** (docs writer, test gen, security analyzer), hardened Docker default (`cap-drop ALL`, `no-new-privileges`), pluggable runtime backends (Docker / K8s / Modal / Daytona / remote API), VNC desktop, VS Code, RBAC + audit + SSO in OSS, agent hub, planning mode, LiteLLM 100+ providers | **TAKE** — best single reference for "how to sandbox an agent properly"; your exec backend should mirror their runtime abstraction |
| **Daytona / E2B / microsandbox** | Apache-2.0 | Sandbox-as-a-service, self-hostable | **TAKE** — E3 exec backend |
| **SWE-agent** | MIT | Minimal agent loop, strong benchmark discipline | **INSPIRE** |
| **Aider** | MIT | Repo map (codebase understanding), git-native edits | **TAKE (pattern)** — repo map for your coding missions |
| **Open Interpreter** | MIT | Local code execution semantics | **WATCH** |

---

## 5. Visual builders / workflow platforms (what NOT to become)

| Project | License | Features | Verdict |
|---|---|---|---|
| **Dify** | Apache-2.0 **+ no-multi-tenant-resale + no-logo-removal** | Visual agentic workflow DAG, knowledge base RAG UI, prompt versioning, annotation + eval, team workspace RBAC/SSO, plugin marketplace, native MCP, built-in traces | **TAKE (features), SKIP (embed)** — their license forbids reselling it as multi-tenant SaaS; and copying their shape would flatten your differentiation |
| **Flowise** | Apache-2.0 | Node canvas, LangChain components, MCP nodes | **INSPIRE** |
| **Langflow** | MIT | Component graph with custom Python nodes, embeddable in closed-source products | **INSPIRE** |
| **n8n** | **Sustainable Use License** (not OSI) | Huge connector catalog, workflow automation | **SKIP embed** — restricted license |

**Take from this category:** prompt versioning UI, annotation/eval loop, per-node debugging view, plugin catalog governance, "knowledge" as a first-class object. **Skip:** the canvas-as-product. Your differentiator is the proof chain, not a node graph.

---

## 6. Chat surfaces

| Project | License | Features | Verdict |
|---|---|---|---|
| **LibreChat** | **MIT** | Best-in-class multi-provider switching, **side-by-side model comparison**, prompt caching, agents + MCP + code interpreter, OAuth2/LDAP/email auth, RAG API, agent marketplace, presets | **TAKE** — commercially usable; the side-by-side compare is a genuinely good UI idea for your provider seam |
| **Open WebUI** | Modified (branding clause, not OSI) | Knowledge bases, 13 vector DBs, 8 extraction engines, hybrid search, channels/notes, RBAC/SSO/SCIM, Python tools/pipelines, in-browser Python | **ADAPT (ideas only)** — verify license before any code |
| **AnythingLLM** | MIT | Document → workspace RAG, simple mental model | **WATCH** |
| **SillyTavern** | AGPL-3.0 | Character/lorebook memory | **SKIP** |

---

## 7. Memory (you have a ledger; this is the *user-facing* layer)

| Project | License | Features | Verdict |
|---|---|---|---|
| **Mem0** | Apache-2.0 | **Four-scope memory** (user / agent / run / app), vector + optional graph, extraction pipeline | **TAKE** — the scope model maps cleanly onto your mission/user/specialist split |
| **Graphiti (Zep OSS engine)** | Apache-2.0 | **Temporal knowledge graph with validity windows** — "what was true when", entity invalidation | **TAKE** — the one capability your ledger lacks; pairs perfectly with receipts |
| **Letta (ex-MemGPT)** | Apache-2.0 | OS-style tiered memory (RAM/disk), agent edits its own memory, memory blocks | **ADAPT** — self-editing memory is powerful *and* dangerous: it belongs behind your gate |
| **Cognee** | Apache-2.0 | Document → knowledge graph, local-first, 28+ data sources | **TAKE** — enterprise doc ingestion path |
| **LangMem** | MIT | Memory as a library, LangGraph-native | **SKIP** (framework-coupled) |
| Benchmarks: **LongMemEval / LOCOMO** | — | Standard memory evals | **TAKE** — add as a probe suite so your memory claims are measured |

---

## 8. Security / guardrails / injection defence (absorb into `pc.exec` + prompts)

| Project | License | Features | Verdict |
|---|---|---|---|
| **NeMo Guardrails** | Apache-2.0 | **Colang DSL**, 5 rail types (input, dialog, retrieval, execution, output), jailbreak + injection rails, fact-check rails, **dialog-flow control** (topic boundaries, canonical forms) | **TAKE** — the only one modelling multi-turn flows |
| **Guardrails AI** | Apache-2.0 | Validator hub (PII, toxicity, format), automatic retry on validation failure | **TAKE** — "validators as an offerable hub" is a marketplace idea for you |
| **LlamaFirewall** | open (Meta) | **PromptGuard 2** (jailbreak), **AlignmentCheck** (audits the agent's own reasoning for goal hijack — catches novel injections), **CodeShield** (static analysis before code runs) | **TAKE** — AlignmentCheck is directly relevant: your specialists reason in the open, so audit the reasoning |
| **Llama Prompt Guard 2-86M** | open weights | Tiny injection/jailbreak classifier | **TAKE** — a fast pre-filter before any web content enters context |
| **garak** | Apache-2.0 | LLM vulnerability scanner | **TAKE** — run as a probe |
| **DeepTeam** | Apache-2.0 | Red-teaming: jailbreaks, multi-turn attacks, PII leakage | **TAKE** — multi-turn attacks are your blind spot |
| **LLM Guard** | MIT | Input/output scanning, secrets detection, data leakage | **TAKE** |
| **Cupcake** | open | **Deterministic policy enforcement over agent actions**, dangerous-tool-use blocking, weak-auditability fix | **TAKE** — closest cousin to your gate; steal its taxonomy of risky arguments |
| **AgentDojo** | open | Prompt-injection / tool-security benchmark suite | **TAKE as probes** — enterprises will ask |
| **MCPSecBench / MCPTox** | open | **MCP tool poisoning** attacks | **TAKE as probes** — you expose 20 MCP tools; this is a named risk class |
| **ShieldGemma 2** | open weights | Safety classifier for vision inputs | **WATCH** (if you add image input) |

---

## 9. Evals & benchmarks (and why you should sell *against* them)

| Benchmark | What it measures | 2026 state | Verdict |
|---|---|---|---|
| GAIA | general assistant, multimodal + web | ~74–80% (scaffolded vs bare model gap >30 pts) | reference only |
| WebArena | multi-app browsing | ~74% vs 78% human | reference only |
| OSWorld | real Ubuntu desktop control | agents now **beat** the human baseline (~82.6% vs 72.4%) | reference only |
| τ²-bench | tool use **+ policy adherence**, `pass^k` | ~0.62–0.77 pass^4 | **most relevant to VH** — policy adherence is your product |
| SWE-bench Verified | real bug fixing | ~94% | reference only |
| METR time horizons | 50%-success task length | ~2 hours | **SELL THE GAP** — enterprises want 8-hour work |

**The strategic finding:** Berkeley RDI's scanner agent reached **~100% on WebArena and ~98% on GAIA without solving a single task** — config leakage, answers shipped with the test, `eval()` on untrusted input. Their conclusion: *"If the agent can see the expected answer, the benchmark measures lookup speed, not capability."*

**Therefore:** public leaderboards are contaminated and gameable. Your **Drill** (a real mission, on a fresh real git repo, verified by *that repo's own test command*, vouched with an attestation digest) is the **anti-benchmark**. That is a product, not a feature: *"we don't publish a leaderboard; we reproduce your workload and prove it."* Add τ²-bench-style **pass^k** reporting ("ran it 4 times, passed 4 times") — nobody else reports reliability that way, and enterprises care about repeatability more than peak score.

---

## 10. Observability (absorb; do not become)

| Project | License | Features | Verdict |
|---|---|---|---|
| **Langfuse** | MIT core (EE extras paid) | Session tracing, prompt versioning + playground, LLM-as-judge, user feedback, annotation queues, datasets | **TAKE** — already your Phase-1 pick |
| **Opik** | Apache-2.0 | Dataset versioning, strong eval UX | **TAKE if you prefer OSS purity** |
| **MLflow Tracing** | Apache-2.0 | Tracing + evals + gateway + agent serving in one | **WATCH** |
| **Arize Phoenix** | ELv2 (server) | OTel-native, span-level retrieval visualisation | **self-host only** |
| **LangWatch** | Apache-2.0 | **OTel topology views of multi-agent handoffs**, trace→simulation | **TAKE (pattern)** — a topology view of your Mission Loop is a killer screen |
| **Latitude** | MIT (self-host) | **Automatic issue discovery from production traces** → closed loop to a PR via MCP | **TAKE (pattern)** — failures that become fixes |
| **AgentOps** | freemium | **Time-travel debugging** of agent runs | **TAKE (pattern)** — pairs with your Backtest Replay |
| Strategic note | — | **Langfuse was acquired by ClickHouse (Jan 2026)** | MIT core keeps you safe; still, keep an OTel-native path so no single vendor owns your traces |

---

## 11. Protocols (your A2A/MCP hosts are already ahead — fill the two gaps)

| Protocol | Steward | Purpose | Verdict |
|---|---|---|---|
| **MCP** | Anthropic → **Linux Foundation** (Dec 2025); ~97M monthly SDK downloads | agent ↔ tool | you have it; keep widening |
| **A2A** | Google → Linux Foundation; v1.0, 150+ orgs, AgentCard discovery, task lifecycle, OAuth 2.0 / mTLS | agent ↔ agent | you have it; adopt **v1.0 card signing** |
| **AG-UI** | CopilotKit, open | agent ↔ user, SSE event stream | **TAKE — missing inbound protocol.** Makes every AG-UI agent a BYOA citizen |
| **A2UI** | open | persistent agent ↔ UI **state sync** | **TAKE** — pairs with generative UI |
| **ACP** | IBM (BeeAI), Linux Foundation | RESTful agent communication | WATCH |
| **ANP** | community | decentralised agent networks, cross-org identity | WATCH |
| **AP2** | Google | agent **management** control plane | WATCH |
| **X42** | open | trust + governance for cross-boundary agent calls | **WATCH CLOSELY** — this is your territory; if it standardises, your receipts should speak it |

**Layering everyone converges on:** `AG-UI → A2A → MCP`. You are missing the top layer, which is exactly the layer your UI needs.

---

## 12. Agent identity (your ECDSA mandates, modernised)

| Item | What it gives | Verdict |
|---|---|---|
| **SPIFFE / SPIRE** (CNCF) | Cryptographic workload identity, short-lived attestation-based creds, no static secrets | **TAKE (pattern)** — issue short-lived run identities derived from your ECDSA root |
| **OAuth 2.1 + MCP authorization spec** | Delegated access to tools | **TAKE** — the standard way to reach third-party MCP servers |
| **ID-JAG (Cross-App Access)** | Enterprise brokering of delegation | WATCH |
| **OpenID AuthZEN** | Fine-grained authorization decision API | **TAKE (consider)** — a standard interface for your policy gate, if you ever want third-party PDPs |
| **Aembit "Blended Identity"** | Binds an agent's identity to its **sponsoring human** | **TAKE (concept)** — your missing link: an agent identity that provably belongs to a person |
| **Teleport Agentic Identity Framework** | Agents as first-class identities, per-session/per-tool MCP controls, **risk scoring + session summaries** | **TAKE (patterns)** |
| **Ping Agent IAM / Gateway / Detection** | Enterprise IAM for agents, privileged access for desktop agents | WATCH (competitor signal) |
| **Clerk agent toolkit** | OAuth DCR, consent, M2M auth | WATCH |

**The known friction everyone hits:** SPIRE's pre-registration model fits long-lived services, not dynamically spawned sub-agents. Your 1,150-specialist fleet spawns constantly — so a **derived, short-lived identity per mission** (your mandate → run SVID) is the right design, and it is a differentiator you can state plainly.

---

## 13. Agent payments — the opening nobody has closed

| Protocol | Steward | Layer | License |
|---|---|---|---|
| **AP2** (mandates are **W3C Verifiable Credentials**) | Google + 60 orgs | **authorization** — proof a human authorized this spend | Apache-2.0 |
| **ACP** | OpenAI + Stripe (+Meta) | checkout | Apache-2.0 |
| **x402** | Coinbase | HTTP 402 per-request settlement (stablecoins) | Apache-2.0 |
| **MPP** | Stripe + Tempo | machine-to-machine sessions with a locked spend limit | open |
| Visa TAP / Mastercard Agent Pay | card networks | crypto agent identity, tokens, issuer risk | proprietary |

**Industry's own summary of the state of play:** *"Payments are the solved part. The unsolved part is trust: proving who an agent acts for, what it may spend, and what it actually did."*

**That sentence is your product description.** Your ECDSA mission mandates already clamp scope/budget/depth. Aligning them with **AP2's mandate shape (W3C VC)** means VH's authority artifacts become interoperable with the payment layer everyone else is standardising on — and no OSS agent platform produces a signed, offline-verifiable authority-to-action chain. **TAKE: AP2-compatible mandate export.**

---

## 14. The compliance layer — where "why pay me" is actually answered

| Requirement | What the law asks for | What VH already has |
|---|---|---|
| **EU AI Act Art. 12 — record-keeping** | automatic logging of events over the system's lifetime; tamper-evident logs, SIEM-integrable, ≥6-month retention | signed receipts + ledger chains + `receiptToJsonl` |
| **Art. 14 — human oversight** | human intervention mechanisms; **cryptographically authenticated operator override**; kill switch | human gate, risk tiers, override floor that cannot be switched off |
| **Art. 11 / Annex IV — technical documentation** | versioned docs linkable to specific system versions and deployments | 41-point version-drift gate, release verification, byte-pinned bundles |
| **Art. 9 — risk management** | documented risk process, continuous scanning | risk tiers + (add) garak/DeepTeam/AgentDojo probe suites |
| **ISO/IEC 42001** | third-party-certified AI management system; evidence that risk decisions were made *on purpose* | evidence ledger, provenance self-proof, probes |
| **ISO 27001 / SOC 2** | security controls | partially; needs the vault + isolation work |

Hard facts to build the pitch on: **EU AI Act full enforcement begins 2 August 2026**; penalties reach **€35M or 7% of global turnover**; and per 2026 procurement guidance, *"If enterprise customers ask for your report before signing, ISO 42001 is already a revenue requirement — not a nice to have."*

**Ship this artifact: the "Evidence Pack".** One export per mission or per period containing: the receipt chain (offline-verifiable), every gate decision with its rule, every refusal in words, model/provider provenance, initiator attribution (*who was watching*), human-override events, version pins, and a retention statement. **This is what an auditor, a CISO and a procurement committee pay for — and it is the one thing no free agent can produce, because it requires a signed chain of custody plus someone contractually accountable for it.**

---

## 15. The verdict list — absorb in this order

| # | Absorb | From | License | Effort | Why now |
|---|---|---|---|---|---|
| 1 | Policy plane (fail-closed, CEL-subset, rule-named refusals) | CopilotKit | MIT | **built** | Loudest enterprise gap; kit ready |
| 2 | Initiator attribution + "Nobody watching" | CopilotKit | MIT | **built** | New differentiator, tiny effort |
| 3 | **Evidence Pack export** (Art. 12/14/11 mapping) | *your own moat, productised* | — | 1 week | **This is the paid product** |
| 4 | Tool narrowing (fail open) + MCP tool-poisoning probes | CopilotKit, MCPTox | MIT/open | 3 days | 20 MCP tools is past the reliable-tool ceiling |
| 5 | Shell-env allowlist for `pc.exec` | CopilotKit | MIT | 1 day | Security questionnaire value |
| 6 | DOM→refs distillation + snapshot/refs browser protocol | agent-browser, Stagehand | Apache-2.0/MIT | 1 week | Kills your browser token cost |
| 7 | Container/gVisor exec backend behind `pc.exec` | OpenHands, CopilotKit | MIT | 1–2 weeks | Containment answer for the CISO |
| 8 | Credential vault invariants (encrypted, never returned, redacted) | CopilotKit | MIT | 3 days | Blocker for governed connectors |
| 9 | AG-UI ingress + A2UI state sync | CopilotKit | MIT/open | 1 week | Distribution + your missing UI layer |
| 10 | Blended identity (agent ↔ sponsoring human), short-lived run SVIDs | Aembit, SPIFFE | Apache-2.0 | 2 weeks | Modernises your ECDSA mandates |
| 11 | Temporal memory graph ("what was true when") | Graphiti | Apache-2.0 | 2 weeks | Completes the evidence story |
| 12 | Injection defence: PromptGuard 2 pre-filter + AlignmentCheck on reasoning | LlamaFirewall | open | 1 week | Your specialists reason in the open |
| 13 | τ²-bench-style **pass^k** reliability reporting on the Drill | τ²-bench | open | 1 week | Nobody reports reliability; enterprises buy it |
| 14 | Routines (floor, cap, fatigue, skip-not-replay) | CopilotKit | MIT | 1 week | Unattended work — **only after #2** |
| 15 | AP2-compatible mandate export | AP2 | Apache-2.0 | 2 weeks | Makes your authority layer speak the payment standard |

**Do not absorb:** Dify's shape (license + flattening), n8n (Sustainable Use), Skyvern / Paseo / SillyTavern (AGPL), Open WebUI code (branding clause), any openbot.run code (PolyForm NC), CopilotKit Intelligence (licensed dependency), per-specialist containers (economics), their policy default `allow: ["true"]` (invert it).

---

## 16. Sources

CopilotKit/OpenBot (MIT; `docs/architecture.md`, `coworkers.md`, `configuration.md`, `routines.md`, `README.md`) · NorbertBodziony/openbot / openbot.run (PolyForm Noncommercial; ≤0.1.11 Apache-2.0) · browser-use, Stagehand, Skyvern, vercel-labs/agent-browser, open-browser-use · OpenHands, SWE-agent, Aider, Daytona, E2B · Dify, Flowise, Langflow, n8n · LibreChat, Open WebUI, AnythingLLM · Mem0, Graphiti/Zep, Letta, Cognee, LangMem · NeMo Guardrails, Guardrails AI, LLM Guard, garak, DeepTeam, LlamaFirewall, Llama Prompt Guard 2, Cupcake, AgentDojo, MCPSecBench/MCPTox · GAIA, WebArena, OSWorld, τ²-bench, SWE-bench Verified, METR, Berkeley RDI benchmark-exploit study · Langfuse, Opik, MLflow, Phoenix, LangWatch, Latitude, AgentOps, Helicone · MCP, A2A, AG-UI, A2UI, ACP, ANP, AP2, X42 · SPIFFE/SPIRE, WIMSE, OAuth 2.1 + MCP auth, ID-JAG, AuthZEN, Aembit, Teleport, Ping, Clerk · AP2, ACP, x402, MPP, Visa TAP, Mastercard Agent Pay · EU AI Act (Art. 9/11/12/14/17, Annex IV), prEN 18286, ISO/IEC 42001, ISO 27001 · open-source monetization research (2026).

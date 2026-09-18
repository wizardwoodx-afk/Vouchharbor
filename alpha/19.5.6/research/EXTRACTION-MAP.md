# EXTRACTION MAP — Vouch Harbor × CopilotKit/OpenBot × openbot.run

**Subject:** `wizardwoodx-afk/Vouchharbor` v19.5.4 "Reach" (proprietary, `LICENSE` = "All rights reserved")
**Goal:** lift working, mature OSS capability into your product **without touching your core** and **without contaminating your proprietary license**.
**Verified:** 18 Sep 2026, against each repo's `LICENSE`, `README`, `NOTICE`, `docs/`, and directory structure.

> Not legal advice. Every item below tells you *which file to read at which commit* before you take anything. Keep a copy of the upstream LICENSE you relied on, and record the commit SHA in your NOTICE. That record is what protects you later.

---

## 0. The verdict in one table

| Repo | License (verified) | Can it go into your closed-source product? | What to take |
|---|---|---|---|
| **CopilotKit/OpenBot** | **MIT © 2026 CopilotKit** — verified verbatim in `LICENSE` | ✅ **Yes.** Copy, modify, sell. Attribution only. | Policy plane, initiator-aware audit, isolation model, credential vault semantics, AG-UI. **This is your quarry.** |
| **openbot.run** (NorbertBodziony/openbot, Electron desktop) | **PolyForm Noncommercial 1.0.0** at HEAD. README: *"Commercial use requires a separate license from the copyright owner. **Versions up to and including 0.1.11 remain available under Apache-2.0.**"* | ⚠️ **HEAD: NO.** Only tags **≤ v0.1.11**, and only after you check that tag's own `LICENSE` file. | Almost nothing — different runtime (Electron ≠ Tauri). **Concepts only.** |
| **Vouchharbor** (yours) | Proprietary, all rights reserved | — | Nothing leaves. Everything only **lands** — behind flags, with probes. |

**The wire you nearly cut:** the current `openbot.run` desktop code is **PolyForm Noncommercial**. Pasted into Vouch Harbor it would make your proprietary product non-commercial, i.e. unsellable. The escape hatch is real but narrow: **tag ≤ 0.1.11 is Apache-2.0 per the author's own README.** If you ever want something from it, `git checkout v0.1.11` first and confirm `LICENSE` says Apache-2.0 *at that tag* — then cite the tag in your NOTICE.

**And the second wire, which is worse:** openbot.run's own README warns agents run with `danger-full-access` and `approvalPolicy: never`, and states *"Full local access is an explicit current product decision, not a security boundary."* That is the **exact opposite** of Vouch Harbor's thesis (gate before the act, receipt after). Copying their execution posture would delete your moat in one commit. Take their *ergonomics* (crash-safe FIFO queues with pause/resume, context compaction before the window exhausts, marketplace catalog, per-agent workspace isolation), never their *access posture*.

---

## 1. What you already own (do not dilute it)

Before extracting, be clear about what is already **ahead** of both OpenBots. Nothing below should be replaced by OSS:

| Vouch Harbor | OpenBot (CopilotKit) | openbot.run |
|---|---|---|
| **Offline-verifiable signed receipts** (SHA-256 + HMAC + Ed25519, zero-dep verifier) | Audit *rows* in Postgres (strong, but not independently verifiable offline) | None |
| **Ledger chains + Ghost Agent Sweep + Hindsight Ledger** | No equivalent | No equivalent |
| **Earned/revocable autonomy (90% exam), category-scoped** | No equivalent | No equivalent |
| **1,150 specialists with `byProvenance` self-proof + Captain synthesis** | ~10 example agents | Named agents, no fleet |
| **125 probe suites, 124 offline bundles, 41-point version-drift gate, byte-pinned bundles** | CI + tests (good, but not byte-pinned) | `bun run check` suite |
| **BYOA + A2A host + MCP router (6 governed tools)** | AG-UI + MCP + browser + shell | ACP/App-Server per CLI |
| **Tauri desktop, on-device, local-first** | Server + Docker + Postgres (+Helm) | Electron desktop |

You are **not behind**. You are behind on exactly four things: **declarative policy, unattended-run attribution, real isolation for computer-use, and a headless enterprise deploy path.** That's the whole extraction list, and CopilotKit/OpenBot is MIT-licensed on all four.

---

## 2. The extraction list — ranked, from CopilotKit/OpenBot (MIT)

Read the source first, at a pinned commit: `server/src/**` (Hono API — policy, audit, credentials), `server/tests/**` (their behaviour specs — the most valuable files in the repo), `agent-computer/**`, `docs/architecture.md`, `charts/openbot/**`.

### E1. Fail-closed declarative policy plane — **highest value, lowest risk**
**Source:** `server/src` policy engine + `docs/architecture.md` §Browser action governance.
**Their semantics, verbatim from the doc:** rules are CEL expressions with case-insensitive `contains()` / `matches()`; **deny rules evaluate before allow rules**; the engine **fails closed** — a missing or empty policy permits nothing, a broken deny rule denies, a broken allow rule does not permit, and a malformed configured policy **stops startup**. Policy fields include `tool.name`, `intent`, `bot.id`, `actor.id`, `page.url`, `page.host`, `element.*`, `key`, `command`, `file.*`, `mcp.server`, `mcp.tool`, `mcp.effect`, `initiator.kind`.
**Your gap:** you have risk tiers + a human gate that are **code-level and yours**. Enterprises want rules *they* author, review, diff, and hand to an auditor. That's a different artifact from "our gate is well-written."
**Where it clips onto VH:** one new module + **one call site** in the governed pipeline, immediately before dispatch (your `src/vh19/tools.ts` act/observe loop and the `pc.*` / MCP tool router). Your risk tiers stay authoritative — the policy plane is consulted *before* them, or alongside, never instead.
**Risk:** 🟢 new file, one call, flag `VH_POLICY_PLANE` default off. Core untouched.
**Effort:** 2–4 days incl. probe. **A starting implementation is in `extraction-kit/` (clean-room, zero-dep).**

### E2. Initiator attribution on every audit row + "Nobody watching" — **your best new differentiator**
**Source:** `docs/architecture.md` §What started a run. Four kinds: `person`, `deployment`, `routine` (id = the routine), `handoff` (id = the handing Bot). *"Nobody watching"* = `routine` + `handoff` — the question of *what ran on somebody's authority while they were away.*
**Why it's gold for you:** your entire pitch is accountable runs. Today you prove *what happened*. This proves *whether a human was present* — and it's filterable, auditable, and map it straight into your existing receipt digest. No consumer agent has it; almost no enterprise agent has it either.
**Where it clips onto VH:** the ledger/receipt writer and the Audit door. Additive field + one filter. Also threads naturally into your Shipyard work orders (each order gets an initiator) and any future Routines.
**Risk:** 🟢 additive field on rows you already write. **Effort:** 1–2 days. **Starter code in `extraction-kit/`.**

### E3. Real isolation for the computer-use plane — **your biggest enterprise exposure**
**Source:** `agent-computer/**` + supervisor. Their model: **one container per Bot**, own `/workspace` volume, own browser profile, `COMPUTER_TOKEN` required, compose binds it to `127.0.0.1`, the supervisor holds the Docker socket and is itself loopback-bound (`4500 host / 4300 container`) and exposes **only** ensure/stop/reset/list, the **database is on a separate Docker network** from anything with a shell, and `COMPUTER_RUNTIME=runsc` runs computers under **gVisor**.
**Your gap:** your own docs describe the computer-use plane as an *honest hybrid* (HTTPS fetch/snapshot, injectable transport, real-binary screenshots) with allowlisted bounded process execution, and `pc.exec` runs on the user's machine through the Tauri shell. That is defensible for a local-first single-user desktop. It will not survive an enterprise security review that asks *"what containment does agent-initiated execution have?"*
**Where it clips onto VH:** your tools are already discrete callables — so this is an **adapter swap behind the tool handler**, not a rewrite: `pc.exec` gets a second backend (`VH_EXEC_BACKEND=container|gvisor|host`), host stays the default. Their topology choices (loopback + token + socket-holding supervisor + split networks) port conceptually to Tauri/Docker on the developer's machine or to your future headless node.
**Risk:** 🟡 medium — *where* work executes changes, but nothing in your loop/policy/receipt chain does. Flag + fallback. **Effort:** 1–2 weeks.

### E4. Credential vault semantics
**Source:** `server/src` credentials + admin surface. Their rules: **encrypted at rest** under a `KEY_ENCRYPTION_KEY`, credentials are **never returned by an API**, and they are **redacted from audit events**. Plus per-person consent per plugin.
**Your gap:** you hold provider keys in memory (session) or OS keychain (durable). Governed *connectors* need a vault with those three properties, or enterprise review stops at "the agent can read third-party tokens."
**Where it clips onto VH:** new module behind your existing provider/connector seam. Your keychain stays the root of trust — you're adding envelope encryption + the never-return/always-redact invariants + a probe that greps audit output for key material.
**Risk:** 🟢 new module. **Effort:** 3–5 days.

### E5. AG-UI as a third inbound protocol — **distribution play**
**Source:** `agent-*/` — they ship adapters for LangGraph, CrewAI, Agno, ADK, AG2, Claude SDK, and a framework harness, all arriving on one protocol. Their line: *"the governance rides the protocol rather than the framework."*
**Your gap:** you have **BYOA** (your own registration) and **A2A** (outbound/peer). AG-UI is the *inbound* standard with a ready ecosystem of agents that would otherwise never reach your gate. Add it and every AG-UI agent on earth becomes a Vouch Harbor BYOA citizen — governed, receipted, risk-graded — with no work from its author.
**Where it clips onto VH:** a new ingress adapter next to your A2A host (`npm run host`), feeding the **same** gateway → risk tier → gate → receipt chain. Your `AskVH19`/Mission Loop never learns AG-UI exists.
**Risk:** 🟡 ingress only. Check the AG-UI spec repo's license for its SDK if you vendor it (the protocol itself is open; adopting a protocol isn't copying code). **Effort:** 1 week.

### E6. Routine model (standing instructions + schedule + owner attribution)
**Source:** `docs/routines.md` — standing instructions a Bot runs on a schedule, the worker that fires them, and **who they run as**.
**Your gap:** your Workflows door is mission-shaped. Routines are the *unattended* shape enterprises ask for next ("run the nightly audit, as me, on the record") — and they are only safe **because of E2**. Do E2 first; then Routines are a thin scheduler over your existing engine.
**Risk:** 🟡 new surface, no core change. **Effort:** 1 week.

### E7. Shell-env allowlist + gVisor option for computer commands
**Source:** `docs/architecture.md` §Computers — a command inherits **only** PATH, locale, terminal names and proxy vars (proxy userinfo stripped), with `COMPUTER_SHELL_ENV` naming anything else.
**Your gap:** `pc.exec` should inherit nothing by default. This is a 20-line hardening with outsized value in a security questionnaire.
**Risk:** 🟢 **Effort:** 1 day.

### E8. Headless / containerised deployment path
**Source:** `charts/openbot/**` (Helm), `Dockerfile` (single image carrying app+API+browser+optional PG), `docs/deployment.md` (image contents, minimum sizes, platform notes).
**Your gap:** you are desktop-first with an A2A host and MCP stdio. Enterprise on-prem buyers increasingly want "run it in our cluster, no desktop." A **Harbor Node** container — headless engine + MCP + A2A + policy plane + receipts, no UI — is the natural product extension, and their chart is a working reference for what a cluster actually needs.
**Risk:** 🟡 new artifact, additive. **Effort:** 2–3 weeks.

### What NOT to take (and why)

| Skip | Reason |
|---|---|
| **CopilotKit Intelligence** as your durable-thread/memory store | It's a managed/licensed service (their server refuses to start without `INTELLIGENCE_API_KEY`; managed **or** self-hosted). Adding a third-party entitlement to your runtime contradicts your local-first, "keys in memory only" honesty contract. Keep your own ledger. |
| **Their Postgres + Drizzle + Hono + K8s topology, wholesale** | That's a different product shape. Adopting it *is* changing your core. Take the **patterns** (separate data network, credentials invariants, supervisor API surface), not the stack. |
| **Their policy defaults** (`deny: []`, `allow: ["true"]`) | Their shipped startup default permits everything. Yours must be deny-risky-by-default — the opposite, deliberately. |
| **Their web framework / CEL npm dependency** | Your 124 offline bundles are **zero-npm-dep by design**. A policy evaluator that drags a runtime into those bundles breaks your own verification story. Use the clean-room, zero-dep evaluator in `extraction-kit/`, or add a full CEL library *outside* the offline bundles and keep a zero-dep subset for them. |
| **One Chromium container per specialist** (of your 1,150) | Their economics are ~10 Bots. Yours are 1,150. Isolate **per mission / per hand / per shipyard order**, not per specialist. |
| **Anything from openbot.run HEAD** | PolyForm Noncommercial. Non-negotiable. |
| **openbot.run's `danger-full-access` + `approvalPolicy: never`** | Actively anti-your-thesis. Their README states it is *not* a security boundary. |
| **Electron-specific code from ≤ v0.1.11** | Your shell is Tauri 2 (Rust). Electron main-process code doesn't run there. Even the Apache-2.0 window buys you little. Concepts only. |
| **Their brand** | "OpenBot", "CopilotKit", "OpenBots" — MIT gives you code rights, **not trademark rights**. Never imply endorsement; never ship their names in your UI. |

---

## 3. Your red wires — the files nobody touches

Every extraction above must leave these byte-identical:

| Red wire | Why |
|---|---|
| `src/mission/missionLoop.ts` | The engine cycle (COMPOSE→DISPATCH→COMMUNICATE→EXECUTE→GATE→ADAPT). Any change here invalidates 125 probe suites and your release verification record. |
| `src/vh19/generalist.ts` (`askVH19`), `agentLoop.ts`, `tools.ts`, `synthesis.ts`, `captains.ts`, `tokenOptim.ts`, `liveData.ts` | The door, the act/observe loop, the gated tools, Captain synthesis, budget fitting, the GuardRail. This **is** the product. |
| Receipt / authority protocol (`vh-proof-receipt/2`, ECDSA P-256 mandates, `authority.*`) | Your moat, and it's cryptographically pinned. Extensions **append** fields; they never reshape the canonical form. |
| RSIRALS v5.0 governance plane + self-evolve floor | "Tighten only, never loosen" is enforced by unrepresentability. Don't hand new code write access to it. |
| `probe/**` (125 suites) + `verify/**` + `src/version.ts` + manifests | Append **new** probes. Never edit an existing probe to make an integration pass — that's how a verification culture dies. |
| `NOTICE`, `LICENSE` | Only ever *added to*, never weakened. |

**Integration rules (mirroring your own culture):**
1. One extraction = one branch = **one flag** (`VH_POLICY_PLANE`, `VH_EXEC_BACKEND`, …), default **off**, old path intact.
2. Every extraction ships **a new probe suite** in your style, and the version-drift gate picks up any new dependency.
3. Vendored third-party code goes under `vendor/<name>/` **with its LICENSE verbatim and a NOTICE row** — exactly the pattern your existing NOTICE already documents for `mcp-servers-reference` and `mcp-github`. Extend that mechanism; don't invent a second one.
4. Record upstream **commit SHA** (not "latest") next to each NOTICE row.
5. Clean-room reimplementations (like `extraction-kit/`) are labelled as such in the header, with a link to the doc they implement. Two legitimate routes — verbatim vendor, or clean-room — but never blur which one a file is.
6. Nothing you add may appear in the canonical receipt form. Receipts describe *what the engine did*, not what tooling observed it.

---

## 4. Order of work

```
Week 1   E1 policy plane (module + 1 call site + probe)      ← closes the loudest enterprise gap
Week 1   E2 initiator attribution + "Nobody watching"        ← new differentiator, tiny effort
Week 2   E7 shell-env allowlist                              ← 1 day, big questionnaire value
Week 3-4 E4 credential vault semantics + probe
Week 5-6 E3 container/gVisor exec backend (flag, fallback)
Week 7   E5 AG-UI ingress                                    ← distribution
Week 8   E6 Routines (unattended runs, now safe because E2 exists)
Week 9+  E8 Harbor Node headless container + chart
```

Two hard precedences: **E2 before E6** (never ship unattended runs you can't attribute), and **E1 before E3** (policy must be able to refuse the sandbox's tool calls before you point it at real machines).

---

## 5. Provenance to add to NOTICE

```md
| Path | Upstream | Commit | Licence |
|---|---|---|---|
| `src/governance/policyGate.ts` | clean-room implementation of the policy semantics documented in CopilotKit/OpenBot `docs/architecture.md` | <sha of the doc you read> | MIT © 2026 CopilotKit — semantics, no code copied |
| `vendor/<name>/…` | <upstream repo> | <tag or SHA> | <LICENSE verbatim, shipped alongside> |
```

**Attribution header for anything MIT-derived:**

```ts
/**
 * Portions derived from CopilotKit/OpenBot (https://github.com/CopilotKit/OpenBot),
 * MIT License, Copyright (c) 2026 CopilotKit. See NOTICE. Upstream commit: <sha>.
 * Modified for Vouch Harbor: <what you changed>.
 */
```

---

## 6. Sources verified for this map

- Vouchharbor `LICENSE` (all rights reserved), `NOTICE` (vendor policy), `package.json` (v19.5.4, Tauri 2, Vite 6, React 18, MCP SDK, Playwright, Zod, Zustand), `README.md`, `FEATURES.md`, `src/` tree.
- CopilotKit/OpenBot `LICENSE` (MIT © 2026 CopilotKit), `docs/architecture.md` (gateway sequence, policy semantics, computers, initiator kinds), `docs/README.md`, `server/` tree (`src`, `drizzle`, `tests`, `Dockerfile`), `agent-*` adapters, `charts/openbot`.
- openbot.run `README.md` (PolyForm Noncommercial 1.0.0; ≤ 0.1.11 remains Apache-2.0; `danger-full-access`; `approvalPolicy: never`), licence badge, releases policy.

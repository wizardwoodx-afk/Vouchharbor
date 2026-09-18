# Vouch Harbor 19.5.4 [Alpha] "Bridge" — feature sheet

**One agent at the front door. A fleet behind it. And — for the first time in this category — two people's agents working directly with each other, with a receipt both sides hold.**

> This is an **alpha** of 19.5.4. It pages on top of the released 19.5.4 "Reach" and changes nothing in the released engine: every new capability is additive, flag-guarded, and revertible by config. Turn them all off and you have exactly 19.5.4 "Reach".

---

## 0. Read this first: what makes Vouch Harbor different

Every agent product on the market answers one of two questions.

- **"How do I let an agent near my tools?"** → governance. Others answer this well.
- **"How do I run many agents all day?"** → orchestration. Others answer this well.

Almost nobody answers the third one:

> **"How do I prove to somebody else what my agent did?"**

An audit trail in someone's database answers it for *them*. A signed artifact that verifies **offline, without us, without trusting us**, answers it for **anyone** — an auditor, a regulator, a counterparty, a customer. That is this product, and everything below serves it.

**Vouch Harbor 19.5.4 [Alpha] in five sentences:**

1. **Your agent works with their agent.** Not two users sharing one agent — two *different users'* agents, in different harbors, negotiating directly, with a receipt **co-signed by both sides**.
2. **You can watch it work and take the wheel** — through a *beacon*, not an eye, and while you drive the agent is **refused, not queued**.
3. **Memory that keeps time and knows whose it is** — five scopes including the one that belongs to two users jointly, and cuts that are always marked.
4. **A policy plane that fails closed** — rules a CISO can read, diffs and signs; a malformed policy refuses to boot; a denied action provably has no side effects.
5. **An Evidence Pack** — one artifact mapping the period to EU AI Act Art. 11/12/14, ISO 42001 and NIST AI RMF, with **declared gaps**, verifiable from its own bytes.

---

## 1. Agent Bridge — two users' agents, working together ⭐ *the flagship*

**What it is.** A user's agent offers a *capability* to another user's agent, on another harbor. They negotiate, the work crosses an owner boundary, and both sides end up holding a receipt signed by both parties.

**Why it is not just "sharing".** Sharing means one agent, two people watching. This is two *principals* — two owners, two trust roots, two policy planes, two ledgers — and the crossing is governed on **both** sides. Neither side can rewrite what happened, because each holds its own copy of the same co-signed bytes.

### 1.1 Nothing crosses as free text
A handoff is a **typed envelope** (`vh-bridge-envelope/1`): capability, task, bounds, and **the shape of a good answer** (deliverable, must-include, must-avoid). Free text is how a handoff goes quietly wrong — the receiver infers the intent, guesses the constraints, and when it guesses wrong it does not fail, it answers *something else confidently*.

### 1.2 Negotiation can only narrow
Every crossing intersects `what you offer` ∩ `what they can do`. There is **no code path that grants**. The panel shows closed cells too, because a grid that hides refusals teaches nobody which door to knock on.

### 1.3 Bounds travel with the request and are enforced by the deployment
`maxDepth`, `maxCostMinor`, `deadlineIso`. A hop that runs out of depth or time is **refused, not truncated** — a silently shortened envelope arrives looking complete.

### 1.4 Pair trust — a relationship, not a permission
Each pair has a trust score with a stated lifecycle:

| Event | Effect |
|---|---|
| jointly co-signed success | **+6** |
| joint failure | **−8** |
| refused by policy | **−3** (a cause is **required**) |
| refused by peer | **−2** (a cause is **required**) |
| disputed — a co-signature failed to verify | **−20** |
| revoked by an owner | flattens to 0 and **locks**; only an explicit re-vouch reopens it |

Trust also **decays** (4 points per 30 idle days, applied on read, never written back — the stored ledger always says what actually happened), and the tier decides what is allowed:

| Tier | Score | What it permits |
|---|---|---|
| none | 0 | nothing; the pair is revoked |
| read_only | 1–34 | may receive summaries; may not hand work back |
| supervised | 35–69 | may hand back one hop, with a human approving the first crossing |
| standing | 70–100 | may hand back and forth up to two hops unattended |

### 1.5 The joint receipt
`vh-bridge-joint-receipt/1` — one record, both signatures, over the same canonical bytes. It carries a **digest of the answer, never the answer**: content stays on the owner's side. A signature that fails verification is **reported as a failure, never repaired**.

**What a probe proves:** 60 checks, including "a tampered receipt fails verification", "a refusal never produces a half-made receipt", "a refusal without a cause is refused", and "a revoked pair refuses further scoring until an owner re-vouches".

---

## 2. The Beacon — watch the work, take the wheel

Several desktop agents show the running browser behind an **eye icon**. An eye means *something is watching you*. A harbor light means the opposite: **where the work is, and whether anything is still moving.** So Vouch Harbor ships a **beacon** — tower, beam, and state — drawn from geometry in `ui/Beacon.tsx`. No icon font, no borrowed asset, no third-party package.

Six states, each with a **word** rather than only a shade: `dark` · `steady` · `flickering` · `waiting` · `human` · `halted`.

**The rules that make watching governance instead of surveillance:**

- **The window is a window; the record is the ledger.** The activity feed is for whoever is watching now. The audit trail is what an investigation reads later. The product never pretends the stream is evidence.
- **A saved file shows its path and size, never its content.** An agent may be handling something it was told in confidence. Same rule for commands: flagged arguments are redacted before they reach the feed.
- **While a person drives, agent actions are refused, not queued.** A queued action that fires the instant you release the wheel is exactly the surprise the human gate exists to prevent.
- **A stall is an event.** Nothing happening leaves no trace of its own, so the absence is written down: a run that stops producing reads as *flickering* and is reported.

---

## 3. Memory Channel — five scopes, kept time, marked cuts

Today's memory is a local ledger and learned briefings. The Memory Channel gives it **structure** without giving up the honesty contract.

**Three additions:**

1. **Scope.** `run` · `agent` · `user` · **`pair`** · `org`.
   The **pair** scope is ours alone: **the memory of a cross-user collaboration** — what Alice's agent and Bob's agent learned together, owned by neither one. No other agent platform can have this scope, because no other platform has the bridge.
2. **Kept time.** A fact is true over an *interval*, not forever. Superseding closes the old fact (`validToIso` + pointer forward) instead of deleting it, so **"what was true in March" stays answerable**. The channel can be asked `asOf` any instant.
3. **The channel.** Context is assembled under an explicit token budget, in a fixed priority order (pinned → narrower scope → confidence → recency), and **anything dropped is reported in words**. Vouch Harbor's token optimizer already refuses silent cuts; the memory channel obeys the same rule rather than inventing a second one.

**Two doctrines carried over:** *evidence before claims* — a `pair`- or `org`-scope fact **must** cite evidence, because another person will rely on it; and *no credentials in memory* — a value that looks like a key, a PEM header or a card number is refused entry to the channel.

---

## 4. Policy Plane — rules a CISO can read

Absorbed from CopilotKit/OpenBot's documented semantics (**MIT**), reimplemented clean-room and zero-dependency so it never enters your offline verification bundles.

- **Fail closed, always.** A missing or empty policy permits **nothing**. A broken deny rule **denies**. A broken allow rule **does not permit**. A malformed policy **refuses to boot**.
- **Deny before allow**, every time.
- **Refusals name the rule that caused them** — "*Refused: rule `contains(command, "rm -rf")` denies this action*" — and the refusal appears in the audit trail, in the beacon feed, and in the Evidence Pack.
- Rules read `tool.name`, `command`, `file.path`, `page.host`, `mcp.server`, `mcp.tool`, `mcp.effect`, `risk.tier`, `mission.id`, `actor.id`, and `initiator.kind`.
- **Two audit rows per action**: the decision, then the outcome. A denied action **cannot** have side effects — the executor is never invoked. A probe mutation proves it.
- The shipped default is **deny-risky**, deliberately the inverse of the allow-everything default most platforms ship.

**Try it:** `npx tsx probe/policyGate.test.ts` → 59 checks.

---

## 5. Evidence Pack — the artifact you get paid for

One export, per mission or per period: the page an auditor reads first.

**Contents:** receipt chain (offline-verifiable) · every gate decision with the rule that decided it · refusals in words · **initiator attribution** (who was watching) · human-override events · model and provider provenance · version pins · retention statement · **declared gaps**.

**The compliance mapping, and it does not overstate itself:**

| Clause | Coverage | Substantiated by |
|---|---|---|
| EU AI Act **Art. 12** — record-keeping | ✅ covered | receipts + digests + joint co-signatures |
| EU AI Act **Art. 14** — human oversight | ✅ covered | gate decisions, overrides, initiator attribution |
| EU AI Act **Art. 11 / Annex IV** — technical documentation | ⚠️ **partial** | version pins; the design narrative lives in the release docs |
| EU AI Act **Art. 9** — risk management | ⚠️ **partial** | refusal trace; the written process is organisational |
| **ISO 42001** A.6 / A.8 | ✅ covered | decisions carry the rule that decided them |
| **ISO 27001** A.8.15 / A.8.16 | ✅ covered | digests protect log integrity without trusting the logging host |
| **NIST AI RMF** MEASURE 2.7 / MANAGE 4.1 | ✅ covered | provenance rides with each receipt |

**A gap is a feature.** Unsigned receipts, a joint receipt with one signer, retention below 180 days, missing version pins, an empty decision set — each is **listed as a gap** rather than glossed over. A pack that claims coverage it does not have is worse than no pack.

**Verifiable from itself.** The digest is computed over canonical content, so a recipient with the bytes and the verifier confirms nothing changed — **without calling us and without trusting us**. `verifyEvidencePack()` reports "a tampered pack fails verification" as a probe.

---

## 6. The fleet — 1,350 specialists

**19.5.4 [Alpha] adds 200** (`catalog/federationBatch.ts`), taking the registered fleet from 1,150 to **1,350**.

**How this batch is built, and why it is built this way.** A bridge is only useful if the far side has real depth to call on: a crossing must land on a specialist who knows the domain, not a generalist improvising. So the batch grows by **breadth with structure** — **40 broad domains × the five stations of the mission cycle = 200**:

| Station | Risk tier | What the specialist does |
|---|---|---|
| **triage** | safe | states the ask in one line, names what would make it wrong, refuses to start without a stated success test |
| **research** | standard | files evidence before the claim, dates every live source, marks what it could not verify |
| **execution** | elevated | gates every risky move, mints a receipt per tool call, reports failures in words |
| **verification** | standard | checks the work against the success test and the receipt chain; says plainly what it could not confirm |
| **ledger** | safe | writes the outcome, the refusals and the open questions into the ledger |

Each station **hands to the next** (`triage → research → execution → verification → ledger`), which mirrors the engine's own cycle — so a cross-user request can enter at any station and still travel a defined path. That is what *alignment* means here: the new 200 are wired into the same pipeline, the same gate, and the same receipt protocol as the existing 1,150.

**Risk follows the work, not the vertical.** The station sets the floor, because the *work* is what a gate sees — reading and recording are safe, executing never is — and a regulated domain then raises the floor of the stations that touch it: its `execution` specialists become `regulated` and its `verification` specialists rise to `elevated`. The rule is exported as `riskForStation()`, so the data is **checked against the rule** in a probe rather than merely described by it.

**Tier census:** 80 safe (triage + ledger across all 40 domains) · 61 standard · 40 elevated · 19 regulated — 200 in total.

**Domains (40):** banking operations · payments & settlement · insurance underwriting · insurance claims · wealth & asset management · corporate treasury · trade finance · retail banking compliance · healthcare revenue cycle · clinical research operations · pharmacovigilance · medical device quality · public health reporting · legal contract lifecycle · litigation support · intellectual property · data protection & privacy · procurement & sourcing · supply chain logistics · warehouse & fulfilment · manufacturing quality · industrial maintenance · energy grid operations · oil & gas asset integrity · renewables & carbon accounting · utilities billing · telecom network operations · telecom revenue assurance · aviation maintenance · maritime freight · rail operations · automotive fleet · construction project controls · real estate portfolio · agritech yield · food safety · mining safety · public sector casework · defence logistics sustainment · higher education accreditation.

**Every entry declares** `provenance: 'federation-batch'`, so `federationStats().byProvenance` self-proves the count — **the number on screen is the number in code**.

**The batch is generated, not typed.** Two hundred hand-written records drift: one eventually gets a tier that does not match its station, or a station that hands to the wrong place, and nobody notices because nobody reads 200 records. So the data comes from one table in `tools/generate-federation-batch.mjs` — 40 domains × 5 stations — and `node tools/generate-federation-batch.mjs --check` exits non-zero the moment the file on disk stops matching that table. That command is wired into the pre-pack checklist alongside the probes. The generated file was verified **byte-identical** to the data it replaced.

---

## 7. What 19.5.4 [Alpha] also did: polished what already existed

| Area | Change |
|---|---|
| **Governance** | one module boundary — `PC_EXEC`, MCP and browser tools all reach the same policy plane through the same call, so the rule that denies is the rule that is shown |
| **Audit** | two rows per action instead of one; refusal coverage is now a measured number (X of Y refusals name their rule) rather than an assurance |
| **Beacon feed** | redaction moved into producers (`describeCommandEvent`, `describeFileEvent`) so a credential cannot reach the window by accident |
| **Memory** | the token optimizer and the memory channel now share one rule — a cut is always marked, never silent |
| **Probe culture** | new suites are additive; **no existing probe was edited to make a new feature pass** |
| **Docs** | this sheet, plus version and manifest alignment across every surface |

---

## 8. Everything from 19.5.4 "Reach" is still here

The 1,150-specialist fleet with `byProvenance` self-proof · the VH-19 Generalist front door with the MoE-style router showing its decision · Captains · the Shipyard with per-domain work orders · RSIRALS v5.0 with the frozen governance plane · **ECDSA P-256 portable authority mandates** · signed offline-verifiable receipts (SHA-256 + HMAC + Ed25519, zero-dep verifier) · **VouchMesh** local collaboration trust fabric · A2A v1.0 host with JWS-signed agent cards · MCP router with six governed `Agent Reach` tools · the 90% autonomy exam with category-scoped grants · Ghost Agent Sweep · Backtest Replay Bench · Hindsight Ledger · the Drill · Team-Evolve with every-member approval · the Horizon token sheet pinned by `probe/theme` · 125 probe suites and 124 zero-dependency offline bundles.

---

## 9. Running it

```bash
npm install
npm run dev            # web on :5173, opens on the VH-19 door
npm run tauri dev      # native desktop
node tools/run-all-probes.mjs           # every suite, one table, one exit code
node tools/generate-federation-batch.mjs --check   # has the fleet drifted from its table?
```

The five suites this increment adds, and what each one actually ran:

| Suite | Checks | What it grades |
|---|---|---|
| `probe/policyGate.test.ts` | **66** | fail-closed rules, deny-before-allow, refusals that name the rule, no side effects on denial |
| `probe/bridge.test.ts` | **84** | envelope typing, intersect-only negotiation, bounds, trust lifecycle and decay, joint receipts, tamper detection |
| `probe/memoryChannel.test.ts` | **48** | five scopes, supersession, `asOf`, evidence requirements, secret guard, budgeted cuts |
| `probe/beaconEvidence.test.ts` | **84** | six beacon states, refuse-not-queue, stall reporting, redaction, pack contents, gap honesty, offline digest |
| `probe/federationBatch.test.ts` | **50** | the +200: count, domains, station chain, tier rule, capability vocabulary |

**332 checks, all green.** TypeScript compiles the whole increment under `strict` **and** `noUncheckedIndexedAccess` with zero errors (`tsc -p tsconfig.alpha.json`).

Preview the new surfaces without building: open **`ui/preview.html`** — self-contained, no network, no build step.

---

## 10. Flags — every new capability is off until you say so

| Flag | Default | Turns on |
|---|---|---|
| `VH_POLICY_PLANE` | off | the policy plane in front of tool dispatch |
| `VH_BRIDGE` | off | cross-user agent crossings |
| `VH_BRIDGE_REQUIRE_HUMAN_FIRST` | **on** | a human approves the pair's first crossing, whatever the score |
| `VH_MEMORY_CHANNEL` | off | scoped, temporal memory and budget-fitted context |
| `VH_EVIDENCE_PACK` | off | Evidence Pack export |
| `VH_BEACON` | off | the watch panel and wheel handover |

With every flag off, behaviour is byte-for-byte 19.5.4 "Reach". That is the promise that makes an alpha safe to run.

---

## 11. What this alpha does **not** do yet — said plainly

- **No live video of the browser.** The beacon reports state, activity and handover; the streamed viewport is designed, not shipped.
- **Pair trust is local-first.** Both harbors compute a score from the crossings they saw; there is no shared trust registry, and there will not be one by default — a registry you must trust is a weaker claim than a receipt you can verify.
- **The Evidence Pack maps clauses; it is not a certification.** ISO 42001 is awarded by an accredited third-party auditor, not by software.
- **Bridge crossings are human-approved at the first crossing** regardless of trust. Loosening that is an owner decision, not a default.
- **The federation batch is 200 specialists, not 200 specialists with execution receipts.** They are registered, doctrinally specified and station-aligned; their individual probe suites land in the next increment.
- **This is an alpha.** APIs in the new modules may change before 19.6. The released 19.5.4 engine is untouched.

---

## 12. How this increment was verified — not "tested", *checked*

A product that sells verification should show its own. Every claim below is reproducible from this archive.

**1. It compiles under the strictest settings this project uses.**
`tsc -p tsconfig.alpha.json` — `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `useUnknownInCatchVariables`. **0 errors** across `src/**`, `catalog/**`, `probe/**` and `ui/**`.

**2. Every suite passes.**
`node tools/run-all-probes.mjs` → **332 checks passed, 0 failed, 0 suites not green**, exit code 0.

**3. The suites have teeth, and that was measured too.**
Ten deliberate breakages were introduced into a copy of the tree, one at a time, and **all ten were caught**:

| Breakage introduced | Caught by |
|---|---|
| pair trust starts at 75 instead of 20 (a new peer would arrive "standing") | bridge |
| negotiation intersects only `offers`, neglecting `canDo` | bridge |
| a person at the wheel no longer refuses the agent | beacon |
| `redactCommand` becomes a no-op (a credential would reach the feed) | beacon |
| refusal coverage is *assumed* rather than measured | evidence |
| `looksLikeSecret` stops guarding | memory |
| a superseded fact is deleted instead of closed | memory |
| `asOf` returns the present instead of the past | memory |
| one specialist hands to the wrong station | federation |
| every policy-syntax refusal turned into a no-op (all seven sites) | policy gate |

**3b. The +200 are reproducible.**
`node tools/generate-federation-batch.mjs` rewrote `catalog/federationBatch.ts` **byte-identical** to the hand-built file it replaced, and `--check` proves it stays that way. Data that cannot be regenerated is data nobody dares touch.

**4. Three real bugs were found by the probes during this build, and fixed rather than explained away.**
- `redactCommand`'s replacement callback read the regex *offset* as a capture group, so a bare `sk-…` key was re-emitted verbatim — precisely the leak the function exists to prevent.
- `mayAgentAct` permitted agent action while a run was stopped waiting for a person's answer — an agent acting around the question it had just asked.
- The federation batch tiered specialists by *domain* while the documentation tiered them by *station*, so a triage specialist in banking carried a `regulated` tier it had no business carrying. The rule is now a function, the data follows it, and the probe checks the data against the rule.

**5. The window is not the record, and the product says so in code.**
`BeaconSnapshot.window` holds the recent tail; `BeaconSnapshot.seen` counts everything recorded. The audit trail is the governance ledger, which the beacon reads and never replaces.

**6. What was *not* verified is written down too.** See §11. The 200 specialists are registered and doctrinally specified; their per-specialist execution suites land next. No live viewport is claimed. No claim in this sheet is stated more strongly than the evidence behind it.

# Vouch Harbor 19.5.4 "Reach" — feature sheet

**One agent at the front door, the whole governed harbor behind it.**

## 0. What 19.5.4 ships (the current release)

```
                    VH-19 GENERALIST (minimal premium door)
                           │
                 ┌─────────┴─────────┐
                 │                   │
          1,150 Specialists     Team / A2A / BYOA
                 │                   │
                 └─────────┬─────────┘
                           │
                      RSIRALS v5.0 (frozen governance plane)
                           │
                  Authority — ECDSA P-256 mandates
                           │
                     Intent / Receipts
                           │
                    VouchMesh (local trust fabric)
                           │
                  Agent Reach MCP (primary default MCP)
                           │
                 Computer Use / governed browser
```

- **The 1,150 fleet** — 460 seed + 160 broader + 140 reach + **390 matured**
  specialists across 14 categories, each matured specialist individually
  specified with named doctrine plus the uniform maturity contract (evidence
  before claims, gate on risky moves, receipts on every tool call, failures
  in words). Every domain has exactly one Captain (14/14). Composition is
  self-proving from `catalogStats().byProvenance` — the number on screen is
  the number in code.
- **Agent Reach MCP — the app's primary default MCP server** (in-app +
  stdio), exposing exactly six tools: `pc.exec`, `pc.browser.open`,
  `pc.browser.screenshot`, `authority.issue`, `authority.verify`,
  `authority.lookup`. Every call rides the governed pipeline:
  risk tier → human gate → receipt.
- **The computer-use plane** — allowlisted, injection-scanned, bounded
  process execution; an honestly HYBRID browser (HTTPS fetch/snapshot,
  injectable transport, real-binary screenshots — refusals in words, never a
  faked page); central egress guard plus a stricter navigation rule for the
  browser plane.
- **Portable authority (ECDSA)** — owner-granted P-256 mission mandates with
  clamped scope/budget/depth; `authority.issue` enforces mission-context
  equality; a wrong owner passphrase is a HARD unlock failure (sealed keys
  are never replaced); verification works with the public key alone. The
  Generalist never self-grants broad authority — finished runs carry a run
  attestation bounded to what actually executed.
- **VouchMesh — the local collaboration trust fabric**, wired into the live
  A2A handoff seam: every delegated handoff produces a joint receipt
  co-signed by both participants; pair trust compounds across sessions;
  refusals move trust down. Canonical scope, stated everywhere: **VouchMesh
  is the LOCAL collaboration trust fabric; ECDSA provides portable authority
  across instances** — both sides of a handoff are minted inside one VH
  runtime, and no cross-instance handshake is claimed.
- **CSPRNG mission ids** — `crypto.randomUUID()` / `getRandomValues()`,
  122 bits of randomness per id; never text-derived, never a non-crypto RNG.
- **Verification as a shipped product** — **125 probe suites**, **124
  self-contained offline bundles** (`node verify/run.mjs`, zero npm deps),
  41-pinned version-drift gate, byte-pinned engine bundles (MCP host + A2A
  host recompute checks), offline-verifiable receipts.
- **Native identity** — Vouch Harbor namespace end to end (`vh.sqlite`
  migrated in place, `vh-desktop` keychain with legacy read-fallback,
  `vh://event`), owner private keys never plaintext at rest.

Gates at 19.5.4: tsc 0 · fleet 125/125 · offline 124/124 · door 70/70 ·
agentic test 24/24 · reachPlane 31/31 · meshRuntime 17/17 · versionDrift 41/41.

*Everything below the line is the lineage record — accurate for the release
named in each section heading.*

---

## A. VH-19 — the Generalist front door (the primary UI)

```
User (VH-19 door — the app opens here)
   ↓
GuardRail content gate
   ↓
MoE-style router → specialist bench (1,150 registered specialists, 14 categories)
   ↓
Human gate (risky/critical work pauses; modal blocks the run)
   ↓
REAL provider execution (OpenAI-compatible / Anthropic / Gemini)
   ↓
Honest outcome: answered · planned · refused · gated-out · error · peer-delegated
   ↓
user Accept / Reject (+ why) → local learning memory
   ↓
90% autonomy exam → earned, revocable autonomy (override permanently on)
```

- **One conversation, one agent.** The user never picks specialists; the router
  shows its decision (who, why, scored how) on every message.
- **Nothing overstates itself.** No provider key ⇒ a plan in words, `executed:
  false`. No gate ⇒ risky work refused. No A2A bridge ⇒ nothing sent. Every
  response carries a provenance digest over its canonical form.
- **The bench is manageable.** Enable/disable any specialist; the router only
  fields the enabled bench, and the count on screen is the real count.
- **Cross-user Team-Evolve (18.1.0).** Joint runs are recorded with real
  outcomes; evolution proposals come only from verified history; adoption
  requires EVERY member's explicit approval (partial/duplicated/outsider
  approvals refuse); the evolved config leans on routing with a visible
  label; revocation is one click. `probe/teamEvolve` pins all of it.
- **Category-scoped autonomy (18.1.0).** Exams can be scoped to one category
  and a grant covers only that category; the gate consults the scoped grant;
  the override floor is unchanged.
- **Learning is local-first.** Accepts, rejects and corrections with reasons
  feed the briefings; cloud sync is opt-in and honestly non-operational until
  it ships with per-user encryption.
- **The 90% exam is real.** Questions come ONLY from the user's own recorded
  scenarios; the agent proposes AND explains each answer; ≥90% earns autonomy
  on safe-tier work; the monitor + override floor cannot be switched off, and
  revocation is one click, no exam required.
- **Providers, honestly.** Session keys live in memory only (and say so);
  durable keys go through env (`VH_OPENAI_API_KEY` / `VH_ANTHROPIC_API_KEY` /
  `VH_GEMINI_API_KEY`, base URLs overridable) or the keychain-backed Providers
  desk. SSRF guard on every base URL; keys are redacted from every error path.

## B. The proven engine behind the door

```
VH-19 door → askVH19 (src/vh19/generalist.ts)
Harbor/Helm → HarborProvider (src/app/harbor.tsx) → Vouch engine → bridge
           → REAL Mission Loop (src/mission/*) → receipts / gates / MCP / drill
```

- No view bypasses the bridge — every read and action goes through the real
  runtime; the shell probes enforce it.
- One engine, one cycle: COMPOSE → DISPATCH → COMMUNICATE → EXECUTE → GATE →
  ADAPT, one signed receipt per cycle (`vh-proof-receipt/2`).
- MCP capability router: 20 governed tools over stdio, risky calls non-blocking
  at the human gate, a receipt for every completed call.
- A2A v1.0.0: JWS-signed agent cards, cross-harbor delegation that EXECUTES
  through the real TeamExecutor and seals a receipt — or refuses in words.
  Mounted by `npm run host`; the receiver re-grades inbound risk itself.
- The drill: real missions on fresh real git repos, the repo's OWN test command
  as the verdict, vouched reports, reproducible attestation digests.

## C. Primary button handlers (all real)

| Button | Action |
|---|---|
| Send (VH-19) | `askVH19()` — the governed Generalist path |
| ✓ Accept / ✗ Reject (VH-19) | `recordDecision()` — the learning payload |
| Propose exam / Submit grades | `proposeExam()` / `gradeExam()` |
| Revoke (autonomy) | `revokeAutonomy()` — instant, no exam |
| Disable / Enable (bench) | `setSpecialistEnabled()` — the router honors it |
| Approve / Deny (gate modal) | resolves the paused run's gate promise |
| Connect / Disconnect (provider) | session-scoped `ProviderConfig`, memory only |
| Make it so (Helm) | `sendVouchMessage()` — governed cycle |
| Hold (streaming) | `stopVouch()` — interrupts, mints no receipt |
| Approve / Deny (gate cards) | `resolveVouchApproval(id, ok)` |
| Verify (Register) | `verifyVouchReceipt(id)` — SHA-256/HMAC/Ed25519 check |
| JSONL (Register) | downloads the real chained receipt via `receiptToJsonl()` |
| + Muster a hand (Ship) | `harborMusterHand()` — real `TeamSeat` on the active crew |
| Re-rate (Ship) | `harborRerate()` — recomputes assurance from persisted crews |
| Run the drill (Backtest) | `runDrill(scenarioId)` — guard/maths/impossible |
| Run full sweep (Sweep) | orphaned-key scan, live vs ghost classification |
| Save key / Clear key | `setProviderKey()` / `removeProviderKey()` — OS keychain |

## D. The four unique differentiators (all wired)

| # | Feature | Where in UI |
|---|---|---|
| 1 | **Signed Delegation Chain Ledger** | Harbor Master → Lineage |
| 2 | **Ghost Agent Sweep + Zero-Residual Receipt** | Harbor Master → Sweep |
| 3 | **Backtest Replay Bench + The Drill** | Harbor Master → Backtest |
| 4 | **Hindsight Ledger** (counterfactual regret) | Register right column |

Plus the moat: **offline-verifiable SHA-256 + HMAC + Ed25519 receipts**
(`node tools/verify-receipt.mjs`, zero deps, zero state).

## F. Signed collaboration, self-evolution & the Horizon UI (18.2.0; hardened in 19.0.0)

- **Horizon UI.** A new token sheet from the product owner's three palettes:
  near-black inks, platinum mist text, Echo Park sage-gray accent (#748785).
  SF-first system type, hairline cards, quiet motion. `probe/theme` pins the
  identity — the old patina green cannot silently return. New app icon: the
  minimal horizon glyph, regenerated across every desktop size.
- **Settings, a real page.** Gear in the sidebar: appearance facts, the
  memory/sync truth (local ledger on-device; cloud opt-in recorded but
  non-operational — the "force sync" refusal is the proof), the self-evolution
  floor as written, applied self-changes with reverts, live bench count.
- **Signed collaboration invitations.** Per-member ECDSA P-256 VH identities
  (TOFU, honestly labeled). User 1 mints a signed invite naming scope, risk
  ceiling, duration and capabilities; tampering refuses in words; approvals
  are signatures by the approver's own key and team-evolution adoption
  verifies every one of them (`probe/collabInvite`).
- **Bounded recursive self-evolution.** Tighten-only proposals minted from
  your own ledger; human-applied, receipt-linked, revert-exact; three
  rejections in a category suppress that category's proposals — it evolves
  its own proposing. The floor (receipt protocol, human gate, honesty, NO
  loosenings) is unrepresentable in the store (`probe/selfEvolve`).
- **The team self-evolves after connection.** Once a connected team clears the
  real bar, VH mints the evolution proposal automatically — visible, never
  silent, never twice; adoption still needs every member, now optionally
  signed.

## G. 19.1.0 — the team release

| # | Feature | Where |
|---|---|---|
| 1 | **The Shipyard** — one brief → per-domain work orders under each domain's **Captain**, run through the real pipeline; DONE only when every order executed, SETTLED seals a build digest | VH-19 door → The Shipyard |
| 2 | **Captains** (renamed AgentLeads) reporting on **every** routed member — the 19.0.0 review's aggregation fix | door log · `src/vh19/captains.ts` |
| 3 | **Autonomous token optimizer** — budget-fitted prompts (marked cuts, never silent), local usage ledger shown live | every provider call · `src/vh19/tokenOptim.ts` |
| 4 | **Live-data GuardRail** — research/analysis prompts hard-carry "always search for current and live data; date every claim; flag stale data" | `research.live-data` skill |

Probes: `shipyard` 22 · `captains` 37 (incl. the multi-member execution pins).

## H. 19.2.0 — the claims-execute release

| # | Feature | Where |
|---|---|---|
| 1 | **True multi-member execution** — N routed specialists = N provider calls, N attributed answers, N member receipt digests; the Captain reports on real per-member results; a failed member is `error`, never relabelled | `askVH19` · `probe/captains` |
| 2 | **Live-data GuardRail at runtime** — answered research/analysis replies are scanned; time-sensitive claims without dated live sources get the stale flag appended to the reply, sealed in the digest, stamped in the door | `src/vh19/liveData.ts` · `probe/liveData` 17 |
| 3 | **Honest naming** — the token optimizer is a **prompt-budget optimizer** working on token estimates (~4 chars/token, labelled everywhere as an estimate) | door strip · `tokenOptim.ts` |

## I. 19.3.0 — the fleet-becomes-real release

| # | Feature | Where |
|---|---|---|
| 1 | **Real specialist execution** — workspace-wired members run an act/observe loop over five gated tools (`fs.list`, `fs.read`, `fs.write`, `net.fetch`, `wiki.search`), category-bound ≤ 3; every attempted call receipted (`vh19-tool/1`), gate denials fed back verbatim, step limit labelled honestly | `src/vh19/tools.ts` · `src/vh19/agentLoop.ts` · `probe/agentTools` 47 |
| 2 | **Captain synthesis** — deterministic divergence pass (corroborated vs single-sourced claim atoms) + the Captain's OWN reasoning call into one coherent domain result; member sections kept as evidence; failed synthesis stated, never faked | `src/vh19/synthesis.ts` · `probe/synthesis` 29 |
| 3 | **GuardRail retrieval** — cited sources FETCHED and claim-checked inside; `verifiedBy: "retrieval"` vs `"disclosure"` sealed in the digest; unfetchable sources keep the flag, receipted | `verifyLiveEvidence` · `probe/liveData` 27 |
| 4 | **Receipts cover effects** — member digests commit to the member's tool receipts, so a run's evidence chain includes what it did, not just what it said | `askVH19` multi-member branch |

## E. Version integrity

Every manifest agrees on **19.5.4 "Reach"**: `src/version.ts`,
`package.json`, `package-lock.json`, `src-tauri/Cargo.toml`,
`src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, `verify/BUILD-INFO.txt`,
`verify/MANIFEST.json` and the current-facing docs.
`probe/versionDrift.test.ts` enforces it; `probe/vh19Door.test.tsx` pins the
front door; `probe/vh19.test.ts` pins the engine's honesty contract.

## Build

```
npm install
npm run dev          # web on :5173 (opens on the VH-19 door)
npm run tauri dev    # native desktop
npm run host         # mounts the A2A harbor (byte-pin verified)
npm test             # runs all 125 probe suites
```

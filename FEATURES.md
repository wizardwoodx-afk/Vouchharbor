# Vouch Harbor 18.0.1 "Generalist" — feature sheet

**One agent at the front door, the whole governed harbor behind it.**

## A. VH-19 — the Generalist front door (the primary UI)

```
User (VH-19 door — the app opens here)
   ↓
GuardRail content gate
   ↓
MoE-style router → specialist bench (62 real specialists, 10 categories)
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

## E. Version integrity

Every manifest agrees on **18.0.1 "Generalist"**: `src/version.ts`,
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
npm test             # runs every probe suite
```

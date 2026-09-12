# Vouch Harbor 17.6.2 "Patina" — hardening release

**17.1 Patina shell + the proven execution engine + regenerated certification.**
This is the first Patina build where the ship-ready and the architecture score line up.

## What is new in this release

### A. One shell, one runtime bridge
```
Patina UI
   ↓
HarborProvider (src/app/harbor.tsx)
   ↓
Vouch engine (src/vouch/engine/*)
   ↓
bridge.ts
   ↓
REAL MJ Mission Loop (src/mission/*)
   ↓
REAL receipts / gates / execution / MCP / genome / drill
```
- The old simulated `src/app/timeline.ts` is deleted.
- No view imports `vouch/engine/*` or `mission/*` at runtime — every read and every action
  goes through `useHarbor()`. `probe/patinaShell.test.ts` enforces that.
- The Helm submits through the real `sendVouchMessage()` path (ROUTE→RECALL→PLAN→THINK→
  SIMULATE→GATE→ACT→VOUCH→LEARN). Streaming state, stop, approvals, and receipt minting
  are all engine-driven.

### B. Every primary button now has a real handler
| Button | Action |
|---|---|
| Make it so (Helm) | `sendVouchMessage()` — governed cycle |
| Hold (streaming) | `stopVouch()` — interrupts the run, mints no receipt |
| Sail / Voyage toggle | `setVouchMode('quick' | 'deep')` |
| Approve / Deny (gate cards) | `resolveVouchApproval(id, ok)` |
| Verify (Register) | `verifyVouchReceipt(id)` — SHA-256/HMAC/Ed25519 check |
| JSONL (Register) | downloads real chained receipt via `receiptToJsonl()` |
| Export manifest bundle | builds + downloads a JSONL bundle of every receipt |
| + Muster a hand (Ship) | `harborMusterHand()` — appends a real `TeamSeat` to the active crew, creates a shore-watch crew if none exists |
| Re-rate (Ship) | `harborRerate()` — recomputes assurance from persisted crews/seats |
| Launch voyage (Harbor) | opens a new thread + focuses the Helm (the governed path is always Make it so) |
| + Signal a thread | `newVouchThread()` |
| Set sail (Chart) | opens a new thread + focuses the Helm |
| Reckon course (Chart) | resets the topology to the live computed graph |
| Import (Chart) | opens a file picker and merges a JSON topology into the chart |
| + `<provider>` (Harbor Master → Windward) | `addProvider()` against the real provider registry |
| Save key | `setProviderKey()` — writes into OS keychain / local secret store |
| Clear key / Remove | `removeProviderKey()` / `removeProvider()` |
| Run the drill (Backtest) | `runDrill(scenarioId)` — guard/maths/impossible against fresh repos |
| Run full sweep (Sweep) | scans localStorage for orphaned keys, classifies live vs ghost |
| Unlearn (Ship skills) | `removeVouchSkill(id)` |
| View receipts (Papers) | cross-navigates to Register |

### C. Version integrity (single identity)
Every manifest agrees on **17.6.2 "Patina"**:
`src/version.ts`, `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`,
`src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, `verify/BUILD-INFO.txt`,
`verify/MANIFEST.json`, `README.md`, `BUILD-NATIVE.md`, `DESKTOP-NATIVE.md`,
`INSTALL-ON-LAPTOP.md`, `DEPLOY-VERCEL.md`, `docs/PLATFORM-LIMITS.md`.

`probe/versionDrift.test.ts` result: **41 passed / 0 failed**.

`VH_TITLE` is updated to include the codename (`Vouch Harbor 17.1 "Patina"`) so the
title assertion in the probe matches what the app actually ships.

### D. The four unique differentiators (all wired)
| # | Feature | Where in UI |
|---|---|---|
| 1 | **Signed Delegation Chain Ledger** | Harbor Master → Lineage |
| 2 | **Ghost Agent Sweep + Zero-Residual Receipt** | Harbor Master → Sweep |
| 3 | **Backtest Replay Bench + The Drill** | Harbor Master → Backtest (calls real `runDrill`) |
| 4 | **Hindsight Ledger** (counterfactual regret) | Register right column |

Plus the existing moat: **offline-verifiable SHA-256 + HMAC + Ed25519 receipts**
(`node tools/verify-receipt.mjs`, zero deps, zero state).

### E. New integration probe
`probe/patinaShell.test.ts` — 36 assertions:
- All Patina shell files exist.
- Views do NOT bypass the bridge (no runtime imports of engine/mission/graph/domain/canvas).
- Every `btn-primary` button in the shell has a handler.
- All four differentiator panels are present.
- Helm submits through `actions.sendMessage` (the real engine).
- Semantic actions call domain primitives (`harborMusterHand`, `harborRerate`, `verifyVouchReceipt`, `runDrill`, `addProvider`).
- The mock `timeline.ts` is gone.

## Build

```
npm install
npm run dev          # web on :5173
npm run tauri dev    # native desktop
npm test             # runs every probe (patinaShell + versionDrift + 95 others)
```

TypeScript: 0 errors. Vite build: 377 KB JS (116 KB gz) / 18.9 KB CSS (4.4 KB gz).
Dev server: http://localhost:5173

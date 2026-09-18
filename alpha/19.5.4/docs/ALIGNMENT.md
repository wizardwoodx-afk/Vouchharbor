# ALIGNMENT — how the 19.5.4 [Alpha] increment is wired

**Doc version: 19.5.4-alpha "Bridge".** This file exists so that "properly aligned, wired and connected" is something you can *audit* rather than something you have to take on faith. Every row states where an addition sits, what it reads, what reads it, and what it deliberately does not touch.

The rule for the whole increment:

> **New modules attach at seams. They do not edit the core.**
> Each one takes data in, returns data out, and is reached through exactly one call site — behind a flag that is off until you turn it on.

---

## 1. The one diagram that matters

```
                                     ┌───────────────────────────────┐
        a user's agent  ──────────▶  │  src/governance/policyGate.ts │  ── allow / refuse (+ rule, + reason)
                                     └───────────────┬───────────────┘
                                                     │ every tool call passes here first
                                                     ▼
   ┌──────────────────┐   context   ┌───────────────────────┐   attributes the run   ┌────────────────────┐
   │ src/memory/      │ ──────────▶ │   existing VH-19      │ ─────────────────────▶ │ src/governance/    │
   │ channel.ts       │             │   engine (untouched)  │                        │ initiator.ts       │
   │ 5 scopes · time  │ ◀────────── │   mission loop·tools  │                        │ person·routine·    │
   └──────────────────┘  facts out  └───────┬───────────────┘                        │ deployment·handoff │
                                            │ writes receipts & events               └────────────────────┘
                        ┌───────────────────┼────────────────────┐
                        ▼                   ▼                    ▼
              ┌──────────────────┐  ┌──────────────┐  ┌────────────────────┐
              │  src/beacon/     │  │ src/bridge/  │  │ src/evidence/      │
              │  beacon.ts       │  │ bridge.ts    │  │ pack.ts            │
              │  watch + wheel   │  │ crossings    │  │ the export         │
              └──────────────────┘  └──────────────┘  └────────────────────┘
                        │                   │                    │
                        ▼                   ▼                    ▼
                  ui/Beacon.tsx      ui/BridgePanel.tsx    (offline verifier on the far side)
```

Read it as three movements: **govern** (policy + attribution) → **execute** (the untouched engine) → **record** (beacon, bridge, evidence). The additions sit on the left and right of the engine, never inside it.

---

## 2. Module map

| Module | Entry point | Reads | Written by | Flag | Probe |
|---|---|---|---|---|---|
| Policy plane | `src/governance/policyGate.ts` | policy doc, tool context | config | `VH_POLICY_PLANE` | `probe/policyGate.test.ts` |
| Attribution | `src/governance/initiator.ts` | initiator kind, actor | run context | (with policy plane) | `probe/policyGate.test.ts` |
| Agent Bridge | `src/bridge/{envelope,trust,bridge}.ts` | envelopes, pair ledger, peer grants | the two harbors | `VH_BRIDGE` | `probe/bridge.test.ts` |
| Memory Channel | `src/memory/channel.ts` | facts, evidence refs | engine + bridge | `VH_MEMORY_CHANNEL` | `probe/memoryChannel.test.ts` |
| Evidence Pack | `src/evidence/pack.ts` | receipts, decisions, overrides, versions | ledger + gate | `VH_EVIDENCE_PACK` | `probe/beaconEvidence.test.ts` |
| Beacon | `src/beacon/beacon.ts` | engine events | producers | `VH_BEACON` | `probe/beaconEvidence.test.ts` |
| Federation batch | `catalog/federationBatch.ts` | — (pure data) | `tools/generate-federation-batch.mjs` | none (data only) | `probe/federationBatch.test.ts` |
| UI | `ui/Beacon.tsx`, `ui/BridgePanel.tsx` | the modules above | — | — | `tsc` + `ui/preview.html` |
| Probe runner | `tools/run-all-probes.mjs` | `probe/**` | — | — | is the runner |
| Fleet generator | `tools/generate-federation-batch.mjs` | its own domain table | — | — | `--check` |

**Where each one attaches, in one sentence each.**

- **Policy plane** — one call, *before* tool dispatch, on the existing path. It returns a decision; it does not execute, retry or mutate anything.
- **Attribution** — the run already knows what started it. The increment *types* that fact (`person · deployment · routine · handoff`) so the audit trail can be filtered instead of guessed at.
- **Bridge** — a new entry point beside the existing local collaboration fabric. It calls the policy plane; the policy plane never calls it.
- **Memory Channel** — a new shape for context handed *to* the engine. Facts go in, a budget-fitted context comes out. It supersedes nothing in the existing memory; it sits in front of it.
- **Evidence Pack** — a read-only projection over receipts and decisions that already exist. It computes a digest; it signs nothing.
- **Beacon** — a reader over engine events plus a small pure state machine. It cannot change what the engine does; that is the point of a watch panel.
- **Federation batch** — data added to the catalogue. Routing, gating and receipts are untouched.

---

## 3. Order of connection (and the two hard precedences)

Not every flag is safe to flip on the same afternoon.

```
1. copy the files in            nothing enabled            → run the five probes
2. VH_POLICY_PLANE=on           one call site              → refusals start appearing in the audit trail
3. VH_BEACON=on                 UI only                    → watch the refusals arrive
4. VH_MEMORY_CHANNEL=on         shadow mode first: write both, read the old path
5. VH_EVIDENCE_PACK=on          read-only over what exists → export a pack, verify it offline
6. VH_BRIDGE=on                 last, on purpose
```

**Precedence 1 — never enable the bridge before the policy plane.** A crossing that cannot be refused must not be possible. The bridge asks the gate; if the gate is not running, there is nothing to ask.

**Precedence 2 — never enable the bridge before attribution.** "Who started this crossing, and was anybody watching" is the first question an investigation asks. Answering it after the fact is not answering it.

Rolling back is one flag at a time, in reverse. With every flag off, behaviour is byte-for-byte the released 19.5.4 "Reach".

---

## 4. Doc alignment — one version, every surface

| Surface | Where | Value |
|---|---|---|
| Version constant | `docs/VERSION.ts` | `19.5.4-alpha` |
| Display form | `docs/VERSION.ts` → `VERSION_DISPLAY` | `19.5.4 [Alpha]` |
| Codename | `docs/VERSION.ts` → `CODENAME` | `Bridge` |
| Machine manifest | `docs/MANIFEST.json` | `19.5.4-alpha` |
| Wiring (this file) | `docs/ALIGNMENT.md` headings | `19.5.4-alpha "Bridge"` |
| Feature sheet | `FEATURES.md` | header + §12 verification results |
| Changelog | `CHANGELOG.md` | `19.5.4-alpha "Bridge"` |
| Wiring (this file) | `docs/ALIGNMENT.md` | `19.5.4-alpha` |
| Drop-in guide | `README-ALPHA.md` | `19.5.4 [Alpha]` |
| Product name in UI | `ui/Beacon.tsx`, `ui/preview.html` | "Vouch Harbor 19.5.4 [Alpha]" |

`pagesOn: "19.5.4 \"Reach\""` in the manifest records the release this increment sits on top of, so a reader never has to guess whether the engine changed.

**The drift gate.** The repo's existing drift probe compares version strings across surfaces. When you merge this increment, add these five paths to its list — `docs/VERSION.ts`, `docs/MANIFEST.json`, `FEATURES.md`, `CHANGELOG.md`, `README-ALPHA.md` — so the next person cannot bump one without the others.

---

## 5. What was deliberately **not** touched

Named explicitly, because an unstated boundary is not a boundary:

`src/mission/missionLoop.ts` · `src/vh19/{generalist,agentLoop,tools,synthesis,captains,tokenOptim,liveData}.ts` · the receipt protocol (`vh-proof-receipt/2`, ECDSA P-256) · the authority protocol · RSIRALS v5.0 · `src/version.ts` · every pre-existing suite under `probe/**` · every bundle under `verify/**` · manifests · `LICENSE` · `NOTICE`.

**No new receipt form was invented.** The bridge's joint receipt is a *new kind of record*, minted beside the canonical receipt protocol rather than inside it, so nothing about offline verification of existing receipts changes. A joint receipt carries a digest of the answer, never the answer.

**No existing probe was edited.** Four new modules claim five new suites; the policy-gate suite was *strengthened* (two tokenizer refusal paths, an empty-policy check) while every one of its original 59 checks remained in place. It reports 66 now, and the mutation run confirms the additions catch breakages the original set did not.

---

## 6. Licensing — what came from where

| Absorbed | Upstream | Licence | How |
|---|---|---|---|
| Policy semantics: evaluate-deny-before-allow, refusals naming the rule, initiator kinds, two audit rows per action, `maxDepth`-style bounds carried inside the run | CopilotKit/OpenBot (`docs/architecture.md`, `docs/configuration.md`) | **MIT © 2026 CopilotKit** | **Clean-room reimplementation.** No upstream code copied. Add a NOTICE row pinning the commit you read. |
| Watch / take-the-wheel interaction idea | the category generally | n/a | Reimplemented as VH's own **beacon** mark and state machine |
| Everything else in this increment | — | — | Written here |

**Not used, in any form:** openbot.run (PolyForm Noncommercial) — no code, no layout, no assets; the eye icon is replaced by VH's own harbor light. CopilotKit Intelligence (separately licensed service). Skyvern, Paseo, SillyTavern, n8n, Open WebUI's protected branding.

`docs/MANIFEST.json` → `thirdParty` is the machine-readable version of this table. **Not legal advice** — confirm the upstream `LICENSE` at the exact commit you rely on and keep a copy in `vendor/` with a NOTICE row.

---

## 7. The alignment that outranks the rest

Everything above serves one sentence, and the sentence is the product:

> **Each user's own agents work directly with other users' agents.**

The rest of the market shares *one* agent between two people: two users, one brain, one set of permissions, one party who can rewrite the record. This increment federates what each user already owns — two principals, two trust roots, two policy planes, two ledgers — and makes the crossing between them **governed on both sides, bounded, attributed, refusable, and co-signed**. That is why the bridge is the flagship and why the other four features exist: memory that belongs to a pair, a beacon you can take the wheel through, a gate that can refuse in words, and a pack that proves it afterwards.

If a future increment does not serve that sentence, it does not belong in this product.

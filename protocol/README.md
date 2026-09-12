# Vouch Harbor Protocol v0.10.2 — "Unified Sentinel-Hybrid (Fix1)"

The device-to-device communication + trust substrate under the Vouch Harbor
agent OS. Shipped inside `protocol/` since **17.6**.

## What it is

Local-first, selective, signature-verified exchange for **humans and AI
agents**. Devices talk directly to devices; a *harbor* is a meeting place
only — presence, signaling, and vouch metadata. Content never transits the
harbor: it moves peer-to-peer under hybrid post-quantum encryption.

```
govern  →  execute  →  verify  →  learn
policy     vouch       chain      reputation
engine     kinds       + metaSig  + decay
```

## Layer stack

| Layer | Mechanism |
|---|---|
| Identity | ECDSA P-256 signing + HPKE + ML-KEM-768 key bundles, challenge-response join |
| Envelopes | signed `{p, n, ts, sig}` + replay guard + timestamp window |
| Vouch chain | full SHA-256 hash chain, harbor meta-signatures (`requireMetaSig` default), root-key checkpoints every 10 links |
| Governance | PolicyEngine (6 vouch kinds, charset/hash/expiry rules, self-endorsement ban) + BindingValidator (signer ↔ actor, SDK **and** harbor) |
| Trust | `findAuthorization` (expiry/revocation-aware), `assessActionRisk`, `computeReputationSignals` (per-capability, exponential time decay λ=0.5, half-life ≈ 10 days) — signals are audit-only; access rides authorization |
| Content | **VH-HYBRID-PQ3** true hybrid combiner — two independent secrets (HPKE-protected + ML-KEM-protected) joined by HKDF; compromise of ONE key-establishment path does not reveal the content key. **VH-VAULT-v3** chunked transfer + RFC 6962 Merkle manifest |
| Honesty | `CRYPTO_BOUNDARY` — machine-readable quantum status per primitive; signing stays classical ECDSA and says so |

## The receipt bridge (17.6)

`bridge/vouch-receipt-bridge.mjs` anchors Patina's `vh-proof-receipt/2`
proof receipts into the vouch chain — the cross-org capability channel's
trust anchor. A receipt verified on one machine becomes a portable,
policy-governed, revocable vouch on any harbor.

- Verification mirrors `tools/verify-receipt.mjs` **byte-for-byte**
  (chain, canon, seal, Ed25519 issuer signature).
- Envelopes are wire-compatible with the protocol's `sealSecure/openSecure`.
- Anchored facts pass PolicyEngine + BindingValidator + the authorization gate.
- Zero npm dependencies (node builtins only).

```bash
node protocol/bridge/bridge-selftest.mjs   # 🏆 17 checks, zero install
```

## Running

```bash
cd protocol
npm install
npm test          # 🏆 122 checks (selftest)
npm start         # harbor server (PORT env, default 3000)
```

## v0.10.2 fix record (why this is "Fix1")

v0.10.1 shipped 9 defects found by executing its own suite; all fixed and
re-verified 122/122:

| Fix | What |
|---|---|
| FIX-1 | selftest: `await` inside non-async arrow (SyntaxError at load) |
| FIX-2/3 | `hybridSealFor` crashed on every call: HPKE `sender.enc`/`seal()` return ArrayBuffer in @hpke/core 1.9.0 |
| FIX-4 | selftest used vault `chunkSize: 256` below the 1024 minimum |
| FIX-5 | SDK join raced the server's immediate `auth:challenge` (every join failed locally) |
| FIX-6 | selftest awaited `connect` on an already-connected socket (hang) |
| FIX-7 | `_emit(event, undefined)` put `null` on the wire → `chain:get`/`checkpoint:get` never acked (hang) |
| FIX-8 | `_safeParse`: `"constructor" in obj` is true for EVERY object (prototype chain) → trust layer silently dead; now `Object.hasOwn` |
| FIX-9 | `byCapability` no longer erases revoked capabilities' history (signals are descriptive; selftest contradiction resolved) |
| FIX-10 | selftest reused pre-rotation facts (binding correctly rejected them) |
| HARDEN-1 | ledger seq commits only after metaSig resolution (no sequence-gap edge) |

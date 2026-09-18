# Changelog

## 19.5.6-alpha "Bridge" — 2026-09-18  [ALPHA]

Pages on top of **19.5.6 "Reach"**. **The released engine is untouched**: no file under
`src/mission/`, `src/vh19/`, the receipt protocol, the authority protocol, RSIRALS or the
existing `probe/**` suites was modified. Every addition is a new module behind a flag,
off by default.

### Post-review hardening — the security review of the 19.5.4-alpha cut

An external review of the first cut returned six findings. All six are fixed, and each
fix carries a probe that fails if it regresses. Recorded here because a changelog that
only lists additions is a marketing document.

1. **Signatures were one function called twice.** `Signer = (bytes) => string`, verified
   by re-invoking the same function, so a receipt proved nothing about who produced it.
   Now: **ECDSA P-256 / SHA-256** via the platform's Web Crypto. Each harbour signs with
   its own private key (never exported, never serialised) and each verifies with the
   **peer's published public key** (`src/bridge/keys.ts`). Receipts are `/2` and name the
   `keyId` that signed them. Envelopes are signed too, so a request cannot claim to come
   from a peer that did not send it.
2. **`VH_BRIDGE_REQUIRE_HUMAN_FIRST` was documented, never consulted.** Now the pair's
   first crossing is **refused** by `crossBridge()` unless it carries a signed, expiring,
   nonce-bound approval from the owner's own key (`src/bridge/approval.ts`). A procedural
   hold costs the peer nothing.
3. **Pair trust arrived as a parameter.** Now it is a **fold over signature-verified
   ledger records** (`src/bridge/ledger.ts`): unverifiable rows are excluded and named, a
   refusal without a cause is refused by the ledger itself, revocation is a lock and only
   an explicit signed re-vouch reopens it.
4. **Envelope ids and nonces were derived from the request.** Now CSPRNG by default
   (`csprngEntropy()`); determinism is opt-in and labelled `seeded-for-tests-only`.
5. **The pack's "digest" was a 64-bit FNV-style hash.** Now a real **SHA-256** over the
   pack's canonical bytes (`src/evidence/sha256.ts`), labelled `vh1:sha256:…`, aligned
   with the SHA-256 the rest of the evidence chain already uses; the non-cryptographic
   hash survives as `checksum()` for short labels and is named as what it is.
6. **The archive's probe run was not reproducible standalone.** The runner imported
   TypeScript natively, so a fresh extraction discovered six suites and loaded none. Now
   `tools/compile-probe-twins.mjs` emits CommonJS twins into `dist-verify/`, and
   `node dist-verify/tools/run-all-probes.mjs` reproduces every number with plain Node.
   A missing loader is now reported as a **failure**, never as silence.

Also from the review: the fleet is described accurately as **1,150 established + 200
registered** specialists, and the pack is retargeted from 19.5.4 to **19.5.6 "Reach"**,
because a governance layer that pages on the wrong release is one nobody can install.

### Added
- **Agent Bridge** (`src/bridge/`) — cross-user agent crossings. Typed envelopes
  (`vh-bridge-envelope/1`), intersect-only negotiation, deployment-enforced bounds,
  pair trust with decay and revocation, and a **co-signed joint receipt**
  (`vh-bridge-joint-receipt/1`). This closes the gap the 19.5.x documentation named:
  "both sides of a handoff are minted inside one VH runtime, and no cross-instance
  handshake is claimed."
- **Beacon** (`src/beacon/`, `ui/Beacon.tsx`) — watch the work and take the wheel.
  Six states, each with a word. **While a person drives, agent actions are refused,
  not queued.** Stalls are events. Files report path and size, never contents.
  The watch mark is VH's own harbor light, drawn from geometry.
- **Memory Channel** (`src/memory/`) — five scopes (`run · agent · user · pair · org`),
  kept time (supersede instead of delete, `asOf` queries), budget-fitted context with
  **marked** cuts, evidence required at `pair`/`org` scope, credentials refused entry.
  The `pair` scope is new to the category: it belongs to two users jointly.
- **Policy Plane** (`src/governance/`) — fail-closed rules, deny before allow,
  refusals that name the rule, two audit rows per action, and a denied action that
  provably has no side effects.
- **Initiator attribution** (`src/governance/initiator.ts`) — `person · deployment ·
  routine · handoff`, so "Nobody watching" is a filter rather than a guess.
- **Evidence Pack** (`src/evidence/`) — EU AI Act Art. 11/12/14, ISO 42001, ISO 27001
  and NIST AI RMF mapping with **declared gaps**, verifiable from its own bytes.
- **Fleet: +200 specialists** (`catalog/federationBatch.ts`) — 40 broad domains × the
  five stations of the mission cycle, each station handing to the next. Registry total
  1,150 → **1,350**, self-proven by `federationStats().byProvenance`.
- **UI preview** (`ui/preview.html`) — self-contained, no network, no build step.

### Added — tooling
- **`tools/run-all-probes.mjs`** — discovers every suite, runs them in-process with a
  timeout, prints one table, exits non-zero on anything that is not green. A suite that
  cannot even load is reported, not skipped quietly.
- **`tools/generate-federation-batch.mjs`** — the +200 are generated from a single
  40-domain × 5-station table; `--check` is a drift gate for the data file. Verified
  byte-identical to the data it replaces.
- **`tsconfig.alpha.json`** — the strict settings this increment was verified under.
- **`tools/pack-release.mjs`** — the full-app release packer: probe gate, exclusion policy
  (dependencies, build output, VCS, secrets, keys, logs), a zero-dependency ZIP writer, and a
  read-back check before it reports success. Refuses to pack a tree that fails its probes or
  is missing `LICENSE` / `NOTICE` / `package.json`.

### Changed (polish, no behaviour change with flags off)
- Refusal coverage is now a measured number in the pack, not an assurance.
- The fleet panel's counts are computed once and frozen rather than re-walked per render.
- Redaction moved into the beacon's producers so a credential cannot reach the feed.
- The memory channel and the token optimizer share one rule: a cut is always marked.
- Version alignment across `docs/VERSION.ts` and `docs/MANIFEST.json`.

### Probes
Additive only. **No existing probe was edited, and none was weakened.**
`probe/policyGate.test.ts` (66 · was 59; the tokenizer's unterminated-string path and
empty-policy behaviour were added, all 59 originals kept) · `probe/bridge.test.ts` (98) ·
`probe/memoryChannel.test.ts` (48) · `probe/beaconEvidence.test.ts` (88) ·
`probe/federationBatch.test.ts` (50) · `probe/sha256.test.ts` (22).

**372 checks, 0 failed**, via `node tools/run-all-probes.mjs`.

TypeScript compiles the whole increment under `strict` + `noUncheckedIndexedAccess`:
**0 errors**.

**Mutation-tested: 15 deliberate breakages, 15 caught** — signature verification short-
circuited, the first-crossing gate skipped, approval replay binding removed, expired
approvals honoured, the ledger counting rows whose signatures do not verify, an audit
claiming every row attributable, a revoked pair reopened by a later success, nonces
derived from the request, the receipt-summary guard removed, a dispute downgraded to a
peer refusal, a corrupted SHA-256 constant, wrong SHA-256 padding at 56 bytes, the pack
digest downgraded to a checksum, trust starting warm, and revocation no longer locking.
(In the first pass this battery also caught a *gap in the battery itself* — two mutations
were silent no-ops because their anchors did not match. The harness now asserts that
every mutation applied.)

**Three real bugs were found by these probes during the build** and fixed: a redaction
callback that read the regex offset as a capture group (a bare `sk-` key survived), a
beacon that let the agent act while a run waited on a person, and specialists tiered by
domain instead of by station (now `riskForStation()`, with the data checked against the
rule by a probe).

### Known gaps — stated, not hidden
- No live streamed viewport; the beacon reports state, not pixels.
- Pair trust is local-first; both harbors compute from the crossings they saw.
  There is deliberately no shared trust registry.
- The Evidence Pack maps clauses; it is not a certification.
- First crossing always requires a human on both sides, whatever the score.
- The 200 new specialists are registered and doctrinally specified; their per-specialist
  execution suites land next.

### Licensing
Policy semantics are absorbed from CopilotKit/OpenBot (MIT © 2026 CopilotKit) as a
**clean-room reimplementation** — no upstream code copied. Add a NOTICE row pinning the
commit you read. Nothing from openbot.run (PolyForm Noncommercial) is used, in code or
in assets; the Beacon is this project's own mark.

# Vouch Harbor Protocol — Threat Model & Trust Decisions (v0.10.3)

This file records the **explicit trust-model decisions** of the protocol,
including the answer to the question every reviewer asks:

> *"Only an authorized principal may grant authorization — who watches the grantors?"*

## Decision 1 — Attested granters (17.6.1 / v0.10.3, enforced mechanically)

An `authorization` vouch is accepted by a harbor **only if the granter holds
an on-record attestation on that harbor**:

- an unrevoked **capability declaration**, or
- an **endorsement received**.

A valid signature alone is not enough. The v0.10.2 hole —

```
Agent A signs authorization → Agent B is now authorized
```

— is refused with `policy:grantor-unattested`. Signing proves *who spoke*;
attestation proves *who is trusted enough to delegate*.

**Bootstrap.** The first attestation on any harbor is an on-record capability
claim. That is deliberate: it is identity-bound, carries reputation
consequences, is revocable, and is visible to every auditor of the chain.
Anonymous authority creation does not exist.

**Revocation is live.** A revocation with `target.kind: "capability"` or
`target.action: "*"` against the granter removes their attestation;
subsequent grants fail immediately. Existing grants remain subject to the
normal expiry/revocation rules at lookup time (`findAuthorization`).

## Decision 2 — Capped delegation chains

Grants may carry `authority: { root, depth }`:

- `depth ≥ 1` requires that the **root is attested** AND that the granter
  **holds a live grant from that root** (expiry + revocation aware).
  Delegation is delegated — never self-invented.
- Depth is capped by `VH_MAX_DELEGATION_DEPTH` (default **2**, range 0–8).
  Beyond the cap: `policy:delegation-depth-exceeded`.
- A grant without `authority` is self-attested (Decision 1 applies).

## Decision 3 — Signals vs. decisions

Reputation (`computeReputationSignals`) is **descriptive audit material** and
is never an access-control input. Access rides `findAuthorization` +
`assessActionRisk` + the grant-authority gate above. Time decay (λ=0.5,
half-life ≈ 10 days) shapes *human* review, not machine decisions.

## Decision 4 — Cryptographic boundary

Content encryption is hybrid post-quantum (HPKE + ML-KEM-768, independent
secrets + HKDF). **Identity and signing remain classical ECDSA P-256** and
are labeled as such (`PROTOCOL.signingLayer`, `CRYPTO_BOUNDARY`). ML-DSA
(FIPS 204) signing is roadmap; no blanket "quantum-safe" claim is made.

## Known limitations (documented, not solved)

| Threat | Status |
|---|---|
| Sybil identities | Mitigated by attestation requirement + per-harbor join governance; not solved globally |
| Colluding endorsers | Reputation is audit-only; delegation depth capped; human review expected at org boundaries |
| Granter key compromise | Rotation proofs + revocation; no retroactive invalidation of pre-compromise grants (they still expire ≤ 30d) |
| Cross-harbor attestation portability | Roadmap: bridge-anchored receipts + endorsement portability |

## Alignment with Patina (17.x)

Patina enforces the **human-principal invariant**: authority envelopes must
root at `human:<id>`, and agents mechanically cannot install their own
safety authority. The protocol's attested-granter rule is the multi-party
projection of the same doctrine: *authority must be rooted in something an
auditor can name*. Roadmap: cross-signing Patina human-root envelopes into
harbor attestations so a harbor can require **human-rooted** attestation for
high-risk action classes — the `authority.root` field is already shaped for
it.

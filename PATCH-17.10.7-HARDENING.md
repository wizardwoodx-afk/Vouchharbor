# VH 17.10.9 — verification and identity hardening patch

This working-tree patch keeps the product version at 17.10.9 and fixes two release-integrity issues found during archive review:

1. Public/private protocol bundles now derive their fingerprint from the actual signing public JWK and reject a caller-supplied fingerprint that does not match it. This makes the fingerprint → public-key binding explicit at serialization boundaries, in addition to the server-side join check.
2. The MCP conformance probe now fails immediately when its real stdio server dies during startup, instead of leaving tests cancelled while the Node test runner exits 0. The offline runner classifies generic missing-package failures as environment/dependency skips rather than verification passes.

The uploaded archive is VH 17.10.9; it uses ECDSA P-256 for identity/signing, not an Ed25519 implementation. Therefore the separate 19.4 Ed25519 parsing issue shown in the supplied screenshot is not a code path present in this archive and has not been fabricated or silently replaced here.

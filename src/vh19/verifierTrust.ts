/**
 * THE VH TRUST ROOT — the anchor for the external canary verifier
 * (19.7.8 [Trustroot]).
 *
 * The 19.7.7 review: a verdict is only as trustworthy as the thing that
 * vouches for it, and VH must verify the vouching INDEPENDENTLY. This
 * module is that independent anchor — a FROZEN constant with no setter,
 * same discipline as plane T:
 *
 *   • verifierPublicKeyJwk — the ECDSA P-256 public key the external
 *     verifier MUST sign with. Verdicts signed by any other key are
 *     refused, so a modified verifier cannot forge accepted output.
 *   • expectedBatteryDigest — SHA-256 over every canary check's SOURCE
 *     (id + probe source), not just the ids. A swapped battery produces
 *     a different digest and is refused before anything else matters.
 *   • verifierKeyFingerprint — SHA-256 over the canonical JWK, printed on
 *     every refusal so a mismatch is diagnosable in one line.
 *
 * Rotation is a release event, like every trust change: new keypair +
 * new battery → new frozen constants → reviewed → shipped. Never runtime.
 */

export const TRUST_ROOT: Readonly<{
  protocol: "vh-verifier/2";
  algorithm: "ECDSA_p256_sha256";
  verifierPublicKeyJwk: Readonly<{ kty: string; crv: string; x: string; y: string; key_ops?: readonly string[]; ext?: boolean }>;
  verifierKeyFingerprint: string;
  expectedBatteryDigest: string;
}> = Object.freeze({
  protocol: "vh-verifier/2",
  algorithm: "ECDSA_p256_sha256",
  verifierPublicKeyJwk: Object.freeze({
    kty: "EC",
    crv: "P-256",
    x: "YkNuABs5fQuX19fr9aq1Sk_JHtz6PO-kHKC2DLeJCZU",
    y: "sy1-QZsgLJgFc4JCtOupGJ2B-TnKkBbyUi3XGsewPUA",
    key_ops: Object.freeze(["verify"]),
    ext: true,
  }),
  verifierKeyFingerprint: "44c2719e7d6c2e446f76283ff58788fb88bb4044b5e6abdfcd2291bea9a39f08",
  expectedBatteryDigest: "4fd7efeb4f52c3a6ee5ed1409cb3a0fda109fd93d25d6a9609f908f1db82931e",
});

/**
 * THE VH TRUST ROOT — the anchor for the external canary verifier
 * (19.7.9 [Keyholder]).
 *
 * The 19.7.8 review found the P0: the verifier's PRIVATE key shipped
 * inside the artifact, so anyone holding the ZIP could forge verdicts the
 * pinned public key happily accepted. The pinned-key design was the
 * mistake — a client-side artifact cannot carry a secret meaningfully.
 * The root has been redesigned around that fact:
 *
 *   • NOTHING SECRET SHIPS. The verifier's keypair is provisioned at
 *     RUNTIME on the owner's machine (private key at
 *     ~/.vouchharbor/verifier.key, mode 0600, outside every artifact).
 *
 *   • REGISTRATION, NOT EMBEDDED KEYS — the provisioned public key is
 *     countersigned by the OWNER key (the same ECDSA P-256 authority that
 *     signs mandates and federation crossings) and stored in the owner
 *     trust store. Verdicts verify under the REGISTERED key; a stranger
 *     key is refused; re-provisioning requires the owner again.
 *
 *   • THE PROGRAM IS PINNED — verifierProgramDigest is the SHA-256 of the
 *     shipped verifier's exact source; the verifier re-digests itself at
 *     runtime and binds programDigest into every verdict signature. A
 *     modified verifier is refused even before its key matters. The
 *     battery digest (over every check's SOURCE) stays pinned alongside —
 *     the battery is EXTERNALLY EXECUTED and DIGEST-PINNED (honest words:
 *     it is not secret, and this design never claims it is).
 *
 * Rotation: change the verifier program → new programDigest → a new
 * release (reviewed, shipped). Re-provision a machine's key → the owner
 * countersigns again. Never runtime mutation of this root: it is frozen,
 * no setter, like plane T.
 */

export const TRUST_ROOT: Readonly<{
  protocol: "vh-verifier/3";
  algorithm: "ECDSA_p256_sha256";
  verifierProgramDigest: string;
  expectedBatteryDigest: string;
  registrationKey: string;
  keyPathOutsideArtifact: string;
}> = Object.freeze({
  protocol: "vh-verifier/3",
  algorithm: "ECDSA_p256_sha256",
  verifierProgramDigest: "2ded52ce5cf8a9857517440f0ec217c1b0771be8f7d87516ae5f49c8b271bdc7",
  expectedBatteryDigest: "4fd7efeb4f52c3a6ee5ed1409cb3a0fda109fd93d25d6a9609f908f1db82931e",
  registrationKey: "vh.verifier.registration.v3",
  keyPathOutsideArtifact: "~/.vouchharbor/verifier.key",
});

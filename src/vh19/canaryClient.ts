/**
 * CANARY CLIENT — the bridge to the EXTERNAL verifier (19.7.8 [Trustroot]).
 *
 * The hidden battery lives in `verifier/vh-verifier.mjs`, a separate
 * zero-dependency process OUTSIDE src/. This module is the only way src/
 * talks to it, and — per the 19.7.7 review — it now verifies the vouching
 * INDEPENDENTLY of the verifier:
 *
 *   • CSPRNG NONCE — crypto.randomUUID (getRandomValues fallback); no
 *     clock-and-Math.random. Verdicts are un-replayable.
 *   • BATTERY ANCHOR — the verdict's batteryDigest must equal the digest
 *     PINNED in the frozen trust root (verifierTrust.ts), which covers
 *     every check's SOURCE. A swapped battery is refused on sight.
 *   • REAL SIGNATURE — the verdict is ECDSA P-256 (SHA-256) over the
 *     canonical payload, verified against the public key PINNED in the
 *     trust root. A modified verifier cannot forge accepted verdicts: it
 *     does not hold the pinned key.
 *   • HONEST DEGRADATION — where no process can run, the report says
 *     `unavailable` and the gate never pretends: the candidate simply
 *     cannot pass canaries without the external verifier.
 *
 * verifyExternal is async (signature verification is WebCrypto); the v6
 * gate itself stays synchronous over the trusted report.
 */

import { TRUST_ROOT } from "./verifierTrust";

export const VERIFIER_PATH = "verifier/vh-verifier.mjs";

export interface ExternalCanaryReport {
  ran: number;
  failed: Array<{ id: string; finding: string }>;
  batteryDigest: string;
  /** "external-verifier" = a live, signature-verified run; "unavailable" = no process could run. */
  source: "external-verifier" | "unavailable";
  note?: string;
}

export interface VerifierWire {
  nonce: string;
  ran: number;
  failed: Array<{ id: string; finding: string }>;
  batteryDigest: string;
  alg: string;
  sig: string;
}

/** CSPRNG nonce — randomUUID, with a getRandomValues fallback. No clocks, no Math.random. */
export function newNonce(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(32));
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return null as unknown as string; // no CSPRNG in this runtime — caller degrades honestly
}

/** The canonical payload the verifier signs and VH verifies. Both sides compute this exact string. */
export function canonicalVerdictPayload(nonce: string, ran: number, failed: Array<{ id: string; finding: string }>, batteryDigest: string): string {
  return `vh-verifier/1|${nonce}|${ran}|${JSON.stringify(failed)}|${batteryDigest}`;
}

function subtle(): SubtleCrypto | null {
  const g = globalThis as { crypto?: { subtle?: SubtleCrypto } };
  if (g.crypto?.subtle) return g.crypto.subtle;
  try {
    const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => { webcrypto?: { subtle?: SubtleCrypto } } } }).process;
    return proc?.getBuiltinModule?.("node:crypto")?.webcrypto?.subtle ?? null;
  } catch {
    return null;
  }
}

/**
 * Verify a verdict against the TRUST ROOT: nonce echo, battery anchor,
 * algorithm tag, and the ECDSA P-256 signature over the canonical payload
 * with the PINNED public key. Nothing here trusts the verifier's word —
 * only its key.
 */
export async function validateVerifierOutput(out: VerifierWire, expectedNonce: string): Promise<{ ok: true; report: ExternalCanaryReport } | { ok: false; reason: string }> {
  if (!out || typeof out !== "object") return { ok: false, reason: "verifier output is not an object" };
  if (out.nonce !== expectedNonce) return { ok: false, reason: "verdict nonce mismatch — replay refused" };
  if (!Array.isArray(out.failed)) return { ok: false, reason: "verdict failed-list malformed" };
  if (typeof out.ran !== "number" || typeof out.batteryDigest !== "string" || out.batteryDigest.length !== 64) return { ok: false, reason: "verdict payload malformed" };
  if (out.alg !== TRUST_ROOT.algorithm) return { ok: false, reason: `verdict algorithm '${String(out.alg)}' is not the pinned ${TRUST_ROOT.algorithm}` };
  if (out.batteryDigest !== TRUST_ROOT.expectedBatteryDigest) {
    return { ok: false, reason: `battery digest ${out.batteryDigest.slice(0, 12)}… does not match the pinned battery ${TRUST_ROOT.expectedBatteryDigest.slice(0, 12)}… — a modified battery is not the approved exam` };
  }
  const s = subtle();
  if (!s) return { ok: false, reason: "no WebCrypto in this runtime — the signature cannot be verified here" };
  try {
    const key = await s.importKey("jwk", TRUST_ROOT.verifierPublicKeyJwk as unknown as JsonWebKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const sigBytes = Uint8Array.from(atobPolyfill(out.sig), (ch) => ch.charCodeAt(0));
    const ok = await s.verify({ name: "ECDSA", hash: "SHA-256" }, key, sigBytes, new TextEncoder().encode(canonicalVerdictPayload(out.nonce, out.ran, out.failed, out.batteryDigest)));
    if (!ok) return { ok: false, reason: `verdict signature INVALID under the pinned verifier key ${TRUST_ROOT.verifierKeyFingerprint.slice(0, 12)}… — tamper or a forged signer refused` };
    return {
      ok: true,
      report: { ran: out.ran, failed: out.failed.map((f) => ({ id: String(f.id), finding: String(f.finding) })), batteryDigest: out.batteryDigest, source: "external-verifier" },
    };
  } catch (err) {
    return { ok: false, reason: `signature verification failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function atobPolyfill(b64: string): string {
  const g = globalThis as { atob?: (s: string) => string };
  if (g.atob) return g.atob(b64);
  return Buffer.from(b64, "base64").toString("binary");
}

interface CandidateShape {
  name: string;
  target: string;
  body: string;
  declares: string;
}

/**
 * Run the external verifier for one candidate and verify its verdict
 * against the trust root. Node runtimes get a REAL signed process run;
 * anywhere else the report is honestly `unavailable`.
 */
export async function verifyExternal(candidate: CandidateShape): Promise<ExternalCanaryReport> {
  try {
    const proc = (globalThis as { process?: { execPath?: string; cwd?: () => string; getBuiltinModule?: (id: string) => unknown; versions?: { node?: string } } }).process;
    const getBuiltin = proc?.getBuiltinModule;
    if (typeof getBuiltin !== "function" || typeof proc?.cwd !== "function" || !proc.versions?.node) {
      return { ran: 0, failed: [], batteryDigest: "", source: "unavailable", note: "no node runtime — the external verifier cannot run here" };
    }
    const cp = getBuiltin("node:child_process") as { execFileSync: (file: string, args: string[], opts: Record<string, unknown>) => string | Buffer };
    const fs = getBuiltin("node:fs") as { existsSync: (p: string) => boolean };
    const pathMod = getBuiltin("node:path") as { resolve: (...p: string[]) => string };
    const verifierPath = pathMod.resolve(proc.cwd(), VERIFIER_PATH);
    if (!fs.existsSync(verifierPath)) {
      return { ran: 0, failed: [], batteryDigest: "", source: "unavailable", note: `verifier process not found at ${VERIFIER_PATH}` };
    }
    const nonce = newNonce();
    if (!nonce) return { ran: 0, failed: [], batteryDigest: "", source: "unavailable", note: "no CSPRNG in this runtime — refusing to run without a fresh nonce" };
    const raw = cp.execFileSync(proc.execPath as string, [verifierPath], {
      input: JSON.stringify({ nonce, candidate }),
      encoding: "utf8",
      timeout: 15_000,
    }) as string;
    const out = JSON.parse(raw) as VerifierWire;
    const res = await validateVerifierOutput(out, nonce);
    if (!res.ok) return { ran: 0, failed: [], batteryDigest: "", source: "unavailable", note: res.reason };
    return res.report;
  } catch (err) {
    return { ran: 0, failed: [], batteryDigest: "", source: "unavailable", note: `verifier run failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

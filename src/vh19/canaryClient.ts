/**
 * CANARY CLIENT — the bridge to the EXTERNAL verifier (19.7.7 [Verifier]).
 *
 * The hidden true-objective canaries live in `verifier/vh-verifier.mjs`, a
 * separate zero-dependency process OUTSIDE src/ — outside the agent's
 * evolvable surface. This module is the only way src/ talks to them:
 *
 *   • spawn the verifier with a FRESH NONCE per call — verdicts cannot be
 *     replayed;
 *   • verify the verdict SIGNATURE (SHA-256 over nonce|ran|failed|battery)
 *     — a tampered verdict is refused;
 *   • degrade HONESTLY: where no process can run (the browser console
 *     runtime), the report says source "unavailable" — and the gate then
 *     NEVER pretends: the candidate simply cannot pass canaries without
 *     the external verifier, so it stays at the human gate.
 *
 * validateVerifierOutput is exported pure so the probe can pin the
 * tamper-evidence and nonce binding directly.
 */

import { pureSha256 } from "./pureHash";

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
  sig: string;
}

/** The verdict signature — over exactly the fields that matter, nonce-bound. */
export function verifierSignature(nonce: string, ran: number, failed: Array<{ id: string; finding: string }>, batteryDigest: string): string {
  return pureSha256(`vh-verifier/1|${nonce}|${ran}|${JSON.stringify(failed)}|${batteryDigest}`);
}

/**
 * Pure validation: nonce must echo, the signature must bind the payload.
 * Returns the trusted report or the reason the verdict was refused.
 */
export function validateVerifierOutput(out: VerifierWire, expectedNonce: string, expectedBattery?: string): { ok: true; report: ExternalCanaryReport } | { ok: false; reason: string } {
  if (!out || typeof out !== "object") return { ok: false, reason: "verifier output is not an object" };
  if (out.nonce !== expectedNonce) return { ok: false, reason: "verdict nonce mismatch — replay refused" };
  if (!Array.isArray(out.failed)) return { ok: false, reason: "verdict failed-list malformed" };
  if (typeof out.ran !== "number" || typeof out.batteryDigest !== "string" || out.batteryDigest.length !== 64) return { ok: false, reason: "verdict payload malformed" };
  if (expectedBattery && out.batteryDigest !== expectedBattery) return { ok: false, reason: "verdict came from a different battery — refused" };
  const expect = verifierSignature(out.nonce, out.ran, out.failed, out.batteryDigest);
  if (out.sig !== expect) return { ok: false, reason: "verdict signature mismatch — tamper refused" };
  return {
    ok: true,
    report: { ran: out.ran, failed: out.failed.map((f) => ({ id: String(f.id), finding: String(f.finding) })), batteryDigest: out.batteryDigest, source: "external-verifier" },
  };
}

/** Which battery version we expect — changes only when the verifier ships a new exam. */
export const EXPECTED_BATTERY_DIGEST = "pinned-by-probe";

interface CandidateShape {
  name: string;
  target: string;
  body: string;
  declares: string;
}

/**
 * Run the external verifier for one candidate. In node runtimes (probes,
 * the host engine, CI) this is a REAL signed process run; where no process
 * can run, the report is honestly "unavailable" — the gate treats that as
 * canary-cannot-pass, never as a pass.
 */
export function verifyExternal(candidate: CandidateShape): ExternalCanaryReport {
  try {
    // Node-only seam, resolved lazily; in the browser this throws and we degrade.
    const proc = (globalThis as { process?: { execPath?: string; cwd?: () => string; getBuiltinModule?: (id: string) => unknown } }).process;
    const getBuiltin = proc?.getBuiltinModule;
    if (typeof getBuiltin !== "function" || typeof proc?.execPath !== "function" && typeof proc?.execPath !== "string" || typeof proc?.cwd !== "function") {
      return { ran: 0, failed: [], batteryDigest: "", source: "unavailable", note: "no node runtime — the external verifier cannot run here" };
    }
    const cp = getBuiltin("node:child_process") as { execFileSync: (file: string, args: string[], opts: Record<string, unknown>) => string | Buffer };
    const fs = getBuiltin("node:fs") as { existsSync: (p: string) => boolean };
    const pathMod = getBuiltin("node:path") as { resolve: (...p: string[]) => string };
    const verifierPath = pathMod.resolve(proc.cwd(), VERIFIER_PATH);
    if (!fs.existsSync(verifierPath)) {
      return { ran: 0, failed: [], batteryDigest: "", source: "unavailable", note: `verifier binary not found at ${VERIFIER_PATH}` };
    }
    const nonce = pureSha256(`${Date.now()}-${Math.random()}-vh-canary`).slice(0, 32);
    const raw = cp.execFileSync(proc.execPath as string, [verifierPath], {
      input: JSON.stringify({ nonce, candidate }),
      encoding: "utf8",
      timeout: 15_000,
    }) as string;
    const out = JSON.parse(raw) as VerifierWire;
    const res = validateVerifierOutput(out, nonce);
    if (!res.ok) return { ran: 0, failed: [], batteryDigest: "", source: "unavailable", note: res.reason };
    return res.report;
  } catch (err) {
    return { ran: 0, failed: [], batteryDigest: "", source: "unavailable", note: `verifier run failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

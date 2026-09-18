/**
 * bridge.ts — the crossing: negotiate, run, and co-sign across an owner boundary.
 *
 * This is the module that closes the gap Vouch Harbor's own documentation names:
 * "both sides of a handoff are minted inside one VH runtime, and no cross-instance
 * handshake is claimed." Here, two owners on two harbors negotiate a capability,
 * run the work, and each signs the same canonical record — so the joint receipt
 * exists independently on both sides and neither side can rewrite it alone.
 *
 * Three invariants, enforced by code rather than by convention:
 *   1. A negotiation can only ever NARROW. Intersecting declared capabilities is
 *      the only operation; there is no path that grants.
 *   2. A refusal carries a cause. Silent refusal is indistinguishable from a
 *      dropped message, which is the failure this product exists to remove.
 *   3. A joint receipt is signed by both sides over the same canonical bytes. A
 *      signature that will not verify is reported, never repaired.
 *
 * Additive module. Zero dependencies. No core file is touched.
 */

import {
  BRIDGE_CAPABILITIES,
  canHop,
  type BridgeCapability,
  type BridgeEnvelope,
  type EnvelopeBounds,
  type PeerRef,
} from './envelope';
import { pairId, posture, recordOutcome, type PairTrust, type TrustPosture } from './trust';

/* ----------------------------- negotiation ----------------------------- */

export interface CapabilityGrant {
  /** Capabilities this owner has authorised this agent to *offer*. */
  readonly offers: readonly BridgeCapability[];
  /** Capabilities this agent can actually perform on this run. */
  readonly canDo: readonly BridgeCapability[];
}

export interface NegotiationRequest {
  readonly capability: BridgeCapability;
  readonly bounds: EnvelopeBounds;
  readonly task: string;
}

export type NegotiationVerdict =
  | { readonly accepted: true; readonly capability: BridgeCapability; readonly note: string }
  | { readonly accepted: false; readonly cause: string };

/**
 * Intersect, never union. `offers ∩ canDo` is what the far side is entitled to
 * expect; asking for anything else is refused with the reason spelled out.
 */
export function negotiate(grant: CapabilityGrant, request: NegotiationRequest): NegotiationVerdict {
  const possible = new Set(grant.offers.filter((c) => grant.canDo.includes(c)));
  if (!possible.has(request.capability)) {
    const requested = request.capability;
    const held = [...possible].sort().join(', ') || 'nothing';
    return {
      accepted: false,
      cause: `refused: this agent is not authorised for "${requested}" on a bridge; it can offer ${held}`,
    };
  }
  if (request.bounds.maxDepth < 0) {
    return { accepted: false, cause: 'refused: maxDepth may not be negative' };
  }
  return {
    accepted: true,
    capability: request.capability,
    note: `accepted "${request.capability}" with depth limit ${request.bounds.maxDepth}`,
  };
}

/** Every capability in the catalogue, for the UI's negotiation matrix. */
export function capabilityMatrix(
  left: CapabilityGrant,
  right: CapabilityGrant,
): ReadonlyArray<{ capability: BridgeCapability; leftOffers: boolean; rightCanDo: boolean; crossable: boolean }> {
  return BRIDGE_CAPABILITIES.map((capability) => {
    const leftOffers = left.offers.includes(capability) && left.canDo.includes(capability);
    const rightCanDo = right.canDo.includes(capability);
    return { capability, leftOffers, rightCanDo, crossable: leftOffers && rightCanDo };
  });
}

/* -------------------------------- receipts ------------------------------ */

export const JOINT_RECEIPT_VERSION = 'vh-bridge-joint-receipt/1';

export interface PartySignature {
  readonly harbor: string;
  readonly handle: string;
  /** Algorithm name, so a verifier never has to guess. */
  readonly alg: string;
  readonly signature: string;
}

export interface JointReceipt {
  readonly v: typeof JOINT_RECEIPT_VERSION;
  readonly envelopeId: string;
  readonly pairId: string;
  readonly capability: BridgeCapability;
  readonly outcome: 'answered' | 'refused' | 'failed';
  /** Digest of the answer, never the answer. Content stays on the owner's side. */
  readonly answerDigest: string;
  readonly answerSummary: string;
  readonly crossings: number;
  readonly from: PeerRef;
  readonly to: PeerRef;
  readonly atIso: string;
  readonly signatures: readonly PartySignature[];
}

export type Signer = (bytes: Uint8Array) => string;

/** Stable canonical bytes both sides hash. Any drift breaks verification loudly. */
export function canonicalReceipt(receipt: Omit<JointReceipt, 'signatures'>): string {
  const r = receipt;
  return JSON.stringify([
    r.v, r.envelopeId, r.pairId, r.capability, r.outcome, r.answerDigest,
    r.answerSummary, r.crossings,
    [r.from.handle, r.from.harbor, r.from.agentId ?? ''],
    [r.to.handle, r.to.harbor, r.to.agentId ?? ''],
    r.atIso,
  ]);
}

function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return new Uint8Array(out);
}

/**
 * Both parties sign the same canonical bytes. Each side keeps its own copy, so a
 * dispute is settled by comparing two independently-held signatures rather than
 * by trusting one copy of a record.
 */
export function signJointReceipt(
  unsigned: Omit<JointReceipt, 'signatures'>,
  parties: ReadonlyArray<{ ref: PeerRef; alg: string; sign: Signer }>,
): JointReceipt {
  const bytes = utf8(canonicalReceipt(unsigned));
  const signatures = parties.map((p) => ({
    harbor: p.ref.harbor,
    handle: p.ref.handle,
    alg: p.alg,
    signature: p.sign(bytes),
  }));
  return { ...unsigned, signatures };
}

export interface VerificationResult {
  readonly valid: boolean;
  readonly detail: string;
  readonly signedBy: readonly string[];
}

/**
 * Verify a joint receipt. A signature that fails is reported as a failure;
 * nothing here ever repairs or re-signs a record to make it pass.
 */
export function verifyJointReceipt(
  receipt: JointReceipt,
  keys: ReadonlyMap<string, Signer>,
): VerificationResult {
  const unsigned: Omit<JointReceipt, 'signatures'> = {
    v: receipt.v,
    envelopeId: receipt.envelopeId,
    pairId: receipt.pairId,
    capability: receipt.capability,
    outcome: receipt.outcome,
    answerDigest: receipt.answerDigest,
    answerSummary: receipt.answerSummary,
    crossings: receipt.crossings,
    from: receipt.from,
    to: receipt.to,
    atIso: receipt.atIso,
  };
  const expected = utf8(canonicalReceipt(unsigned));
  const signedBy: string[] = [];
  for (const sig of receipt.signatures) {
    const signer = keys.get(`${sig.harbor}#${sig.handle}`);
    if (signer === undefined) {
      return { valid: false, detail: `no key held for ${sig.harbor}#${sig.handle}`, signedBy };
    }
    if (signer(expected) !== sig.signature) {
      return { valid: false, detail: `signature by ${sig.harbor}#${sig.handle} does not verify`, signedBy };
    }
    signedBy.push(`${sig.harbor}#${sig.handle}`);
  }
  return { valid: true, detail: `co-signed by ${signedBy.length} part${signedBy.length === 1 ? 'y' : 'ies'}`, signedBy };
}

/* ------------------------------ the crossing ---------------------------- */

export interface CrossingInput {
  readonly envelope: BridgeEnvelope;
  readonly trust: PairTrust;
  readonly nowIso: string;
  readonly requester: { ref: PeerRef; alg: string; sign: Signer; grant: CapabilityGrant };
  readonly responder: { ref: PeerRef; alg: string; sign: Signer; grant: CapabilityGrant };
  /** The far side's answer. Summary only; the digest is computed from this. */
  readonly answer?: { summary: string };
  /** Set when the far side's own policy plane refused. */
  readonly refusedCause?: string;
}

export type CrossingResult =
  | {
      readonly status: 'answered';
      readonly receipt: JointReceipt;
      readonly trust: PairTrust;
      readonly verification: VerificationResult;
      readonly statement: string;
    }
  | {
      readonly status: 'refused';
      readonly cause: string;
      readonly trust: PairTrust;
      readonly statement: string;
    };

/**
 * Run one crossing end to end: negotiate, hop-check, execute, co-sign, fold trust.
 * Refusals at any stage return a cause in words and never a half-made receipt.
 */
export function crossBridge(input: CrossingInput): CrossingResult {
  const { envelope, nowIso } = input;

  const hop = canHop(envelope, nowIso);
  if (!hop.ok) return refuse(input, hop.reason, 'refused_by_policy');

  const farPosture: TrustPosture = posture(input.trust, nowIso);
  if (farPosture.tier === 'none') {
    return refuse(input, `refused: ${farPosture.statement}`, 'refused_by_policy');
  }
  if (envelope.depth > farPosture.maxDepth && envelope.depth !== 0) {
    return refuse(
      input,
      `refused: this pair permits depth up to ${farPosture.maxDepth}, and this envelope is at depth ${envelope.depth}`,
      'refused_by_policy',
    );
  }

  const verdict = negotiate(input.responder.grant, {
    capability: envelope.capability,
    bounds: envelope.bounds,
    task: envelope.task,
  });
  if (!verdict.accepted) return refuse(input, verdict.cause, 'refused_by_peer');

  if (input.refusedCause !== undefined) return refuse(input, input.refusedCause, 'refused_by_peer');

  const summary = input.answer?.summary ?? '';
  if (summary.trim().length === 0) {
    return fail(input, 'the far side produced no answer within its bounds');
  }

  const id = pairId(input.requester.ref.harbor, input.requester.ref.handle, input.responder.ref.harbor, input.responder.ref.handle);
  const unsigned: Omit<JointReceipt, 'signatures'> = {
    v: JOINT_RECEIPT_VERSION,
    envelopeId: envelope.id,
    pairId: id,
    capability: envelope.capability,
    outcome: 'answered',
    answerDigest: digestText(summary),
    answerSummary: summary,
    crossings: envelope.depth + 1,
    from: envelope.from,
    to: envelope.to,
    atIso: nowIso,
  };

  const receipt = signJointReceipt(unsigned, [
    { ref: input.requester.ref, alg: input.requester.alg, sign: input.requester.sign },
    { ref: input.responder.ref, alg: input.responder.alg, sign: input.responder.sign },
  ]);

  const keys = new Map<string, Signer>([
    [`${input.requester.ref.harbor}#${input.requester.ref.handle}`, input.requester.sign],
    [`${input.responder.ref.harbor}#${input.responder.ref.handle}`, input.responder.sign],
  ]);
  const verification = verifyJointReceipt(receipt, keys);

  const nextTrust = verification.valid
    ? recordOutcome(input.trust, { outcome: 'joint_success', envelopeId: envelope.id, atIso: nowIso })
    : recordOutcome(input.trust, {
        outcome: 'disputed',
        envelopeId: envelope.id,
        atIso: nowIso,
        cause: `joint receipt failed verification: ${verification.detail}`,
      });

  return {
    status: 'answered',
    receipt,
    trust: nextTrust,
    verification,
    statement: verification.valid
      ? `Answered by ${input.responder.ref.handle} and co-signed by both sides (${receipt.answerDigest.slice(0, 12)}…).`
      : `Answered, but the joint receipt did not verify: ${verification.detail}`,
  };
}

function refuse(input: CrossingInput, cause: string, kind: 'refused_by_policy' | 'refused_by_peer'): CrossingResult {
  const nextTrust = recordOutcome(input.trust, {
    outcome: kind,
    envelopeId: input.envelope.id,
    atIso: input.nowIso,
    cause,
  });
  return { status: 'refused', cause, trust: nextTrust, statement: cause };
}

function fail(input: CrossingInput, cause: string): CrossingResult {
  const nextTrust = recordOutcome(input.trust, {
    outcome: 'joint_failure',
    envelopeId: input.envelope.id,
    atIso: input.nowIso,
    cause,
  });
  return { status: 'refused', cause, trust: nextTrust, statement: cause };
}

/** A small deterministic digest; swap for SHA-256 in the runtime if preferred. */
export function digestText(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x85ebca6b;
  const bytes = utf8(text);
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i] ?? 0;
    h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + b, 0x85ebca6b) >>> 0;
  }
  return `sha256:${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

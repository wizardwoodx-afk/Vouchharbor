/**
 * approval.ts — the human gate on a pair's FIRST crossing, as a signed record.
 *
 * WHY THIS IS A MODULE AND NOT A FLAG. The first version of the bridge documented
 * `VH_BRIDGE_REQUIRE_HUMAN_FIRST` in a manifest and never consulted it. A rule
 * that lives only in configuration is a claim; a rule the engine refuses without
 * is a gate. And "a human approved" is worth exactly as much as the evidence that
 * a *specific* human approved *this* crossing — so approval is a signed,
 * expiring, nonce-bound record from the owner's own key, not a boolean.
 *
 * The binding matters as much as the signature. An approval carries the pair id,
 * the envelope id and the envelope's nonce, so it authorises one crossing and
 * cannot be lifted onto another request, another capability or another peer.
 */

import {
  verifySignature,
  type HarborKeys,
  type HarborPublicKey,
  type KeyRegistry,
  lookupKey,
} from './keys';
import { utf8Bytes } from './keys';

export const APPROVAL_VERSION = 'vh-bridge-approval/1';

export interface ApprovalBody {
  readonly v: typeof APPROVAL_VERSION;
  readonly pairId: string;
  /** The one envelope this authorises. */
  readonly envelopeId: string;
  /** The envelope's nonce: an approval cannot be replayed onto a re-issued request. */
  readonly envelopeNonce: string;
  readonly capability: string;
  readonly approvedBy: { readonly handle: string; readonly harbor: string };
  readonly approvedAtIso: string;
  readonly expiresIso: string;
  /** The human's own words for what they are allowing. Required, and read by people. */
  readonly statement: string;
}

export interface ApprovalSignature {
  readonly harbor: string;
  readonly handle: string;
  readonly keyId: string;
  readonly alg: string;
  readonly signature: string;
}

export interface SignedApproval {
  readonly body: ApprovalBody;
  readonly signer: ApprovalSignature;
}

export function canonicalApproval(body: ApprovalBody): string {
  return JSON.stringify([
    body.v,
    body.pairId,
    body.envelopeId,
    body.envelopeNonce,
    body.capability,
    [body.approvedBy.handle, body.approvedBy.harbor],
    body.approvedAtIso,
    body.expiresIso,
    body.statement,
  ]);
}

export class ApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApprovalError';
  }
}

export interface ApprovalRequest {
  readonly pairId: string;
  readonly envelopeId: string;
  readonly envelopeNonce: string;
  readonly capability: string;
  readonly handle: string;
  readonly harbor: string;
  readonly statement: string;
  readonly approvedAtIso: string;
  readonly expiresIso: string;
}

/** The human's own key signs the approval. The bridge never mints one itself. */
export async function signApproval(request: ApprovalRequest, keys: HarborKeys): Promise<SignedApproval> {
  if (request.statement.trim().length < 8) {
    throw new ApprovalError('an approval must state, in words, what the person is allowing');
  }
  if (Date.parse(request.expiresIso) <= Date.parse(request.approvedAtIso)) {
    throw new ApprovalError('an approval must expire after it is given');
  }
  const body: ApprovalBody = {
    v: APPROVAL_VERSION,
    pairId: request.pairId,
    envelopeId: request.envelopeId,
    envelopeNonce: request.envelopeNonce,
    capability: request.capability,
    approvedBy: { handle: request.handle, harbor: request.harbor },
    approvedAtIso: request.approvedAtIso,
    expiresIso: request.expiresIso,
    statement: request.statement,
  };
  return {
    body,
    signer: {
      harbor: keys.harbor,
      handle: request.handle,
      keyId: keys.keyId,
      alg: keys.alg,
      signature: await keys.sign(utf8Bytes(canonicalApproval(body))),
    },
  };
}

export interface ApprovalExpectation {
  readonly pairId: string;
  readonly envelopeId: string;
  readonly envelopeNonce: string;
  readonly capability: string;
  readonly nowIso: string;
  /** The harbour whose owner is being asked to approve. */
  readonly ownerHarbor: string;
  /** The owner's public key, if the caller holds it already. */
  readonly ownerKey?: HarborPublicKey;
}

export interface ApprovalVerdict {
  readonly ok: boolean;
  /** Always set: people read this, and a refusal without a cause is not a refusal. */
  readonly reason: string;
}

/**
 * Check an approval against the crossing it claims to authorise. Every failure
 * returns a reason a person can act on — "expired 4 minutes ago" is actionable,
 * "invalid approval" is not.
 */
export async function verifyApproval(
  approval: SignedApproval,
  registry: KeyRegistry,
  expect: ApprovalExpectation,
): Promise<ApprovalVerdict> {
  const { body, signer } = approval;
  if (body.v !== APPROVAL_VERSION) {
    return { ok: false, reason: `approval is version ${body.v}; this bridge reads ${APPROVAL_VERSION}` };
  }
  if (body.pairId !== expect.pairId) {
    return { ok: false, reason: 'approval names a different pair; an approval is not transferable' };
  }
  if (body.envelopeId !== expect.envelopeId || body.envelopeNonce !== expect.envelopeNonce) {
    return {
      ok: false,
      reason: 'approval names a different envelope or nonce; an approval authorises one crossing, not a category of them',
    };
  }
  if (body.capability !== expect.capability) {
    return { ok: false, reason: `approval authorises "${body.capability}", not "${expect.capability}"` };
  }
  if (body.approvedBy.harbor !== expect.ownerHarbor) {
    return {
      ok: false,
      reason: `approval was given at ${body.approvedBy.harbor}, but the owner on this side is ${expect.ownerHarbor}`,
    };
  }
  if (signer.harbor !== body.approvedBy.harbor || signer.handle !== body.approvedBy.handle) {
    return { ok: false, reason: 'the signature does not belong to the person the approval names' };
  }

  const now = Date.parse(expect.nowIso);
  const issued = Date.parse(body.approvedAtIso);
  const expires = Date.parse(body.expiresIso);
  if (Number.isNaN(now) || Number.isNaN(issued) || Number.isNaN(expires)) {
    return { ok: false, reason: 'approval timestamps are not readable instants' };
  }
  if (issued > now) {
    return { ok: false, reason: `approval is dated ${body.approvedAtIso}, which is in the future` };
  }
  if (now >= expires) {
    const minutes = Math.round((now - expires) / 60000);
    return { ok: false, reason: `approval expired ${minutes} minute(s) ago at ${body.expiresIso}` };
  }

  const key = expect.ownerKey ?? lookupKey(registry, signer.harbor, signer.keyId);
  if (key === undefined) {
    return { ok: false, reason: `no public key held for ${signer.harbor}#${signer.keyId}; an approval that cannot be checked is not an approval` };
  }
  const valid = await verifySignature(key, utf8Bytes(canonicalApproval(body)), signer.signature);
  if (!valid) {
    return { ok: false, reason: `the approval's signature by ${signer.harbor}#${signer.handle} does not verify` };
  }
  return { ok: true, reason: `approved by ${body.approvedBy.handle}@${body.approvedBy.harbor}: ${body.statement}` };
}

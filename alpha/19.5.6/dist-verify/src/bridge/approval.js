"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalError = exports.APPROVAL_VERSION = void 0;
exports.canonicalApproval = canonicalApproval;
exports.signApproval = signApproval;
exports.verifyApproval = verifyApproval;
const keys_1 = require("./keys");
const keys_2 = require("./keys");
exports.APPROVAL_VERSION = 'vh-bridge-approval/1';
function canonicalApproval(body) {
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
class ApprovalError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ApprovalError';
    }
}
exports.ApprovalError = ApprovalError;
/** The human's own key signs the approval. The bridge never mints one itself. */
async function signApproval(request, keys) {
    if (request.statement.trim().length < 8) {
        throw new ApprovalError('an approval must state, in words, what the person is allowing');
    }
    if (Date.parse(request.expiresIso) <= Date.parse(request.approvedAtIso)) {
        throw new ApprovalError('an approval must expire after it is given');
    }
    const body = {
        v: exports.APPROVAL_VERSION,
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
            signature: await keys.sign((0, keys_2.utf8Bytes)(canonicalApproval(body))),
        },
    };
}
/**
 * Check an approval against the crossing it claims to authorise. Every failure
 * returns a reason a person can act on — "expired 4 minutes ago" is actionable,
 * "invalid approval" is not.
 */
async function verifyApproval(approval, registry, expect) {
    const { body, signer } = approval;
    if (body.v !== exports.APPROVAL_VERSION) {
        return { ok: false, reason: `approval is version ${body.v}; this bridge reads ${exports.APPROVAL_VERSION}` };
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
    const key = expect.ownerKey ?? (0, keys_1.lookupKey)(registry, signer.harbor, signer.keyId);
    if (key === undefined) {
        return { ok: false, reason: `no public key held for ${signer.harbor}#${signer.keyId}; an approval that cannot be checked is not an approval` };
    }
    const valid = await (0, keys_1.verifySignature)(key, (0, keys_2.utf8Bytes)(canonicalApproval(body)), signer.signature);
    if (!valid) {
        return { ok: false, reason: `the approval's signature by ${signer.harbor}#${signer.handle} does not verify` };
    }
    return { ok: true, reason: `approved by ${body.approvedBy.handle}@${body.approvedBy.harbor}: ${body.statement}` };
}

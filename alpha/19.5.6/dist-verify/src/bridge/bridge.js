"use strict";
/**
 * bridge.ts — the crossing. Two owners, two harbors, two keys, one co-signed record.
 *
 * WHAT CHANGED AFTER REVIEW. The first version of this file was honest about its
 * own limits and wrong about three of them:
 *
 *   1. A "signature" was one function called twice — signing and verifying were the
 *      same operation, so a receipt proved nothing about who produced it. Now each
 *      harbour signs with its own ECDSA P-256 key and each verifies with the
 *      **other's public key** (`keys.ts`).
 *   2. `VH_BRIDGE_REQUIRE_HUMAN_FIRST` was documented in a manifest and never read.
 *      Now the first crossing of a pair is **refused** unless it carries a signed,
 *      expiring, nonce-bound approval from the owner (`approval.ts`).
 *   3. Trust arrived as a parameter. Now it is folded from **verified signed
 *      records** in the pair's ledger (`ledger.ts`): a warm number handed in by a
 *      buggy integration no longer exists as a concept.
 *
 * Everything the first version got right is untouched: typed envelopes, bounds that
 * travel, intersect-only negotiation, refusals with causes, and a joint receipt
 * that carries a digest of the answer rather than the answer.
 *
 * Additive module. No core file is touched. No canonical receipt form is modified.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUMMARY_MAX = exports.JOINT_RECEIPT_VERSION = void 0;
exports.negotiate = negotiate;
exports.capabilityMatrix = capabilityMatrix;
exports.signEnvelope = signEnvelope;
exports.verifySignedEnvelope = verifySignedEnvelope;
exports.canonicalReceipt = canonicalReceipt;
exports.signReceiptHalf = signReceiptHalf;
exports.assembleJointReceipt = assembleJointReceipt;
exports.verifyJointReceipt = verifyJointReceipt;
exports.envelopePreamble = envelopePreamble;
exports.crossBridge = crossBridge;
exports.summarise = summarise;
exports.respondToCrossing = respondToCrossing;
const envelope_1 = require("./envelope");
const keys_1 = require("./keys");
const approval_1 = require("./approval");
const trust_1 = require("./trust");
/**
 * Negotiation can only ever narrow: the result is `offers ∩ canDo` and there is no
 * code path that grants a capability because somebody asked for it. A refusal
 * names what *is* available, because the far side is entitled to know which door
 * to knock on — and never includes the capability it just refused.
 */
function negotiate(grant, request) {
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
        cause: `accepted "${request.capability}" with depth limit ${request.bounds.maxDepth}`,
        capability: request.capability,
        note: `accepted "${request.capability}" with depth limit ${request.bounds.maxDepth}`,
    };
}
/** Every capability in the catalogue, for the UI's negotiation matrix. */
function capabilityMatrix(left, right) {
    const all = [...new Set([...left.offers, ...left.canDo, ...right.canDo])].sort();
    return all.map((capability) => {
        const leftOffers = left.offers.includes(capability) && left.canDo.includes(capability);
        const rightCanDo = right.canDo.includes(capability);
        return { capability, leftOffers, rightCanDo, crossable: leftOffers && rightCanDo };
    });
}
/**
 * The requester signs the envelope, so the receiver can tell that the request came
 * from the harbour it claims to come from. Without this, any client could present
 * itself as any peer and the pair's trust would be worth nothing.
 */
async function signEnvelope(envelope, keys) {
    if (keys.harbor !== envelope.from.harbor) {
        throw new Error(`refused: a harbor may only sign envelopes it sent (signing as ${keys.harbor}, envelope from ${envelope.from.harbor})`);
    }
    return {
        envelope,
        signer: {
            harbor: envelope.from.harbor,
            handle: envelope.from.handle,
            keyId: keys.keyId,
            alg: keys.alg,
            signature: await keys.sign((0, keys_1.utf8Bytes)((0, envelope_1.canonicalEnvelope)(envelope))),
        },
    };
}
async function verifySignedEnvelope(signed, registry) {
    const problems = (0, envelope_1.validateEnvelope)(signed.envelope);
    if (problems.length > 0) {
        return { ok: false, reason: `envelope refused: ${problems.map((p) => `${p.field} ${p.problem}`).join('; ')}` };
    }
    const { envelope, signer } = signed;
    if (signer.harbor !== envelope.from.harbor || signer.handle !== envelope.from.handle) {
        return { ok: false, reason: 'the envelope signature does not belong to the sender it names' };
    }
    const key = (0, keys_1.lookupKey)(registry, signer.harbor, signer.keyId);
    if (key === undefined) {
        return { ok: false, reason: `no public key held for ${signer.harbor}#${signer.keyId}; an unverifiable request is refused` };
    }
    const valid = await (0, keys_1.verifySignature)(key, (0, keys_1.utf8Bytes)((0, envelope_1.canonicalEnvelope)(envelope)), signer.signature);
    return valid
        ? { ok: true, reason: `request signed by ${signer.handle}@${signer.harbor}` }
        : { ok: false, reason: `the envelope's signature by ${signer.harbor} does not verify` };
}
/* -------------------------------- receipts ------------------------------ */
exports.JOINT_RECEIPT_VERSION = 'vh-bridge-joint-receipt/2';
/** Stable canonical bytes both sides sign. Any drift breaks verification loudly. */
function canonicalReceipt(receipt) {
    const r = receipt;
    return JSON.stringify([
        r.v, r.envelopeId, r.envelopeNonce, r.pairId, r.capability, r.outcome, r.answerDigest,
        r.answerSummary, r.crossings,
        [r.from.handle, r.from.harbor, r.from.agentId ?? ''],
        [r.to.handle, r.to.harbor, r.to.agentId ?? ''],
        r.atIso,
    ]);
}
/**
 * One side's half of a receipt. In a real crossing each harbour signs on its own
 * machine over identical canonical bytes and only the signature travels — so
 * neither side ever holds the other's private key, and neither can produce the
 * other's half.
 */
async function signReceiptHalf(unsigned, keys, as) {
    if (as.harbor !== keys.harbor) {
        throw new Error(`refused: ${keys.harbor} cannot sign a receipt half as ${as.harbor}`);
    }
    return {
        harbor: as.harbor,
        handle: as.handle,
        keyId: keys.keyId,
        alg: keys.alg,
        signature: await keys.sign((0, keys_1.utf8Bytes)(canonicalReceipt(unsigned))),
    };
}
function assembleJointReceipt(unsigned, signatures) {
    if (signatures.length !== 2) {
        throw new Error(`refused: a joint receipt carries two signatures, got ${signatures.length}`);
    }
    const [a, b] = signatures;
    if (a.harbor === b.harbor) {
        throw new Error('refused: a joint receipt must carry two different harbors; one harbour is not a joint record');
    }
    return { ...unsigned, signatures: [a, b] };
}
/**
 * Verify a joint receipt against **public keys**. Each signature is checked
 * against the key its harbour published; nothing here re-signs anything, so a
 * verifier can confirm a crossing it is incapable of producing.
 */
async function verifyJointReceipt(receipt, registry) {
    if (receipt.v !== exports.JOINT_RECEIPT_VERSION) {
        return { valid: false, detail: `receipt is version ${receipt.v}; this bridge reads ${exports.JOINT_RECEIPT_VERSION}`, signedBy: [], failures: [] };
    }
    const unsigned = {
        v: receipt.v,
        envelopeId: receipt.envelopeId,
        envelopeNonce: receipt.envelopeNonce,
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
    const bytes = (0, keys_1.utf8Bytes)(canonicalReceipt(unsigned));
    const signedBy = [];
    const failures = [];
    for (const sig of receipt.signatures) {
        const who = `${sig.harbor}#${sig.handle}`;
        const key = (0, keys_1.lookupKey)(registry, sig.harbor, sig.keyId);
        if (key === undefined) {
            failures.push(`${who}: no public key held for key ${sig.keyId}`);
            continue;
        }
        if (sig.alg !== key.alg) {
            failures.push(`${who}: signed with ${sig.alg}, key is ${key.alg}`);
            continue;
        }
        if (await (0, keys_1.verifySignature)(key, bytes, sig.signature))
            signedBy.push(who);
        else
            failures.push(`${who}: signature does not verify against the published key`);
    }
    if (failures.length > 0) {
        return {
            valid: false,
            detail: `joint receipt rejected: ${failures.join('; ')}`,
            signedBy,
            failures,
        };
    }
    if (new Set(receipt.signatures.map((s) => s.harbor)).size !== 2) {
        return { valid: false, detail: 'joint receipt rejected: both signatures come from one harbor', signedBy, failures: ['one harbor'] };
    }
    const expectedPair = (0, trust_1.pairId)(receipt.from.harbor, receipt.from.handle, receipt.to.harbor, receipt.to.handle);
    if (receipt.pairId !== expectedPair) {
        return { valid: false, detail: `joint receipt rejected: pair id ${receipt.pairId} does not match the parties`, signedBy, failures: ['pair id'] };
    }
    return {
        valid: true,
        detail: `co-signed by ${signedBy.join(' and ')}, each verified against a published public key`,
        signedBy,
        failures: [],
    };
}
function envelopePreamble(envelope) {
    const pair = (0, trust_1.pairId)(envelope.from.harbor, envelope.from.handle, envelope.to.harbor, envelope.to.handle);
    return {
        v: exports.JOINT_RECEIPT_VERSION,
        envelopeId: envelope.id,
        envelopeNonce: envelope.nonce,
        pairId: pair,
        capability: envelope.capability,
        outcome: 'answered',
        answerDigest: '',
        answerSummary: '',
        crossings: envelope.depth + 1,
        from: envelope.from,
        to: envelope.to,
        atIso: '',
    };
}
/**
 * Perform one crossing from this harbour's side.
 *
 * Order is the governance, and it is deliberate: identify the peer, then check
 * whether this pair may cross at all, then require a human if it is the first
 * time, then intersect capabilities, then take the far side's answer — and only
 * then write anything down.
 */
async function crossBridge(input) {
    const { envelope, keys, registry, ledger, nowIso } = input;
    const pair = (0, trust_1.pairId)(envelope.from.harbor, envelope.from.handle, envelope.to.harbor, envelope.to.handle);
    const refuse = async (cause, kind, record) => {
        if (record !== undefined) {
            await ledger.attest({
                pairId: pair,
                kind: record.kind,
                atIso: nowIso,
                envelopeId: envelope.id,
                receiptDigest: '',
                note: record.note,
            }, keys);
        }
        const postureNow = await ledger.postureOf(pair, nowIso);
        return {
            status: 'refused',
            cause,
            refusalKind: kind,
            posture: postureNow,
            statement: `${cause} Trust is now ${postureNow.score}/100 (${postureNow.tier}).`,
        };
    };
    /* 1. Is the request itself well-formed, and did it come from who it says? */
    if (input.signedEnvelope !== undefined) {
        const verdict = await verifySignedEnvelope(input.signedEnvelope, registry);
        if (!verdict.ok)
            return refuse(verdict.reason, 'refused_by_policy');
    }
    const problems = (0, envelope_1.validateEnvelope)(envelope);
    if (problems.length > 0) {
        return refuse(`refused: the envelope is malformed — ${problems.map((p) => `${p.field} ${p.problem}`).join('; ')}`, 'refused_by_policy');
    }
    /* 2. Bounds travel with the request. A hop out of depth or out of time is refused. */
    const hop = (0, envelope_1.canHop)({ ...envelope, depth: envelope.depth - 1 < 0 ? 0 : envelope.depth - 1 }, nowIso);
    if (envelope.depth > 0 && !hop.ok)
        return refuse(hop.reason, 'refused_by_policy');
    /* 3. Trust is read, never supplied. */
    const postureNow = await ledger.postureOf(pair, nowIso);
    if (postureNow.tier === 'none') {
        return refuse(`refused: ${postureNow.statement}`, 'refused_by_policy');
    }
    if (envelope.depth > postureNow.maxDepth) {
        return refuse(`refused: this pair permits depth up to ${postureNow.maxDepth}, and this envelope is at depth ${envelope.depth}`, 'refused_by_policy');
    }
    /* 4. The first crossing of a pair needs a person, and needs proof of one. */
    const humanFirst = input.requireHumanFirstCrossing !== false;
    if (humanFirst) {
        const crossedBefore = await ledger.hasCrossedBefore(pair);
        if (!crossedBefore) {
            if (input.approval === undefined) {
                /* A procedural hold, not a judgement against the peer: no trust moves. */
                return refuse(`refused: this would be the first crossing with ${envelope.to.handle}@${envelope.to.harbor}, and a person has to approve it. Gather an approval for pair ${pair} and envelope ${envelope.id} (nonce ${envelope.nonce}) and present it with the request.`, 'approval_required');
            }
            const approved = await (0, approval_1.verifyApproval)(input.approval, registry, {
                pairId: pair,
                envelopeId: envelope.id,
                envelopeNonce: envelope.nonce,
                capability: envelope.capability,
                nowIso,
                ownerHarbor: keys.harbor,
            });
            if (!approved.ok)
                return refuse(`refused: ${approved.reason}`, 'approval_required');
        }
    }
    /* 5. Capability is intersected, never granted. */
    const verdict = negotiate(input.ours, {
        capability: envelope.capability,
        bounds: envelope.bounds,
        task: envelope.task,
    });
    if (!verdict.accepted)
        return refuse(verdict.cause, 'refused_by_policy');
    /* 6. The far side's own posture is consulted, not assumed. */
    if (!input.peerGrant.canDo.includes(envelope.capability)) {
        const theyCan = [...new Set(input.peerGrant.canDo)].sort().join(', ') || 'nothing';
        return refuse(`refused: ${envelope.to.handle}@${envelope.to.harbor} cannot perform "${envelope.capability}" on a bridge; they can do ${theyCan}`, 'refused_by_policy');
    }
    /* 7. What the far side actually answered. */
    if (input.peerReply.status === 'refused') {
        return refuse(input.peerReply.cause, 'refused_by_peer', {
            kind: 'peer-refusal',
            note: input.peerReply.cause,
        });
    }
    if (input.peerReply.status === 'failed') {
        await ledger.attest({ pairId: pair, kind: 'failure', atIso: nowIso, envelopeId: envelope.id, receiptDigest: '', note: input.peerReply.cause }, keys);
        const afterFailure = await ledger.postureOf(pair, nowIso);
        return {
            status: 'failed',
            cause: input.peerReply.cause,
            posture: afterFailure,
            statement: `${input.peerReply.cause} Trust is now ${afterFailure.score}/100 (${afterFailure.tier}).`,
        };
    }
    /* 8. Assemble the joint receipt from two independently produced halves. */
    const preamble = envelopePreamble(envelope);
    const unsigned = {
        ...preamble,
        capability: envelope.capability,
        outcome: 'answered',
        answerDigest: input.peerReply.answerDigest,
        answerSummary: input.peerReply.summary,
        crossings: input.crossings ?? envelope.depth + 1,
        atIso: nowIso,
    };
    const theirLine = summarise(input.peerReply.summary);
    if (!theirLine.ok) {
        return refuse(`refused: the far side's receipt summary is not publishable — ${theirLine.reason.replace('refused: ', '')}`, 'refused_by_policy');
    }
    const theirHalf = input.peerReply.signature;
    const theirKey = (0, keys_1.lookupKey)(registry, theirHalf.harbor, theirHalf.keyId);
    const theirHalfOk = theirKey !== undefined &&
        theirHalf.harbor === envelope.to.harbor &&
        (await (0, keys_1.verifySignature)(theirKey, (0, keys_1.utf8Bytes)(canonicalReceipt(unsigned)), theirHalf.signature));
    if (!theirHalfOk) {
        /* A half that does not verify is a dispute, and disputes cost the most. */
        return refuse(`refused: the far side's half-signature over envelope ${envelope.id} does not verify against their published key; the crossing is recorded as a dispute`, 'disputed', {
            kind: 'dispute',
            note: `half-signature over envelope ${envelope.id} failed to verify against ${theirHalf.harbor}#${theirHalf.keyId}`,
        });
    }
    const ourHalf = await signReceiptHalf(unsigned, keys, { handle: envelope.from.handle, harbor: envelope.from.harbor });
    const receipt = assembleJointReceipt(unsigned, [ourHalf, theirHalf]);
    const verification = await verifyJointReceipt(receipt, registry);
    if (!verification.valid) {
        return refuse(`refused: ${verification.detail}`, 'disputed', {
            kind: 'dispute',
            note: `joint receipt for envelope ${envelope.id} failed verification: ${verification.failures.join('; ')}`,
        });
    }
    await ledger.attest({
        pairId: pair,
        kind: 'success',
        atIso: nowIso,
        envelopeId: envelope.id,
        receiptDigest: verification.signedBy.length === 2 ? `vh1:sha256:${shortDigest(canonicalReceipt(unsigned))}` : '',
        note: `${envelope.capability} answered over ${verification.signedBy.length} signatures`,
    }, keys);
    const afterSuccess = await ledger.postureOf(pair, nowIso);
    return {
        status: 'answered',
        receipt,
        verification,
        posture: afterSuccess,
        statement: `${verification.detail}. Trust is now ${afterSuccess.score}/100 (${afterSuccess.tier}).`,
    };
}
/** A short, stable label for a record. Not a signature and never presented as one. */
function shortDigest(text) {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < text.length; i += 1) {
        const c = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
        h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
    }
    return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 24);
}
/* ------------------------------- the far side ----------------------------- */
/**
 * A summary is what the far side chooses to *publish* on the receipt, so it is
 * held to a publishing standard: one line, bounded, no newlines. Without this the
 * summary field is where an entire answer gets smuggled back across the boundary
 * the receipt otherwise protects.
 */
exports.SUMMARY_MAX = 200;
function summarise(summary) {
    if (summary.includes('\n') || summary.includes('\r')) {
        return { ok: false, reason: 'refused: a receipt summary must be one line; send the answer itself through your own channel, not through the receipt' };
    }
    if (summary.trim().length === 0) {
        return { ok: false, reason: 'refused: a receipt must say, in one line, what was answered' };
    }
    if (summary.length > exports.SUMMARY_MAX) {
        return { ok: false, reason: `refused: a receipt summary must not exceed ${exports.SUMMARY_MAX} characters (got ${summary.length}); a digest is not a delivery mechanism` };
    }
    return { ok: true, reason: 'one line, bounded' };
}
/**
 * The far side's half of a crossing: verify the request, check our own grant, and
 * either refuse with a cause or sign our half over the same canonical bytes. This
 * is what a peer runs on its own machine; the private key here never leaves it.
 */
async function respondToCrossing(input) {
    const { signed, keys, registry, ledger, nowIso } = input;
    const envelope = signed.envelope;
    const pair = (0, trust_1.pairId)(envelope.from.harbor, envelope.from.handle, envelope.to.harbor, envelope.to.handle);
    const verdict = await verifySignedEnvelope(signed, registry);
    if (!verdict.ok)
        return { status: 'refused', cause: `refused: ${verdict.reason}`, statement: verdict.reason };
    const postureNow = await ledger.postureOf(pair, nowIso);
    if (postureNow.tier === 'none') {
        return { status: 'refused', cause: `refused: ${postureNow.statement}`, statement: postureNow.statement };
    }
    if (input.requireHumanFirstCrossing !== false) {
        const crossedBefore = await ledger.hasCrossedBefore(pair);
        if (!crossedBefore) {
            return {
                status: 'refused',
                cause: `refused: this is the first crossing this harbor has recorded with ${envelope.from.handle}@${envelope.from.harbor}; a person here must approve it before the first answer`,
                statement: 'the first crossing needs a person on both sides',
            };
        }
    }
    if (input.refuseCause !== undefined) {
        await ledger.attest({ pairId: pair, kind: 'policy-refusal', atIso: nowIso, envelopeId: envelope.id, receiptDigest: '', note: input.refuseCause }, keys);
        return { status: 'refused', cause: input.refuseCause, statement: input.refuseCause };
    }
    const own = negotiate(input.ours, { capability: envelope.capability, bounds: envelope.bounds, task: envelope.task });
    if (!own.accepted) {
        await ledger.attest({ pairId: pair, kind: 'policy-refusal', atIso: nowIso, envelopeId: envelope.id, receiptDigest: '', note: own.cause }, keys);
        return { status: 'refused', cause: own.cause, statement: own.cause };
    }
    if (input.answer === undefined) {
        return { status: 'refused', cause: 'refused: no answer was produced, so no receipt half is signed', statement: 'nothing to sign' };
    }
    const line = summarise(input.answer.summary);
    if (!line.ok) {
        return { status: 'refused', cause: line.reason, statement: line.reason };
    }
    const unsigned = {
        ...envelopePreamble(envelope),
        capability: envelope.capability,
        outcome: 'answered',
        answerDigest: input.answer.digest,
        answerSummary: input.answer.summary,
        crossings: envelope.depth + 1,
        atIso: nowIso,
    };
    const signature = await signReceiptHalf(unsigned, keys, { handle: envelope.to.handle, harbor: envelope.to.harbor });
    return {
        status: 'accepted',
        unsigned,
        signature,
        statement: `${envelope.capability} answered; our half of the receipt is signed and the answer itself stays here`,
    };
}

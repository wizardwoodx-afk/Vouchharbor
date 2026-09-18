"use strict";
/**
 * trust.ts — pair trust: the ledger that makes a cross-user bridge safe to open twice.
 *
 * Vouch Harbor already has VouchMesh as a LOCAL collaboration trust fabric, and
 * the product docs are honest that two sides of a handoff are minted inside one
 * runtime. This module is the missing half: trust between two *different* users
 * on two *different* harbors, where neither side can see the other's ledger and
 * neither side can relabel what happened.
 *
 * The rules, deliberately boring:
 *   - A pair starts at a low, explicit score. Nothing is implicit.
 *   - Trust compounds on jointly co-signed success and degrades on refusal,
 *     failure and dispute. One event never swings it.
 *   - Trust decays with age, so a pair that worked well last year is not
 *     automatically trusted today.
 *   - A revocation is a lock, not a subtraction: no amount of history reopens it.
 *   - Every change names its cause, because "the score went down" is not evidence.
 *
 * Additive module. No store, no clock of its own, no I/O.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DECAY_PER_30_DAYS = exports.TRUST_WEIGHTS = exports.TrustError = exports.TRUST_START = exports.TRUST_MAX = exports.TRUST_MIN = void 0;
exports.pairId = pairId;
exports.newPairTrust = newPairTrust;
exports.recordOutcome = recordOutcome;
exports.reVouch = reVouch;
exports.effectiveScore = effectiveScore;
exports.trustTier = trustTier;
exports.posture = posture;
exports.TRUST_MIN = 0;
exports.TRUST_MAX = 100;
exports.TRUST_START = 20;
class TrustError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TrustError';
    }
}
exports.TrustError = TrustError;
/** A pair id is canonical and order-independent: A|B and B|A are one pair. */
function pairId(harborA, handleA, harborB, handleB) {
    const a = `${harborA}#${handleA}`;
    const b = `${harborB}#${handleB}`;
    const [first, second] = a <= b ? [a, b] : [b, a];
    return `pair:${first}<->${second}`;
}
function newPairTrust(id) {
    return { pairId: id, score: exports.TRUST_START, events: [], locked: false };
}
/** Points per outcome. Small on purpose: trust is a slope, not a switch. */
exports.TRUST_WEIGHTS = {
    joint_success: 6,
    joint_failure: -8,
    refused_by_policy: -3,
    refused_by_peer: -2,
    disputed: -20,
    revoked: 0,
};
const REQUIRES_CAUSE = ['refused_by_policy', 'refused_by_peer', 'disputed'];
const MAX_EVENTS_KEPT = 200;
function clamp(score) {
    if (score < exports.TRUST_MIN)
        return exports.TRUST_MIN;
    if (score > exports.TRUST_MAX)
        return exports.TRUST_MAX;
    return score;
}
/**
 * Fold one outcome into a pair's trust. Returns a new value; never mutates.
 */
function recordOutcome(current, input) {
    if (current.locked && input.outcome !== 'revoked') {
        throw new TrustError(`pair ${current.pairId} is revoked; only an explicit re-vouch reopens it`);
    }
    if (REQUIRES_CAUSE.includes(input.outcome) && (input.cause === undefined || input.cause.trim().length === 0)) {
        throw new TrustError(`${input.outcome} requires a cause: a refusal without a reason teaches the other side nothing`);
    }
    if (input.outcome === 'revoked') {
        const event = { at: input.atIso, outcome: 'revoked', envelopeId: input.envelopeId, cause: input.cause ?? 'revoked by owner' };
        return {
            ...current,
            score: exports.TRUST_MIN,
            locked: true,
            lastEventIso: input.atIso,
            events: [...current.events, event].slice(-MAX_EVENTS_KEPT),
        };
    }
    const delta = exports.TRUST_WEIGHTS[input.outcome];
    const event = input.cause === undefined
        ? { at: input.atIso, outcome: input.outcome, envelopeId: input.envelopeId }
        : { at: input.atIso, outcome: input.outcome, envelopeId: input.envelopeId, cause: input.cause };
    return {
        ...current,
        score: clamp(current.score + delta),
        locked: current.locked,
        lastEventIso: input.atIso,
        events: [...current.events, event].slice(-MAX_EVENTS_KEPT),
    };
}
/** Fresh-start score for a revoked pair. An owner may re-vouch explicitly. */
function reVouch(current, atIso, cause) {
    if (cause.trim().length === 0)
        throw new TrustError('a re-vouch must say why trust is being restored');
    const event = { at: atIso, outcome: 'joint_success', envelopeId: 're-vouch', cause: `re-vouched: ${cause}` };
    return {
        pairId: current.pairId,
        score: exports.TRUST_START,
        locked: false,
        lastEventIso: atIso,
        events: [...current.events, event].slice(-MAX_EVENTS_KEPT),
    };
}
exports.DECAY_PER_30_DAYS = 4;
/**
 * Trust is about the recent relationship, not the historical one. Applied on
 * read, never written back — so the stored ledger always says what actually happened.
 */
function effectiveScore(pair, nowIso) {
    if (pair.locked)
        return exports.TRUST_MIN;
    if (pair.lastEventIso === undefined)
        return pair.score;
    const last = Date.parse(pair.lastEventIso);
    const now = Date.parse(nowIso);
    if (Number.isNaN(last) || Number.isNaN(now) || now <= last)
        return pair.score;
    const months = (now - last) / (1000 * 60 * 60 * 24 * 30);
    return clamp(Math.round(pair.score - months * exports.DECAY_PER_30_DAYS));
}
function trustTier(score) {
    if (score <= exports.TRUST_MIN)
        return 'none';
    if (score < 35)
        return 'read_only';
    if (score < 70)
        return 'supervised';
    return 'standing';
}
function posture(pair, nowIso) {
    const score = effectiveScore(pair, nowIso);
    const tier = pair.locked ? 'none' : trustTier(score);
    const table = {
        none: { depth: 0, approval: true, words: 'no bridge may be opened' },
        read_only: { depth: 0, approval: true, words: 'may receive summaries only; may not hand work back' },
        supervised: { depth: 1, approval: true, words: 'may hand work back one hop, with a human approving the first crossing' },
        standing: { depth: 2, approval: false, words: 'may hand work back and forth up to two hops without a human in the loop' },
    };
    const row = table[tier];
    return {
        score,
        storedScore: pair.score,
        tier,
        locked: pair.locked,
        statement: pair.locked
            ? `This pair is revoked: ${row.words}.`
            : `Trust ${score}/100 (${tier}): ${row.words}.`,
        maxDepth: row.depth,
        requiresHumanApproval: row.approval,
    };
}

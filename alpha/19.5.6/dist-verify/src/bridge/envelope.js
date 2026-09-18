"use strict";
/**
 * envelope.ts — the typed cross-user handoff envelope.
 *
 * Vouch Harbor's differentiator is that one user's agent works directly with
 * another user's agent. That is a *crossing*: two different owners, two trust
 * roots, two policy planes, two ledgers. So the thing they pass to each other
 * cannot be free text.
 *
 * Design rule taken from the field (CopilotKit/OpenBot `docs/architecture.md`,
 * MIT): free-text delegation does not fail loudly — the receiving agent infers
 * the intent, guesses the constraints, and when it guesses wrong it does not
 * fail, it answers something else confidently. So a handoff here is typed:
 * task, bounds, and the shape of a good answer.
 *
 * Additive module. Depends on nothing. Never touches the mission loop.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntropyUnavailableError = exports.EnvelopeError = exports.BRIDGE_CAPABILITIES = exports.ENVELOPE_VERSION = void 0;
exports.isBridgeCapability = isBridgeCapability;
exports.csprngEntropy = csprngEntropy;
exports.seededEntropy = seededEntropy;
exports.buildEnvelope = buildEnvelope;
exports.validateEnvelope = validateEnvelope;
exports.canHop = canHop;
exports.canonicalEnvelope = canonicalEnvelope;
exports.ENVELOPE_VERSION = 'vh-bridge-envelope/1';
/** Capabilities an agent may be offered. A declaration never grants anything. */
exports.BRIDGE_CAPABILITIES = [
    'summarise',
    'research',
    'analyse',
    'draft',
    'review',
    'verify',
    'translate',
    'extract',
    'plan',
    'simulate',
];
function isBridgeCapability(value) {
    return exports.BRIDGE_CAPABILITIES.includes(value);
}
class EnvelopeError extends Error {
    problems;
    constructor(problems) {
        super(`bridge envelope refused: ${problems.map((p) => `${p.field} ${p.problem}`).join('; ')}`);
        this.name = 'EnvelopeError';
        this.problems = problems;
    }
}
exports.EnvelopeError = EnvelopeError;
const HEX = '0123456789abcdef';
function bytesToHex(bytes) {
    let out = '';
    for (const b of bytes)
        out += HEX[(b >> 4) & 0xf] + HEX[b & 0xf];
    return out;
}
class EntropyUnavailableError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EntropyUnavailableError';
    }
}
exports.EntropyUnavailableError = EntropyUnavailableError;
/** The default: the platform's cryptographically secure random source. */
function csprngEntropy() {
    return {
        kind: 'csprng',
        bytes(length) {
            const globalCrypto = globalThis.crypto;
            if (typeof globalCrypto?.getRandomValues !== 'function') {
                throw new EntropyUnavailableError('no CSPRNG available: this runtime has no globalThis.crypto.getRandomValues. Refusing to mint bridge identifiers from a predictable source.');
            }
            const out = new Uint8Array(length);
            globalCrypto.getRandomValues(out);
            return out;
        },
        token(prefix, length = 12) {
            return `${prefix}_${bytesToHex(this.bytes(length))}`;
        },
    };
}
/**
 * TEST ONLY. A deterministic stream, so a probe can assert on exact ids. Never
 * use this to mint a nonce in a deployment: an adversary who can predict the
 * nonce can replay a crossing.
 */
function seededEntropy(seed) {
    let counter = 0;
    const next = () => {
        /* xorshift32 over a seeded state — reproducible, and useless as entropy. */
        let x = (counter = (counter + 1) & 0xffffffff);
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x + seed.length * 2654435761) >>> 0;
    };
    const bytes = (length) => {
        const out = new Uint8Array(length);
        for (let i = 0; i < length; i += 1)
            out[i] = next() & 0xff;
        return out;
    };
    return {
        kind: 'seeded-for-tests-only',
        bytes,
        token(prefix, length = 12) {
            return `${prefix}_${bytesToHex(bytes(length))}`;
        },
    };
}
function buildEnvelope(input, options = {}) {
    const entropy = options.entropy ?? csprngEntropy();
    const envelope = {
        v: exports.ENVELOPE_VERSION,
        id: input.id ?? entropy.token('brg'),
        nonce: input.nonce ?? entropy.token('bnc'),
        capability: input.capability,
        task: input.task,
        bounds: input.bounds,
        answerShape: input.answerShape,
        from: input.from,
        to: input.to,
        depth: input.depth ?? 0,
        createdAtIso: input.nowIso ?? new Date().toISOString(),
    };
    const problems = validateEnvelope(envelope);
    if (problems.length > 0)
        throw new EnvelopeError(problems);
    return envelope;
}
/**
 * Validate an inbound envelope. Strict on purpose: an envelope that crosses an
 * owner boundary gets no benefit of the doubt.
 */
function validateEnvelope(value) {
    const problems = [];
    if (typeof value !== 'object' || value === null) {
        return [{ field: 'envelope', problem: 'must be an object' }];
    }
    const e = value;
    if (e.v !== exports.ENVELOPE_VERSION)
        problems.push({ field: 'v', problem: `must be ${exports.ENVELOPE_VERSION}` });
    if (typeof e.id !== 'string' || e.id.length < 8)
        problems.push({ field: 'id', problem: 'must be a string of at least 8 characters' });
    if (typeof e.nonce !== 'string' || e.nonce.length < 8)
        problems.push({ field: 'nonce', problem: 'must be a string of at least 8 characters' });
    if (typeof e.capability !== 'string' || !isBridgeCapability(e.capability)) {
        problems.push({ field: 'capability', problem: `must be one of ${exports.BRIDGE_CAPABILITIES.join(', ')}` });
    }
    if (typeof e.task !== 'string' || e.task.trim().length < 8) {
        problems.push({ field: 'task', problem: 'must state the task in at least 8 characters' });
    }
    if (typeof e.task === 'string' && e.task.length > 2000) {
        problems.push({ field: 'task', problem: 'must not exceed 2000 characters' });
    }
    const bounds = e.bounds;
    if (typeof bounds !== 'object' || bounds === null) {
        problems.push({ field: 'bounds', problem: 'is required' });
    }
    else {
        if (!Number.isInteger(bounds.maxDepth) || bounds.maxDepth < 0) {
            problems.push({ field: 'bounds.maxDepth', problem: 'must be a non-negative integer' });
        }
        if (!Number.isInteger(bounds.maxCostMinor) || bounds.maxCostMinor < 0) {
            problems.push({ field: 'bounds.maxCostMinor', problem: 'must be a non-negative integer' });
        }
        if (typeof bounds.deadlineIso !== 'string' || Number.isNaN(Date.parse(bounds.deadlineIso))) {
            problems.push({ field: 'bounds.deadlineIso', problem: 'must be an ISO-8601 instant' });
        }
    }
    const shape = e.answerShape;
    if (typeof shape !== 'object' || shape === null) {
        problems.push({ field: 'answerShape', problem: 'is required; state what a good answer looks like' });
    }
    else if (typeof shape.deliverable !== 'string' || shape.deliverable.trim().length < 4) {
        problems.push({ field: 'answerShape.deliverable', problem: 'must name the deliverable' });
    }
    const peer = (name, ref) => {
        if (typeof ref !== 'object' || ref === null) {
            problems.push({ field: name, problem: 'is required' });
            return;
        }
        if (typeof ref.handle !== 'string' || ref.handle.length < 2)
            problems.push({ field: `${name}.handle`, problem: 'is required' });
        if (typeof ref.harbor !== 'string' || ref.harbor.length < 2)
            problems.push({ field: `${name}.harbor`, problem: 'is required' });
    };
    peer('from', e.from);
    peer('to', e.to);
    if (e.from !== undefined && e.to !== undefined && e.from.harbor === e.to.harbor && e.from.handle === e.to.handle) {
        problems.push({ field: 'to', problem: 'must differ from "from"; a bridge crosses an owner boundary' });
    }
    if (!Number.isInteger(e.depth) || (e.depth ?? -1) < 0)
        problems.push({ field: 'depth', problem: 'must be a non-negative integer' });
    return problems;
}
function canHop(envelope, nowIso) {
    if (envelope.depth >= envelope.bounds.maxDepth) {
        return {
            ok: false,
            reason: `refused: the envelope is at depth ${envelope.depth} of ${envelope.bounds.maxDepth}; it may not be handed on again`,
        };
    }
    const deadline = Date.parse(envelope.bounds.deadlineIso);
    const now = Date.parse(nowIso);
    if (now >= deadline) {
        return { ok: false, reason: `refused: the deadline ${envelope.bounds.deadlineIso} has passed` };
    }
    return { ok: true, reason: `may hop once more, to depth ${envelope.depth + 1}`, childDepth: envelope.depth + 1 };
}
/** Canonical form for signing and digesting. Key order is fixed; no whitespace drift. */
function canonicalEnvelope(envelope) {
    const e = envelope;
    return JSON.stringify([
        e.v, e.id, e.nonce, e.capability, e.task,
        [e.bounds.maxDepth, e.bounds.maxCostMinor, e.bounds.deadlineIso],
        [e.answerShape.deliverable, e.answerShape.mustInclude ?? [], e.answerShape.mustAvoid ?? []],
        [e.from.handle, e.from.harbor, e.from.agentId ?? ''],
        [e.to.handle, e.to.harbor, e.to.agentId ?? ''],
        e.depth, e.createdAtIso,
    ]);
}

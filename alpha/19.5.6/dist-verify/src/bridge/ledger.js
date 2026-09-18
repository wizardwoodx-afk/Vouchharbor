"use strict";
/**
 * ledger.ts — pair trust derived from signed records, not handed in as a number.
 *
 * THE FLAW THIS CLOSES. The first bridge took a `PairTrust` object from its
 * caller. Anything that can call the function could hand it a warm score, and a
 * malformed integration would have been indistinguishable from a trusted peer.
 * "Trust" that a caller can assert is not trust; it is a parameter.
 *
 * So the score is no longer an input. It is a **fold over records that verify**:
 * each crossing appends a record signed by the harbour that recorded it, and the
 * score is recomputed from the signature-checked set, with age applied on read.
 * A record whose signature does not verify is not counted and is *reported* —
 * never silently dropped, because a ledger that hides its unusable rows is worse
 * than no ledger.
 *
 * Storage is deliberately an interface. The bridge ships an in-memory store so a
 * probe can drive it; a deployment backs the same interface with its own durable
 * ledger. The bridge never keeps the authoritative copy — each side keeps its own,
 * which is the point of two independent records of one crossing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRUST_START = exports.TrustLedger = exports.MemoryTrustStore = exports.LedgerError = exports.KIND_TO_OUTCOME = exports.CROSSING_RECORD_VERSION = void 0;
exports.canonicalRecord = canonicalRecord;
const trust_1 = require("./trust");
Object.defineProperty(exports, "TRUST_START", { enumerable: true, get: function () { return trust_1.TRUST_START; } });
const keys_1 = require("./keys");
exports.CROSSING_RECORD_VERSION = 'vh-bridge-crossing-record/1';
exports.KIND_TO_OUTCOME = {
    success: 'joint_success',
    failure: 'joint_failure',
    'policy-refusal': 'refused_by_policy',
    'peer-refusal': 'refused_by_peer',
    dispute: 'disputed',
    revocation: 'revoked',
    're-vouch': 'revoked', // handled separately: re-vouch clears the lock
};
function canonicalRecord(body) {
    return JSON.stringify([
        body.v,
        body.pairId,
        body.kind,
        body.atIso,
        body.envelopeId,
        body.receiptDigest,
        body.note,
    ]);
}
class LedgerError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LedgerError';
    }
}
exports.LedgerError = LedgerError;
class MemoryTrustStore {
    byPair = new Map();
    async load(pair) {
        return [...(this.byPair.get(pair) ?? [])];
    }
    async append(pair, record) {
        const rows = this.byPair.get(pair) ?? [];
        rows.push(record);
        this.byPair.set(pair, rows);
    }
}
exports.MemoryTrustStore = MemoryTrustStore;
/** Trust outcomes that require a cause. An unexplained drop is not evidence. */
const CAUSE_REQUIRED = ['policy-refusal', 'peer-refusal', 'dispute', 'revocation'];
class TrustLedger {
    store;
    registry;
    constructor(options) {
        this.store = options.store ?? new MemoryTrustStore();
        this.registry = options.registry;
    }
    /** The canonical pair id, so callers cannot invent a second spelling of one pair. */
    static pairIdFor(a, b) {
        return (0, trust_1.pairId)(a.harbor, a.handle, b.harbor, b.handle);
    }
    /**
     * Sign and append a record. The writer's own key signs it, so the record is
     * attributable to the harbour that wrote it — and a peer can prove which side
     * wrote what, long after the fact.
     */
    async attest(body, keys) {
        if (CAUSE_REQUIRED.includes(body.kind) && body.note.trim().length < 8) {
            throw new LedgerError(`a ${body.kind} record must state its cause; "${body.note}" is not a cause`);
        }
        const full = { v: exports.CROSSING_RECORD_VERSION, ...body };
        const record = {
            body: full,
            signer: {
                harbor: keys.harbor,
                keyId: keys.keyId,
                alg: keys.alg,
                signature: await keys.sign((0, keys_1.utf8Bytes)(canonicalRecord(full))),
            },
        };
        await this.store.append(full.pairId, record);
        return record;
    }
    /** Records that verify, and the ones that do not, named. */
    async audit(pair) {
        const rows = await this.store.load(pair);
        const unverifiable = [];
        let verified = 0;
        for (const row of rows) {
            const key = this.registry[`${row.signer.harbor}#${row.signer.keyId}`];
            const ok = row.body.v === exports.CROSSING_RECORD_VERSION &&
                key !== undefined &&
                (await (0, keys_1.verifySignature)(key, (0, keys_1.utf8Bytes)(canonicalRecord(row.body)), row.signer.signature));
            if (ok)
                verified += 1;
            else
                unverifiable.push(`${row.signer.harbor}#${row.signer.keyId} ${row.body.kind} at ${row.body.atIso}`);
        }
        return {
            pairId: pair,
            records: rows.length,
            verified,
            unverifiable,
            statement: `${verified} of ${rows.length} record(s) verify against a held public key. ` +
                (unverifiable.length === 0
                    ? 'Every row is attributable.'
                    : `${unverifiable.length} row(s) could not be attributed and are not counted in the score.`),
        };
    }
    /**
     * The score, derived. Unverifiable rows are excluded, decay is applied on read,
     * and a revocation locks the pair until an explicit re-vouch.
     */
    async postureOf(pair, nowIso) {
        const rows = await this.store.load(pair);
        let trust = (0, trust_1.newPairTrust)(pair);
        for (const row of rows) {
            const key = this.registry[`${row.signer.harbor}#${row.signer.keyId}`];
            if (key === undefined)
                continue;
            const ok = await (0, keys_1.verifySignature)(key, (0, keys_1.utf8Bytes)(canonicalRecord(row.body)), row.signer.signature);
            if (!ok)
                continue;
            if (row.body.kind === 're-vouch') {
                /* The only record that reopens a revoked pair, and only a person signs one. */
                trust = (0, trust_1.reVouch)(trust, row.body.atIso, row.body.note);
                continue;
            }
            /* A locked pair ignores everything except an explicit re-vouch. Records that
               arrive after a revocation are not errors, they are simply not trust. */
            if (trust.locked)
                continue;
            trust = (0, trust_1.recordOutcome)(trust, {
                atIso: row.body.atIso,
                outcome: exports.KIND_TO_OUTCOME[row.body.kind],
                envelopeId: row.body.envelopeId,
                ...(row.body.note.trim().length > 0 ? { cause: row.body.note } : {}),
            });
        }
        return (0, trust_1.posture)(trust, nowIso);
    }
    /** The raw rows, so a caller can see what is stored rather than what was counted. */
    async storeLoad(pair) {
        return this.store.load(pair);
    }
    /** A pair has crossed before only if a *verified* success says so. */
    async hasCrossedBefore(pair) {
        const rows = await this.store.load(pair);
        for (const row of rows) {
            if (row.body.kind !== 'success')
                continue;
            const key = this.registry[`${row.signer.harbor}#${row.signer.keyId}`];
            if (key === undefined)
                continue;
            if (await (0, keys_1.verifySignature)(key, (0, keys_1.utf8Bytes)(canonicalRecord(row.body)), row.signer.signature))
                return true;
        }
        return false;
    }
}
exports.TrustLedger = TrustLedger;

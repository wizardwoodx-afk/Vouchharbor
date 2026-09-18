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

import {
  TRUST_START,
  type PairTrust,
  type TrustOutcome,
  newPairTrust,
  pairId,
  posture,
  recordOutcome,
  reVouch,
  type TrustPosture,
} from './trust';
import { verifySignature, utf8Bytes, type HarborKeys, type KeyRegistry } from './keys';

export const CROSSING_RECORD_VERSION = 'vh-bridge-crossing-record/1';

/** The record kinds a ledger accepts. Each maps to one trust outcome. */
export type CrossingKind =
  | 'success'
  | 'failure'
  | 'policy-refusal'
  | 'peer-refusal'
  | 'dispute'
  | 'revocation'
  | 're-vouch';

export const KIND_TO_OUTCOME: Readonly<Record<CrossingKind, TrustOutcome>> = {
  success: 'joint_success',
  failure: 'joint_failure',
  'policy-refusal': 'refused_by_policy',
  'peer-refusal': 'refused_by_peer',
  dispute: 'disputed',
  revocation: 'revoked',
  're-vouch': 'revoked', // handled separately: re-vouch clears the lock
};

export interface CrossingRecordBody {
  readonly v: typeof CROSSING_RECORD_VERSION;
  readonly pairId: string;
  readonly kind: CrossingKind;
  readonly atIso: string;
  /** The envelope this concerns. Empty for a revocation, which is about the pair. */
  readonly envelopeId: string;
  /** Digest of the joint receipt, when there is one. Never the answer itself. */
  readonly receiptDigest: string;
  /** The cause in words. Required for refusals and disputes. */
  readonly note: string;
}

export interface RecordSignature {
  readonly harbor: string;
  readonly keyId: string;
  readonly alg: string;
  readonly signature: string;
}

export interface SignedCrossingRecord {
  readonly body: CrossingRecordBody;
  readonly signer: RecordSignature;
}

export function canonicalRecord(body: CrossingRecordBody): string {
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

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerError';
  }
}

/** Where records live. Swap for a durable store in a deployment. */
export interface TrustStore {
  load(pair: string): Promise<readonly SignedCrossingRecord[]>;
  append(pair: string, record: SignedCrossingRecord): Promise<void>;
}

export class MemoryTrustStore implements TrustStore {
  private readonly byPair = new Map<string, SignedCrossingRecord[]>();

  async load(pair: string): Promise<readonly SignedCrossingRecord[]> {
    return [...(this.byPair.get(pair) ?? [])];
  }

  async append(pair: string, record: SignedCrossingRecord): Promise<void> {
    const rows = this.byPair.get(pair) ?? [];
    rows.push(record);
    this.byPair.set(pair, rows);
  }
}

export interface LedgerAudit {
  readonly pairId: string;
  readonly records: number;
  readonly verified: number;
  readonly unverifiable: readonly string[];
  readonly statement: string;
}

/** Trust outcomes that require a cause. An unexplained drop is not evidence. */
const CAUSE_REQUIRED: readonly CrossingKind[] = ['policy-refusal', 'peer-refusal', 'dispute', 'revocation'];

export class TrustLedger {
  private readonly store: TrustStore;
  private readonly registry: KeyRegistry;

  constructor(options: { readonly registry: KeyRegistry; readonly store?: TrustStore }) {
    this.store = options.store ?? new MemoryTrustStore();
    this.registry = options.registry;
  }

  /** The canonical pair id, so callers cannot invent a second spelling of one pair. */
  static pairIdFor(a: { harbor: string; handle: string }, b: { harbor: string; handle: string }): string {
    return pairId(a.harbor, a.handle, b.harbor, b.handle);
  }

  /**
   * Sign and append a record. The writer's own key signs it, so the record is
   * attributable to the harbour that wrote it — and a peer can prove which side
   * wrote what, long after the fact.
   */
  async attest(
    body: Omit<CrossingRecordBody, 'v'>,
    keys: HarborKeys,
  ): Promise<SignedCrossingRecord> {
    if (CAUSE_REQUIRED.includes(body.kind) && body.note.trim().length < 8) {
      throw new LedgerError(`a ${body.kind} record must state its cause; "${body.note}" is not a cause`);
    }
    const full: CrossingRecordBody = { v: CROSSING_RECORD_VERSION, ...body };
    const record: SignedCrossingRecord = {
      body: full,
      signer: {
        harbor: keys.harbor,
        keyId: keys.keyId,
        alg: keys.alg,
        signature: await keys.sign(utf8Bytes(canonicalRecord(full))),
      },
    };
    await this.store.append(full.pairId, record);
    return record;
  }

  /** Records that verify, and the ones that do not, named. */
  async audit(pair: string): Promise<LedgerAudit> {
    const rows = await this.store.load(pair);
    const unverifiable: string[] = [];
    let verified = 0;
    for (const row of rows) {
      const key = this.registry[`${row.signer.harbor}#${row.signer.keyId}`];
      const ok =
        row.body.v === CROSSING_RECORD_VERSION &&
        key !== undefined &&
        (await verifySignature(key, utf8Bytes(canonicalRecord(row.body)), row.signer.signature));
      if (ok) verified += 1;
      else unverifiable.push(`${row.signer.harbor}#${row.signer.keyId} ${row.body.kind} at ${row.body.atIso}`);
    }
    return {
      pairId: pair,
      records: rows.length,
      verified,
      unverifiable,
      statement:
        `${verified} of ${rows.length} record(s) verify against a held public key. ` +
        (unverifiable.length === 0
          ? 'Every row is attributable.'
          : `${unverifiable.length} row(s) could not be attributed and are not counted in the score.`),
    };
  }

  /**
   * The score, derived. Unverifiable rows are excluded, decay is applied on read,
   * and a revocation locks the pair until an explicit re-vouch.
   */
  async postureOf(pair: string, nowIso: string): Promise<TrustPosture> {
    const rows = await this.store.load(pair);
    let trust: PairTrust = newPairTrust(pair);
    for (const row of rows) {
      const key = this.registry[`${row.signer.harbor}#${row.signer.keyId}`];
      if (key === undefined) continue;
      const ok = await verifySignature(key, utf8Bytes(canonicalRecord(row.body)), row.signer.signature);
      if (!ok) continue;

      if (row.body.kind === 're-vouch') {
        /* The only record that reopens a revoked pair, and only a person signs one. */
        trust = reVouch(trust, row.body.atIso, row.body.note);
        continue;
      }
      /* A locked pair ignores everything except an explicit re-vouch. Records that
         arrive after a revocation are not errors, they are simply not trust. */
      if (trust.locked) continue;

      trust = recordOutcome(trust, {
        atIso: row.body.atIso,
        outcome: KIND_TO_OUTCOME[row.body.kind],
        envelopeId: row.body.envelopeId,
        ...(row.body.note.trim().length > 0 ? { cause: row.body.note } : {}),
      });
    }
    return posture(trust, nowIso);
  }

  /** The raw rows, so a caller can see what is stored rather than what was counted. */
  async storeLoad(pair: string): Promise<readonly SignedCrossingRecord[]> {
    return this.store.load(pair);
  }

  /** A pair has crossed before only if a *verified* success says so. */
  async hasCrossedBefore(pair: string): Promise<boolean> {
    const rows = await this.store.load(pair);
    for (const row of rows) {
      if (row.body.kind !== 'success') continue;
      const key = this.registry[`${row.signer.harbor}#${row.signer.keyId}`];
      if (key === undefined) continue;
      if (await verifySignature(key, utf8Bytes(canonicalRecord(row.body)), row.signer.signature)) return true;
    }
    return false;
  }
}

export { TRUST_START };

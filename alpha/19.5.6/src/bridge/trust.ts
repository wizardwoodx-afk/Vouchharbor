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

export const TRUST_MIN = 0;
export const TRUST_MAX = 100;
export const TRUST_START = 20;

export type TrustOutcome =
  | 'joint_success'
  | 'joint_failure'
  | 'refused_by_policy'
  | 'refused_by_peer'
  | 'disputed'
  | 'revoked';

export interface TrustEvent {
  readonly at: string;
  readonly outcome: TrustOutcome;
  readonly envelopeId: string;
  /** Free-text cause, shown to both sides. Required for refusals and disputes. */
  readonly cause?: string;
}

export interface PairTrust {
  readonly pairId: string;
  readonly score: number;
  readonly events: readonly TrustEvent[];
  /** Set once and never cleared by scoring; only an explicit re-vouch clears it. */
  readonly locked: boolean;
  readonly lastEventIso?: string;
}

export class TrustError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrustError';
  }
}

/** A pair id is canonical and order-independent: A|B and B|A are one pair. */
export function pairId(harborA: string, handleA: string, harborB: string, handleB: string): string {
  const a = `${harborA}#${handleA}`;
  const b = `${harborB}#${handleB}`;
  const [first, second] = a <= b ? [a, b] : [b, a];
  return `pair:${first}<->${second}`;
}

export function newPairTrust(id: string): PairTrust {
  return { pairId: id, score: TRUST_START, events: [], locked: false };
}

/** Points per outcome. Small on purpose: trust is a slope, not a switch. */
export const TRUST_WEIGHTS: Readonly<Record<TrustOutcome, number>> = {
  joint_success: 6,
  joint_failure: -8,
  refused_by_policy: -3,
  refused_by_peer: -2,
  disputed: -20,
  revoked: 0,
};

const REQUIRES_CAUSE: readonly TrustOutcome[] = ['refused_by_policy', 'refused_by_peer', 'disputed'];

const MAX_EVENTS_KEPT = 200;

function clamp(score: number): number {
  if (score < TRUST_MIN) return TRUST_MIN;
  if (score > TRUST_MAX) return TRUST_MAX;
  return score;
}

export interface RecordInput {
  readonly outcome: TrustOutcome;
  readonly envelopeId: string;
  readonly atIso: string;
  readonly cause?: string;
}

/**
 * Fold one outcome into a pair's trust. Returns a new value; never mutates.
 */
export function recordOutcome(current: PairTrust, input: RecordInput): PairTrust {
  if (current.locked && input.outcome !== 'revoked') {
    throw new TrustError(`pair ${current.pairId} is revoked; only an explicit re-vouch reopens it`);
  }
  if (REQUIRES_CAUSE.includes(input.outcome) && (input.cause === undefined || input.cause.trim().length === 0)) {
    throw new TrustError(`${input.outcome} requires a cause: a refusal without a reason teaches the other side nothing`);
  }
  if (input.outcome === 'revoked') {
    const event: TrustEvent = { at: input.atIso, outcome: 'revoked', envelopeId: input.envelopeId, cause: input.cause ?? 'revoked by owner' };
    return {
      ...current,
      score: TRUST_MIN,
      locked: true,
      lastEventIso: input.atIso,
      events: [...current.events, event].slice(-MAX_EVENTS_KEPT),
    };
  }
  const delta = TRUST_WEIGHTS[input.outcome];
  const event: TrustEvent = input.cause === undefined
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
export function reVouch(current: PairTrust, atIso: string, cause: string): PairTrust {
  if (cause.trim().length === 0) throw new TrustError('a re-vouch must say why trust is being restored');
  const event: TrustEvent = { at: atIso, outcome: 'joint_success', envelopeId: 're-vouch', cause: `re-vouched: ${cause}` };
  return {
    pairId: current.pairId,
    score: TRUST_START,
    locked: false,
    lastEventIso: atIso,
    events: [...current.events, event].slice(-MAX_EVENTS_KEPT),
  };
}

export const DECAY_PER_30_DAYS = 4;

/**
 * Trust is about the recent relationship, not the historical one. Applied on
 * read, never written back — so the stored ledger always says what actually happened.
 */
export function effectiveScore(pair: PairTrust, nowIso: string): number {
  if (pair.locked) return TRUST_MIN;
  if (pair.lastEventIso === undefined) return pair.score;
  const last = Date.parse(pair.lastEventIso);
  const now = Date.parse(nowIso);
  if (Number.isNaN(last) || Number.isNaN(now) || now <= last) return pair.score;
  const months = (now - last) / (1000 * 60 * 60 * 24 * 30);
  return clamp(Math.round(pair.score - months * DECAY_PER_30_DAYS));
}

/** What a score is allowed to open. Both sides read the same table. */
export type TrustTier = 'none' | 'read_only' | 'supervised' | 'standing';

export function trustTier(score: number): TrustTier {
  if (score <= TRUST_MIN) return 'none';
  if (score < 35) return 'read_only';
  if (score < 70) return 'supervised';
  return 'standing';
}

export interface TrustPosture {
  readonly score: number;
  readonly storedScore: number;
  readonly tier: TrustTier;
  readonly locked: boolean;
  /** Plain words, for the UI and for the audit row. */
  readonly statement: string;
  readonly maxDepth: number;
  readonly requiresHumanApproval: boolean;
}

export function posture(pair: PairTrust, nowIso: string): TrustPosture {
  const score = effectiveScore(pair, nowIso);
  const tier = pair.locked ? 'none' : trustTier(score);
  const table: Record<TrustTier, { depth: number; approval: boolean; words: string }> = {
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

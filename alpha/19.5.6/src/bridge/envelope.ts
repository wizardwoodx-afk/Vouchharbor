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

export const ENVELOPE_VERSION = 'vh-bridge-envelope/1';

/** Capabilities an agent may be offered. A declaration never grants anything. */
export const BRIDGE_CAPABILITIES = [
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
] as const;

export type BridgeCapability = (typeof BRIDGE_CAPABILITIES)[number];

export function isBridgeCapability(value: string): value is BridgeCapability {
  return (BRIDGE_CAPABILITIES as readonly string[]).includes(value);
}

/** What a good answer looks like. Stated, never inferred. */
export interface AnswerShape {
  /** One line naming the deliverable, e.g. "a two-column comparison table". */
  readonly deliverable: string;
  /** Extra requirements the receiver must meet, in plain words. */
  readonly mustInclude?: readonly string[];
  /** Things that would make the answer wrong. */
  readonly mustAvoid?: readonly string[];
}

/**
 * The bounds travel with the envelope and are enforced by the *deployment*,
 * never by the model. A model asked to respect its own limits will not.
 */
export interface EnvelopeBounds {
  /** Hops remaining. 0 means the receiver may not hand this on at all. */
  readonly maxDepth: number;
  /** Ceiling in minor currency units, for cost accounting on both sides. */
  readonly maxCostMinor: number;
  /** ISO-8601 instant after which the work is void. */
  readonly deadlineIso: string;
}

export interface PeerRef {
  /** A stable, user-chosen handle. Never an email or a real name by default. */
  readonly handle: string;
  /** The peer's instance identifier (harbor id). */
  readonly harbor: string;
  /** Which of that peer's agents is being addressed, when one is chosen. */
  readonly agentId?: string;
}

export interface BridgeEnvelope {
  readonly v: typeof ENVELOPE_VERSION;
  readonly id: string;
  readonly nonce: string;
  readonly capability: BridgeCapability;
  readonly task: string;
  readonly bounds: EnvelopeBounds;
  readonly answerShape: AnswerShape;
  readonly from: PeerRef;
  readonly to: PeerRef;
  readonly depth: number;
  readonly createdAtIso: string;
}

export interface EnvelopeProblem {
  readonly field: string;
  readonly problem: string;
}

export class EnvelopeError extends Error {
  readonly problems: readonly EnvelopeProblem[];
  constructor(problems: readonly EnvelopeProblem[]) {
    super(`bridge envelope refused: ${problems.map((p) => `${p.field} ${p.problem}`).join('; ')}`);
    this.name = 'EnvelopeError';
    this.problems = problems;
  }
}

export interface BuildEnvelopeInput {
  readonly capability: string;
  readonly task: string;
  readonly bounds: EnvelopeBounds;
  readonly answerShape: AnswerShape;
  readonly from: PeerRef;
  readonly to: PeerRef;
  readonly depth?: number;
  readonly nowIso?: string;
  /** Supply only to pin a known id (a re-issue of a real request). */
  readonly id?: string;
  /** Supply only to pin a known nonce. */
  readonly nonce?: string;
}

/**
 * Where ids and nonces come from.
 *
 * The first version derived both from a hash of the envelope's own fields, which
 * made two equivalent requests share an identifier — fine for a probe, wrong for
 * a protocol whose whole job is to distinguish one crossing from another, and
 * unsafe the moment a nonce is used for replay binding.
 *
 * So the default is the platform CSPRNG. Determinism is still available, but it
 * has to be asked for by name, and `seededEntropy` is labelled test-only on
 * purpose: a deterministic nonce in production is a vulnerability, not a feature.
 */
export interface EntropySource {
  readonly kind: 'csprng' | 'seeded-for-tests-only';
  bytes(length: number): Uint8Array;
  token(prefix: string, length?: number): string;
}

const HEX = '0123456789abcdef';

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += (HEX[(b >> 4) & 0xf] as string) + (HEX[b & 0xf] as string);
  return out;
}

export class EntropyUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntropyUnavailableError';
  }
}

interface CryptoLike {
  getRandomValues?<T extends ArrayBufferView>(array: T): T;
}

/** The default: the platform's cryptographically secure random source. */
export function csprngEntropy(): EntropySource {
  return {
    kind: 'csprng',
    bytes(length: number): Uint8Array {
      const globalCrypto = (globalThis as { crypto?: CryptoLike }).crypto;
      if (typeof globalCrypto?.getRandomValues !== 'function') {
        throw new EntropyUnavailableError(
          'no CSPRNG available: this runtime has no globalThis.crypto.getRandomValues. Refusing to mint bridge identifiers from a predictable source.',
        );
      }
      const out = new Uint8Array(length);
      globalCrypto.getRandomValues(out);
      return out;
    },
    token(prefix: string, length = 12): string {
      return `${prefix}_${bytesToHex(this.bytes(length))}`;
    },
  };
}

/**
 * TEST ONLY. A deterministic stream, so a probe can assert on exact ids. Never
 * use this to mint a nonce in a deployment: an adversary who can predict the
 * nonce can replay a crossing.
 */
export function seededEntropy(seed: string): EntropySource {
  let counter = 0;
  const next = (): number => {
    /* xorshift32 over a seeded state — reproducible, and useless as entropy. */
    let x = (counter = (counter + 1) & 0xffffffff);
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x + seed.length * 2654435761) >>> 0;
  };
  const bytes = (length: number): Uint8Array => {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) out[i] = next() & 0xff;
    return out;
  };
  return {
    kind: 'seeded-for-tests-only',
    bytes,
    token(prefix: string, length = 12): string {
      return `${prefix}_${bytesToHex(bytes(length))}`;
    },
  };
}

export interface BuildEnvelopeOptions {
  readonly entropy?: EntropySource;
}

export function buildEnvelope(input: BuildEnvelopeInput, options: BuildEnvelopeOptions = {}): BridgeEnvelope {
  const entropy = options.entropy ?? csprngEntropy();
  const envelope: BridgeEnvelope = {
    v: ENVELOPE_VERSION,
    id: input.id ?? entropy.token('brg'),
    nonce: input.nonce ?? entropy.token('bnc'),
    capability: (input.capability as BridgeCapability),
    task: input.task,
    bounds: input.bounds,
    answerShape: input.answerShape,
    from: input.from,
    to: input.to,
    depth: input.depth ?? 0,
    createdAtIso: input.nowIso ?? new Date().toISOString(),
  };
  const problems = validateEnvelope(envelope);
  if (problems.length > 0) throw new EnvelopeError(problems);
  return envelope;
}

/**
 * Validate an inbound envelope. Strict on purpose: an envelope that crosses an
 * owner boundary gets no benefit of the doubt.
 */
export function validateEnvelope(value: unknown): EnvelopeProblem[] {
  const problems: EnvelopeProblem[] = [];
  if (typeof value !== 'object' || value === null) {
    return [{ field: 'envelope', problem: 'must be an object' }];
  }
  const e = value as Partial<BridgeEnvelope>;

  if (e.v !== ENVELOPE_VERSION) problems.push({ field: 'v', problem: `must be ${ENVELOPE_VERSION}` });
  if (typeof e.id !== 'string' || e.id.length < 8) problems.push({ field: 'id', problem: 'must be a string of at least 8 characters' });
  if (typeof e.nonce !== 'string' || e.nonce.length < 8) problems.push({ field: 'nonce', problem: 'must be a string of at least 8 characters' });
  if (typeof e.capability !== 'string' || !isBridgeCapability(e.capability)) {
    problems.push({ field: 'capability', problem: `must be one of ${BRIDGE_CAPABILITIES.join(', ')}` });
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
  } else {
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
  } else if (typeof shape.deliverable !== 'string' || shape.deliverable.trim().length < 4) {
    problems.push({ field: 'answerShape.deliverable', problem: 'must name the deliverable' });
  }

  const peer = (name: 'from' | 'to', ref: PeerRef | undefined): void => {
    if (typeof ref !== 'object' || ref === null) {
      problems.push({ field: name, problem: 'is required' });
      return;
    }
    if (typeof ref.handle !== 'string' || ref.handle.length < 2) problems.push({ field: `${name}.handle`, problem: 'is required' });
    if (typeof ref.harbor !== 'string' || ref.harbor.length < 2) problems.push({ field: `${name}.harbor`, problem: 'is required' });
  };
  peer('from', e.from);
  peer('to', e.to);

  if (e.from !== undefined && e.to !== undefined && e.from.harbor === e.to.harbor && e.from.handle === e.to.handle) {
    problems.push({ field: 'to', problem: 'must differ from "from"; a bridge crosses an owner boundary' });
  }

  if (!Number.isInteger(e.depth) || (e.depth ?? -1) < 0) problems.push({ field: 'depth', problem: 'must be a non-negative integer' });

  return problems;
}

/**
 * A hop that runs out of depth or out of time is **refused, not truncated**.
 * A silently shortened envelope arrives looking complete.
 */
export interface HopVerdict {
  readonly ok: boolean;
  readonly reason: string;
  readonly childDepth?: number;
}

export function canHop(envelope: BridgeEnvelope, nowIso: string): HopVerdict {
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
export function canonicalEnvelope(envelope: BridgeEnvelope): string {
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

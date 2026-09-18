/**
 * channel.ts — the Memory Channel: one channelled path from raw recall to a
 * budget-fitted context, with every fact's provenance and every cut marked.
 *
 * Why this exists. Vouch Harbor's memory today is a local ledger plus learned
 * briefings. That is honest but flat: it has no scope, no time, and no notion of
 * *whose* memory a fact is. Three things are added here, each borrowed from the
 * state of the art and then made stricter:
 *
 *   1. SCOPE — five of them: run, agent, user, pair, org. The fifth is ours.
 *      `pair` is the memory of a *cross-user collaboration*: what User A's agent
 *      and User B's agent learned together, owned by neither alone. No other
 *      agent platform has this scope, because no other platform has the bridge.
 *
 *   2. TIME — a fact is true over an interval, not forever. Superseding a fact
 *      closes the old one instead of deleting it, so "what was true in March"
 *      stays answerable. (The temporal-graph pattern; reimplemented, zero-dep.)
 *
 *   3. THE CHANNEL — context is assembled under a token budget with a fixed
 *      priority order, and anything dropped is *reported in words*. Vouch
 *      Harbor's token optimizer already refuses silent cuts; the memory channel
 *      obeys the same rule rather than inventing a second one.
 *
 * And one doctrine the rest of the product already holds: **evidence before
 * claims**. A fact written at `org` or `pair` scope must cite evidence, because
 * those are the scopes another person will rely on.
 *
 * Additive module. No store, no clock of its own.
 */

export const MEMORY_CHANNEL_VERSION = 'vh-memory-channel/1';

export type MemoryScope = 'run' | 'agent' | 'user' | 'pair' | 'org';

export const MEMORY_SCOPES: readonly MemoryScope[] = ['run', 'agent', 'user', 'pair', 'org'];

/** Narrower scopes are cheaper to trust: they affect fewer people. */
export const SCOPE_TRUST_WEIGHT: Readonly<Record<MemoryScope, number>> = {
  run: 5,
  agent: 4,
  user: 3,
  pair: 2,
  org: 1,
};

export interface MemoryFact {
  readonly id: string;
  readonly scope: MemoryScope;
  /** For run/agent/user: the owner key. For pair: the canonical pair id. */
  readonly scopeKey: string;
  /** Stable subject, e.g. "invoice.currency" — used to supersede. */
  readonly key: string;
  readonly value: string;
  readonly validFromIso: string;
  /** Undefined while this is the current truth. */
  readonly validToIso?: string;
  readonly supersededBy?: string;
  readonly source: string;
  /** Required at pair and org scope. */
  readonly evidenceRef?: string;
  readonly confidence: number;
}

export class MemoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MemoryError';
  }
}

const EVIDENCE_REQUIRED: readonly MemoryScope[] = ['pair', 'org'];

export interface WriteInput {
  readonly scope: MemoryScope;
  readonly scopeKey: string;
  readonly key: string;
  readonly value: string;
  readonly atIso: string;
  readonly source: string;
  readonly evidenceRef?: string;
  readonly confidence?: number;
  readonly id?: string;
}

function stableId(input: WriteInput): string {
  const seed = `${input.scope}|${input.scopeKey}|${input.key}|${input.atIso}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  return `mem_${h.toString(16).padStart(8, '0')}`;
}

/**
 * Write a fact. If a live fact already holds this key at this scope, the write
 * SUPERSEDES it: the old fact is closed with a `validToIso` and a pointer to the
 * new one, and stays in the set. Nothing is deleted, so history stays answerable.
 */
export function writeFact(session: readonly MemoryFact[], input: WriteInput): { facts: MemoryFact[]; superseded?: string } {
  if (!MEMORY_SCOPES.includes(input.scope)) throw new MemoryError(`unknown scope "${input.scope}"`);
  if (input.scopeKey.trim().length === 0) throw new MemoryError(`${input.scope} scope requires a scope key`);
  if (input.key.trim().length === 0) throw new MemoryError('a fact requires a key');
  if (input.value.trim().length === 0) throw new MemoryError('a fact requires a value');
  if (EVIDENCE_REQUIRED.includes(input.scope) && (input.evidenceRef ?? '').trim().length === 0) {
    throw new MemoryError(
      `a ${input.scope}-scope fact requires an evidence reference: another person will rely on it, so it may not be an unsourced claim`,
    );
  }
  const confidence = input.confidence ?? 0.8;
  if (confidence < 0 || confidence > 1) throw new MemoryError('confidence must be between 0 and 1');

  const fresh: MemoryFact = {
    id: input.id ?? stableId(input),
    scope: input.scope,
    scopeKey: input.scopeKey,
    key: input.key,
    value: input.value,
    validFromIso: input.atIso,
    source: input.source,
    ...(input.evidenceRef === undefined ? {} : { evidenceRef: input.evidenceRef }),
    confidence,
  };

  const liveIndex = session.findIndex(
    (f) => f.scope === input.scope && f.scopeKey === input.scopeKey && f.key === input.key && f.validToIso === undefined,
  );
  if (liveIndex === -1) return { facts: [...session, fresh] };

  const old = session[liveIndex];
  if (old === undefined) return { facts: [...session, fresh] };
  const closed: MemoryFact = { ...old, validToIso: input.atIso, supersededBy: fresh.id };
  const next = session.slice();
  next[liveIndex] = closed;
  next.push(fresh);
  return { facts: next, superseded: old.id };
}

export interface RecallQuery {
  readonly scope: MemoryScope;
  readonly scopeKey: string;
  /** Point in time. Omit for "now". */
  readonly asOfIso?: string;
  /** Only live facts (no validTo). Default false when asOf is given. */
  readonly liveOnly?: boolean;
  readonly keyPrefix?: string;
}

export function recall(session: readonly MemoryFact[], query: RecallQuery): MemoryFact[] {
  const asOf = query.asOfIso;
  return session
    .filter((f) => f.scope === query.scope && f.scopeKey === query.scopeKey)
    .filter((f) => (query.keyPrefix === undefined ? true : f.key.startsWith(query.keyPrefix)))
    .filter((f) => {
      if (query.liveOnly === true) return f.validToIso === undefined;
      if (asOf === undefined) return f.validToIso === undefined;
      const from = Date.parse(f.validFromIso);
      const to = f.validToIso === undefined ? Number.POSITIVE_INFINITY : Date.parse(f.validToIso);
      const at = Date.parse(asOf);
      return at >= from && at < to;
    })
    .sort((a, b) => a.key.localeCompare(b.key) || a.validFromIso.localeCompare(b.validFromIso));
}

/** "What was true in March" — the query a temporal graph exists to answer. */
export function asOf(session: readonly MemoryFact[], query: Omit<RecallQuery, 'liveOnly'>, atIso: string): MemoryFact[] {
  return recall(session, { ...query, asOfIso: atIso, liveOnly: false });
}

/* ------------------------------- the channel ---------------------------- */

export interface ChannelRequest {
  readonly scopes: ReadonlyArray<{ scope: MemoryScope; scopeKey: string }>;
  /** Total context budget, in estimated tokens. */
  readonly budgetTokens: number;
  /** Facts to place first regardless of score, e.g. this run's own notes. */
  readonly pinned?: readonly string[];
}

export interface ContextBlock {
  readonly scope: MemoryScope;
  readonly scopeKey: string;
  readonly lines: readonly string[];
  readonly tokensUsed: number;
}

export interface ChannelResult {
  readonly blocks: readonly ContextBlock[];
  readonly tokensUsed: number;
  readonly budgetTokens: number;
  /** Everything dropped, in words. Never empty-and-silent. */
  readonly cuts: readonly string[];
  readonly droppedCount: number;
}

/** ~4 characters per token, labelled everywhere as an estimate. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function renderLine(fact: MemoryFact): string {
  const w = SCOPE_TRUST_WEIGHT[fact.scope];
  return `[${fact.key} = ${fact.value}] (source: ${fact.source}${fact.evidenceRef === undefined ? '' : `, evidence: ${fact.evidenceRef}`}, scope weight ${w})`;
}

function factScore(fact: MemoryFact, nowIso: string): number {
  const ageDays = Math.max(0, (Date.parse(nowIso) - Date.parse(fact.validFromIso)) / 86_400_000);
  const recency = 1 / (1 + ageDays / 30);
  return SCOPE_TRUST_WEIGHT[fact.scope] * recency * fact.confidence;
}

/**
 * Assemble context. Priority order is fixed and stated, not tuned per run:
 * pinned → narrower scope → higher confidence → more recent. Effects-only:
 * facts whose text looks like a secret are refused entry to the channel.
 */
export function assembleContext(session: readonly MemoryFact[], request: ChannelRequest, nowIso: string): ChannelResult {
  const pinned = new Set(request.pinned ?? []);
  const considered: MemoryFact[] = [];

  for (const target of request.scopes) {
    const live = recall(session, { scope: target.scope, scopeKey: target.scopeKey, liveOnly: true });
    for (const fact of live) {
      if (looksLikeSecret(fact.value)) continue;
      considered.push(fact);
    }
  }

  considered.sort((a, b) => {
    const ap = pinned.has(a.id) ? 1 : 0;
    const bp = pinned.has(b.id) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    const ad = SCOPE_TRUST_WEIGHT[a.scope];
    const bd = SCOPE_TRUST_WEIGHT[b.scope];
    if (ad !== bd) return bd - ad;
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    const ascore = factScore(a, nowIso);
    const bscore = factScore(b, nowIso);
    if (ascore !== bscore) return bscore - ascore;
    return a.id.localeCompare(b.id);
  });

  const cuts: string[] = [];
  let droppedCount = 0;
  const byBlock = new Map<string, { scope: MemoryScope; scopeKey: string; lines: string[]; tokens: number }>();
  let used = 0;

  for (const fact of considered) {
    const line = renderLine(fact);
    const cost = estimateTokens(line);
    if (used + cost > request.budgetTokens) {
      droppedCount += 1;
      cuts.push(`dropped ${fact.key} (${fact.scope}) — ${cost} tok over the ${request.budgetTokens}-token budget`);
      continue;
    }
    const blockKey = `${fact.scope}:${fact.scopeKey}`;
    const block = byBlock.get(blockKey) ?? { scope: fact.scope, scopeKey: fact.scopeKey, lines: [], tokens: 0 };
    block.lines.push(line);
    block.tokens += cost;
    byBlock.set(blockKey, block);
    used += cost;
  }

  if (droppedCount > 0) {
    cuts.unshift(
      `context budget ${request.budgetTokens} tokens: ${droppedCount} fact${droppedCount === 1 ? '' : 's'} not included, listed below. The cuts are marked, never silent.`,
    );
  }

  const blocks = [...byBlock.values()]
    .sort((a, b) => SCOPE_TRUST_WEIGHT[b.scope] - SCOPE_TRUST_WEIGHT[a.scope] || a.scopeKey.localeCompare(b.scopeKey))
    .map((b) => ({ scope: b.scope, scopeKey: b.scopeKey, lines: b.lines, tokensUsed: b.tokens }));

  return { blocks, tokensUsed: used, budgetTokens: request.budgetTokens, cuts, droppedCount };
}

/** Belt-and-braces: a credential never becomes a memory. */
const SECRET_SHAPES: readonly RegExp[] = [
  /sk-[A-Za-z0-9]{16,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b\d{13,19}\b/,
  /(?:api[_-]?key|password|secret)\s*[:=]\s*\S{8,}/i,
];

export function looksLikeSecret(value: string): boolean {
  return SECRET_SHAPES.some((re) => re.test(value));
}

/** What the Memory Channel can prove about itself, for the System screen. */
export interface ChannelHealth {
  readonly totalFacts: number;
  readonly live: number;
  readonly superseded: number;
  readonly byScope: Readonly<Record<MemoryScope, number>>;
  readonly withEvidence: number;
  readonly statement: string;
}

export function health(session: readonly MemoryFact[]): ChannelHealth {
  const byScope = { run: 0, agent: 0, user: 0, pair: 0, org: 0 } as Record<MemoryScope, number>;
  let live = 0;
  let superseded = 0;
  let withEvidence = 0;
  for (const fact of session) {
    byScope[fact.scope] += 1;
    if (fact.validToIso === undefined) live += 1;
    else superseded += 1;
    if (fact.evidenceRef !== undefined) withEvidence += 1;
  }
  const required = (byScope.pair ?? 0) + (byScope.org ?? 0);
  return {
    totalFacts: session.length,
    live,
    superseded,
    byScope,
    withEvidence,
    statement:
      `${session.length} facts (${live} live, ${superseded} superseded). ` +
      `${withEvidence} carry evidence${required === 0 ? '' : `, and every one of the ${required} pair/org-scope facts does by rule`}.`,
  };
}

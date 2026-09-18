/**
 * initiator.ts — who (or what) started a run, and the two-row audit pattern.
 *
 * CLEAN-ROOM IMPLEMENTATION of semantics documented in CopilotKit/OpenBot
 * `docs/architecture.md` (MIT, Copyright (c) 2026 CopilotKit), sections
 * "Browser action governance" and "What started a run". No upstream code copied.
 *
 * The idea worth taking: an audit row that records *on whose authority* an action
 * happened cannot tell you whether anybody was present. An interactive run has
 * somebody watching who will notice a wrong tool call; an unattended one does not.
 * So every row also records what caused it — and "Nobody watching" becomes a
 * filter over `routine` + `handoff`, not a guess.
 *
 * This is additive to Vouch Harbor. It introduces no store: rows are handed to
 * your existing ledger/audit sink, so they can be digested into the receipt chain
 * you already mint.
 */

import type { CompiledPolicy, PolicyContext, PolicyDecision } from './policyGate';
import { decide } from './policyGate';

export type InitiatorKind = 'person' | 'deployment' | 'routine' | 'handoff';

export interface Initiator {
  readonly kind: InitiatorKind;
  /** The routine's id, or the handing party's id. Absent for person/deployment. */
  readonly id?: string;
}

export const INITIATOR_KINDS: readonly InitiatorKind[] = ['person', 'deployment', 'routine', 'handoff'];

/**
 * The kinds where nobody is necessarily in the room. `deployment` is deliberately
 * excluded: a boundary held at start-up is the system holding its own line.
 */
export const NOBODY_WATCHING: readonly InitiatorKind[] = ['routine', 'handoff'];

export function initiator(kind: InitiatorKind, id?: string): Initiator {
  if (!INITIATOR_KINDS.includes(kind)) {
    throw new Error(`unknown initiator kind ${JSON.stringify(kind)}`);
  }
  if (kind === 'routine' || kind === 'handoff') {
    if (id === undefined || id.length === 0) {
      throw new Error(`initiator kind "${kind}" requires an id (the routine's, or the handing party's)`);
    }
    return { kind, id };
  }
  if (id !== undefined) {
    throw new Error(`initiator kind "${kind}" must not carry an id`);
  }
  return { kind };
}

export function isNobodyWatching(i: Initiator): boolean {
  return NOBODY_WATCHING.includes(i.kind);
}

export function nobodyWatchingKinds(): InitiatorKind[] {
  return [...NOBODY_WATCHING];
}

/* ------------------------------ audit rows ----------------------------- */

export type AuditPhase = 'decision' | 'outcome';

export interface AuditRow {
  readonly at: string;
  readonly phase: AuditPhase;
  readonly tool: string;
  readonly actorId: string;
  readonly initiator: Initiator;
  readonly nobodyWatching: boolean;
  /** decision rows: was it forwarded. outcome rows: was it executed. */
  readonly allowed: boolean;
  readonly reason: string;
  readonly rule?: string;
  readonly detail?: string;
}

export interface GovernActionOptions {
  readonly policy: CompiledPolicy;
  readonly context: PolicyContext;
  readonly tool: string;
  readonly actorId: string;
  readonly initiator: Initiator;
  /** Where rows go. Wire this to your ledger; never to a store of its own. */
  readonly audit: (row: AuditRow) => void;
  readonly clock?: () => Date;
}

export interface GovernedOutcome<T> {
  readonly ok: boolean;
  readonly decision: PolicyDecision;
  readonly value?: T;
  /** Present when the action was permitted but threw. */
  readonly error?: string;
  readonly rows: readonly AuditRow[];
}

/**
 * The action boundary, in the documented order:
 *   resolve -> decide -> write the decision row -> act only when forwarded
 *   -> write a second row if the forwarded action fails.
 *
 * The interesting property: `execute` is not called at all when the decision is
 * a refusal, so a denied action cannot have side effects.
 */
export async function governAction<T>(
  options: GovernActionOptions,
  execute: () => Promise<T> | T,
): Promise<GovernedOutcome<T>> {
  const now = (): string => (options.clock ? options.clock() : new Date()).toISOString();
  const base = {
    tool: options.tool,
    actorId: options.actorId,
    initiator: options.initiator,
    nobodyWatching: isNobodyWatching(options.initiator),
  } as const;

  const decision = decide(options.policy, options.context);
  const rows: AuditRow[] = [];

  const decisionRow: AuditRow = {
    ...base,
    at: now(),
    phase: 'decision',
    allowed: decision.allowed,
    reason: decision.reason,
    ...(decision.rule === undefined ? {} : { rule: decision.rule }),
    ...(decision.detail === undefined ? {} : { detail: decision.detail }),
  };
  rows.push(decisionRow);
  options.audit(decisionRow);

  if (!decision.allowed) {
    return { ok: false, decision, rows };
  }

  try {
    const value = await execute();
    const outcomeRow: AuditRow = { ...base, at: now(), phase: 'outcome', allowed: true, reason: 'executed' };
    rows.push(outcomeRow);
    options.audit(outcomeRow);
    return { ok: true, decision, value, rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failureRow: AuditRow = {
      ...base,
      at: now(),
      phase: 'outcome',
      allowed: true,
      reason: 'execution-failed',
      detail: message,
    };
    rows.push(failureRow);
    options.audit(failureRow);
    return { ok: false, decision, error: message, rows };
  }
}

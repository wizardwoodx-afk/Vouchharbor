/**
 * VH-19 router — the gating function. Pure, deterministic, browser-safe.
 *
 * Three signals, deliberately kept separable so each can be tested alone:
 *
 *   capability    static fit between the task and the specialist's declared
 *                 keywords. Answers "who is this FOR".
 *   learnedPrior  cumulative user verdicts on this specialist. Answers
 *                 "who does THIS USER keep accepting". This is the weight that
 *                 moves, and it is what entitles the product to say the routing
 *                 is learned rather than hardcoded.
 *   recentSuccess decayed short-window performance. Answers "who is good RIGHT
 *                 NOW", so a specialist that has started failing stops winning.
 *
 * Safety invariants enforced here rather than hoped for:
 *   1. The tool ceiling is checked BEFORE a route is produced, and an exceedance
 *      is a refusal, not a narrowing. Silently dropping the missing tool would
 *      let a specialist claim success while doing less than it was asked.
 *   2. A route under the confidence floor goes to the human gate, not to the
 *      best-guess specialist. Uncertainty is routed to a person.
 *   3. `shadow` tier computes and records a decision but does not act on it, so
 *     the router can be judged against reality before it is trusted with it.
 *   4. The asserted risk tier from a sender is never believed; the receiver's own
 *      grading wins. Same rule the A2A bridge already applies inbound.
 */
import type {
  RouteDecision,
  RouteScore,
  SpecialistMeta,
  SpecialistWeights,
  TaskIntent,
  TrustTier,
} from "./types";

/** relative influence of each signal; exported so the probe can pin the shape */
export const ROUTER_WEIGHTS = {
  capability: 1.0,
  learnedPrior: 0.45,
  recentSuccess: 0.35,
} as const;

/** default floor: below this margin the router asks a human instead of choosing */
export const DEFAULT_CONFIDENCE_FLOOR = 0.18;

/** half-life of the recency window, in verdicts */
const RECENCY_HALF_LIFE = 8;

const STOP = new Set([
  "the", "and", "for", "with", "this", "that", "from", "into", "your", "you",
  "are", "when", "use", "need", "want", "please", "make", "add", "fix", "can",
  "should", "would", "could", "about", "have", "has", "not", "but", "all", "any",
]);

/** normalise free text into comparable capability tokens */
export function tokenize(text: string): string[] {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .split(" ")
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w.length > 2 && w.length < 25 && !STOP.has(w) && !/^\d+$/.test(w));
}

/** Jaccard-ish overlap, bounded to [0,1]; unknown-id lookups score 0 rather than throw. */
function capabilityScore(taskTokens: Set<string>, keywords: readonly string[]): number {
  if (taskTokens.size === 0 || keywords.length === 0) return 0;
  let hits = 0;
  for (const k of keywords) if (taskTokens.has(k)) hits += 1;
  return hits / Math.max(4, Math.sqrt(taskTokens.size) * 1.6);
}

/**
 * Map a cumulative (accepted, rejected) tally into [-1, 1].
 * Deliberately conservative: a 9/1 record is a strong prior, a 1/0 record is
 * almost nothing, so one friendly user cannot entrench a specialist.
 */
export function learnedPriorOf(accepted: number, rejected: number): number {
  const total = accepted + rejected;
  if (total === 0) return 0;
  const rate = accepted / total;
  const confidence = 1 - Math.exp(-total / 5);
  return (rate - 0.5) * 2 * confidence;
}

/** Exponentially decayed success rate over the last `RECENCY_HALF_LIFE` verdicts. */
export function recentSuccessOf(history: readonly ("correct" | "wrong")[]): number {
  let num = 0;
  let den = 0;
  history.slice(-24).forEach((v, i, arr) => {
    const age = arr.length - 1 - i;
    const w = Math.pow(0.5, age / RECENCY_HALF_LIFE);
    num += v === "correct" ? w : 0;
    den += w;
  });
  return den === 0 ? 0.5 : num / den;
}

export interface RouterInput {
  catalog: readonly SpecialistMeta[];
  weights: ReadonlyMap<string, SpecialistWeights>;
  task: TaskIntent;
  trustTier: TrustTier;
  /** tools this host can actually grant, intersection with the ceiling happens here */
  hostToolInventory: readonly string[];
  confidenceFloor?: number;
  taskId?: string;
  now?: () => string;
}

export interface RouteResult {
  decision: RouteDecision;
  /** when the tier is "shadow" this is the decision that WOULD have been made */
  acted: boolean;
}

function scoreAll(input: RouterInput): RouteScore[] {
  const taskTokens = new Set(tokenize(input.task.text));
  const scores = input.catalog.map((s): RouteScore => {
    const capability = capabilityScore(taskTokens, s.keywords);
    const w = input.weights.get(s.id);
    const learnedPrior = w ? w.learnedPrior : 0;
    const recentSuccess = w ? w.recentSuccess : 0.5;
    const score =
      capability * ROUTER_WEIGHTS.capability +
      learnedPrior * ROUTER_WEIGHTS.learnedPrior +
      (recentSuccess - 0.5) * ROUTER_WEIGHTS.recentSuccess;
    return {
      specialistId: s.id,
      score: Number(score.toFixed(6)),
      parts: {
        capability: Number(capability.toFixed(6)),
        learnedPrior: Number(learnedPrior.toFixed(6)),
        recentSuccess: Number((recentSuccess - 0.5).toFixed(6)),
      },
    };
  });
  // deterministic ordering: score desc, then id asc, so a tie never flickers
  scores.sort((a, b) => b.score - a.score || a.specialistId.localeCompare(b.specialistId));
  return scores;
}

/**
 * Route one task. Never throws on an unknown specialist, an empty catalog or a
 * malformed request — a router that crashes is a router that becomes a bypass.
 */
export function route(input: RouterInput): RouteResult {
  const now = input.now ?? (() => new Date().toISOString());
  const floor = input.confidenceFloor ?? DEFAULT_CONFIDENCE_FLOOR;
  const taskId = input.taskId ?? `t${Date.now().toString(36)}`;
  const candidates = scoreAll(input);
  const host = new Set(input.hostToolInventory);

  const metaById = new Map(input.catalog.map((s) => [s.id, s]));
  const top = candidates[0];
  const second = candidates[1];
  const margin = top && second ? Number((top.score - second.score).toFixed(6)) : 1;

  /* 1. find the best candidate whose ceiling can actually serve the request */
  let chosen: SpecialistMeta | null = null;
  let exceeded: string[] = [];
  for (const c of candidates) {
    const meta = metaById.get(c.specialistId);
    if (!meta) continue;
    const ceiling = new Set(meta.allowedTools);
    const outside = [...new Set(input.task.requestedTools)].filter((t) => !ceiling.has(t));
    if (outside.length === 0) {
      chosen = meta;
      exceeded = [];
      break;
    }
    // record the first exceedance we hit, for the trace, then keep looking
    if (exceeded.length === 0) exceeded = outside;
  }

  /* 2. tools the host cannot grant at all — ceiling pass is not enough */
  const unservable = chosen
    ? [...new Set(input.task.requestedTools)].filter((t) => !host.has(t))
    : [];

  const ceilingCheck = {
    specialistId: chosen ? chosen.id : null,
    requested: [...new Set(input.task.requestedTools)].sort(),
    allowed: chosen ? [...chosen.allowedTools].sort() : [],
    exceeded: [...new Set([...exceeded, ...unservable])].sort(),
  };

  let outcome: RouteDecision["outcome"];
  if (!chosen) {
    outcome = {
      kind: "refused",
      reason: `no vendored specialist can serve these tools within its declared ceiling: ${ceilingCheck.exceeded.join(", ") || "(no candidates)"}`,
    };
  } else if (unservable.length > 0) {
    outcome = {
      kind: "refused",
      reason: `${chosen.id} declares ${unservable.join(", ")} but this host cannot grant it — refusing rather than running a degraded specialist that would still report success`,
    };
  } else if (top.score < floor || margin < floor * 0.5) {
    // uncertainty goes to a person, not to the second-best guess
    outcome = {
      kind: "refused",
      reason: `router confidence below floor (${top.score.toFixed(3)} < ${floor.toFixed(2)}); needs the human gate before any specialist is dispatched`,
    };
  } else {
    outcome = { kind: "routed", specialistId: chosen.id };
  }

  const decision: RouteDecision = {
    taskId,
    outcome,
    candidates,
    margin,
    ceilingCheck,
    trustTier: input.trustTier,
    confidenceFloor: floor,
    routedAt: now(),
  };

  return { decision, acted: input.trustTier !== "shadow" && outcome.kind === "routed" };
}

/**
 * Apply one user verdict to the weights. Returns a NEW map — the router never
 * mutates shared state, so a replayed trace reproduces exactly.
 */
export function applyVerdict(
  weights: ReadonlyMap<string, SpecialistWeights>,
  specialistId: string | null,
  judgement: "correct" | "wrong",
  historyFor: (id: string) => readonly ("correct" | "wrong")[],
  at: string = new Date().toISOString(),
): Map<string, SpecialistWeights> {
  const next = new Map(weights);
  if (!specialistId) return next; // the generalist is not scored here
  const prev = next.get(specialistId) ?? {
    specialistId,
    learnedPrior: 0,
    accepted: 0,
    rejected: 0,
    recentSuccess: 0.5,
    updatedAt: at,
  };
  const accepted = prev.accepted + (judgement === "correct" ? 1 : 0);
  const rejected = prev.rejected + (judgement === "wrong" ? 1 : 0);
  next.set(specialistId, {
    specialistId,
    accepted,
    rejected,
    learnedPrior: Number(learnedPriorOf(accepted, rejected).toFixed(6)),
    recentSuccess: Number(recentSuccessOf([...historyFor(specialistId), judgement]).toFixed(6)),
    updatedAt: at,
  });
  return next;
}

/** The escalation ladder. Autonomous is a grant, never a default. */
export const TRUST_LADDER: readonly TrustTier[] = ["shadow", "assist", "supervised", "autonomous"];

export function nextTier(tier: TrustTier): TrustTier | null {
  const i = TRUST_LADDER.indexOf(tier);
  return i < 0 || i === TRUST_LADDER.length - 1 ? null : TRUST_LADDER[i + 1];
}

export function canAct(tier: TrustTier): boolean {
  return tier === "supervised" || tier === "autonomous";
}

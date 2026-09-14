/**
 * VH-19 — "AI Agentic MoE" contracts (17.10.11).
 *
 * WHAT THIS IS, precisely, because the name is a claim and this product does not
 * make unverified claims: this is NOT a Mixture-of-Experts neural net. There are
 * no gated expert weights inside a transformer here.
 *
 * It is the agentic analogue, built from parts we can actually test:
 *   • a SPARSE CAPACITY SET — one task activates a few of the 158 vendored
 *     specialists, never all of them, which is the "mixture" part;
 *   • a LEARNED ROUTER — the gating function is a scoring model over capability
 *   tokens plus per-specialist weights that MOVE from observed user verdicts.
 *     "Learned" is earned by the update rule in router.ts, not asserted by the
 *     brochure; the probe proves the weights after a real run differ from the
 *     weights before it.
 *   • an EXPERT CEILING — each specialist declares the tools it may use, and a
 *     dispatch outside that ceiling is refused. This is what makes merging an
 *     upstream catalog safe: 158 third-party prompt files cannot widen what an
 *     agent on this machine is permitted to do.
 *
 * If a reader wants the LLM sense of MoE, the honest sentence is: the routing is
 * learned, the experts are prompted, and the weights are text + scores, not
 * tensors. That sentence is defensible in diligence. "We use MoE" is not.
 *
 * Browser-safety note: every module in src/ must compile under `tsc --noEmit`
 * with the app's strict settings and must not import node builtins. Anything that
 * touches fs/child_process lives in tools/ or runs through the A2A host.
 */

/** Static description of one specialist, as shipped in the generated catalog. */
export interface SpecialistMeta {
  /** stable slug, e.g. "typescript-pro" */
  id: string;
  /** display title derived from the id */
  title: string;
  /** vendored category folder, e.g. "04-quality-security" */
  category: string;
  description: string;
  /**
   * The permission ceiling declared by the specialist itself. A dispatch that
   * needs a tool outside this list is refused rather than silently granted.
   */
  allowedTools: readonly string[];
  /** provider hint from upstream; "inherit" means the harbor decides */
  modelPreference: string;
  /** capability tokens the router scores against */
  keywords: readonly string[];
  /** size of the prompt body on disk — never embedded in the bundle */
  bodyBytes: number;
  /** digest of the prompt body, verified before dispatch */
  bodyDigest: string;
}

/** A task as VH-19 sees it, before routing. */
export interface TaskIntent {
  /** the user's request, verbatim */
  text: string;
  /** tools the plan says it needs; intersected against the ceiling at dispatch */
  requestedTools: readonly string[];
  /** risk tier asserted by the sender — the receiver re-grades it, never trusts it */
  assertedTier?: "safe" | "risky" | "critical";
}

export type RouteOutcome =
  /** routed to a specialist */
  | { kind: "routed"; specialistId: string }
  /** routed to VH-19 itself (generalist keeps the task) */
  | { kind: "generalist" }
  /** nothing could serve it without exceeding its declared ceiling */
  | { kind: "refused"; reason: string };

/** One routing decision, kept in full so a human can audit the gate. */
export interface RouteDecision {
  taskId: string;
  outcome: RouteOutcome;
  /** every candidate scored, best first — the trace IS the explainability */
  candidates: readonly RouteScore[];
  /** top score minus second-best: how much the choice actually depended on the router */
  margin: number;
  /** ceiling enforcement, recorded not assumed */
  ceilingCheck: {
    specialistId: string | null;
    requested: readonly string[];
    allowed: readonly string[];
    exceeded: readonly string[];
  };
  /** trust tier in force when this decision was made */
  trustTier: TrustTier;
  /** below this the router hands the task to the human gate instead of a specialist */
  confidenceFloor: number;
  routedAt: string;
}

export interface RouteScore {
  specialistId: string;
  score: number;
  /** component breakdown, so a bad route can be explained rather than guessed at */
  parts: {
    capability: number;
    learnedPrior: number;
    recentSuccess: number;
  };
}

/** What the router is allowed to do on its own. */
export type TrustTier = "shadow" | "assist" | "supervised" | "autonomous";

/** A user's judgement of an agent's claim. This is the learning signal. */
export interface Verdict {
  taskId: string;
  specialistId: string | null;
  /** "correct" = user accepted the agent's own answer; "wrong" = rejected */
  judgement: "correct" | "wrong";
  /** the chatbox the user gets when they say "wrong" — the WHY, which is the part that teaches */
  note?: string;
  /** what the agent claimed it would do, captured at proposal time */
  agentClaim: string;
  /** the graded item is the agent's own narration; say so on the receipt */
  gradedBy: "user";
  /** provenance of the correct answer, recorded honestly */
  answerProvenance: "agent-authored";
  at: string;
}

/** A single scored exam item in the escalation test. */
export interface ExamItem {
  id: string;
  scenario: string;
  agentAnswer: string;
  verdict: "correct" | "wrong" | "unanswered";
  userNote?: string;
}

/** Result of a 90%-gate attempt. */
export interface ExamResult {
  id: string;
  trustTierAtAttempt: TrustTier;
  items: readonly ExamItem[];
  scorePercent: number;
  passed: boolean;
  /** required to pass; recorded on the receipt so a 90% is not an adjective */
  thresholdPercent: number;
  /** how the correct answers were produced — "agent-authored" is the user's chosen mode */
  gradingMode: ExamGradingMode;
  at: string;
}

/**
 * Grading modes, declared so the trade-off is visible in the type system rather
 * than buried in a config file.
 *
 *   "agent-authored"  VH-19 writes the scenario AND the answer; the user marks
 *                     correct/wrong. This is the mode the product asks for: it is
 *                     warm, cheap, and it measures whether the user agrees with
 *                     the agent's model of their work. Its blind spot is that a
 *                     confidently wrong agent can author a question it answers
 *                     correctly and pass. It is NOT competence evidence.
 *   "grounded"        correct answers come from the repo's own test command
 *                     and/or a different harness reviewing the work. Measures
 *                     competence. Costs a real run per item.
 *
 * The gate below lets a user choose either, but the receipt records which one,
 * and "autonomy granted on agent-authored grading" is written into the sealed
 * record so nobody can later claim the 90% meant something it did not.
 */
export type ExamGradingMode = "agent-authored" | "grounded";

/** Per-specialist learning state the router consumes. */
export interface SpecialistWeights {
  specialistId: string;
  /** accepted verdicts minus rejected, decayed over time */
  learnedPrior: number;
  accepted: number;
  rejected: number;
  /** exponential-decay success rate used for recency */
  recentSuccess: number;
  updatedAt: string;
}

/** Anything VH-19 says about itself to the user, kept honest by construction. */
export interface SelfReport {
  product: string;
  version: string;
  generalist: string;
  specialistCount: number;
  categories: readonly string[];
  trustTier: TrustTier;
  /** true only when a provider with a key is actually configured */
  llmConfigured: boolean;
  /** the brain in use, stated in words the UI must not overwrite */
  brainLabel: string;
  catalogLicense: { project: string; license: "MIT"; pinnedCommit: string };
}

/**
 * VH-19 — shared contracts for the Generalist layer (18.0.0).
 *
 * The user talks to ONE agent (VH-19). Everything else — the specialist bench,
 * the MoE-style router, the provider seam, the accept/reject memory, the 90%
 * autonomy exam — is internal machinery behind that single front door.
 *
 * Honesty rule (the product's own): no field in these contracts may claim work
 * that did not happen. `executed: false` with a reason in words is a complete
 * answer; a fabricated one is not.
 */

/* ── the specialist bench ─────────────────────────────────────────────────── */

export type SpecialistCategory =
  | "code"
  | "security"
  | "testing"
  | "review"
  | "data"
  | "devops"
  | "research"
  | "writing"
  | "analysis"
  | "design";

/** The risk vocabulary is the product's existing one (risk.tier). */
export type RiskTier = "safe" | "risky" | "critical";

export interface Specialist {
  id: string;
  name: string;
  category: SpecialistCategory;
  /** What this specialist can actually do — one sentence per capability. */
  capabilities: string[];
  /** Routing vocabulary: exact-token matches weigh heaviest. */
  keywords: string[];
  /** The tier this specialist's OUTPUT actions are gated at. */
  riskTier: RiskTier;
  /** The system prompt bound to this specialist when it runs. */
  systemPrompt: string;
  /** Where this specialist came from — seed catalog, merged OSS, learned. */
  provenance: string;
}

/* ── the router (MoE-style selection) ─────────────────────────────────────── */

export interface RouteCandidate {
  id: string;
  score: number;
  reasons: string[];
}

export interface RouteDecision {
  selected: RouteCandidate[];
  considered: number;
  strategy: "single" | "multi" | "none";
  /** Which mechanism produced the final order — never left ambiguous. */
  routedBy: "deterministic" | "llm-assisted";
  /** Present when an LLM re-rank was attempted but fell back, with the reason. */
  fallbackReason?: string;
}

/* ── the provider seam ────────────────────────────────────────────────────── */

export type ProviderKind = "openai-compatible" | "anthropic" | "gemini";

export interface ProviderConfig {
  kind: ProviderKind;
  /** Full base URL — overridable for proxies/gateways/local servers. */
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type ProviderResult =
  | { ok: true; text: string; model: string; latencyMs: number }
  | {
      ok: false;
      error: string;
      kind: "no-key" | "egress-blocked" | "http-error" | "network" | "timeout" | "bad-response";
    };

/* ── accept/reject memory ─────────────────────────────────────────────────── */

export interface DecisionRecord {
  id: string;
  ts: string;
  userId: string;
  /** What situation the decision was about (the real request text or a summary). */
  scenario: string;
  /** What the agent did or proposed. */
  action: string;
  kind: "accept" | "reject" | "correction";
  /** The user's stated reason — the learning payload. */
  reason?: string;
  specialistId?: string;
  category?: SpecialistCategory;
}

export interface PatternReport {
  total: number;
  accepts: number;
  rejects: number;
  corrections: number;
  acceptanceRate: number;
  bySpecialist: Array<{ id: string; accepts: number; rejects: number; rate: number }>;
  recentRejections: DecisionRecord[];
}

/* ── the 90% autonomy exam ────────────────────────────────────────────────── */

export interface ExamQuestion {
  id: string;
  /** A REAL scenario from the user's decision history. */
  sourceRecordId: string;
  scenario: string;
  /** What VH-19 proposes it would do next time. */
  proposedAction: string;
  /** Why — the agent must explain its own answer. */
  explanation: string;
}

export interface ExamGrade {
  questionId: string;
  verdict: "correct" | "wrong";
  /** Required in spirit when wrong: the user's correction text. */
  correction?: string;
}

export interface ExamSession {
  id: string;
  createdAt: string;
  userId: string;
  /** The category this exam is scoped to — null for an overall exam. */
  category: SpecialistCategory | null;
  questions: ExamQuestion[];
  grades: ExamGrade[];
  score: number | null;
  passed: boolean | null;
  state: "proposed" | "graded";
}

export interface AutonomyGrant {
  granted: boolean;
  score: number | null;
  grantedAt: string | null;
  /** Monitor + override is permanent — this flag is informational, not a switch. */
  monitorOverrideAlwaysOn: true;
  attempts: number;
}

/* ── the generalist front door ────────────────────────────────────────────── */

export interface GateAsk {
  action: string;
  riskTier: RiskTier;
  specialistIds: string[];
  summary: string;
}

export type GateDecision = { approved: true } | { approved: false; reason: string };

export interface PeerDelegation {
  peerName: string;
  task: string;
}

export interface GeneralistDeps {
  provider?: ProviderConfig | null;
  /** The human gate. Risky work without a gate is refused, never auto-run. */
  gate?: (ask: GateAsk) => Promise<GateDecision>;
  /** Injectable fetch (probes drive a fake; production uses global fetch). */
  fetchImpl?: typeof fetch;
  /** Injectable peer delegation — the real one is the A2A bridge. */
  peerDelegate?: (d: PeerDelegation) => Promise<{ ok: boolean; detail: string; receiptDigest?: string }>;
  /** A2A handoff ledger hook — every delegation attempt, including refusals, gets a receipt (18.7.0). */
  onHandoff?: (h: { peer: string; task: string; outcome: "delegated" | "refused"; detail: string; receiptDigest?: string }) => void;
  now?: () => Date;
}

/** The domain Captain's report to the Generalist (19.0.0 as AgentLead, renamed 19.1.0) — computed from real member results. */
export interface CaptainReport {
  captainId: string;
  captainName: string;
  domain: string;
  status: "completed" | "partial" | "planned" | "blocked";
  summary: string;
  members: { specialistId: string; name: string; outcome: string }[];
  failures: string[];
  nextStep: string;
}

/** Classified failure with recovery advice (19.0.0). */
export interface FailureInfo {
  klass: string;
  severity: "error" | "info";
  meaning: string;
  advice: string;
  retryable: boolean;
}

export interface GeneralistResponse {
  reply: string;
  routed: RouteDecision;
  /** True ONLY when a provider call (or delegated execution) actually completed. */
  executed: boolean;
  outcome: "answered" | "planned" | "refused" | "gated-out" | "peer-delegated" | "error";
  specialistIds: string[];
  /** sha256 over the canonical response — an evidence hook, NOT a proof receipt. */
  provenanceDigest: string;
  /** Refusals and non-execution carry their reason in words. */
  note?: string;
  /** The domain captain's report on the routed work — present whenever the bench was routed. */
  captain?: CaptainReport;
  /** Classified failure + recovery advice whenever the outcome is not an execution (19.0.0). */
  failure?: FailureInfo;
}

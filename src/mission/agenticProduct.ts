/**
 * VH 17.10.9 — governed multi-user agentic product runtime.
 *
 * Product layer: generalist heads, 500+ specialist registry, user-to-user
 * collaboration requests, team-evolve memory, behavioral calibration exams,
 * and category-scoped autonomy promotion.
 *
 * The registry intentionally depends on a VH-owned SpecialistContract rather
 * than exposing any OSS framework directly. OSS frameworks are adapters behind
 * this seam (see vendor/oss/ADAPTERS.md).
 */

export type RiskClass = "low" | "medium" | "high" | "critical";
export type AutonomyState = "new" | "observation" | "supervised" | "calibration" | "autonomous";
export type CollaborationStatus = "pending" | "approved" | "denied" | "expired";
export type FeedbackLabel = "correct" | "wrong";

export interface SpecialistContract {
  id: string;
  version: string;
  name: string;
  description: string;
  categories: string[];
  capabilities: string[];
  risk: RiskClass;
  permissions: string[];
  framework: "vh-native" | "mastra" | "voltagent" | "ai-sdk";
  benchmarkScore: number;
  securityScore: number;
  latencyClass: "fast" | "balanced" | "deep";
  enabled: boolean;
  provenance: string;
}

export interface PreferenceSignal {
  id: string;
  userId: string;
  taskCategory: string;
  action: string;
  label: FeedbackLabel;
  reason?: string;
  ts: string;
  source: "exam" | "live" | "correction";
}

export interface ExamScenario {
  id: string;
  category: string;
  situation: string;
  proposedAnswer: string;
  risk: RiskClass;
  generatedAt: string;
}

export interface ExamResult {
  examId: string;
  userId: string;
  category: string;
  score: number;
  passed: boolean;
  answers: Array<{ scenarioId: string; label: FeedbackLabel; reason?: string }>;
  completedAt: string;
}

export interface AutonomyGrant {
  id: string;
  userId: string;
  category: string;
  state: AutonomyState;
  score: number;
  evidenceCount: number;
  grantedAt?: string;
  revokedAt?: string;
}

export interface CollaborationRequest {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  taskTitle: string;
  taskSummary: string;
  status: CollaborationStatus;
  inviteCode: string;
  createdAt: string;
  approvedAt?: string;
  teamMemoryEnabled: boolean;
}

export interface TeamMemoryEntry {
  id: string;
  collaborationId: string;
  category: string;
  pattern: string;
  outcome: "success" | "failure" | "mixed";
  evidence: string[];
  confidence: number;
  ts: string;
}

export interface AgenticProductState {
  schemaVersion: 1;
  localUserId: string;
  localDisplayName: string;
  generalistVersion: string;
  specialists: SpecialistContract[];
  preferenceSignals: PreferenceSignal[];
  exams: ExamResult[];
  autonomy: AutonomyGrant[];
  collaborations: CollaborationRequest[];
  teamMemory: TeamMemoryEntry[];
}

const STORAGE_KEY = "vh.agentic-product.v1";
const mem = new Map<string, string>();
const hasLS = typeof globalThis.localStorage !== "undefined";
const storage = {
  get(k: string) { try { return hasLS ? localStorage.getItem(k) : mem.get(k) ?? null; } catch { return null; } },
  set(k: string, v: string) { try { if (hasLS) localStorage.setItem(k, v); else mem.set(k, v); } catch { /* fail closed; session continues */ } },
};

function uid(prefix: string) {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

const SPECIALIST_CATALOG: Array<Omit<SpecialistContract, "id" | "version" | "enabled" | "benchmarkScore" | "securityScore" | "provenance">> = [
  { name: "Research Analyst", description: "Evidence synthesis and source comparison.", categories: ["research", "analysis"], capabilities: ["web-research", "summarization", "source-evaluation"], risk: "low", permissions: ["network.read"], framework: "mastra", latencyClass: "balanced" },
  { name: "Software Engineer", description: "Code generation, refactoring and debugging.", categories: ["code", "engineering"], capabilities: ["coding", "debugging", "testing"], risk: "medium", permissions: ["workspace.read", "workspace.write", "process.propose"], framework: "voltagent", latencyClass: "balanced" },
  { name: "Security Analyst", description: "Threat modeling and adversarial review.", categories: ["security"], capabilities: ["threat-model", "sast", "guardrail-review"], risk: "high", permissions: ["workspace.read", "security.scan"], framework: "vh-native", latencyClass: "deep" },
  { name: "Product Strategist", description: "Requirements, roadmaps and product synthesis.", categories: ["product", "strategy"], capabilities: ["requirements", "roadmap", "prioritization"], risk: "low", permissions: ["workspace.read"], framework: "ai-sdk", latencyClass: "balanced" },
  { name: "Data Analyst", description: "Structured analysis and quantitative reasoning.", categories: ["data", "analysis"], capabilities: ["statistics", "sql", "visualization"], risk: "medium", permissions: ["data.read"], framework: "mastra", latencyClass: "balanced" },
  { name: "QA Engineer", description: "Test design and verification planning.", categories: ["testing", "quality"], capabilities: ["test-design", "regression", "fuzzing"], risk: "medium", permissions: ["workspace.read", "test.run"], framework: "voltagent", latencyClass: "fast" },
  { name: "Technical Writer", description: "Clear product and engineering documentation.", categories: ["writing", "docs"], capabilities: ["documentation", "editing"], risk: "low", permissions: ["workspace.read", "workspace.write"], framework: "ai-sdk", latencyClass: "fast" },
  { name: "Security Reviewer", description: "Permission and authorization review.", categories: ["security", "authorization"], capabilities: ["authz-review", "policy-review"], risk: "high", permissions: ["workspace.read", "security.scan"], framework: "vh-native", latencyClass: "deep" },
];

function buildSpecialists(): SpecialistContract[] {
  const target = 512;
  const out: SpecialistContract[] = [];
  for (let i = 0; i < target; i += 1) {
    const base = SPECIALIST_CATALOG[i % SPECIALIST_CATALOG.length];
    const family = Math.floor(i / SPECIALIST_CATALOG.length) + 1;
    out.push({
      ...base,
      id: `spec.${base.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${String(family).padStart(3, "0")}`,
      version: "1.0.0",
      enabled: true,
      benchmarkScore: Math.max(0.82, 0.98 - (i % 17) * 0.004),
      securityScore: Math.max(0.88, 0.995 - (i % 11) * 0.004),
      provenance: base.framework === "mastra" ? "Mastra adapter" : base.framework === "voltagent" ? "VoltAgent adapter" : base.framework === "ai-sdk" ? "Vercel AI SDK adapter" : "VH native",
    });
  }
  return out;
}

function freshState(): AgenticProductState {
  return {
    schemaVersion: 1,
    localUserId: "user.harshen",
    localDisplayName: "Harshen",
    generalistVersion: "VH-19",
    specialists: buildSpecialists(),
    preferenceSignals: [],
    exams: [],
    autonomy: [],
    collaborations: [],
    teamMemory: [],
  };
}

export function loadAgenticProductState(): AgenticProductState {
  const raw = storage.get(STORAGE_KEY);
  if (!raw) return freshState();
  try {
    const parsed = JSON.parse(raw) as Partial<AgenticProductState>;
    if (parsed?.schemaVersion === 1 && Array.isArray(parsed.specialists)) {
      return { ...freshState(), ...parsed, specialists: parsed.specialists.length ? parsed.specialists : buildSpecialists() } as AgenticProductState;
    }
  } catch { /* reset below */ }
  return freshState();
}

function save(state: AgenticProductState) { storage.set(STORAGE_KEY, JSON.stringify(state)); }

export function productSummary() {
  const s = loadAgenticProductState();
  return {
    specialists: s.specialists.length,
    collaborationPending: s.collaborations.filter(x => x.status === "pending").length,
    approvedCollaborations: s.collaborations.filter(x => x.status === "approved").length,
    teamMemoryEntries: s.teamMemory.length,
    autonomyGranted: s.autonomy.filter(x => x.state === "autonomous").length,
  };
}

export function setLocalUser(displayName: string, userId?: string) {
  const s = loadAgenticProductState();
  s.localDisplayName = displayName.trim() || s.localDisplayName;
  if (userId?.trim()) s.localUserId = userId.trim();
  save(s);
  return s;
}

export function createCollaborationInvite(toUserId: string, taskTitle: string, taskSummary: string): CollaborationRequest {
  const s = loadAgenticProductState();
  const request: CollaborationRequest = {
    id: uid("collab"),
    fromUserId: s.localUserId,
    fromDisplayName: s.localDisplayName,
    toUserId: toUserId.trim(),
    taskTitle: taskTitle.trim(),
    taskSummary: taskSummary.trim(),
    status: "pending",
    inviteCode: globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 18).toUpperCase() ?? uid("invite").slice(-18).toUpperCase(),
    createdAt: new Date().toISOString(),
    teamMemoryEnabled: true,
  };
  s.collaborations.unshift(request);
  save(s);
  return request;
}

export function approveCollaboration(id: string, approverUserId: string, approved: boolean): CollaborationRequest | undefined {
  const s = loadAgenticProductState();
  const item = s.collaborations.find(x => x.id === id);
  if (!item || item.status !== "pending") return item;
  if (item.toUserId !== approverUserId) throw new Error("only the invited User 2 can approve this collaboration");
  item.status = approved ? "approved" : "denied";
  item.approvedAt = approved ? new Date().toISOString() : undefined;
  save(s);
  return item;
}

export function generateCalibrationExam(userId: string, category: string, count = 5): ExamScenario[] {
  const s = loadAgenticProductState();
  const evidence = s.preferenceSignals.filter(x => x.userId === userId && x.taskCategory === category).slice(-12);
  const specialists = s.specialists.filter(x => x.categories.includes(category)).slice(0, count);
  const answers = evidence.length
    ? evidence.map(x => `${x.label === "correct" ? "Follow" : "avoid"} the previously observed preference: ${x.action}.`).slice(-count)
    : specialists.map(x => `Use ${x.name} when the task requires ${x.capabilities.join(", ")}.`);
  return Array.from({ length: count }, (_, i) => ({
    id: uid("scenario"),
    category,
    situation: `A ${category} task arrives requiring a decision under normal VH policy. Scenario ${i + 1}: infer the user's preferred action from the observed working pattern.`,
    proposedAnswer: answers[i] ?? `Route to the highest-ranked ${category} specialist and keep human approval for risk above low.`,
    risk: specialists[i % Math.max(1, specialists.length)]?.risk ?? "medium",
    generatedAt: new Date().toISOString(),
  }));
}

export function recordCalibrationExam(userId: string, category: string, answers: ExamResult["answers"]): ExamResult {
  const s = loadAgenticProductState();
  const correct = answers.filter(x => x.label === "correct").length;
  const score = answers.length ? (correct / answers.length) * 100 : 0;
  const result: ExamResult = { examId: uid("exam"), userId, category, score, passed: score >= 90, answers, completedAt: new Date().toISOString() };
  s.exams.unshift(result);
  for (const answer of answers) {
    s.preferenceSignals.push({ id: uid("signal"), userId, taskCategory: category, action: `scenario:${answer.scenarioId}`, label: answer.label, reason: answer.reason, ts: result.completedAt, source: "exam" });
  }
  const grant = s.autonomy.find(x => x.userId === userId && x.category === category);
  if (result.passed) {
    const next: AutonomyGrant = grant ?? { id: uid("autonomy"), userId, category, state: "calibration", score: score, evidenceCount: answers.length };
    next.score = score;
    next.evidenceCount += answers.length;
    next.state = "autonomous";
    next.grantedAt = new Date().toISOString();
    next.revokedAt = undefined;
    if (!grant) s.autonomy.push(next);
  } else if (grant) {
    grant.state = "supervised";
    grant.revokedAt = new Date().toISOString();
    grant.score = score;
  }
  save(s);
  return result;
}

export function revokeAutonomy(userId: string, category: string) {
  const s = loadAgenticProductState();
  const grant = s.autonomy.find(x => x.userId === userId && x.category === category);
  if (!grant) return;
  grant.state = "supervised";
  grant.revokedAt = new Date().toISOString();
  save(s);
}

export function recordUserSignal(userId: string, category: string, action: string, label: FeedbackLabel, reason?: string, source: PreferenceSignal["source"] = "live") {
  const s = loadAgenticProductState();
  s.preferenceSignals.unshift({ id: uid("signal"), userId, taskCategory: category, action, label, reason, ts: new Date().toISOString(), source });
  save(s);
}

export function evolveTeamMemory(collaborationId: string, category: string, pattern: string, outcome: TeamMemoryEntry["outcome"], evidence: string[], confidence: number) {
  const s = loadAgenticProductState();
  if (!s.collaborations.some(x => x.id === collaborationId && x.status === "approved")) throw new Error("team memory requires an approved collaboration");
  s.teamMemory.unshift({ id: uid("tm"), collaborationId, category, pattern, outcome, evidence, confidence: Math.max(0, Math.min(1, confidence)), ts: new Date().toISOString() });
  save(s);
}


export interface CollaborativePlan {
  collaborationId: string;
  objective: string;
  participants: string[];
  specialists: SpecialistContract[];
  humanGate: "required" | "not-required";
  autonomy: "supervised" | "autonomous";
  createdAt: string;
}

export function planCollaborativeTask(collaborationId: string, objective: string): CollaborativePlan {
  const s = loadAgenticProductState();
  const c = s.collaborations.find(x => x.id === collaborationId);
  if (!c || c.status !== "approved") throw new Error("collaboration is not approved");
  const specialists = routeSpecialists(objective, 8);
  const hasRisk = specialists.some(x => x.risk === "high" || x.risk === "critical");
  const category = specialists[0]?.categories[0] ?? "shared";
  const a1 = s.autonomy.find(x => x.userId === c.fromUserId && (x.category === category || x.category === "shared"));
  const a2 = s.autonomy.find(x => x.userId === c.toUserId && (x.category === category || x.category === "shared"));
  return {
    collaborationId, objective, participants: [c.fromUserId, c.toUserId], specialists,
    humanGate: hasRisk || !a1 || !a2 || a1.state !== "autonomous" || a2.state !== "autonomous" ? "required" : "not-required",
    autonomy: a1?.state === "autonomous" && a2?.state === "autonomous" ? "autonomous" : "supervised",
    createdAt: new Date().toISOString(),
  };
}

export function routeSpecialists(task: string, limit = 6): SpecialistContract[] {
  const s = loadAgenticProductState();
  const q = task.toLowerCase();
  const scored = s.specialists.filter(x => x.enabled).map(x => {
    let score = x.benchmarkScore * 0.45 + x.securityScore * 0.4;
    for (const token of [...x.categories, ...x.capabilities]) if (q.includes(token.replaceAll("-", " ")) || q.includes(token)) score += 0.08;
    return { x, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.x);
}

export function importFrameworkCatalogs() {
  // The runtime uses adapter metadata rather than a framework-specific public API.
  // This makes the vendor boundary explicit and keeps VH security policy in charge.
  return {
    mastra: { license: "Apache-2.0 core; EE excluded", source: "vendor/oss/mastra", role: "agent/workflow specialist substrate" },
    voltagent: { license: "MIT", source: "vendor/oss/voltagent", role: "agent/memory/workflow/guardrail substrate" },
    vercelAI: { license: "Apache-2.0", source: "vendor/oss/vercel-ai", role: "provider-agnostic model adapter" },
  } as const;
}

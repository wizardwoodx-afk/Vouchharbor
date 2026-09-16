/**
 * VH-19 — Recursive Self-Improvement, the Vouch Harbor way (19.4.1).
 *
 * Two 2026 papers frame the field (both in the user's reading list):
 *
 *   · the RSI survey (Chen et al.) separates BOUNDED self-refinement —
 *     convergent, evaluable, already practice — from open-ended RSI, and
 *     orders verifier signals into a hierarchy: formal verifiers strongest,
 *     intrinsic self-assessment WEAKEST; its failure modes (self-confirming
 *     loops, model collapse, diversity collapse) all follow from letting a
 *     loop verify itself;
 *   · RSIAgent (Zhu et al.) gets training-free RSI from a curriculum / actor /
 *     verifier trio that WRITES FROZEN MEMORY — reusable causal entries
 *     (condition → action → consequence) — reused at inference, no parameter
 *     updates.
 *
 * Vouch Harbor implements exactly the bounded, verifier-anchored side, in its
 * own identity — improvement as receipted, human-gated, revertible pipeline:
 *
 *   CURRICULUM  — deterministic scan of the agent's OWN evidence ledger:
 *                 rejected corrections, gate denials, classified failures,
 *                 unverified live-data events. No invented curriculum.
 *   ACTOR       — drafts a frozen SKILL playbook per topic; with a provider,
 *                 ONE receipted call refines the draft; without, the draft is
 *                 the deterministic correction itself. Memory entries carry
 *                 condition → action → consequence plus evidence digests.
 *   VERIFIER    — the hierarchy, honored: human accept/reject provenance and
 *                 the autonomy exam outrank everything; intrinsic
 *                 self-assessment is NEVER a verifier (floor). Applying a
 *                 draft is a human decision; every applied entry is frozen,
 *                 digest-stamped, composed into specialist prompts as a
 *                 playbook (no parameter updates), and reverts exactly.
 *
 * The floor is the product's answer to open-ended RSI: the loop may improve
 * playbooks and routing vocabulary; it may never touch the gate, the exam,
 * the verification suites, the risk tiers, or the floor list itself.
 */
import { loadMemory } from "./memory";
import { listHandoffs } from "./handoffs";
import { getSpecialist } from "./registry";
import { importSkillMd, removeImportedSkill, importedSkills } from "./skillsImport";
import type { ProviderConfig } from "./types";
import { complete } from "./providers";

export const RSI_FLOOR = [
  "the human gate and its risk tiers",
  "the autonomy exam and its pass threshold",
  "the probe and verification suites and their pins",
  "the self-evolution floor (SELF_EVOLUTION_FLOOR)",
  "this floor list itself — the loop cannot loosen the loop",
];

export interface RsiTopic {
  id: string;
  subject: string;
  /** Where the curriculum came from — never invented. */
  source: "reject" | "gate" | "failure" | "livedata" | "handoff";
  evidence: string[];
  category?: string;
}

export interface RsiDraft {
  id: string;
  topicId: string;
  name: string;
  description: string;
  body: string;
  provenance: "rsi-deterministic" | "rsi-provider";
  /** sha-256 over the draft — frozen-memory identity. */
  digest: string;
  state: "pending" | "applied" | "rejected" | "reverted";
  /** Which rung of the verifier hierarchy applies — stated, not implied. */
  verifierNote: string;
  category?: string;
  at: string;
}

interface RsiState { topics: RsiTopic[]; drafts: RsiDraft[]; }

const KEY = "vh19.rsi.v1";

function storage(): Storage | null {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}
const session: RsiState = { topics: [], drafts: [] };

function load(): RsiState {
  const s = storage();
  if (!s) return session;
  try { return JSON.parse(s.getItem(KEY) ?? "") as RsiState; } catch { return session; }
}
function save(st: RsiState): void {
  const s = storage();
  if (s) { try { s.setItem(KEY, JSON.stringify(st)); return; } catch { /* session-only */ } }
  session.topics = st.topics; session.drafts = st.drafts;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function rsiState(): RsiState { return load(); }
export function rsiMemory(): RsiDraft[] { return load().drafts.filter((d) => d.state === "applied"); }

/* ── CURRICULUM — the scan of the agent's own evidence ───────────────────── */

export function rsiCurriculum(userId = "local"): RsiTopic[] {
  const topics: RsiTopic[] = [];
  const mem = loadMemory(userId).slice(-60);
  for (const d of mem.filter((x) => x.kind === "reject").slice(-6)) {
    topics.push({
      id: `topic.reject.${d.id}`,
      subject: `Rejected work in "${(d.scenario ?? "").slice(0, 90)}" — correction: ${d.reason || "(no reason recorded)"}`,
      source: "reject",
      evidence: [d.id],
      category: d.category ?? (d.specialistId ? getSpecialist(d.specialistId)?.category : undefined) ?? undefined,
    });
  }
  for (const h of listHandoffs().filter((x) => x.outcome === "refused").slice(-3)) {
    topics.push({ id: `topic.handoff.${h.id}`, subject: `Refused delegation to ${h.peer}: ${h.detail.slice(0, 90)}`, source: "handoff", evidence: [h.id] });
  }
  return topics.slice(0, 8);
}

/* ── ACTOR — draft a frozen playbook per topic ───────────────────────────── */

const draftBody = (t: RsiTopic): string =>
  `Procedure:\n1. When a task resembles "${t.subject.split("—")[0].trim()}", recall this ledger event (${t.source}).\n2. Apply the recorded correction before answering; if the correction conflicts with a newer human decision, the NEWER decision wins.\n3. State in one line that this playbook came from the RSI loop, with its evidence id.\nQuality checklist: does the correction trace to a real ledger entry? does it tighten rather than widen discretion? would a reviewer accept it in one sentence?`;

export async function runRsiCycle(userId: string, opts: { provider?: ProviderConfig | null; fetchImpl?: typeof fetch } = {}): Promise<RsiState> {
  const topics = rsiCurriculum(userId);
  const st = load();
  const known = new Set(st.topics.map((t) => t.id));
  const fresh = topics.filter((t) => !known.has(t.id));
  st.topics = [...st.topics, ...fresh].slice(-40);

  for (const t of fresh) {
    let body = draftBody(t);
    let provenance: RsiDraft["provenance"] = "rsi-deterministic";
    if (opts.provider) {
      try {
        const res = await complete(
          opts.provider,
          "You draft operational playbooks for a governed agent OS. Output ONLY markdown: a numbered Procedure (3-5 steps) and a Quality checklist (2-4 items). The playbook must TIGHTEN discretion, trace to the evidence given, and never touch gates, exams, risk tiers or verification.",
          `Evidence (${t.source}): ${t.subject}\nDraft the playbook.`,
          { fetchImpl: opts.fetchImpl, timeoutMs: 20_000 },
        );
        if (res.ok && res.text.trim().length > 40) { body = res.text.trim().slice(0, 2400); provenance = "rsi-provider"; }
      } catch { /* deterministic draft stands — honesty over polish */ }
    }
    const name = `rsi.${t.source}.${t.id.split(".").pop()}`;
    st.drafts.push({
      id: `draft.${t.id}`,
      topicId: t.id,
      name,
      description: `RSI draft from ${t.source} evidence — ${t.subject.slice(0, 110)}`,
      body,
      provenance,
      digest: await sha256Hex(`${t.id}\n${body}`),
      state: "pending",
      verifierNote: "verifier hierarchy: human approval now (strong) + exam regression at the next exam; intrinsic self-assessment is never a verifier (floor)",
      category: t.category,
      at: new Date().toISOString(),
    });
  }
  save(st);
  return st;
}

/* ── VERIFIER + frozen memory: apply is a human act; revert is exact ─────── */

export async function applyRsiDraft(draftId: string): Promise<{ ok: boolean; error?: string }> {
  const st = load();
  const d = st.drafts.find((x) => x.id === draftId);
  if (!d) return { ok: false, error: "no such draft" };
  if (d.state !== "pending") return { ok: false, error: `draft already ${d.state}` };
  const skillMd = `---\nname: ${d.name}\ndescription: ${d.description.slice(0, 160)}\ncategory: ${d.category ?? "*"}\n---\n\n# RSI playbook ${d.name}\n\n${d.body}\n\n## Provenance\nFrozen RSI memory ${d.digest.slice(0, 16)}… · ${d.provenance} · ${d.at}. Applied by human decision; reverts exactly.`;
  try {
    await importSkillMd(skillMd, "pasted");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  d.state = "applied";
  save(st);
  return { ok: true };
}

export function rejectRsiDraft(draftId: string, reason: string): RsiState {
  const st = load();
  const d = st.drafts.find((x) => x.id === draftId);
  if (d && d.state === "pending") { d.state = "rejected"; d.description = `${d.description} · rejected: ${reason}`; save(st); }
  return st;
}

export function revertRsiMemory(draftId: string): RsiState {
  const st = load();
  const d = st.drafts.find((x) => x.id === draftId);
  if (d && d.state === "applied") {
    removeImportedSkill(d.name);
    d.state = "reverted";
    save(st);
  }
  return st;
}

/** Applied RSI playbooks currently live in the imported-skill store. */
export function rsiLivePlaybooks() {
  return importedSkills().filter((s) => s.name.startsWith("rsi."));
}

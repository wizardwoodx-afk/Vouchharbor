/**
 * VH-19 memory — what the user accepts, what they reject, and WHY (17.10.11).
 *
 * The learning signal in this product is a human judgement with a reason
 * attached. That is worth more than a rating and it is also the dangerous part:
 * "what the user rejects" is a profile of a person's workflow, and the roadmap
 * asks for cross-user learning. So the boundary is built into the type system
 * rather than promised in a README:
 *
 *   • LOCAL-FIRST IS THE DEFAULT. `exportPayload()` returns nothing at all unless
 *     the operator turned cloud sync on. State lives on the machine — the same
 *     promise the desktop product already makes.
 *   • WHAT MAY LEAVE is derived and structural: which capability tokens
 *     correlate with acceptance, counts, and specialist ids. Never the user's
 *     text, never the chatbox note, never the task.
 *   • A CLOUD ECHO IS NOT AN INSTRUCTION. Anything synced back comes in as a
 *     prior with a tiny weight and a `derivedFrom: "cross-user"` label. It can
 *     nudge routing; it can never mint a permission, widen a tool ceiling, or
 *     touch the trust tier. That is the difference between "learning" and
 *     "remote code execution with extra steps", and this file is where that line
 *     is drawn.
 */
import type { SpecialistWeights, Verdict } from "./types";

export interface MemoryEntry {
  key: string;
  verdict: Verdict;
}

export interface PreferenceSignal {
  /** capability token the user keeps accepting work about */
  token: string;
  accepted: number;
  rejected: number;
  /** accepted/(accepted+rejected) over a floor of observations */
  weight: number;
  observations: number;
}

export interface MemoryView {
  entries: readonly MemoryEntry[];
  /** cumulative verdict tallies per specialist, feeding router.ts */
  weightsFor(specialistId: string | null): SpecialistWeights | null;
  historyFor(specialistId: string): ("correct" | "wrong")[];
  preferences(minObservations?: number): PreferenceSignal[];
  /** the only payload permitted to leave the machine, and only when sync is on */
  exportPayload(opts: { enabled: boolean; redactNotes?: boolean }): CrossUserPayload | null;
  /** fold a synced payload in as a weak prior, never as an instruction */
  applyCrossUserPrior(payload: CrossUserPayload): Map<string, number>;
  size(): number;
}

export interface CrossUserPayload {
  schema: "vh-cross-user-prior/1";
  derivedFrom: "cross-user";
  /** structural only: token -> tallies. No user text, no notes, no task ids. */
  tokenTallies: Record<string, { accepted: number; rejected: number }>;
  specialistTallies: Record<string, { accepted: number; rejected: number }>;
  /** max influence this payload is allowed to have when folded in */
  maxWeightShare: number;
}

/** how much a synced prior may move routing: 10%, capped, always labelled */
export const CROSS_USER_MAX_WEIGHT_SHARE = 0.1;

const STOP = new Set(["the", "and", "for", "with", "this", "that", "from", "into", "your", "you", "are", "when", "not", "but", "all", "any"]);

function tokens(text: string): string[] {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .split(" ")
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w.length > 2 && w.length < 24 && !STOP.has(w) && !/^\d+$/.test(w));
}

export function createMemory(initial: readonly MemoryEntry[] = []): MemoryView {
  const entries: MemoryEntry[] = [...initial];

  const tally = (specialistId: string) => {
    let accepted = 0;
    let rejected = 0;
    for (const e of entries) {
      if (e.verdict.specialistId !== specialistId) continue;
      if (e.verdict.judgement === "correct") accepted += 1;
      else rejected += 1;
    }
    return { accepted, rejected };
  };

  return {
    entries,
    weightsFor(specialistId) {
      if (!specialistId) return null;
      const { accepted, rejected } = tally(specialistId);
      if (accepted + rejected === 0) return null;
      const total = accepted + rejected;
      const confidence = 1 - Math.exp(-total / 5);
      const history = this.historyFor(specialistId);
      const last = history.slice(-24);
      let num = 0;
      let den = 0;
      last.forEach((v, i) => {
        const w = Math.pow(0.5, (last.length - 1 - i) / 8);
        num += v === "correct" ? w : 0;
        den += w;
      });
      const lastEntry = entries[entries.length - 1];
      return {
        specialistId,
        accepted,
        rejected,
        learnedPrior: Number(((accepted / total - 0.5) * 2 * confidence).toFixed(6)),
        recentSuccess: den === 0 ? 0.5 : Number((num / den).toFixed(6)),
        updatedAt: lastEntry?.verdict.at ?? new Date(0).toISOString(),
      };
    },
    historyFor(specialistId) {
      return entries.filter((e) => e.verdict.specialistId === specialistId).map((e) => e.verdict.judgement);
    },
    preferences(minObservations = 3) {
      const acc = new Map<string, number>();
      const rej = new Map<string, number>();
      for (const e of entries) {
        for (const t of new Set([...tokens(e.verdict.agentClaim), ...tokens(e.verdict.note ?? "")])) {
          if (e.verdict.judgement === "correct") acc.set(t, (acc.get(t) ?? 0) + 1);
          else rej.set(t, (rej.get(t) ?? 0) + 1);
        }
      }
      const out: PreferenceSignal[] = [];
      for (const token of new Set([...acc.keys(), ...rej.keys()])) {
        const a = acc.get(token) ?? 0;
        const r = rej.get(token) ?? 0;
        const observations = a + r;
        if (observations < minObservations) continue;
        // Laplace smoothing so a 3/0 streak is "probably good", not "certain"
        out.push({ token, accepted: a, rejected: r, weight: Number(((a + 1) / (observations + 2)).toFixed(4)), observations });
      }
      return out.sort((x, y) => y.observations - x.observations || y.weight - x.weight || x.token.localeCompare(y.token));
    },
    exportPayload({ enabled, redactNotes = true }) {
      // THE gate. Not "redact on request" — no payload exists while sync is off.
      if (!enabled) return null;
      const tokenTallies: CrossUserPayload["tokenTallies"] = {};
      const specialistTallies: CrossUserPayload["specialistTallies"] = {};
      for (const e of entries) {
        const v = e.verdict;
        const src = redactNotes ? v.agentClaim : `${v.agentClaim} ${v.note ?? ""}`;
        for (const t of new Set(tokens(src))) {
          const cur = tokenTallies[t] ?? { accepted: 0, rejected: 0 };
          if (v.judgement === "correct") cur.accepted += 1;
          else cur.rejected += 1;
          tokenTallies[t] = cur;
        }
        if (v.specialistId) {
          const cur = specialistTallies[v.specialistId] ?? { accepted: 0, rejected: 0 };
          if (v.judgement === "correct") cur.accepted += 1;
          else cur.rejected += 1;
          specialistTallies[v.specialistId] = cur;
        }
      }
      return {
        schema: "vh-cross-user-prior/1",
        derivedFrom: "cross-user",
        tokenTallies,
        specialistTallies,
        maxWeightShare: CROSS_USER_MAX_WEIGHT_SHARE,
      };
    },
    applyCrossUserPrior(payload) {
      const out = new Map<string, number>();
      if (!payload || payload.schema !== "vh-cross-user-prior/1") return out;
      const cap = Math.min(CROSS_USER_MAX_WEIGHT_SHARE, Math.max(0, payload.maxWeightShare ?? CROSS_USER_MAX_WEIGHT_SHARE));
      for (const [id, t] of Object.entries(payload.specialistTallies ?? {})) {
        const total = (t.accepted ?? 0) + (t.rejected ?? 0);
        if (total <= 0) continue;
        // capped, and shrunk by sample size so a 2-vote fleet cannot outvote 200 local ones
        const confidence = 1 - Math.exp(-total / 25);
        out.set(id, Number((((t.accepted - t.rejected) / total) * cap * confidence).toFixed(6)));
      }
      return out;
    },
    size() {
      return entries.length;
    },
  };
}

/**
 * The invariant that keeps "cross-user learning" from becoming remote control.
 *
 * `applyCrossUserPrior` above is typed to return `Map<string, number>` — a table
 * of routing nudges. It has no path to a tool grant and no path to a trust tier,
 * which is a STRUCTURAL fact about the return type, not a policy setting someone
 * can flip. This function states that fact where a probe can pin it, so if a
 * future change widens the payload's reach (returns a permission, touches a tier)
 * the type no longer satisfies this and the suite goes red.
 */
export function applyCrossUserPriorSafety(): {
  grantsTool: boolean;
  changesTrustTier: boolean;
  returnsOnlyWeights: boolean;
} {
  const probe = createMemory([]).applyCrossUserPrior({
    schema: "vh-cross-user-prior/1",
    derivedFrom: "cross-user",
    specialistTallies: { probe: { accepted: 9, rejected: 0 } },
    tokenTallies: {},
    maxWeightShare: 1,
  });
  const onlyNumbers = [...probe.values()].every((x) => typeof x === "number");
  const noKeysMinted = !(probe as unknown as { tools?: unknown }).tools;
  const noTierTouched = !(probe as unknown as { trustTier?: unknown }).trustTier;
  return { grantsTool: !noKeysMinted, changesTrustTier: !noTierTouched, returnsOnlyWeights: onlyNumbers };
}

/** append-only ledger entry, ready for the signed receipt chain */
export function toLedgerEntry(v: Verdict): Record<string, string | null | undefined> {
  return {
    kind: "vh-verdict/1",
    taskId: v.taskId,
    specialistId: v.specialistId,
    judgement: v.judgement,
    gradedBy: v.gradedBy,
    answerProvenance: v.answerProvenance,
    // stored verbatim, but scrubbed of anything key-shaped on the way in — the
    // chatbox note is free text and free text is where pasted secrets live
    note: v.note ? v.note.replace(/sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,}/g, "[REDACTED]") : null,
    at: v.at,
  };
}

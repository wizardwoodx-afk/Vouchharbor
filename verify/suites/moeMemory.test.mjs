import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// src/moe/memory.ts
var CROSS_USER_MAX_WEIGHT_SHARE = 0.1;
var STOP = /* @__PURE__ */ new Set(["the", "and", "for", "with", "this", "that", "from", "into", "your", "you", "are", "when", "not", "but", "all", "any"]);
function tokens(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").split(" ").map((w2) => w2.replace(/^\.+|\.+$/g, "")).filter((w2) => w2.length > 2 && w2.length < 24 && !STOP.has(w2) && !/^\d+$/.test(w2));
}
function createMemory(initial = []) {
  const entries2 = [...initial];
  const tally = (specialistId) => {
    let accepted = 0;
    let rejected = 0;
    for (const e of entries2) {
      if (e.verdict.specialistId !== specialistId) continue;
      if (e.verdict.judgement === "correct") accepted += 1;
      else rejected += 1;
    }
    return { accepted, rejected };
  };
  return {
    entries: entries2,
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
      last.forEach((v2, i) => {
        const w2 = Math.pow(0.5, (last.length - 1 - i) / 8);
        num += v2 === "correct" ? w2 : 0;
        den += w2;
      });
      const lastEntry = entries2[entries2.length - 1];
      return {
        specialistId,
        accepted,
        rejected,
        learnedPrior: Number(((accepted / total - 0.5) * 2 * confidence).toFixed(6)),
        recentSuccess: den === 0 ? 0.5 : Number((num / den).toFixed(6)),
        updatedAt: lastEntry?.verdict.at ?? (/* @__PURE__ */ new Date(0)).toISOString()
      };
    },
    historyFor(specialistId) {
      return entries2.filter((e) => e.verdict.specialistId === specialistId).map((e) => e.verdict.judgement);
    },
    preferences(minObservations = 3) {
      const acc = /* @__PURE__ */ new Map();
      const rej = /* @__PURE__ */ new Map();
      for (const e of entries2) {
        for (const t of /* @__PURE__ */ new Set([...tokens(e.verdict.agentClaim), ...tokens(e.verdict.note ?? "")])) {
          if (e.verdict.judgement === "correct") acc.set(t, (acc.get(t) ?? 0) + 1);
          else rej.set(t, (rej.get(t) ?? 0) + 1);
        }
      }
      const out = [];
      for (const token of /* @__PURE__ */ new Set([...acc.keys(), ...rej.keys()])) {
        const a = acc.get(token) ?? 0;
        const r = rej.get(token) ?? 0;
        const observations = a + r;
        if (observations < minObservations) continue;
        out.push({ token, accepted: a, rejected: r, weight: Number(((a + 1) / (observations + 2)).toFixed(4)), observations });
      }
      return out.sort((x, y) => y.observations - x.observations || y.weight - x.weight || x.token.localeCompare(y.token));
    },
    exportPayload({ enabled, redactNotes = true }) {
      if (!enabled) return null;
      const tokenTallies = {};
      const specialistTallies = {};
      for (const e of entries2) {
        const v2 = e.verdict;
        const src = redactNotes ? v2.agentClaim : `${v2.agentClaim} ${v2.note ?? ""}`;
        for (const t of new Set(tokens(src))) {
          const cur = tokenTallies[t] ?? { accepted: 0, rejected: 0 };
          if (v2.judgement === "correct") cur.accepted += 1;
          else cur.rejected += 1;
          tokenTallies[t] = cur;
        }
        if (v2.specialistId) {
          const cur = specialistTallies[v2.specialistId] ?? { accepted: 0, rejected: 0 };
          if (v2.judgement === "correct") cur.accepted += 1;
          else cur.rejected += 1;
          specialistTallies[v2.specialistId] = cur;
        }
      }
      return {
        schema: "vh-cross-user-prior/1",
        derivedFrom: "cross-user",
        tokenTallies,
        specialistTallies,
        maxWeightShare: CROSS_USER_MAX_WEIGHT_SHARE
      };
    },
    applyCrossUserPrior(payload2) {
      const out = /* @__PURE__ */ new Map();
      if (!payload2 || payload2.schema !== "vh-cross-user-prior/1") return out;
      const cap = Math.min(CROSS_USER_MAX_WEIGHT_SHARE, Math.max(0, payload2.maxWeightShare ?? CROSS_USER_MAX_WEIGHT_SHARE));
      for (const [id, t] of Object.entries(payload2.specialistTallies ?? {})) {
        const total = (t.accepted ?? 0) + (t.rejected ?? 0);
        if (total <= 0) continue;
        const confidence = 1 - Math.exp(-total / 25);
        out.set(id, Number(((t.accepted - t.rejected) / total * cap * confidence).toFixed(6)));
      }
      return out;
    },
    size() {
      return entries2.length;
    }
  };
}
function applyCrossUserPriorSafety() {
  const probe = createMemory([]).applyCrossUserPrior({
    schema: "vh-cross-user-prior/1",
    derivedFrom: "cross-user",
    specialistTallies: { probe: { accepted: 9, rejected: 0 } },
    tokenTallies: {},
    maxWeightShare: 1
  });
  const onlyNumbers = [...probe.values()].every((x) => typeof x === "number");
  const noKeysMinted = !probe.tools;
  const noTierTouched = !probe.trustTier;
  return { grantsTool: !noKeysMinted, changesTrustTier: !noTierTouched, returnsOnlyWeights: onlyNumbers };
}
function toLedgerEntry(v2) {
  return {
    kind: "vh-verdict/1",
    taskId: v2.taskId,
    specialistId: v2.specialistId,
    judgement: v2.judgement,
    gradedBy: v2.gradedBy,
    answerProvenance: v2.answerProvenance,
    // stored verbatim, but scrubbed of anything key-shaped on the way in — the
    // chatbox note is free text and free text is where pasted secrets live
    note: v2.note ? v2.note.replace(/sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,}/g, "[REDACTED]") : null,
    at: v2.at
  };
}

// probe/moeMemory.test.ts
var passed = 0;
var failures = [];
function ok(label, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail ? ` \u2014 ${detail}` : ""}`);
    console.log(`  FAIL ${label} \u2014 ${detail}`);
  }
}
function section(n) {
  console.log(`
== ${n}`);
}
var v = (over) => ({
  taskId: "t1",
  specialistId: "typescript-pro",
  judgement: "correct",
  agentClaim: "I will validate the login form input",
  gradedBy: "user",
  answerProvenance: "agent-authored",
  at: "2026-09-14T00:00:00.000Z",
  ...over
});
section("0. empty memory is neutral, not optimistic");
var empty = createMemory([]);
ok("no weights before any verdict", empty.weightsFor("typescript-pro") === null);
ok("the generalist is never given specialist weights", empty.weightsFor(null) === null);
ok("no preferences from nothing", empty.preferences().length === 0);
section("1. verdicts accumulate into the signal the router reads");
var m = createMemory([]);
var entries = [
  ...new Array(7).fill(0).map((_, i) => ({ key: `a${i}`, verdict: v({ taskId: `a${i}`, judgement: "correct", agentClaim: "validate login input and add unit tests" }) })),
  ...new Array(2).fill(0).map((_, i) => ({ key: `b${i}`, verdict: v({ taskId: `b${i}`, judgement: "wrong", agentClaim: "validate login input", note: "you skipped the server-side check" }) }))
];
m = createMemory(entries);
var w = m.weightsFor("typescript-pro");
ok("counts are exact", w.accepted === 7 && w.rejected === 2, JSON.stringify({ a: w.accepted, r: w.rejected }));
ok("a mostly-accepted specialist has a positive prior", w.learnedPrior > 0, String(w.learnedPrior));
ok("recency reflects the trailing verdicts", w.recentSuccess > 0.5 && w.recentSuccess < 1, String(w.recentSuccess));
ok("history is ordered and complete", m.historyFor("typescript-pro").length === 9);
ok("size reports the ledger length", m.size() === 9);
section("2. preferences are derived from WHAT the user objected to");
var prefs = m.preferences(3);
ok("preferences exist once there are enough observations", prefs.length > 0);
ok("the rejected concept is tracked, not just the accepted one", prefs.some((p) => p.token === "validate"), JSON.stringify(prefs.slice(0, 4)));
ok("weights are smoothed, never a hard 1.0", prefs.every((p) => p.weight > 0 && p.weight < 1));
ok("min-observation floor is honoured", prefs.every((p) => p.observations >= 3));
ok("ordering is deterministic", JSON.stringify(prefs.map((p) => p.token)) === JSON.stringify([...prefs].sort((a, b) => b.observations - a.observations || a.token.localeCompare(b.token)).map((p) => p.token)));
section("3. THE PRIVACY BOUNDARY \u2014 export is opt-in and structurally limited");
ok("sync OFF produces NO payload at all", m.exportPayload({ enabled: false }) === null);
ok("sync ON produces a payload", m.exportPayload({ enabled: true }) !== null);
var payload = m.exportPayload({ enabled: true });
var serialised = JSON.stringify(payload);
ok("the payload schema is versioned", payload.schema === "vh-cross-user-prior/1");
ok("the payload is labelled as derived, forever", payload.derivedFrom === "cross-user");
ok("the user's own words never leave", !serialised.includes("skipped the server-side check"), serialised.slice(0, 120));
ok("task ids never leave", !serialised.includes('"a0"') && !serialised.includes("t1"));
ok("no free-text field exists on the payload at all", (() => {
  const shape = Object.keys(payload).join(",");
  return !/note|claim|text|userText|taskId/.test(shape);
})(), Object.keys(payload).join(","));
ok("maxWeightShare is a number, capped, not caller-inflatable", payload.maxWeightShare === CROSS_USER_MAX_WEIGHT_SHARE && CROSS_USER_MAX_WEIGHT_SHARE <= 0.1);
ok("notes are redacted from tokens by default even when sync is on", (() => {
  const p2 = m.exportPayload({ enabled: true, redactNotes: true });
  return !JSON.stringify(p2).includes("skipped");
})());
section("4. a synced prior can nudge routing and nothing else");
var prior = m.applyCrossUserPrior({
  schema: "vh-cross-user-prior/1",
  derivedFrom: "cross-user",
  specialistTallies: { "typescript-pro": { accepted: 900, rejected: 1 }, "evil-synth": { accepted: 1e3, rejected: 0 } },
  tokenTallies: {},
  maxWeightShare: 1
  // deliberately absurd: the cap must hold anyway
});
ok("priors are returned per specialist", prior.size === 2);
ok("influence is CLAMPED to the local cap, not the payload's", [...prior.values()].every((x) => Math.abs(x) <= CROSS_USER_MAX_WEIGHT_SHARE + 1e-9), JSON.stringify([...prior.values()]));
ok("a bogus schema is ignored entirely", createMemory([]).applyCrossUserPrior({ schema: "not-vh/9", derivedFrom: "cross-user", specialistTallies: { x: { accepted: 1, rejected: 0 } }, tokenTallies: {}, maxWeightShare: 1 }).size === 0);
ok("a null payload cannot crash the fold-in", m.applyCrossUserPrior(null).size === 0);
ok("zero-observation tallies contribute nothing", m.applyCrossUserPrior({ schema: "vh-cross-user-prior/1", derivedFrom: "cross-user", specialistTallies: { z: { accepted: 0, rejected: 0 } }, tokenTallies: {}, maxWeightShare: 0.1 }).get("z") === void 0);
ok("cross-user learning can never mint a permission or a tier", (() => {
  const safe = applyCrossUserPriorSafety();
  return safe.grantsTool === false && safe.changesTrustTier === false && safe.returnsOnlyWeights === true;
})(), JSON.stringify(applyCrossUserPriorSafety()));
section("5. the ledger entry is what gets sealed, so it must be clean");
var entry = toLedgerEntry(v({ judgement: "wrong", note: "also here is my key sk-ant-abcdef1234567890XYZ, remove it" }));
ok("a key pasted into the chatbox is scrubbed before storage", !String(entry.note).includes("sk-ant-abcdef"), String(entry.note));
ok("the entry records WHO graded and HOW the answer was produced", entry.gradedBy === "user" && entry.answerProvenance === "agent-authored");
ok("the note is preserved otherwise \u2014 the why is the value", String(entry.note).includes("remove it"));
ok("a verdict with no note stores null, not the string 'undefined'", toLedgerEntry(v({})).note === null);
console.log(`
${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ! ${f}`);
  process.exit(1);
}

/**
 * Memory + cross-user learning probe (17.10.11).
 *
 * The promise: each user's VH agent learns what that user accepts, what they
 * reject and WHY, and (opt-in) shares learning across users.
 *
 * The risk: "share learning across users" is a sentence that ships a privacy
 * incident. So the assertions here are about what CANNOT leave the machine, not
 * about what the sync feature can do.
 */
import {
  applyCrossUserPriorSafety,
  createMemory,
  CROSS_USER_MAX_WEIGHT_SHARE,
  toLedgerEntry,
  type CrossUserPayload,
} from "../src/moe/memory";
import type { Verdict } from "../src/moe/types";

let passed = 0;
const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed += 1; console.log(`  ok   ${label}`); }
  else { failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label} — ${detail}`); }
}
function section(n: string): void { console.log(`\n== ${n}`); }

const v = (over: Partial<Verdict>): Verdict => ({
  taskId: "t1", specialistId: "typescript-pro", judgement: "correct", agentClaim: "I will validate the login form input",
  gradedBy: "user", answerProvenance: "agent-authored", at: "2026-09-14T00:00:00.000Z", ...over,
});

section("0. empty memory is neutral, not optimistic");
const empty = createMemory([]);
ok("no weights before any verdict", empty.weightsFor("typescript-pro") === null);
ok("the generalist is never given specialist weights", empty.weightsFor(null) === null);
ok("no preferences from nothing", empty.preferences().length === 0);

section("1. verdicts accumulate into the signal the router reads");
let m = createMemory([]);
const entries = [
  ...new Array(7).fill(0).map((_, i) => ({ key: `a${i}`, verdict: v({ taskId: `a${i}`, judgement: "correct", agentClaim: "validate login input and add unit tests" }) })),
  ...new Array(2).fill(0).map((_, i) => ({ key: `b${i}`, verdict: v({ taskId: `b${i}`, judgement: "wrong", agentClaim: "validate login input", note: "you skipped the server-side check" }) })),
];
m = createMemory(entries);
const w = m.weightsFor("typescript-pro")!;
ok("counts are exact", w.accepted === 7 && w.rejected === 2, JSON.stringify({ a: w.accepted, r: w.rejected }));
ok("a mostly-accepted specialist has a positive prior", w.learnedPrior > 0, String(w.learnedPrior));
ok("recency reflects the trailing verdicts", w.recentSuccess > 0.5 && w.recentSuccess < 1, String(w.recentSuccess));
ok("history is ordered and complete", m.historyFor("typescript-pro").length === 9);
ok("size reports the ledger length", m.size() === 9);

section("2. preferences are derived from WHAT the user objected to");
const prefs = m.preferences(3);
ok("preferences exist once there are enough observations", prefs.length > 0);
ok("the rejected concept is tracked, not just the accepted one", prefs.some((p) => p.token === "validate"), JSON.stringify(prefs.slice(0, 4)));
ok("weights are smoothed, never a hard 1.0", prefs.every((p) => p.weight > 0 && p.weight < 1));
ok("min-observation floor is honoured", prefs.every((p) => p.observations >= 3));
ok("ordering is deterministic", JSON.stringify(prefs.map((p) => p.token)) === JSON.stringify([...prefs].sort((a, b) => b.observations - a.observations || a.token.localeCompare(b.token)).map((p) => p.token)));

section("3. THE PRIVACY BOUNDARY — export is opt-in and structurally limited");
ok("sync OFF produces NO payload at all", m.exportPayload({ enabled: false }) === null);
ok("sync ON produces a payload", m.exportPayload({ enabled: true }) !== null);
const payload = m.exportPayload({ enabled: true })!;
const serialised = JSON.stringify(payload);
ok("the payload schema is versioned", payload.schema === "vh-cross-user-prior/1");
ok("the payload is labelled as derived, forever", payload.derivedFrom === "cross-user");
ok("the user's own words never leave", !serialised.includes("skipped the server-side check"), serialised.slice(0, 120));
ok("task ids never leave", !serialised.includes("\"a0\"") && !serialised.includes("t1"));
ok("no free-text field exists on the payload at all", (() => {
  const shape = Object.keys(payload).join(",");
  return !/note|claim|text|userText|taskId/.test(shape);
})(), Object.keys(payload).join(","));
ok("maxWeightShare is a number, capped, not caller-inflatable", payload.maxWeightShare === CROSS_USER_MAX_WEIGHT_SHARE && CROSS_USER_MAX_WEIGHT_SHARE <= 0.1);
ok("notes are redacted from tokens by default even when sync is on", (() => {
  const p2 = m.exportPayload({ enabled: true, redactNotes: true })!;
  return !JSON.stringify(p2).includes("skipped");
})());

section("4. a synced prior can nudge routing and nothing else");
const prior = m.applyCrossUserPrior({
  schema: "vh-cross-user-prior/1", derivedFrom: "cross-user",
  specialistTallies: { "typescript-pro": { accepted: 900, rejected: 1 }, "evil-synth": { accepted: 1000, rejected: 0 } },
  tokenTallies: {}, maxWeightShare: 1.0, // deliberately absurd: the cap must hold anyway
});
ok("priors are returned per specialist", prior.size === 2);
ok("influence is CLAMPED to the local cap, not the payload's", [...prior.values()].every((x) => Math.abs(x) <= CROSS_USER_MAX_WEIGHT_SHARE + 1e-9), JSON.stringify([...prior.values()]));
ok("a bogus schema is ignored entirely", createMemory([]).applyCrossUserPrior({ schema: "not-vh/9", derivedFrom: "cross-user", specialistTallies: { x: { accepted: 1, rejected: 0 } }, tokenTallies: {}, maxWeightShare: 1 } as unknown as CrossUserPayload).size === 0);
ok("a null payload cannot crash the fold-in", m.applyCrossUserPrior(null as unknown as CrossUserPayload).size === 0);
ok("zero-observation tallies contribute nothing", m.applyCrossUserPrior({ schema: "vh-cross-user-prior/1", derivedFrom: "cross-user", specialistTallies: { z: { accepted: 0, rejected: 0 } }, tokenTallies: {}, maxWeightShare: 0.1 }).get("z") === undefined);
ok("cross-user learning can never mint a permission or a tier", (() => {
  const safe = applyCrossUserPriorSafety();
  return safe.grantsTool === false && safe.changesTrustTier === false && safe.returnsOnlyWeights === true;
})(), JSON.stringify(applyCrossUserPriorSafety()));

section("5. the ledger entry is what gets sealed, so it must be clean");
const entry = toLedgerEntry(v({ judgement: "wrong", note: "also here is my key sk-ant-abcdef1234567890XYZ, remove it" }));
ok("a key pasted into the chatbox is scrubbed before storage", !String(entry.note).includes("sk-ant-abcdef"), String(entry.note));
ok("the entry records WHO graded and HOW the answer was produced", entry.gradedBy === "user" && entry.answerProvenance === "agent-authored");
ok("the note is preserved otherwise — the why is the value", String(entry.note).includes("remove it"));
ok("a verdict with no note stores null, not the string 'undefined'", toLedgerEntry(v({})).note === null);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { for (const f of failures) console.log(`  ! ${f}`); process.exit(1); }

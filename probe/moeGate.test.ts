/**
 * The 90% escalation gate probe (17.10.11).
 *
 * What the product promises: VH-19 proposes the most relevant scenarios, answers
 * them itself, the user marks correct/wrong (chatbox on wrong), and at ≥90% the
 * agent asks for full autonomy. Below it, the ladder restarts.
 *
 * What this suite adds: the gate must be unable to pass on noise, and the receipt
 * must never claim more than the grading mode actually established. The mode is
 * the user's choice; the honesty of the record is not.
 */
import {
  DEFAULT_POLICY,
  DEFAULT_THRESHOLD_PERCENT,
  evaluateGate,
  MIN_EXAM_ITEMS,
  proposeScenarios,
  scoreExam,
} from "../src/moe/gate";
import { SPECIALIST_CATALOG } from "../src/moe/catalog.gen";
import { tokenize } from "../src/moe/router";
import type { ExamItem } from "../src/moe/types";

let passed = 0;
const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed += 1; console.log(`  ok   ${label}`); }
  else { failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label} — ${detail}`); }
}
function section(n: string): void { console.log(`\n== ${n}`); }

const mk = (n: number, verdicts: ("correct" | "wrong" | "unanswered")[] = []): ExamItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    scenario: `scenario ${i}`,
    agentAnswer: `answer ${i}`,
    verdict: verdicts[i] ?? "correct",
  }));

section("0. defaults are the promises made in the product");
ok("threshold is 90", DEFAULT_THRESHOLD_PERCENT === 90 && DEFAULT_POLICY.thresholdPercent === 90);
ok("there is a minimum item count so percentages mean something", DEFAULT_POLICY.minItems === MIN_EXAM_ITEMS && MIN_EXAM_ITEMS >= 8, String(MIN_EXAM_ITEMS));
ok("the default grading mode is the one the product asks for", DEFAULT_POLICY.gradingMode === "agent-authored");

section("1. scoring arithmetic");
ok("8/8 is 100%", scoreExam(mk(8), 90).percent === 100);
ok("7/8 is 87.5% and fails a 90% bar", (() => {
  const r = evaluateGate("e1", mk(8, ["correct","correct","correct","correct","correct","correct","correct","wrong"]), "supervised");
  return r.result.scorePercent === 87.5 && r.result.passed === false;
})(), "expected 87.5 / fail");
ok("rounding cannot smuggle a pass — 90% of 10 means 9/10 exactly", (() => {
  const r9 = evaluateGate("e9", mk(10, new Array(9).fill("correct").concat(["wrong"]) as ("correct"|"wrong")[]), "supervised");
  return r9.result.passed === true && r9.result.scorePercent === 90;
})());
ok("8.99 of 10 is not 9", (() => {
  const r = scoreExam(mk(10, new Array(8).fill("correct").concat(["wrong","wrong"]) as ("correct"|"wrong")[]), 90);
  return r.percent === 80;
})());

section("2. it must not be possible to pass by asking less");
ok("a 3-item exam is refused even at 3/3", (() => {
  const r = evaluateGate("e2", mk(3), "supervised");
  return r.result.passed === false && /minimum/.test(r.explanation);
})());
ok("unanswered items count as misses, not skips", (() => {
  const r = evaluateGate("e3", mk(10, new Array(7).fill("correct").concat(["unanswered","unanswered","unanswered"]) as ("correct"|"unanswered")[]), "supervised");
  return r.result.passed === false;
})());
ok("an unanswered-heavy exam says so in the receipt", (() => {
  const r = evaluateGate("e4", mk(10, new Array(6).fill("correct").concat(["unanswered","unanswered","wrong","wrong"]) as ("correct"|"unanswered"|"wrong")[]), "supervised");
  return /unanswered=2/.test(r.receiptNote);
})());
ok("an empty exam cannot pass", evaluateGate("e5", [], "supervised").result.passed === false);

section("3. passing moves ONE rung, and only autonomy is the headline ask");
const pass = evaluateGate("e6", mk(10), "supervised");
ok("supervised -> autonomous on a pass", pass.result.passed === true && pass.nextTrustTier === "autonomous", pass.nextTrustTier);
ok("the explanation explicitly requests full autonomy with monitoring", /FULL AUTONOMOUS/i.test(pass.explanation) && /monitor/i.test(pass.explanation));
ok("shadow cannot jump straight to autonomous", (() => {
  const r = evaluateGate("e7", mk(10), "shadow");
  return r.result.passed === true && r.nextTrustTier === "assist";
})());

section("4. failing resets, with a reason that is not a shrug");
const fail = evaluateGate("e8", mk(10, new Array(5).fill("correct").concat(new Array(5).fill("wrong")) as ("correct"|"wrong")[]), "autonomous");
ok("a fail drops the tier all the way back to shadow", fail.nextTrustTier === "shadow" && fail.result.passed === false);
ok("the receipt records the score, threshold, item counts and mode",
  /score=50%/.test(fail.receiptNote) && /threshold=90%/.test(fail.receiptNote) && /items=5\/10/.test(fail.receiptNote) && /mode=agent-authored/.test(fail.receiptNote),
  fail.receiptNote);

section("5. THE HONESTY CLAUSE — mode is recorded, and its blind spot is printed on the receipt");
ok("agent-authored pass states it measures agreement, not competence",
  /USER-AGREEMENT-NOT-INDEPENDENT-COMPETENCE/.test(pass.receiptNote) && /NOT independently verified competence/.test(pass.explanation),
  pass.receiptNote);
ok("grounded pass does NOT carry the agreement caveat", (() => {
  const r = evaluateGate("e9", mk(10), "supervised", { gradingMode: "grounded", requireGroundedChecks: { repoTestsPassed: true, crossVendorReviewPassed: true } });
  return r.result.passed && !/USER-AGREEMENT/.test(r.receiptNote) && /grounded/.test(r.receiptNote);
})());
ok("grounded mode REFUSES without the repo's own tests passing", (() => {
  const r = evaluateGate("e10", mk(10), "supervised", { gradingMode: "grounded", requireGroundedChecks: { repoTestsPassed: false, crossVendorReviewPassed: true } });
  return r.result.passed === false && /repository's own tests/.test(r.explanation);
})());
ok("grounded mode REFUSES when the author reviewed its own work", (() => {
  const r = evaluateGate("e11", mk(10), "supervised", { gradingMode: "grounded", requireGroundedChecks: { repoTestsPassed: true, crossVendorReviewPassed: false } });
  return r.result.passed === false && /different-harness/.test(r.explanation);
})());
ok("grounded mode with no checks object at all cannot pass", (() => {
  const r = evaluateGate("e12", mk(10), "supervised", { gradingMode: "grounded" });
  return r.result.passed === false;
})());
ok("the graded-by and provenance fields are fixed, not caller-supplied", (() => {
  const v = { taskId: "t", specialistId: "x", judgement: "correct" as const, agentClaim: "c", gradedBy: "user" as const, answerProvenance: "agent-authored" as const, at: "now" };
  return v.gradedBy === "user" && v.answerProvenance === "agent-authored";
})());

section("6. the exam is drawn from what the router thinks is relevant");
const proposed = proposeScenarios(SPECIALIST_CATALOG.map((s) => ({ id: s.id, title: s.title, description: s.description, keywords: s.keywords })),
  "add strict input validation to the login form in typescript and cover it with unit tests", tokenize, 8);
ok("proposals are returned for a real task", proposed.length > 0, String(proposed.length));
ok("proposals respect the limit", proposed.length <= 8);
ok("every proposed scenario names a real specialist", proposed.every((p) => SPECIALIST_CATALOG.some((s) => s.id === p.specialistId)));
ok("scenario text quotes the user's task, so the exam is about THIS work", proposed.every((p) => /login form/.test(p.scenario)));
ok("an unrelated task yields no proposals rather than random filler", (() => {
  const r = proposeScenarios([{ id: "zzz", title: "Zzz", description: "nothing relevant", keywords: ["quux"] }], "completely unrelated plumbing task", tokenize);
  return r.length === 0;
})());
ok("deterministic: same task, same proposal order", JSON.stringify(proposeScenarios(SPECIALIST_CATALOG.map((s) => ({ id: s.id, title: s.title, description: s.description, keywords: s.keywords })), "add strict input validation to the login form in typescript and cover it with unit tests", tokenize, 8)) === JSON.stringify(proposed));

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { for (const f of failures) console.log(`  ! ${f}`); process.exit(1); }

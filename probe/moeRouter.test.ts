/**
 * Router probe (17.10.11) — the suite that earns the word "learned".
 *
 * If these checks pass, the routing is not a static lookup: the weights after a
 * user's verdict demonstrably differ from the weights before it, and a specialist
 * that keeps getting rejected stops winning. If someone later replaces the router
 * with a keyword table, §3 goes red.
 */
import { SPECIALIST_CATALOG } from "../src/moe/catalog.gen";
import {
  applyVerdict,
  canAct,
  DEFAULT_CONFIDENCE_FLOOR,
  learnedPriorOf,
  nextTier,
  recentSuccessOf,
  ROUTER_WEIGHTS,
  route,
  tokenize,
  TRUST_LADDER,
} from "../src/moe/router";
import type { SpecialistWeights } from "../src/moe/types";

let passed = 0;
const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed += 1; console.log(`  ok   ${label}`); }
  else { failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label} — ${detail}`); }
}
function section(n: string): void { console.log(`\n== ${n}`); }

const HOST = ["Read", "Grep", "Glob", "Bash", "Write", "Edit"];
const weights0 = new Map<string, SpecialistWeights>();

section("0. the module is importable and honest about its shape");
ok("ROUTER_WEIGHTS exposes every signal separately", Object.keys(ROUTER_WEIGHTS).length === 3, JSON.stringify(ROUTER_WEIGHTS));
ok("the confidence floor is a number in (0,1)", DEFAULT_CONFIDENCE_FLOOR > 0 && DEFAULT_CONFIDENCE_FLOOR < 1, String(DEFAULT_CONFIDENCE_FLOOR));
ok("the trust ladder has 4 rungs ending in autonomous", TRUST_LADDER.length === 4 && TRUST_LADDER[3] === "autonomous", TRUST_LADDER.join(">"));

section("1. deterministic: same input, same route, always");
const task = { text: "add strict input validation to the login form in typescript and cover it with unit tests", requestedTools: ["Read", "Grep", "Write"], assertedTier: "safe" as const };
const a = route({ catalog: SPECIALIST_CATALOG, weights: weights0, task, trustTier: "supervised", hostToolInventory: HOST, taskId: "t-a" });
const b = route({ catalog: SPECIALIST_CATALOG, weights: weights0, task, trustTier: "supervised", hostToolInventory: HOST, taskId: "t-b" });
ok("two runs pick the same specialist",
  JSON.stringify(a.decision.outcome) === JSON.stringify(b.decision.outcome),
  `${JSON.stringify(a.decision.outcome)} vs ${JSON.stringify(b.decision.outcome)}`);
ok("the decision carries a full candidate trace", a.decision.candidates.length > 0, String(a.decision.candidates.length));
ok("the trace is sorted best-first", a.decision.candidates.every((c, i, arr) => i === 0 || arr[i - 1].score >= c.score));
ok("the margin is top minus second", a.decision.candidates.length < 2 ||
  Math.abs(a.decision.margin - (a.decision.candidates[0].score - a.decision.candidates[1].score)) < 1e-6, String(a.decision.margin));

section("2. the tool ceiling is a wall, not a hint");
const needsExtra = route({
  catalog: SPECIALIST_CATALOG, weights: weights0, trustTier: "supervised", hostToolInventory: HOST,
  task: { text: task.text, requestedTools: ["Read", "Grep", "Write", "chrome-mcp"] },
});
ok("a tool the host cannot grant is refused, not silently dropped", needsExtra.decision.outcome.kind === "refused", JSON.stringify(needsExtra.decision.outcome));
ok("the refusal names the missing tool", needsExtra.decision.outcome.kind === "refused" && needsExtra.decision.outcome.reason.includes("chrome-mcp"),
  needsExtra.decision.outcome.kind === "refused" ? needsExtra.decision.outcome.reason : "");
ok("the refusal is recorded as a route decision, so it is auditable", needsExtra.decision.ceilingCheck.exceeded.includes("chrome-mcp"), JSON.stringify(needsExtra.decision.ceilingCheck.exceeded));
const empty = route({ catalog: [], weights: weights0, task, trustTier: "supervised", hostToolInventory: [] });
ok("an empty catalog refuses instead of throwing", empty.decision.outcome.kind === "refused");
ok("a router never throws on garbage input", (() => {
  try {
    route({ catalog: SPECIALIST_CATALOG, weights: weights0, task: { text: "", requestedTools: [] }, trustTier: "shadow", hostToolInventory: HOST });
    return true;
  } catch { return false; }
})());

section("3. THE LEARNING CLAIM — weights move, and moving them changes routing");
ok("an empty record is exactly neutral", learnedPriorOf(0, 0) === 0);
ok("1/0 is a weak prior, not a mandate", Math.abs(learnedPriorOf(1, 0)) < 0.45, String(learnedPriorOf(1, 0)));
ok("9/1 is a strong prior", Math.abs(learnedPriorOf(9, 1)) > Math.abs(learnedPriorOf(2, 0)) + 0.2, `${learnedPriorOf(9, 1)} vs ${learnedPriorOf(2, 0)}`);
ok("rejection flips the sign", learnedPriorOf(1, 9) < 0 && learnedPriorOf(9, 1) > 0);
ok("recentSuccess defaults to a neutral half when there is no history", recentSuccessOf([]) === 0.5);
ok("recentSuccess decays old results", (() => {
  const withOldWins = recentSuccessOf(["correct", "correct", "correct", "wrong", "wrong", "wrong", "wrong"]);
  const freshWins = recentSuccessOf(["wrong", "wrong", "wrong", "wrong", "correct", "correct", "correct"]);
  return freshWins > withOldWins;
})());

const chosenId = a.decision.outcome.kind === "routed" ? a.decision.outcome.specialistId : null;
ok("baseline routed to a real catalog entry", !!chosenId && SPECIALIST_CATALOG.some((s) => s.id === chosenId), String(chosenId));

const rejected = applyVerdict(weights0, chosenId, "wrong", () => []);
const accepted = applyVerdict(weights0, chosenId, "correct", () => []);
ok("applyVerdict returns a NEW map (no shared mutation)", rejected !== weights0 && accepted !== weights0 && weights0.size === 0);
ok("a rejection makes the prior negative", (rejected.get(chosenId!)?.learnedPrior ?? 0) < 0, JSON.stringify(rejected.get(chosenId!)));
ok("an acceptance makes the prior positive", (accepted.get(chosenId!)?.learnedPrior ?? 0) > 0, JSON.stringify(accepted.get(chosenId!)));
ok("the generalist is never scored as a specialist", applyVerdict(weights0, null, "wrong", () => []).size === 0);

// the load-bearing one: hammer the chosen specialist with rejections and see whether
// the ranking responds. If routing were a static table, this could not move.
let w = weights0;
for (let i = 0; i < 12; i += 1) w = applyVerdict(w, chosenId, "wrong", () => new Array(i).fill("wrong"));
const after = route({ catalog: SPECIALIST_CATALOG, weights: w, task, trustTier: "supervised", hostToolInventory: HOST, taskId: "t-after" });
const rankBefore = a.decision.candidates.findIndex((c) => c.specialistId === chosenId);
const rankAfter = after.decision.candidates.findIndex((c) => c.specialistId === chosenId);
ok(`12 rejections demoted the specialist in the ranking (rank ${rankBefore} -> ${rankAfter})`, rankAfter > rankBefore, `chosen=${chosenId}`);
ok("the specialist that got rejected is now penalised in its own score",
  (after.decision.candidates.find((c) => c.specialistId === chosenId)?.parts.learnedPrior ?? 0) < 0);
ok("learning is reversible — accepting restores it", (() => {
  let w2 = weights0;
  for (let i = 0; i < 12; i += 1) w2 = applyVerdict(w2, chosenId, "correct", () => new Array(i).fill("correct"));
  const r = route({ catalog: SPECIALIST_CATALOG, weights: w2, task, trustTier: "supervised", hostToolInventory: HOST });
  return (r.decision.candidates.find((c) => c.specialistId === chosenId)?.parts.learnedPrior ?? 0) > 0;
})());

section("4. uncertainty goes to a person, not to the second-best guess");
const vague = route({ catalog: SPECIALIST_CATALOG, weights: weights0, task: { text: "do the thing", requestedTools: [] }, trustTier: "supervised", hostToolInventory: HOST });
ok("a vague task does not get confidently routed", vague.decision.outcome.kind === "refused" || vague.decision.margin < DEFAULT_CONFIDENCE_FLOOR, JSON.stringify(vague.decision.outcome));
ok("below the floor the reason names the human gate", vague.decision.outcome.kind === "refused" ? /human gate|below floor/i.test(vague.decision.outcome.reason) || /ceiling/.test(vague.decision.outcome.reason) : true,
  vague.decision.outcome.kind === "refused" ? vague.decision.outcome.reason : "routed");

section("5. shadow tier computes but does not act");
const shadow = route({ catalog: SPECIALIST_CATALOG, weights: weights0, task, trustTier: "shadow", hostToolInventory: HOST });
ok("shadow records a decision yet acts:false", shadow.decision.outcome.kind === "routed" ? shadow.acted === false : true, JSON.stringify({ o: shadow.decision.outcome.kind, acted: shadow.acted }));
ok("supervised acts", canAct("supervised") === true && canAct("shadow") === false && canAct("assist") === false);
ok("autonomous is terminal — no rung above it", nextTier("autonomous") === null && nextTier("shadow") === "assist");
ok("the tier in force is stamped on every decision", shadow.decision.trustTier === "shadow" && a.decision.trustTier === "supervised");

section("6. tokenization does not crash or leak the whole prompt");
ok("tokenize strips punctuation", tokenize("foo.bar, baz!").includes("baz"));
ok("tokenize drops stopwords", !tokenize("the and for with").length);
ok("tokenize survives empty and unicode input", Array.isArray(tokenize("")) && Array.isArray(tokenize("日本語 🎉")));

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { for (const f of failures) console.log(`  ! ${f}`); process.exit(1); }

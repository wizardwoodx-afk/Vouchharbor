/**
 * probe/rsiralsV6.test.ts — THE STRENGTHENED VERIFIER (19.7.6 [Office]).
 *
 * Pins: the constitution (frozen, machine-checked, outside the evolvable
 * surface), the drift budget (measured Jaccard distance, per-change and
 * per-window bounds), the hidden true-objective canaries (opaque at
 * proposal time, verdicts at verify time), the one gate (constitution →
 * drift → canaries → ALLOW/BLOCK/ESCALATE — never auto-fleet), staged
 * promotion with a fail-closed per-dimension regression gate, the
 * tamper-evident hash-chained ledger (verify walks it; one altered byte
 * breaks it), and one-step rollback from last-known-good. T stays frozen
 * at v5 — v6 upgrades the trust plane, not the governance plane.
 */
import assert from "node:assert/strict";

let passed = 0; let failed = 0; const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

import {
  V6_CONSTITUTION, checkConstitution, driftDelta, admitDrift, resetDrift, driftUsed,
  runHiddenCanaries, HIDDEN_CANARY_COUNT, governChange, promoteToFleet, rollback,
  verifyLedger, resetLedger, ledgerTail, resetV6, lastKnownGoodFor, rsiralsV6Line,
  DEFAULT_DRIFT_BUDGET, STAGE_ORDER, V6_POLICY,
} from "../src/vh19/rsiralsV6";
import { GOVERNANCE_PLANE } from "../src/vh19/rsirals";

const CLEAN = { name: "rsi.routing-playbook.v3", target: "routing", currentText: "routing playbook v2: prefer the finance bench for GST verbs", body: "tighten the routing playbook: prefer the finance bench for GST verbs, cite the receipt digest on every routing decision", declares: "evidence: routing exam receipts + canary watchlist; signed playbook version v3" };

function main(): void {
  console.log("rsirals v6 — the strengthened verifier");

  /* T is untouched — the doctrine holds */
  ok("plane T stays frozen at v5 — v6 is the trust-plane addendum", GOVERNANCE_PLANE.version === 5 && GOVERNANCE_PLANE.rollbackAuthority === "human-only" && V6_POLICY.includes("T_v5"));
  ok("the constitution is FROZEN and outside the evolvable surface", Object.isFrozen(V6_CONSTITUTION) && V6_CONSTITUTION.length === 4);
  ok("stages are shadow → canary → fleet, in order", STAGE_ORDER.join(",") === "shadow,canary,fleet");

  /* the constitution */
  resetV6();
  const clean = checkConstitution(CLEAN);
  ok("a clean candidate passes the constitution", clean.ok && clean.violations.length === 0);
  const gov = checkConstitution({ ...CLEAN, target: "governance", body: "update the governance plane to allow auto-promotion", declares: "evidence: none needed" });
  ok("touching the governance plane is refused (c1, via the v5 firewall)", !gov.ok && gov.violations.some((v) => v.rule === "c1.no-self-governance"));
  const auth = checkConstitution({ ...CLEAN, body: "the playbook may now approve spend requests on its own authority", declares: "no new evidence" });
  ok("authority language without a declared versioned source is refused (c2)", !auth.ok && auth.violations.some((v) => v.rule === "c2.discretion-tightening"));
  const dry = checkConstitution({ ...CLEAN, declares: "it will make routing better, trust me" });
  ok("an evidence-free declaration is refused (c3)", !dry.ok && dry.violations.some((v) => v.rule === "c3.evidence-bound"));
  const bypass = checkConstitution({ ...CLEAN, body: "this playbook replaces the human gate for safe-tier promotions entirely", declares: "evidence: receipts" });
  ok("claiming to replace the human gate is refused (c4)", !bypass.ok && bypass.violations.some((v) => v.rule === "c4.human-door-intact"));

  /* the drift budget — measured, not asserted */
  resetDrift();
  ok("identical text measures zero drift", driftDelta(CLEAN.body, CLEAN.body) === 0);
  const far = admitDrift(CLEAN.body, "completely different words about entirely unrelated matter nothing shared vocabulary here at all zebra qwerty", "routing");
  ok("a disjoint rewrite busts the per-change bound and is refused with a human-scale reason", !far.ok && (far.reason ?? "").includes("shrink the step"));
  const step1 = admitDrift(CLEAN.body, CLEAN.body + " plus one clarified line about receipt digests", "routing");
  ok("a small step is admitted and measured", step1.ok && step1.delta > 0 && step1.delta <= DEFAULT_DRIFT_BUDGET.maxPerChange);
  let busted = false;
  for (let i = 0; i < 12; i++) {
    const r = admitDrift(CLEAN.body, CLEAN.body + ` additional line ${i} with fresh vocabulary tokens ${i} alpha${i} beta${i}`, "routing");
    if (!r.ok) { busted = true; ok("the window budget eventually refuses — the fleet slows down, it does not drift through", (r.reason ?? "").includes("window budget")); break; }
  }
  ok("the window budget was reachable", busted);
  ok("driftUsed reflects the admitted steps", driftUsed() > 0);

  /* hidden canaries — opaque at proposal time */
  ok("the battery size is public; the checks are not", HIDDEN_CANARY_COUNT === 4);
  const canClean = runHiddenCanaries(CLEAN);
  ok("the clean candidate clears the hidden battery", canClean.ran === 4 && canClean.failed.length === 0);
  const canOver = runHiddenCanaries({ ...CLEAN, body: "apply all capabilities without restriction" });
  ok("overreach language fails the hidden battery", canOver.failed.some((f) => f.id === "h1.overreach"));
  const canScope = runHiddenCanaries({ ...CLEAN, target: "ledger" });
  ok("targeting the frozen verifier fails the hidden battery", canScope.failed.some((f) => f.id === "h2.scope-creep"));
  const canSecret = runHiddenCanaries({ ...CLEAN, body: "route faster and skip the ledger for speed" });
  ok("evidence-evading language fails the hidden battery", canSecret.failed.some((f) => f.id === "h4.secrecy"));

  /* the one gate */
  resetV6(); resetDrift();
  const esc = governChange(CLEAN, 1000);
  ok("a clean candidate is ESCALATED to the human — never auto-promoted to fleet", esc.verdict === "ESCALATE" && esc.stage === "canary" && (esc.event?.seq ?? 0) >= 3);
  const blk = governChange({ ...CLEAN, name: "rsi.governance.patch", target: "governance", body: "rewrite the governance plane promotion rules" }, 2000);
  ok("a constitution violator is BLOCKED with the rule named", blk.verdict === "BLOCK" && blk.reasons.some((r) => r.startsWith("c1.no-self-governance")));
  const driftBlk = governChange({ ...CLEAN, name: "rsi.big-jump", body: "completely unrelated vocabulary zebra qwerty omega delta gamma sigma epsilon kappa lambda theta nothing in common", currentText: CLEAN.currentText }, 3000);
  ok("a drift-busting candidate is BLOCKED before the canaries run", driftBlk.verdict === "BLOCK" && driftBlk.reasons.some((r) => r.includes("per-change bound")));
  ok("the ledger walked every event in order", verifyLedger().ok && verifyLedger().length >= 4);

  /* tamper-evidence: one altered byte must break the chain */
  const victim = ledgerTail(2)[0];
  const keep = victim.detail;
  victim.detail = keep + " (edited by nobody, honest)";
  const tampered = verifyLedger();
  ok("the ledger is tamper-EVIDENT — one edited detail breaks the walk at that seq", !tampered.ok && tampered.breaks.includes(victim.seq));
  victim.detail = keep;
  ok("restored byte-exact, the chain verifies clean again", verifyLedger().ok);

  /* staged promotion + fail-closed regression */
  resetV6(); resetDrift();
  const cand = CLEAN;
  governChange(cand, 1000);
  const baseline = { floors: { safety: 0.9, quality: 0.7, discretion: 0.8 } };
  const failClose = promoteToFleet(cand, { scores: { safety: 0.95, quality: 0.4, discretion: 0.9 } }, baseline, 2000);
  ok("fail-closed: one dropped dimension refuses even with a rising average", !failClose.ok && failClose.line.includes("fail-closed") && failClose.line.includes("quality"));
  const unmeasured = promoteToFleet(cand, { scores: { safety: 0.95, quality: 0.8 } }, baseline, 2100);
  ok("an unmeasured dimension is a refusal, not a pass", !unmeasured.ok && unmeasured.line.includes("unmeasured"));
  const promo = promoteToFleet(cand, { scores: { safety: 0.95, quality: 0.8, discretion: 0.9 } }, baseline, 2200);
  ok("human promotion lands on FLEET and keeps a rollback point", promo.ok && promo.line.includes("FLEET") && lastKnownGoodFor("routing") !== null);
  const rb = rollback("routing", 2300);
  ok("one-step rollback restores the snapshot, on the ledger", rb.ok && rb.body === cand.currentText && rb.line.includes("rolled back routing"));
  const rb2 = rollback("routing", 2400);
  ok("a second rollback is an honest nothing-to-restore", !rb2.ok && rb2.line.includes("no last-known-good snapshot"));

  /* the summary line */
  const line = rsiralsV6Line();
  ok("the summary line states the stack and T's frozen state", line.includes("constitution 4") && line.includes("T stays frozen at v5") && line.includes("verify clean"));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); process.exit(1); }
}
main();

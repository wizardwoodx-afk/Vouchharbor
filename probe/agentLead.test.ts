/**
 * VH-19 — AgentLead + failure-handling probe (19.0.0 "Bastion").
 *
 * Pins the lead layer (leads exist per domain, plans are real member plans,
 * reports are computed from real outcomes and never inflate status) and the
 * failure taxonomy (every class has meaning, advice and an honest retry
 * verdict; classification is driven by real pipeline signals).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { AGENT_LEADS, buildLeadReport, getLead, leadForDomain, leadForRoute, planDomainWork } from "../src/vh19/agentLead";
import { classifyFailure, shouldRetry } from "../src/vh19/failures";
import { SPECIALISTS } from "../src/vh19/registry";
import { askVH19 } from "../src/vh19/generalist";

test("agentLead + failures — oversight that never fabricates", async () => {
  let pass = 0, fail = 0;
  const check = (name: string, cond: boolean, detail?: unknown) => {
    cond ? pass++ : fail++;
    console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  };

  console.log("\n── 1. the lead layer ──");
  check("every domain has exactly one AgentLead", AGENT_LEADS.length === 10 && new Set(AGENT_LEADS.map((l) => l.domain)).size === 10);
  check("leads have a mandate and their own playbook", AGENT_LEADS.every((l) => l.mandate.length > 10 && l.systemPrompt.includes(l.name)));
  check("leadForDomain resolves every category", ["code", "security", "design"].every((c) => leadForDomain(c as "code") !== null));
  check("leadForRoute picks the dominant domain", leadForRoute(["code.typescript", "code.debugging", "testing.unit"])?.domain === "code");
  check("leadForRoute returns null for unknown specialists only", leadForRoute(["nope.404"]) === null);

  console.log("\n── 2. the lead plans with real members ──");
  const plan = planDomainWork("lead.code", "refactor typescript types and debug the crash");
  check("the plan lists real bench members with scores", plan.length > 0 && plan.every((p) => SPECIALISTS.some((s) => s.id === p.specialistId) && p.score > 0));
  check("the plan is capped — a plan, not a wishlist", planDomainWork("lead.devops", "deploy kubernetes terraform docker ci observability").length <= 3);
  check("an unrelated task yields no plan (no invented work)", planDomainWork("lead.design", "zzz qqq xxx").length === 0);
  check("unknown leads refuse politely", planDomainWork("lead.nope", "typescript").length === 0 && getLead("lead.nope") === null);

  console.log("\n── 3. the report tells the truth ──");
  const done = buildLeadReport("lead.code", [{ specialistId: "code.typescript", outcome: "answered" }])!;
  check("all-executed reads completed", done.status === "completed" && done.failures.length === 0);
  const partial = buildLeadReport("lead.code", [{ specialistId: "code.typescript", outcome: "answered" }, { specialistId: "code.debugging", outcome: "refused", note: "denied at the gate" }])!;
  check("mixed reads partial — never completed", partial.status === "partial" && partial.failures.length === 1);
  const planned = buildLeadReport("lead.code", [{ specialistId: "code.typescript", outcome: "planned" }])!;
  check("plan-only reads planned, with the key advice", planned.status === "planned" && planned.nextStep.includes("provider key"));
  const blocked = buildLeadReport("lead.code", [{ specialistId: "code.typescript", outcome: "gated-out" }])!;
  check("gate-stop reads blocked with the resume step", blocked.status === "blocked" && blocked.nextStep.includes("gate"));
  check("an empty result set yields no report (nothing to report)", buildLeadReport("lead.code", []) === null);

  console.log("\n── 4. the failure taxonomy ──");
  const auth = classifyFailure("error", "provider returned 401 unauthorized");
  check("a 401 is provider-auth, not retryable", auth.klass === "provider-auth" && auth.retryable === false && auth.severity === "error");
  check("a 429 is rate-limit and retryable", (() => { const f = classifyFailure("error", "429 too many requests"); return f.klass === "provider-rate-limit" && shouldRetry(f); })());
  check("a timeout is retryable with wait advice", (() => { const f = classifyFailure("error", "request timed out"); return f.klass === "provider-timeout" && f.retryable; })());
  check("a network failure is unreachable", classifyFailure("error", "fetch failed: ECONNREFUSED").klass === "provider-unreachable");
  check("an unclassifiable error stays honestly unknown", classifyFailure("error", "something odd happened").klass === "unknown");
  check("planned is info, not error — the plan is the product", (() => { const f = classifyFailure("planned"); return f.klass === "no-provider" && f.severity === "info" && !shouldRetry(f); })());
  check("gate-denied is final and says so", classifyFailure("gated-out").advice.includes("narrow"));
  check("injection blocks are named as guardrail work", classifyFailure("refused", "blocked by the GuardRail: injection detected").klass === "injection-blocked");
  check("every class carries meaning AND advice", ["no-provider", "gate-denied", "policy-refused", "injection-blocked", "peer-refused"].every((k) => {
    const f = classifyFailure(k === "no-provider" ? "planned" : k === "gate-denied" ? "gated-out" : "refused", k === "injection-blocked" ? "injection" : k === "peer-refused" ? "peer bridge missing" : undefined);
    return f.meaning.length > 20 && f.advice.length > 20;
  }));

  console.log("\n── 5. the generalist attaches both to every routed exit ──");
  const resp = await askVH19({ text: "refactor the typescript types in the parser", userId: "probe-user" });
  check("a routed response carries its lead report", resp.lead != null && resp.lead.leadId.startsWith("lead.") && resp.lead.members.length > 0, resp.outcome);
  check("a non-executed response carries classified failure advice", resp.failure != null && resp.failure.meaning.length > 20 && resp.outcome !== "answered");
  check("the digest still seals the response", typeof resp.provenanceDigest === "string" && resp.provenanceDigest.length === 64);

  console.log(`\n${fail === 0 ? "✅" : "❌"} agentLead probe: ${pass} passed, ${fail} failed\n`);
  assert.equal(fail, 0, `${fail} agentLead checks failed`);
});

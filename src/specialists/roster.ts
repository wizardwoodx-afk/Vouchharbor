/**
 * The generalist roster — the domain specialists that run on the same engine as everything
 * else, with the same two rules the finance pack established: the arithmetic is
 * deterministic, and anything that changes production stops at a human.
 *
 * `status` is honest rather than aspirational: "engine" means a real exported function does
 * the work and a probe drives it; "workflow" means the specialist is a governed sequence
 * whose steps are engine-backed but whose judgement is a human's.
 *
 * `requiresApproval` marks the specialists whose last step touches production, a customer, a
 * credential or money. A read-only audit does not need a gate; a deploy, a rotation, a price
 * change and a customer-facing send do.
 */
import type { Domain } from "./types";

export interface Specialist {
  id: string;
  name: string;
  domain: Domain;
  purpose: string;
  /** Exported function(s) that perform the computation. */
  engine: string;
  inputs: string;
  output: string;
  requiresApproval: boolean;
  /** What the Velvet Hand receipt attests when the specialist completes. */
  receipt: string;
  status: "engine" | "workflow";
}

const A = (a: Specialist): Specialist => a;

export const SPECIALISTS: readonly Specialist[] = Object.freeze([
  /* ── frontend ───────────────────────────────────────────────────────────── */
  A({ id: "fe.contrast-audit", name: "Contrast Audit", domain: "frontend", status: "engine",
      engine: "contrastRatio + wcagVerdict", inputs: "a token set or a list of foreground/background pairs",
      output: "each pair's ratio and the highest WCAG level it meets",
      purpose: "Check every colour pair in a token set against WCAG so accessibility is a build failure rather than a review comment.",
      requiresApproval: false, receipt: "the ratio computed for each pair, the standard applied, and the token set it came from" }),
  A({ id: "fe.token-convert", name: "Token Converter", domain: "frontend", status: "engine",
      engine: "parseColor + toHex", inputs: "colours in hex, rgb() or hsl() from a design file",
      output: "every notation a codebase needs, alpha preserved",
      purpose: "Convert design-file colours into the exact strings a stylesheet, a canvas call and a native theme each require.",
      requiresApproval: false, receipt: "the source value, the conversions produced, and the alpha handling" }),
  A({ id: "fe.type-scale", name: "Type Scale", domain: "frontend", status: "engine",
      engine: "typeScale", inputs: "a base size and a ratio", output: "the scale in px and rem",
      purpose: "Generate the type scale a design system is built on, with the rounding decided once instead of per component.",
      requiresApproval: false, receipt: "the base, the ratio, and every step produced" }),
  A({ id: "fe.grid-drift", name: "Grid Drift", domain: "frontend", status: "engine",
      engine: "snapToGrid", inputs: "spacing values found in a stylesheet", output: "off-grid values and the distance to the grid",
      purpose: "Find the spacing values that have drifted off the 4/8px grid before they become a visual rhythm nobody can name.",
      requiresApproval: false, receipt: "the values tested, the movement each one requires, and the grid base" }),
  A({ id: "fe.a11y-fix", name: "Accessibility Fix Plan", domain: "frontend", status: "workflow",
      engine: "wcagVerdict", inputs: "a contrast audit plus the component inventory",
      output: "a ranked list of token changes that clear the most failures",
      purpose: "Turn a list of failing pairs into the smallest set of token changes that fix the most of them.",
      requiresApproval: true, receipt: "the plan, the failures it clears, and the human's decision before any token changed" }),

  /* ── dev / release engineering ──────────────────────────────────────────── */
  A({ id: "dev.release-guard", name: "Release Guard", domain: "dev", status: "engine",
      engine: "satisfiesRange + compareSemver", inputs: "the manifest, the lockfile and a proposed version",
      output: "ranges a dependency violates, with each range expanded to its real bounds",
      purpose: "Check a release's dependency ranges before the install fails in CI and somebody reaches for --force.",
      requiresApproval: false, receipt: "every range tested, the version tested against it, and the expansion used" }),
  A({ id: "dev.changelog", name: "Changelog Composer", domain: "dev", status: "engine",
      engine: "lintCommit", inputs: "a commit range", output: "a categorised changelog and the commits it could not parse",
      purpose: "Turn a commit range into a readable changelog and name every commit whose message defeated the parser.",
      requiresApproval: false, receipt: "the commits read, what each became in the changelog, and every unparsed one" }),
  A({ id: "dev.retry-shape", name: "Retry Shape", domain: "dev", status: "engine",
      engine: "backoffSchedule", inputs: "a retry policy or the values the client implements",
      output: "the real schedule and the total time before giving up",
      purpose: "Show what a retry ladder actually does over time, so a policy that never finishes is caught in review.",
      requiresApproval: false, receipt: "the policy as implemented, the schedule produced, and the client timeout compared against it" }),
  A({ id: "dev.schedule-audit", name: "Schedule Audit", domain: "dev", status: "engine",
      engine: "parseCron", inputs: "cron expressions from a scheduler", output: "next runs, daylight handling and the day-field rule",
      purpose: "Catch the scheduled job that will not fire, or will fire twice, before anyone notices the data is stale.",
      requiresApproval: false, receipt: "each expression, the runs computed, and the dialect assumed" }),
  A({ id: "dev.migration-plan", name: "Migration Plan", domain: "dev", status: "workflow",
      engine: "deployRisk", inputs: "a schema diff and the deploy plan", output: "the ordered steps and the rollback path",
      purpose: "Sequence a schema change so the deploy can be rolled back without losing the data it wrote.",
      requiresApproval: true, receipt: "the plan, the rollback path, and the human's approval before anything ran against production" }),

  /* ── API ────────────────────────────────────────────────────────────────── */
  A({ id: "api.limit-fit", name: "Rate Limit Fit", domain: "api", status: "engine",
      engine: "tokenBucketPlan", inputs: "the published limit and the client's demand",
      output: "sustainable rate, first rejection and the timeline",
      purpose: "Tell a client team what demand its integration can actually sustain before it meets the limit in production.",
      requiresApproval: false, receipt: "the limit, the demand simulated, and the timeline produced from them" }),
  A({ id: "api.payload-budget", name: "Payload Budget", domain: "api", status: "engine",
      engine: "payloadBudget", inputs: "a response body", output: "size per field and what dominates it",
      purpose: "Find the field that is making a response large while clients pay to download and discard it.",
      requiresApproval: false, receipt: "the payload measured, the per-field breakdown, and the compression question left unanswered" }),
  A({ id: "api.idempotency-review", name: "Idempotency Review", domain: "api", status: "engine",
      engine: "checkIdempotencyKey", inputs: "the key format the client sends and the retention window",
      output: "entropy, shape issues and the retention mismatch",
      purpose: "Check that a write path's idempotency key is actually unguessable and remembered for long enough to matter.",
      requiresApproval: false, receipt: "the key shape measured, the entropy floor, and the retention the server promised" }),
  A({ id: "api.paging-advice", name: "Paging Advice", domain: "api", status: "engine",
      engine: "paginationPlan", inputs: "row counts, page size and the offset pattern in use",
      output: "page arithmetic and whether the offset is deep enough to hurt",
      purpose: "Say when offset paging stops being fine, and what a keyset cursor would cost instead.",
      requiresApproval: false, receipt: "the arithmetic, the depth observed, and the recommendation with its reason" }),
  A({ id: "api.contract-change", name: "Contract Change", domain: "api", status: "workflow",
      engine: "httpSemantics + payloadBudget", inputs: "an API diff and the consumer list",
      output: "breaking changes, affected consumers and a deprecation schedule",
      purpose: "Classify an API change as breaking or not, name which consumers it touches, and propose the schedule.",
      requiresApproval: true, receipt: "the diff classified, the consumers named, and the human's decision before any deprecation notice went out" }),

  /* ── data ───────────────────────────────────────────────────────────────── */
  A({ id: "data.latency-read", name: "Latency Read", domain: "data", status: "engine",
      engine: "percentile", inputs: "a latency series", output: "the percentiles with the sample size stated",
      purpose: "Report latency the way users experience it — at the tail, with the sample size that supports it.",
      requiresApproval: false, receipt: "the series, the interpolation method, and every percentile computed" }),
  A({ id: "data.outlier-triage", name: "Outlier Triage", domain: "data", status: "engine",
      engine: "outliersIqr", inputs: "a data series", output: "fenced values and why the rule may be degenerate here",
      purpose: "Surface the points outside the fences, and say plainly when the sample is too small for the rule to mean anything.",
      requiresApproval: false, receipt: "the fences, the points outside them, and the caveats about the sample" }),
  A({ id: "data.experiment-readout", name: "Experiment Readout", domain: "data", status: "engine",
      engine: "abTest + sampleSize", inputs: "two arms of a test", output: "lift, interval, p-value and the peeking warning",
      purpose: "Read out a test with the uncertainty attached, and refuse to call a result the design could never detect.",
      requiresApproval: false, receipt: "the arms, the test used, the interval, and the honesty notes about stopping rules" }),
  A({ id: "data.sample-plan", name: "Sample Plan", domain: "data", status: "engine",
      engine: "sampleSize", inputs: "a baseline rate and the effect worth detecting",
      output: "trials per arm and the time that implies",
      purpose: "Size a test before it starts, so the decision is made on the power of the design rather than the patience of the team.",
      requiresApproval: false, receipt: "the baseline, the effect, the power and alpha chosen, and the sample derived" }),
  A({ id: "data.metric-definition", name: "Metric Definition", domain: "data", status: "workflow",
      engine: "percentile + stddev", inputs: "a metric name, its proposed definition and the events available",
      output: "a definition with its exclusions and its failure modes",
      purpose: "Write down what a metric means — including the cases it excludes — before it appears on a dashboard.",
      requiresApproval: false, receipt: "the definition, the exclusions, and the events it is actually computed from" }),

  /* ── security ───────────────────────────────────────────────────────────── */
  A({ id: "sec.secret-sweep", name: "Secret Sweep", domain: "security", status: "engine",
      engine: "scanSecrets", inputs: "a diff, a config or a log sample", output: "matched credential patterns, masked, with the false-positive caveat",
      purpose: "Find the credential shapes that have a fixed format — and state what a pattern scan cannot find.",
      requiresApproval: false, receipt: "the patterns tested, the matches found (masked), and the limits of the method" }),
  A({ id: "sec.token-inspect", name: "Token Inspect", domain: "security", status: "engine",
      engine: "jwtInspect", inputs: "a JWT from a support ticket", output: "claims, expiry and the algorithm in use",
      purpose: "Decode what a token says and when it dies, without ever implying the signature was checked.",
      requiresApproval: false, receipt: "the claims decoded, the arithmetic on exp, and the explicit statement that nothing was verified" }),
  A({ id: "sec.header-audit", name: "Header Audit", domain: "security", status: "engine",
      engine: "cspAudit", inputs: "a Content-Security-Policy header", output: "directives that are doing nothing, by severity",
      purpose: "Name the clauses of a security policy that look protective and are not.",
      requiresApproval: false, receipt: "the policy as supplied, every finding, and the checklist it was tested against" }),
  A({ id: "sec.entropy-floor", name: "Entropy Floor", domain: "security", status: "engine",
      engine: "stringEntropyBits", inputs: "a candidate key, password or token", output: "measured bits and what the measure does not prove",
      purpose: "Measure how much a string actually carries, and be clear that entropy measures the string and not the generator.",
      requiresApproval: false, receipt: "the string measured (not stored), the bits, and the interpretation with its limits" }),
  A({ id: "sec.rotation-runbook", name: "Rotation Runbook", domain: "security", status: "workflow",
      engine: "scanSecrets + stringEntropyBits", inputs: "a confirmed exposure and the systems that use the credential",
      output: "the revoke → rotate → verify sequence and its owners",
      purpose: "Sequence a credential rotation so revoking comes before rotating, and verification comes before the all-clear.",
      requiresApproval: true, receipt: "the sequence, the owners, and the human's approval — rotation touches production credentials" }),

  /* ── ops ────────────────────────────────────────────────────────────────── */
  A({ id: "ops.budget-watch", name: "Error Budget Watch", domain: "ops", status: "engine",
      engine: "sloErrorBudget", inputs: "an SLO, a window and consumption so far", output: "remaining budget, burn rate and time to exhaust",
      purpose: "Keep the reliability decision a number rather than an argument held during an incident.",
      requiresApproval: false, receipt: "the SLO, the window, the consumption observed, and the extrapolation with its assumption stated" }),
  A({ id: "ops.capacity-plan", name: "Capacity Plan", domain: "ops", status: "engine",
      engine: "capacityHeadroom", inputs: "current utilisation, growth rate and a ceiling",
      output: "the month the ceiling is crossed and the runway",
      purpose: "Give the launch question a date: when growth meets the ceiling, if nothing changes.",
      requiresApproval: false, receipt: "the inputs, the compound curve, and the breach month computed from them" }),
  A({ id: "ops.incident-class", name: "Incident Classifier", domain: "ops", status: "engine",
      engine: "incidentSeverity", inputs: "impact numbers from triage", output: "an S1–S4 call with the rule that produced it",
      purpose: "Assign severity from impact rather than from who noticed, using a rule that is printed alongside the verdict.",
      requiresApproval: false, receipt: "the impact data, the severity, and the rule applied — printed so it can be argued with" }),
  A({ id: "ops.deploy-gate", name: "Deploy Gate", domain: "ops", status: "engine",
      engine: "deployRisk", inputs: "the change, its tests, its rollback and its timing",
      output: "a risk score, the active factors and a recommendation",
      purpose: "Score a deploy against the six factors that turn releases into incidents, and say which one to fix first.",
      requiresApproval: true, receipt: "the factors assessed, the score, and the human's go-ahead — this gate can stop a release" }),
  A({ id: "ops.postmortem", name: "Postmortem Drafter", domain: "ops", status: "workflow",
      engine: "incidentSeverity + sloErrorBudget", inputs: "the incident timeline and its impact",
      output: "a blameless timeline, the budget cost and the actions with owners",
      purpose: "Draft the postmortem from the timeline, with the impact measured against the budget it consumed.",
      requiresApproval: false, receipt: "the timeline used, the budget arithmetic, and the actions with their owners" }),

  /* ── docs ───────────────────────────────────────────────────────────────── */
  A({ id: "docs.reading-level", name: "Reading Level", domain: "docs", status: "engine",
      engine: "readability", inputs: "prose from a page or a README", output: "grade level, ease score and the cause",
      purpose: "Keep user-facing documentation at the reading level its audience actually has.",
      requiresApproval: false, receipt: "the text measured, the scores, and the syllable-estimation caveat" }),
  A({ id: "docs.len-budget", name: "Length Budget", domain: "docs", status: "engine",
      engine: "readingTime", inputs: "a document", output: "words, minutes and code lines",
      purpose: "Decide whether a page needs a summary by knowing how long it takes to read.",
      requiresApproval: false, receipt: "the word count, the assumed rate, and the code lines counted separately" }),
  A({ id: "docs.structure-check", name: "Structure Check", domain: "docs", status: "engine",
      engine: "headingLint", inputs: "markdown", output: "level jumps, duplicate anchors, title problems",
      purpose: "Keep headings in a shape that a table of contents and a screen reader can both follow.",
      requiresApproval: false, receipt: "the heading tree, every structural issue, and its line number" }),
  A({ id: "docs.terminology-lock", name: "Terminology Lock", domain: "docs", status: "engine",
      engine: "terminologyDrift", inputs: "a document set", output: "terms written more than one way",
      purpose: "Keep one spelling per concept so search, glossary links and translation keep working.",
      requiresApproval: false, receipt: "the variants found with their counts, and the fixed variant list used" }),
  A({ id: "docs.release-notes", name: "Release Notes", domain: "docs", status: "workflow",
      engine: "lintCommit + readability", inputs: "a changelog and the audience it serves",
      output: "notes written for users, checked for reading level",
      purpose: "Turn engineering changes into notes a customer can act on, at a reading level they can finish.",
      requiresApproval: true, receipt: "the source commits, the notes drafted, and the human's approval before anything was published" }),

  /* ── growth ─────────────────────────────────────────────────────────────── */
  A({ id: "growth.economics", name: "Unit Economics", domain: "growth", status: "engine",
      engine: "unitEconomics", inputs: "revenue, margin, acquisition cost and churn",
      output: "lifetime value, the ratio and the payback period",
      purpose: "Answer whether growth pays for itself before more money is spent proving it.",
      requiresApproval: false, receipt: "the inputs, the ratio, the payback, and the assumptions the model rests on" }),
  A({ id: "growth.funnel-read", name: "Funnel Read", domain: "growth", status: "engine",
      engine: "funnel", inputs: "stage counts in order", output: "stage conversions and the largest proportional loss",
      purpose: "Point the next experiment at the step that loses the most, rather than the step with the most traffic.",
      requiresApproval: false, receipt: "the counts, each stage's conversion, and the step identified as the constraint" }),
  A({ id: "growth.backlog-rank", name: "Backlog Ranker", domain: "growth", status: "engine",
      engine: "riceScore", inputs: "candidate work with reach, impact, confidence and effort",
      output: "a ranked table with the inputs left visible",
      purpose: "Rank a backlog so disagreement can be traced to an input somebody chose, not to seniority.",
      requiresApproval: false, receipt: "every candidate scored, the formula used, and the inputs as supplied" }),
  A({ id: "growth.plan-check", name: "Plan Check", domain: "growth", status: "engine",
      engine: "growthModel", inputs: "a growth plan with its churn assumption",
      output: "the trajectory, the exit ARR and the implied rate",
      purpose: "Test whether a revenue plan survives its own churn assumption before it is presented.",
      requiresApproval: false, receipt: "the plan modelled month by month, the assumed rates, and the exit position" }),
  A({ id: "growth.price-change", name: "Price Change", domain: "growth", status: "workflow",
      engine: "unitEconomics + growthModel", inputs: "a proposed price change and the affected base",
      output: "the margin effect, the churn break-even and the affected cohorts",
      purpose: "Model a price change: what it earns, what churn it can absorb, and who it touches.",
      requiresApproval: true, receipt: "the model, the break-even churn, and the human's approval — a price change is customer-facing" }),
]);

export function specialistsByDomain(domain: Domain): Specialist[] {
  return SPECIALISTS.filter((s) => s.domain === domain);
}

export function findSpecialist(id: string): Specialist | undefined {
  return SPECIALISTS.find((s) => s.id === id);
}

export function specialistStatus(): {
  total: number; engine: number; workflow: number; requiringApproval: number; domains: number;
} {
  return {
    total: SPECIALISTS.length,
    engine: SPECIALISTS.filter((s) => s.status === "engine").length,
    workflow: SPECIALISTS.filter((s) => s.status === "workflow").length,
    requiringApproval: SPECIALISTS.filter((s) => s.requiresApproval).length,
    domains: new Set(SPECIALISTS.map((s) => s.domain)).size,
  };
}

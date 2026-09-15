/**
 * VH-19 — the skill library (18.9.0).
 *
 * Skills follow the open Agent Skills pattern: each skill is a named,
 * described playbook — a short operational procedure with a quality gate at
 * the end. A specialist's system prompt is composed at run time from its own
 * prompt PLUS the playbooks bound to it (progressive disclosure: the catalog
 * stores the full library; only the routed specialist's skills are loaded
 * into context). Nothing here is decorative: every skill body is a numbered
 * procedure and a checklist, written to change output quality, not to sound
 * impressive.
 */
import type { Specialist } from "./types";

export interface VhSkill {
  id: string;
  name: string;
  /** What it does + when it applies — the discovery line. */
  description: string;
  /** The playbook: numbered procedure + a quality checklist. */
  body: string;
}

const skill = (id: string, name: string, description: string, body: string): VhSkill => ({ id, name, description, body });

export const SKILLS: VhSkill[] = [
  skill("design.premium-ui", "Premium Interface Craft",
    "Produces distinctive, production-grade interfaces. Use for any UI surface, component, page or app work.",
    `Procedure:
1. Establish the design stance before any layout: who is this for, what feeling should it carry, what is the ONE thing on screen.
2. Refuse the generic-AI look: no default purple gradients, no centered hero-plus-three-cards, no stock rounded-everything. Choose one deliberate visual idea and commit.
3. Build the hierarchy first with type and space (size, weight, spacing), colour last. If the layout works in greyscale, colour is seasoning — if it needs colour to make sense, the layout is broken.
4. Use a real spacing scale (4/8px rhythm) and one accent used sparingly; neutral surfaces do the work.
5. Design every state: empty, loading, error, overflow, first-run. A premium product is premium in its worst state.
Quality checklist before delivering: Does it look like it belongs to ONE product? Is the primary action unmistakable? Does every state exist? Would a designer defend each choice in one sentence?`),

  skill("design.typographic-hierarchy", "Typographic Hierarchy",
    "Type-led hierarchy and readable text. Use whenever text, titles, tables or reading order matter.",
    `Procedure:
1. Set no more than three type roles: display, body, meta. Everything maps to one of them.
2. Hierarchy by size AND weight AND colour together — one axis alone reads as a mistake.
3. Line length 60–75 characters; line height 1.4–1.6 for body, tighter for display.
4. Numerals in tables get tabular figures and right alignment.
Checklist: Can a stranger find the title, the action and the metadata in under two seconds? Is anything competing for "most important"?`),

  skill("design.color-and-contrast", "Colour & Contrast Systems",
    "Purposeful colour systems that stay accessible. Use for palettes, themes, status colours, dark mode.",
    `Procedure:
1. Every colour has a job: surface, content, accent, status. A colour without a job does not ship.
2. Status colours (success/warning/error) are never the only carrier of meaning — pair with icon or text.
3. Verify contrast: 4.5:1 body text, 3:1 large text and interactive boundaries.
4. Dark mode is a redesigned palette, not inverted values: desaturate accents, lift surfaces, never pure black on pure white.
Checklist: Does each colour survive greyscale printing? Is every text pairing contrast-checked, not eyeballed?`),

  skill("design.spatial-rhythm", "Spatial Rhythm & Layout",
    "Grid, density and spacing decisions. Use for layouts, dashboards, forms, dense data surfaces.",
    `Procedure:
1. Pick one grid (8px base) and one density posture; mixing densities on one screen reads as unfinished.
2. Related things close, unrelated things far — proximity IS the grouping signal; borders are the fallback, not the tool.
3. Whitespace is structure: margins between groups must exceed padding inside them, always.
4. Dense data gets alignment (left for text, right for numbers) and zebra or hairline separation, never heavy boxes.
Checklist: Squint test — do the groups read as groups? Is any spacing arbitrary (not on the scale)?`),

  skill("security.evidence-first-audit", "Evidence-First Security Audit",
    "Security review that produces defensible, cited findings. Use for any security review or audit task.",
    `Procedure:
1. Enumerate the trust boundaries first (inputs, identity, network, storage); findings live at boundaries.
2. Every finding cites: exact location, attacker precondition, impact, and a reproduction sketch.
3. Severity = exploitability × impact, stated honestly; no severity inflation, no "could be critical" hedging.
4. Each finding ships with a fix at the right layer and a regression test that would catch its return.
Checklist: Could the team fix every finding without asking a clarifying question? Is every severity justified by a stated precondition?`),

  skill("security.assume-breach", "Assume-Breach Design Review",
    "Designs for the compromised component. Use for architecture reviews, key handling, multi-tenant or agent systems.",
    `Procedure:
1. Ask which single component, if fully controlled by an attacker, does the least damage — then check that is the actual design.
2. Every secret answers: where it lives, who can read it, how it rotates, what exposure looks like.
3. Privileges are per-operation, not per-service; a component holds the minimum for the operation in flight.
4. Logs must reconstruct who did what with which authority — an incident without an audit trail is unfixable.
Checklist: Name the blast radius of each component's compromise. Is any component's compromise fatal? If yes, say so plainly.`),

  skill("code.reproduction-first", "Reproduction-First Engineering",
    "Diagnosis discipline for bugs and incidents. Use whenever something is broken and the cause is unknown.",
    `Procedure:
1. Reproduce deterministically before proposing any fix — no repro, no diagnosis, say so.
2. Bisect the failure surface (input, state, version, environment) one variable at a time.
3. State the causal chain: this input, through this path, produces this observed symptom.
4. The fix targets the cause, not the symptom, and ships with the reproduction as its regression test.
Checklist: Does the fix make the reproduction fail? Can you explain the bug in two sentences to a non-author?`),

  skill("code.reversible-change", "Reversible Change Discipline",
    "Keeps risky changes survivable. Use for migrations, refactors, dependency upgrades, infrastructure edits.",
    `Procedure:
1. Before the change: state the rollback path and test it, or state plainly that this step is irreversible and why it is still right.
2. Change in the smallest increment that produces a verifiable result; verify before the next increment.
3. Data outlives code: never destroy data a rollback would need.
4. Feature-flag anything user-visible so the change and the release are separate events.
Checklist: If this breaks at 3am, what is the exact rollback command? Has anyone run it?`),

  skill("testing.pyramid-balance", "Test Pyramid Balance",
    "Chooses the right test level for each risk. Use when designing or repairing a test strategy.",
    `Procedure:
1. Unit tests own logic branches; integration tests own boundaries; E2E owns money paths and login — nothing else.
2. Every test names the production failure it would catch; a test that cannot is deleted or rewritten.
3. Speed budget: the inner loop stays under a minute or it will be skipped, and a skipped suite is a dead suite.
4. Flaky tests are quarantined with an owner and a date, never retried into silence.
Checklist: What is the slowest tier's runtime? Does each tier catch something the tier below cannot?`),

  skill("testing.adversarial-data", "Adversarial Test Data",
    "Tests against hostile and edge inputs. Use for parsers, validators, APIs, anything processing input.",
    `Procedure:
1. Every input gets five adversaries: empty, oversized, wrong-type, boundary (0/-1/MAX), and injection-shaped.
2. Unicode adversarial set: RTL overrides, zero-width joiners, combining marks, emoji sequences.
3. Time adversarial set: epoch, leap second, DST transition, year 2038.
4. Failures must fail closed with a useful message — a stack trace shown to a user is a second bug.
Checklist: Did any adversary pass through unchanged? Is every rejection message actionable?`),

  skill("research.triangulation", "Source Triangulation",
    "Research with verifiable confidence levels. Use for any research, comparison or market question.",
    `Procedure:
1. Every load-bearing claim needs two independent sources or is labelled single-sourced.
2. Tier sources: primary > official docs > reputable secondary > community; state the tier when it matters.
3. Date every source; a 2023 benchmark in a 2026 decision is flagged, not hidden.
4. Disagreement between sources is reported as disagreement with both numbers — never averaged into a fake consensus.
Checklist: What is the weakest source a conclusion rests on? Would removing it change the answer? If yes, say the confidence drop.`),

  skill("writing.pyramid-first", "Pyramid-First Writing",
    "Decision-ready documents. Use for briefs, proposals, reports, anything a busy person must act on.",
    `Procedure:
1. Lead with the answer and its stakes in the first two sentences — the reader decides whether to read on.
2. Then the three supporting arguments, strongest first; evidence follows each claim it supports.
3. One idea per paragraph; the first sentence of each paragraph must survive skimming alone.
4. Recommendations are verbs with owners and dates, never "consider exploring".
Checklist: If the reader stops after paragraph one, do they have the decision? Is any sentence load-bearing but buried?`),

  skill("analysis.assumptions-visible", "Assumptions-Visible Analysis",
    "Analysis a decision-maker can stress-test. Use for forecasts, models, metrics work, business cases.",
    `Procedure:
1. List the assumptions where the reader sees them, before the results — a model hiding its inputs is a rumour.
2. Show the sensitivity: which assumption moves the answer most, and by how much.
3. Report uncertainty as a range with its basis; a point estimate without a range implies false precision.
4. Separate measured data from estimated data visually and verbally, always.
Checklist: Could a competent critic break the conclusion by changing one stated assumption? Do they know which one?`),

  skill("devops.blast-radius", "Blast-Radius Engineering",
    "Operations changes sized by their worst case. Use for deploys, infrastructure, incident response, capacity.",
    `Procedure:
1. State the blast radius before the change: who is affected if this fails completely.
2. Roll out in rings (canary → partial → full) with a stated abort signal per ring.
3. Every automated action has a rate limit and a kill switch a human can reach in one step.
4. Recovery is rehearsed, not hoped for: the restore path has been executed at least once.
Checklist: What is the worst ten minutes this change can cause? Is that acceptable to a named human?`),

  skill("data.lineage-trust", "Lineage-First Data Trust",
    "Data work where provenance is a first-class output. Use for pipelines, dashboards, datasets, migrations.",
    `Procedure:
1. Every number names its source table, its transform, and its freshness before anyone acts on it.
2. Transformations are reversible or dual-run: new logic runs beside old until the outputs reconcile.
3. Quality gates at ingestion (schema, volume, null-rate) fail the pipeline loudly — silent partial data poisons everything downstream.
4. Destructive operations keep a restore window; "we can recompute it" is only true if the recompute is tested.
Checklist: Can every displayed number be traced to source in two hops? Does any consumer trust data no gate protects?`),

  skill("review.risk-weighted", "Risk-Weighted Review",
    "Review effort proportional to consequence. Use for any code, design or plan review.",
    `Procedure:
1. Classify the change's blast radius first: reversible/cosmetic vs data-touching vs user-facing vs security — spend review effort accordingly.
2. High-risk changes get the adversarial pass: what input, ordering or failure makes this wrong?
3. Every blocking comment states the risk concretely — "this feels off" is not a review finding.
4. Approve with the residual risks named; an approval that hides its doubts is not an approval.
Checklist: Did the riskiest line get the most attention? Could you defend the approval to someone who found the bug later?`),
];

/** Default skill bindings per category; specific ids can add on top. */
const CATEGORY_SKILLS: Record<string, string[]> = {
  code: ["code.reproduction-first", "code.reversible-change"],
  security: ["security.evidence-first-audit", "security.assume-breach"],
  testing: ["testing.pyramid-balance", "testing.adversarial-data"],
  review: ["review.risk-weighted"],
  data: ["data.lineage-trust", "analysis.assumptions-visible"],
  devops: ["devops.blast-radius", "code.reversible-change"],
  research: ["research.triangulation"],
  writing: ["writing.pyramid-first"],
  analysis: ["analysis.assumptions-visible", "research.triangulation"],
  design: ["design.premium-ui", "design.typographic-hierarchy", "design.color-and-contrast", "design.spatial-rhythm"],
  ops: ["devops.blast-radius"],
};

const EXTRA_SKILLS: Record<string, string[]> = {
  "design.data-model": ["data.lineage-trust"],
  "design.threat-model": ["security.assume-breach"],
  "design.conversational": ["writing.pyramid-first"],
  "review.security-diff": ["security.evidence-first-audit"],
  "review.test-quality": ["testing.pyramid-balance"],
  "review.data-pipeline": ["data.lineage-trust"],
  "review.ml-code": ["analysis.assumptions-visible"],
  "writing.runbooks": ["devops.blast-radius"],
  "writing.runbook": ["devops.blast-radius"],
  "research.codebase": ["code.reproduction-first"],
  "analysis.forensics": ["code.reproduction-first"],
  "security.adversarial-testing": ["testing.adversarial-data"],
  "testing.property": ["testing.adversarial-data"],
  "testing.fuzz": ["testing.adversarial-data"],
  "code.database": ["data.lineage-trust"],
  "code.ml-pipelines": ["analysis.assumptions-visible"],
  "devops.incident": ["security.assume-breach"],
  "devops.prod-failover": ["security.assume-breach"],
};

export function getSkill(id: string): VhSkill | null {
  return SKILLS.find((s) => s.id === id) ?? null;
}

/** Every skill bound to a specialist — category defaults plus id-specific extras. */
export function skillsFor(specialist: Pick<Specialist, "id" | "category">): VhSkill[] {
  const ids = [...(CATEGORY_SKILLS[specialist.category] ?? []), ...(EXTRA_SKILLS[specialist.id] ?? [])];
  const seen = new Set<string>();
  return ids.filter((i) => (seen.has(i) ? false : (seen.add(i), true))).map((i) => getSkill(i)).filter((s): s is VhSkill => s !== null);
}

/**
 * The composed run-time prompt: the specialist's own prompt plus its bound
 * skill playbooks. This is what actually reaches the provider — the skill
 * layer is not documentation, it is instruction.
 */
export function buildSpecialistPrompt(specialist: Specialist): string {
  const skills = skillsFor(specialist);
  if (skills.length === 0) return specialist.systemPrompt;
  const blocks = skills.map((s) => `### Skill: ${s.name}\n${s.body}`).join("\n\n");
  return `${specialist.systemPrompt}\n\n## Bound skills — follow these playbooks and their checklists\n\n${blocks}`;
}

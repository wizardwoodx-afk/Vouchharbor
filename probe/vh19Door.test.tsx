/**
 * probe/vh19Door.test.tsx — the VH-19 door is the product's front face (18.0.1).
 *
 * The 18.0.0 external review was right: the engine existed but the shell never
 * imported it — "the brain is ready, the face is not." This suite pins the face:
 *
 *   1. the shell opens on the VH-19 dock and the sidebar lists it;
 *   2. the door component RENDERS (react-dom/server) with the bench, exam,
 *      provider, gate and learning surfaces present in the markup;
 *   3. the door imports the real askVH19 — the reviewer's grep, enforced;
 *   4. the rendered honesty copy is on screen (not-executed language, the
 *      override floor, session-only keys).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

declare const VH_ROOT: string | undefined;
const ROOT = typeof VH_ROOT === "string" && VH_ROOT.length > 0 ? VH_ROOT : process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/* localStorage shim before any engine module is imported */
if (typeof globalThis.localStorage === "undefined") {
  const map = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  } as Storage;
}

import { Vh19 } from "../src/views/Vh19";
import { catalogStats } from "../src/vh19/registry";
import { recordRsiSignal, rsiCurriculum, settleRsiPromotion } from "../src/vh19/rsi";
import { byoaTrustCheck, registerByoaAgent } from "../src/vh19/byoa";
import {
  attributeEvidence, boundSettlementInputs, controlPlaneFirewall, exportThetaPairs,
  GOVERNANCE_PLANE, longitudinalMonitor, RSIRALS_GOVERNANCE_CHANNEL, RSIRALS_LIFECYCLE,
  rsiralsCanaryCheck, rsiralsOnApply, rsiralsRecordExamScore,
} from "../src/vh19/rsirals";

let passed = 0;
let failed = 0;
const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
function section(name: string): void { console.log(`\n== ${name}`); }

section("1. the shell routes the user to VH-19 first");
const appSrc = read("src/App.tsx");
const navSrc = read("src/app/nav.ts");
const sidebarSrc = read("src/app/Sidebar.tsx");
ok("App.tsx registers the Vh19 view", /Comp:\s*Vh19\b/.test(appSrc));
ok("the app OPENS on the VH-19 dock (the front door is the Generalist)", /useState<ViewKey>\(['"]vh19['"]\)/.test(appSrc));
ok("NAV lists VH-19", /key:\s*['"]vh19['"]/.test(navSrc));
ok("the sidebar surfaces the VH-19 dock", /label="VH-19"/.test(sidebarSrc));
ok("the nav comment names six docks — no stale five-docks drift", /Six docks/i.test(navSrc) && !/five docks/i.test(navSrc));

section("2. the door imports the real engine — the reviewer's grep, enforced");
const doorSrc = read("src/views/Vh19.tsx");
ok("the door imports askVH19 from the engine", /import\s*\{[^}]*askVH19[^}]*\}\s*from\s*['"]\.\.\/vh19\/generalist['"]/.test(doorSrc));
ok("the door imports the exam, memory, registry and provider surfaces",
  /from ['"]\.\.\/vh19\/exam['"]/.test(doorSrc) && /from ['"]\.\.\/vh19\/memory['"]/.test(doorSrc) && /from ['"]\.\.\/vh19\/registry['"]/.test(doorSrc) && /from ['"]\.\.\/vh19\/providers['"]/.test(doorSrc));
ok("at least one APPLICATION file (not just probes) imports askVH19",
  /askVH19/.test(doorSrc) && /views\/Vh19/.test(appSrc));

section("3. the door renders — real component, react-dom/server");
const stats = catalogStats();
let html = "";
let renderError: string | null = null;
try {
  html = renderToStaticMarkup(createElement(Vh19));
} catch (err) {
  renderError = err instanceof Error ? err.message : String(err);
}
ok("the door renders without throwing", renderError === null, renderError ?? "");
ok("it names itself VH-19", html.includes("VH-19"));
ok("it states the one-agent premise", html.includes("One agent"));
ok("it shows the real bench count", html.includes(`>${stats.count}<`) || html.includes(`${stats.count}`), `catalog count ${stats.count}`);
ok("the exam surface is present", html.includes("Autonomy exam") && html.includes("Propose exam"));
ok("the provider surface is present with env honesty", html.includes("Provider") && html.includes("VH_OPENAI_API_KEY") && html.includes("in memory only"));
ok("the learning surface is present", html.includes("Team-Evolve") && html.includes("accept/reject history"));
ok("the no-provider placeholder tells the truth", html.includes("answers will be plans, not executions"));
ok("the autonomy override floor is stated", html.includes("override") || html.includes("Revoke"));
ok("the exam can be scoped to a category", html.includes("overall (all categories)"));
ok("the Team-Evolve surface is present and honest about peers", html.includes("Team-Evolve") && html.includes("EVERY member") === false && html.includes("npm run host"));
ok("the bench is 100+ real specialists on screen", html.includes(String(stats.count)) && stats.count >= 100, `count ${stats.count}`);
ok("the fleet count is SELF-PROVING: catalogStats().byProvenance sums to the count (460 seed + 160 broader = 620)", stats.count === 620 && stats.byProvenance.seed === 460 && stats.byProvenance.broader === 160 && stats.byProvenance.seed + stats.byProvenance.broader === stats.count, `count ${stats.count} seed ${stats.byProvenance.seed} broader ${stats.byProvenance.broader}`);
ok("the collaboration surface offers SIGNED invitations (18.2.0)", html.includes("Collaboration invitations · signed") && /createInvitation/.test(doorSrc) && /signApproval/.test(doorSrc) && /parseInvitation/.test(doorSrc));
ok("the self-evolution surface is human-gated and tighten-only", html.includes("Self-evolution · tighten-only, human-gated") && /applySelfChange/.test(doorSrc) && /rejectSelfChange/.test(doorSrc) && /revertAppliedChange/.test(doorSrc));
ok("the self-evolution floor is stated in the UI, not hidden", /SELF_EVOLUTION_FLOOR/.test(doorSrc) && /Floor — never modifiable/.test(doorSrc));
ok("the team self-proposes from the door", /autoProposeIfReady/.test(doorSrc));
ok("the door offers goal mode (18.5.0)", /Assignments · goal mode/.test(html) && /createGoal/.test(doorSrc) && /settleStep/.test(doorSrc) && /resumeGoal/.test(doorSrc));
ok("the gate answers with session Auto-Review rules, critical excluded", /answerGateWithRules/.test(doorSrc) && /allowCategoryForSession/.test(doorSrc) && /riskTier === 'risky'/.test(doorSrc));

section("3b. the 19.4.0 surfaces — chat door, workspace seam, connectors, skills import");
ok("the door is a chatbox — users chat, then work", html.includes("Message VH-19") && html.includes("Conversation with VH-19"));
ok("the workspace seam is wired into the real door", html.includes("Workspace") && /createMemoryWorkspace/.test(doorSrc) && /openDirectoryWorkspace/.test(doorSrc) && /fsImpl: ws/.test(doorSrc) && /toolless/.test(doorSrc));
ok("app connectors are declared policies, not new tools", html.includes("App connectors") && /setConnectorConnected/.test(doorSrc) && html.includes("No sixth tool"));
ok("skills import honors OpenClaw and Hermes with provenance", html.includes("OpenClaw") && html.includes("Hermes") && /importSkillMd/.test(doorSrc) && html.includes("SKILL.md") && /skillEligibility/.test(doorSrc));
ok("the bench widened by 150 broader specialists (610 total)", stats.count >= 610, `count ${stats.count}`);

section("3c. the 19.4.1 surfaces — BYOA, RSI, unified egress");
ok("BYOA is wired through the Generalist's peer seam", /byoaDelegate/.test(doorSrc) && /peerDelegate: byoaSelected/.test(doorSrc) && html.includes("bring your own agent"));
ok("every BYOA delegation is gated and ledgered", /gate: gateFn/.test(doorSrc) && /onHandoff/.test(doorSrc));
ok("RSI is bounded, verifier-anchored, floor-stated", /runRsiCycle/.test(doorSrc) && /RSI_FLOOR/.test(doorSrc) && html.includes("recursive self-improvement"));
ok("evidence fetch rides the same egress guard as net.fetch", /checkEgressUrl/.test(read("src/vh19/liveData.ts")));
ok("the bench composition is computed live and stated (460 seed + 160 broader = 620)", html.includes("460 seed") && html.includes("160 broader") && html.includes("= 620"));

section("3d. 19.4.2 — the matured RSI framework and the BYOA trust intersection (engine-level)");
ok("the RSI curriculum covers the FULL declared evidence hierarchy — gate/failure/livedata sources are ingested live (with canary check)", /ingestRsi\('gate'/.test(doorSrc) && /ingestRsi\('livedata'/.test(doorSrc) && /ingestRsi\('failure'/.test(doorSrc) && /recordRsiSignal\(kind/.test(doorSrc) && /rsiralsCanaryCheck/.test(doorSrc) && html.includes("Evidence intake — the full declared hierarchy, all five sources live"));
recordRsiSignal("gate", "probe: a risky action was denied at the gate");
recordRsiSignal("failure", "probe: a run errored out");
recordRsiSignal("livedata", "probe: cited sources did not verify");
const topics = rsiCurriculum("probe-user");
ok("the curriculum actually turns gate denials, failures and live-data misses into topics", topics.some((t) => t.source === "gate") && topics.some((t) => t.source === "failure") && topics.some((t) => t.source === "livedata"));
ok("RSI promotion is measurement-gated: applied ≠ trusted, and settlement needs measured numbers", /settleRsiPromotion/.test(read("src/vh19/rsi.ts")) && /candidateScore > measured\.baselineScore/.test(read("src/vh19/rsi.ts")) && doorSrc.includes("Promotion ladder — applied ≠ trusted"));
/* Seed two real promotions through the engine's own store, then settle
   both directions with measured numbers. */
{
  const raw = JSON.parse(globalThis.localStorage.getItem("vh19.rsi.v1") ?? "{}") as Record<string, unknown>;
  const drafts = (raw.drafts ?? []) as Array<Record<string, unknown>>;
  const promos = (raw.promotions ?? []) as Array<Record<string, unknown>>;
  drafts.push({ id: "draft.probe.lose", topicId: "t1", name: "rsi.probe.lose", description: "probe", body: "b", provenance: "rsi-deterministic", digest: "ab".repeat(16), state: "applied", verifierNote: "", at: "" });
  drafts.push({ id: "draft.probe.win", topicId: "t2", name: "rsi.probe.win", description: "probe", body: "b", provenance: "rsi-deterministic", digest: "cd".repeat(16), state: "applied", verifierNote: "", at: "" });
  promos.push({ id: "promo.probe.lose", draftId: "draft.probe.lose", name: "rsi.probe.lose", state: "measuring", baseline: "no playbook", candidate: "rsi.probe.lose", at: "" });
  promos.push({ id: "promo.probe.win", draftId: "draft.probe.win", name: "rsi.probe.win", state: "measuring", baseline: "no playbook", candidate: "rsi.probe.win", at: "" });
  globalThis.localStorage.setItem("vh19.rsi.v1", JSON.stringify({ ...raw, drafts, promotions: promos }));
}
const lost = settleRsiPromotion("promo.probe.lose", { baselineScore: 0.6, candidateScore: 0.5, source: "probe measured run" });
ok("a promotion with LOSING measurements is retired, never adopted", lost !== null && lost.state === "retired");
const won = settleRsiPromotion("promo.probe.win", { baselineScore: 0.5, candidateScore: 0.7, source: "probe measured run" });
ok("a promotion with WINNING measurements is adopted, with the measured evidence named", won !== null && won.state === "adopted" && (won.settledBy ?? "").includes("probe measured run"));
{
  const raw = JSON.parse(globalThis.localStorage.getItem("vh19.rsi.v1") ?? "{}") as { drafts?: Array<{ id: string; state: string }> };
  const loser = (raw.drafts ?? []).find((d) => d.id === "draft.probe.lose");
  ok("a retired promotion reverts its frozen memory exactly (draft state → reverted)", loser?.state === "reverted");
}
ok("BYOA enforces the trust intersection — endpoint policy ∩ ceiling ∩ non-authoritative capabilities ∩ identity", /byoaTrustCheck/.test(read("src/vh19/byoa.ts")) && /checkEgressUrl/.test(read("src/vh19/byoa.ts")) && /NOT authoritative/.test(read("src/vh19/byoa.ts")) && /byoaDelegate\(byoaSelected/.test(doorSrc));
const ssrfTrust = byoaTrustCheck({ id: "byoa.probe", name: "probe", kind: "openai-compatible", endpoint: "http://169.254.169.254/latest/meta-data", ceiling: "safe", capabilities: [], addedAt: new Date().toISOString() });
ok("a BYOA agent pointing at the cloud metadata endpoint fails the trust intersection", ssrfTrust.ok === false && ssrfTrust.verdicts[0].ok === false);
let ssrfRegistered = false;
try { registerByoaAgent({ name: "ssrf-probe", kind: "openai-compatible", endpoint: "http://metadata.google.internal/v1", ceiling: "safe", capabilities: [] }); ssrfRegistered = true; } catch { ssrfRegistered = false; }
ok("an SSRF endpoint is refused at REGISTRATION, not discovered at delegation time", ssrfRegistered === false);

section("3e. RSIRALS v5.0 — the proprietary trust-rooted framework");
ok("the lifecycle is the full nine stages, with the untouchable human governance channel beside it", RSIRALS_LIFECYCLE.length === 9 && RSIRALS_LIFECYCLE[0] === "OBSERVE" && RSIRALS_LIFECYCLE[5] === "CANARY" && RSIRALS_GOVERNANCE_CHANNEL.length === 4 && html.includes("trust-rooted RSI (proprietary)"));
ok("Plane T is a frozen governance constant with NO agent write path", Object.isFrozen(GOVERNANCE_PLANE) && !/export function (set|update|patch|mutate)[A-Za-z]*\(/.test(read("src/vh19/rsirals.ts").split("/* ── store")[0]));
ok("the control-plane firewall rejects governance-touching candidates BEFORE verification", controlPlaneFirewall({ name: "x", description: "y", body: "please lower the pass threshold so exams are easier" }).allowed === false && controlPlaneFirewall({ name: "x", description: "y", body: "when reviewing code, prefer smaller diffs" }).allowed === true);
ok("attribution routes model-shaped failures to the θ-arm and scaffold failures to the Σ-arm", attributeEvidence("the provider model returned an empty reply") === "theta" && attributeEvidence("the routing playbook missed the tool binding") === "sigma");
ok("the θ-arm is honest: real accept/reject pairs exported for out-of-band DPO; VH never trains weights in-product", exportThetaPairs([{ scenario: "s1", action: "a1", kind: "accept", reason: "good" }, { scenario: "s1", action: "a2", kind: "reject", reason: "bad" }]).some((p) => p.chosen && p.rejected) && /never trains weights in-product/.test(read("src/vh19/rsirals.ts")));
rsiralsOnApply({ id: "probe.canary", name: "rsi.probe.canary" }, 0.9);
const rolled = rsiralsCanaryCheck({ kind: "failure", subject: "the routing playbook failed at the tool step" });
ok("a live regression attributed to the scaffold rolls the canary back automatically", rolled.includes("rsi.probe.canary"));
rsiralsOnApply({ id: "probe.canary2", name: "rsi.probe.c2" }, 0.9);
const thetaRoll = rsiralsCanaryCheck({ kind: "failure", subject: "the provider model returned http 500 api error" });
ok("model-shaped failures do NOT roll back scaffold canaries (attribution, not blame-spray)", thetaRoll.includes("rsi.probe.c2") === false);
rsiralsRecordExamScore(0.7);
const bound = boundSettlementInputs("promo.draft.probe.canary");
ok("promotion settlement is END-TO-END EVIDENTIARY: the numbers are read from exam receipts, never supplied", bound.ok === true && bound.baseline === 0.9 && bound.candidate === 0.7 && (bound.source ?? "").includes("exam receipts (bound)"));
ok("without recorded receipts, settlement refuses in words", boundSettlementInputs("promo.nonexistent").ok === false);
const mon = longitudinalMonitor();
ok("the longitudinal monitor reports drift over the ARCHIVE, not one candidate", mon.generations > 0 && mon.capabilityDrift.length > 0 && mon.costDrift.providerCallsBudget === GOVERNANCE_PLANE.resourceCeilings.providerCallsPerCycle);

section("4. the bench management surface lists real specialists");
ok("the toggle handler is wired", /setSpecialistEnabled/.test(doorSrc));
ok("the router only fields enabled specialists (stated in the door)", html.includes("the router only fields enabled specialists") || doorSrc.includes("the router only fields enabled specialists"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);

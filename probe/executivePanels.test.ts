/**
 * probe/executivePanels.test.ts — the three unifying planes (16.9.1).
 *
 * The 16.9.0 external review found the gap: the underlying engines
 * (assuranceScore, finOps, evidencePack, receiptVault) are each probe-pinned,
 * but the COMPOSITION layer — the executive panels that render them — was not.
 * This probe pins the composition contract:
 *
 *   TrustCenterPanel         (Proof door)   — unifies vault + issuer + crosswalk + assurance;
 *                                             exports a Trust Pack naming the crosswalk and the
 *                                             zero-install verifier.
 *   AssuranceScorecardPanel  (Audit door)   — the 0–100 measured-only score, honestly badged.
 *   CostPerOutcomePanel      (Audit door)   — measured chargeback; `unmeasured` stays unmeasured.
 *
 * Ethos pins: real engines (not reinvented math), the labeled-demo disclosure,
 * token-only styling (no hardcoded palette hex outside the theme system), and
 * both doors actually render the panels.
 */
import { test, } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

declare const MJ_ROOT: string;
const root = MJ_ROOT ?? process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(root, rel), "utf8");

const panels = read("src/panels/ExecutivePanels.tsx");
const proof = read("src/pages/ProofPage.tsx");
const audit = read("src/pages/AuditPage.tsx");

let passed = 0;
const failures: string[] = [];
const ok = (label: string, cond: boolean, detail = ""): void => {
  if (cond) passed++;
  else failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`  ${cond ? "ok " : "FAIL"} ${label}${cond ? "" : ` — ${detail}`}`);
};

const section = (t: string): void => console.log(`\n== ${t} ==\n`);

test("executivePanels — the composition layer is pinned", () => {
  section("1. the composition exists and rides the real engines");
  ok("the panel module exists", panels.length > 1000, "file too small");
  ok("Trust Center uses the REAL assurance engine (scoreAssurance)", panels.includes("scoreAssurance"));
  ok("Cost per Outcome uses the REAL chargeback engine (rowFor)", /rowFor/.test(panels));
  ok("Trust Center renders the REAL control crosswalk (EVIDENCE_CONTROL_MAPPINGS)", panels.includes("EVIDENCE_CONTROL_MAPPINGS"));
  ok("Trust Center reads the LIVE receipt vault (globalReceiptVault)", panels.includes("globalReceiptVault"));

  section("2. the honesty contract");
  ok("web edition is labeled (labeled demo badge)", panels.includes("labeled demo · web edition"));
  ok("the unmeasured honesty string survives the composition", panels.includes("unmeasured"));
  ok("no hardcoded palette hex outside the theme system", !/#[0-9a-fA-F]{6}\b/.test(panels.replace(/var\(--[a-z-]+\)/g, "")), "found a literal hex");
  ok("the Trust Pack names the zero-install verifier", panels.includes("tools/verify-receipt.mjs"));

  section("3. the doors actually render the planes");
  ok("Proof door renders the Trust Center", proof.includes("<TrustCenterPanel />"));
  ok("Audit door renders the Assurance Scorecard", audit.includes("<AssuranceScorecardPanel />"));
  ok("Audit door renders Cost per Outcome", audit.includes("<CostPerOutcomePanel />"));

  section("4. exports an artifact, not a claim");
  ok("Trust Pack export is wired (downloadText)", panels.includes("downloadText"));
  ok("chargeback CSV export is wired", panels.includes("vouch-cost-per-outcome.csv"));
  ok("the exported pack carries the crosswalk controls", panels.includes("## Control crosswalk"));

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log("\nfailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  assert.equal(failures.length, 0, failures.join("; "));
});

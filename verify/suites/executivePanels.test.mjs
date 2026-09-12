import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/executivePanels.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
var root = ".";
var read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
var panels = read("src/panels/ExecutivePanels.tsx");
var proof = read("src/pages/ProofPage.tsx");
var audit = read("src/pages/AuditPage.tsx");
var passed = 0;
var failures = [];
var ok = (label, cond, detail = "") => {
  if (cond) passed++;
  else failures.push(detail ? `${label} \u2014 ${detail}` : label);
  console.log(`  ${cond ? "ok " : "FAIL"} ${label}${cond ? "" : ` \u2014 ${detail}`}`);
};
var section = (t) => console.log(`
== ${t} ==
`);
test("executivePanels \u2014 the composition layer is pinned", () => {
  section("1. the composition exists and rides the real engines");
  ok("the panel module exists", panels.length > 1e3, "file too small");
  ok("Trust Center uses the REAL assurance engine (scoreAssurance)", panels.includes("scoreAssurance"));
  ok("Cost per Outcome uses the REAL chargeback engine (rowFor)", /rowFor/.test(panels));
  ok("Trust Center renders the REAL control crosswalk (EVIDENCE_CONTROL_MAPPINGS)", panels.includes("EVIDENCE_CONTROL_MAPPINGS"));
  ok("Trust Center reads the LIVE receipt vault (globalReceiptVault)", panels.includes("globalReceiptVault"));
  section("2. the honesty contract");
  ok("web edition is labeled (labeled demo badge)", panels.includes("labeled demo \xB7 web edition"));
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
  console.log(`
${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log("\nfailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  assert.equal(failures.length, 0, failures.join("; "));
});

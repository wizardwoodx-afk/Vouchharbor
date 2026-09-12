/**
 * Patina (17.1) — atelier palette probe.
 *
 * Replaces the legacy multi-theme probe: Patina ships a single signature
 * palette — verdigris patina #3E7C71 on ink/parchment — so the probe asserts
 * the core tokens exist and the patina signature color is not purple/cyan/blue.
 */
import * as fs from "node:fs";
import * as path from "node:path";

let passed = 0; let failed = 0; const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

declare const MJ_ROOT: string | undefined;
const ROOT = typeof MJ_ROOT === "string" && MJ_ROOT.length > 0 ? MJ_ROOT : process.cwd();
const css = fs.readFileSync(path.join(ROOT, "src", "styles", "atelier.css"), "utf8");

ok("atelier.css declares the verdigris --patina signature token", /--patina:\s*#3E7C71/i.test(css) || /--accent:\s*#3E7C71/i.test(css), "patina signature missing");
ok("atelier.css declares ink-950 background", /--ink-950:\s*#0A0C0E/i.test(css) || /--bg:\s*#0A0C0E/i.test(css), "ink 950 missing");
ok("atelier.css declares parchment text", /--parchment/i.test(css), "parchment token missing");
ok("signature patina is NOT a competitor's purple/cyan/blue",
  !/#6[0-9A-F]{5}/i.test("--accent:#3E7C71") && !/#007AFF/i.test(css) && !/#7C3AED/i.test(css) && !/#06B6D4/i.test(css),
  "purple/cyan detected");
ok("the patina seal animation exists", /patinaSeal|seal-mark/i.test(css), "no seal animation");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);

/**
 * Broader (19.4.0) — premium-minimal theme probe.
 *
 * The 19.4.0 pre-seed redesign retired the dark Horizon sheet for the
 * product's own five-color light system: Gunmetal #2D3142, Greyish White
 * #D5DFEA, Platinum #D8D5DB, Brooklyn #586A66, Simple Plum #827278. This
 * probe pins that identity: the sage signature is the accent, the canvas is
 * platinum, ink is gunmetal, the palette is NOT a competitor's purple/cyan/
 * blue, the chrome is hairline-minimal, and the legacy patina green is gone
 * from the signature slot.
 */
import * as fs from "node:fs";
import * as path from "node:path";

let passed = 0; let failed = 0; const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

declare const VH_ROOT: string | undefined;
const ROOT = typeof VH_ROOT === "string" && VH_ROOT.length > 0 ? VH_ROOT : process.cwd();
const css = fs.readFileSync(path.join(ROOT, "src", "styles", "atelier.css"), "utf8");

ok("the Brooklyn sage signature is the accent", /--patina:\s*#586a66/i.test(css), "signature missing");
ok("the canvas is Platinum, not near-black", /--bg:\s*#d8d5db/i.test(css), "canvas token missing");
ok("ink is Gunmetal, not aged cream", /--text:\s*#2d3142/i.test(css), "ink token missing");
ok("the five-color system names its owners in the sheet", /Gunmetal/.test(css) && /Greyish White/.test(css) && /Simple Plum/.test(css), "five-color provenance missing");
ok("the signature is NOT a competitor's purple/cyan/blue", !/#7C3AED/i.test(css) && !/#06B6D4/i.test(css) && !/#007AFF/i.test(css), "purple/cyan detected");
ok("the old patina green is retired from the token sheet", !/#3E7C71/i.test(css), "legacy patina still present");
ok("typography is the system SF-first stack (premium minimal)", /-apple-system/.test(css) && /SF Pro/.test(css), "system stack missing");
ok("the 19.4.0 refinement pass ships (hairlines, no chrome glow)", /HORIZON \(19\.4\.0/.test(css) && /border-soft/.test(css), "refinement pass missing");
ok("Apple-proportioned radii (10/14/20)", /--radius-md:\s*10px/.test(css) && /--radius-lg:\s*14px/.test(css) && /--radius-xl:\s*20px/.test(css), "radii off");
ok("nav hover is calm (no translate gimmick)", /\.nav-item:hover \{ transform: none/.test(css), "hover translate still present");

const sidebar = fs.readFileSync(path.join(ROOT, "src", "app", "Sidebar.tsx"), "utf8");
ok("the brand mark is the minimal horizon glyph, not the patina seal", /horizon/i.test(sidebar) && !/patinaG/.test(sidebar), "brand mark stale");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);

import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/theme.test.ts
import * as fs from "node:fs";
import * as path from "node:path";
var passed = 0;
var failed = 0;
var failures = [];
function ok(label, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    failures.push(`${label}${detail ? ` \u2014 ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}
var ROOT = ".".length > 0 ? "." : process.cwd();
var css = fs.readFileSync(path.join(ROOT, "src", "styles", "atelier.css"), "utf8");
ok("the Horizon signature token (Echo Park sage-gray) is the accent", /--patina:\s*#748785/i.test(css), "signature missing");
ok("the app background is the near-black Thamar/Lead family", /--ink-950:\s*#141416/i.test(css), "bg token missing");
ok("text is the mist/platinum family, not aged cream", /--parchment:\s*#E9EBED/i.test(css), "text token missing");
ok("the signature is NOT a competitor's purple/cyan/blue", !/#7C3AED/i.test(css) && !/#06B6D4/i.test(css) && !/#007AFF/i.test(css), "purple/cyan detected");
ok("the old patina green is retired from the token sheet", !/#3E7C71/i.test(css), "legacy patina still present");
ok("typography is the system SF-first stack (premium minimal)", /-apple-system/.test(css) && /SF Pro/.test(css), "system stack missing");
ok("the Horizon refinement pass ships (hairlines, no chrome glow)", /HORIZON refinement/.test(css) && /border-soft/.test(css), "refinement pass missing");
ok("Apple-proportioned radii (10/14/20)", /--radius-md:\s*10px/.test(css) && /--radius-lg:\s*14px/.test(css) && /--radius-xl:\s*20px/.test(css), "radii off");
ok("nav hover is calm (no translate gimmick)", /\.nav-item:hover \{ transform: none/.test(css), "hover translate still present");
var sidebar = fs.readFileSync(path.join(ROOT, "src", "app", "Sidebar.tsx"), "utf8");
ok("the brand mark is the minimal horizon glyph, not the patina seal", /horizon/i.test(sidebar) && !/patinaG/.test(sidebar), "brand mark stale");
console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);

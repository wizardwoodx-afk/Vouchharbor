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
ok("atelier.css declares the verdigris --patina signature token", /--patina:\s*#3E7C71/i.test(css) || /--accent:\s*#3E7C71/i.test(css), "patina signature missing");
ok("atelier.css declares ink-950 background", /--ink-950:\s*#0A0C0E/i.test(css) || /--bg:\s*#0A0C0E/i.test(css), "ink 950 missing");
ok("atelier.css declares parchment text", /--parchment/i.test(css), "parchment token missing");
ok(
  "signature patina is NOT a competitor's purple/cyan/blue",
  !/#6[0-9A-F]{5}/i.test("--accent:#3E7C71") && !/#007AFF/i.test(css) && !/#7C3AED/i.test(css) && !/#06B6D4/i.test(css),
  "purple/cyan detected"
);
ok("the patina seal animation exists", /patinaSeal|seal-mark/i.test(css), "no seal animation");
console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);

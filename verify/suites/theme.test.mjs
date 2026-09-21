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
var css = fs.readFileSync(path.join(ROOT, "src", "ui", "vh.css"), "utf8");
var main = fs.readFileSync(path.join(ROOT, "src", "main.tsx"), "utf8");
ok("one stylesheet \u2014 main.tsx imports vh.css and nothing else", /import '\.\/ui\/vh\.css'/.test(main) && (main.match(/\.css['"]/g) ?? []).length === 1);
ok("the retired sheets are gone", !fs.existsSync(path.join(ROOT, "src", "styles")));
ok("dark ground is charcoal #0D1010 with surface #232B2B (not flat black)", /--bg:\s*#0D1010/i.test(css) && /#232B2B/i.test(css) && !/--bg:\s*#000/i.test(css));
ok("light ground is bone #FAEBD7 with ink #141919", /--bg:\s*#FAEBD7/i.test(css) && /#141919/i.test(css));
ok("champagne #D5B26B is the sole accent", /--accent:\s*#D5B26B/i.test(css));
ok("no blue, no competitor purple/cyan", !/#007AFF|#3B82F6|#2563EB|#7C3AED|#06B6D4/i.test(css));
ok("Instrument Serif for brand/titles, Geist for body and mono", /Instrument Serif/.test(css) && /Geist/.test(css) && /Geist Mono/.test(css));
ok("not Inter / JetBrains", !/Inter\b/.test(css.replace(/Instrument/g, "")) && !/JetBrains/.test(css));
ok("weights stay light \u2014 nothing at 500 or above", !/font-weight:\s*(5|6|7|8|9)00/.test(css) && !/font-weight:\s*bold/.test(css));
ok("no legacy animation gimmicks (splash, shimmer, glow keyframes)", !/@keyframes\s+(splash|shimmer|glow|pulseGlow|float)/.test(css));
ok("themes are attribute-scoped so both ship in one sheet", /\[data-theme=dark\]|\[data-theme="dark"\]/.test(css) && /\[data-theme=light\]|\[data-theme="light"\]/.test(css));
console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);

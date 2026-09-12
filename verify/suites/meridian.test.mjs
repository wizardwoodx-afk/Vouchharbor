import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/meridian.test.ts
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
var master = fs.readFileSync(path.join(ROOT, "src", "views", "HarborMaster.tsx"), "utf8");
var register = fs.readFileSync(path.join(ROOT, "src", "views", "Register.tsx"), "utf8");
ok("Harbor Master has the Sweep tab (Ghost Agent Sweep)", /'Sweep'/.test(master) && /Ghost Agent Sweep/.test(master), "missing sweep");
ok("Harbor Master has the Backtest tab (Drill + Replay)", /'Backtest'/.test(master) && /Drill/.test(master) && /runDrill/.test(master), "missing backtest");
ok("Harbor Master has the Lineage tab (Delegation Chain)", /'Lineage'/.test(master) && /Delegation Chain/.test(master), "missing lineage");
ok("Register has the Hindsight Ledger", /Hindsight Ledger/.test(register), "missing hindsight");
ok("Sweep actually runs when invoked", /runSweep|onClick=\{runSweep\}/.test(master), "sweep button inert");
ok("Backtest actually invokes runDrill", /runDrill\(/.test(master), "drill button inert");
ok("Windward allows adding a provider through the bridge", /actions\.addProvider|addProvider/.test(master), "add provider not wired");
console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);

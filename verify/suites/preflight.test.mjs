import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/preflight.test.ts
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
var engine = fs.readFileSync(path.join(ROOT, "src", "vouch", "engine", "vouch.ts"), "utf8");
var helm = fs.readFileSync(path.join(ROOT, "src", "app", "Helm.tsx"), "utf8");
ok("simulateVouchAction exists (preflight prediction)", /simulateVouchAction/.test(engine), "no simulate");
ok("risky tools are routed through the human gate", /RISKY_TOOLS/.test(engine) && /requestVouchApproval/.test(engine), "no gate");
ok("the Helm renders pending approval count", /pendingApprovals/.test(helm), "helm ignores pending approvals");
ok("every vouched receipt carries a simulation event when a risky tool ran", /vouch\.simulation/.test(engine), "no simulation event");
ok("the real Harbor surfaces the gate (Approve/Deny buttons)", /resolveVouchApproval|actions\.approve/.test(fs.readFileSync(path.join(ROOT, "src", "app", "harbor.tsx"), "utf8")), "no approve/deny in harbor");
console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);

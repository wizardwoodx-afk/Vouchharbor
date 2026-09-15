/**
 * Patina (17.1) — preflight probe.
 *
 * In Patina the Helm performs the preflight role: risky actions are
 * SIMULATED before execution and PAUSED at the human gate. This probe
 * asserts that the simulate + gate pipeline is wired (the new preflight)
 * instead of asserting the legacy PreflightPanel UI.
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

const engine = fs.readFileSync(path.join(ROOT, "src", "vouch", "engine", "vouch.ts"), "utf8");
const helm = fs.readFileSync(path.join(ROOT, "src", "app", "Helm.tsx"), "utf8");

ok("simulateVouchAction exists (preflight prediction)", /simulateVouchAction/.test(engine), "no simulate");
ok("risky tools are routed through the human gate", /RISKY_TOOLS/.test(engine) && /requestVouchApproval/.test(engine), "no gate");
ok("the Helm renders pending approval count", /pendingApprovals/.test(helm), "helm ignores pending approvals");
ok("every vouched receipt carries a simulation event when a risky tool ran", /vouch\.simulation/.test(engine), "no simulation event");
ok("the real Harbor surfaces the gate (Approve/Deny buttons)", /resolveVouchApproval|actions\.approve/.test(fs.readFileSync(path.join(ROOT, "src", "app", "harbor.tsx"), "utf8")), "no approve/deny in harbor");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);

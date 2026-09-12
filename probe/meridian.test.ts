/**
 * Patina (17.1) — governance-meridian probe.
 *
 * Replaces the legacy Inspector-on-selection probe (Canvas-era). In Patina,
 * the "meridian" invariant is that Harbor Master tabs govern the ship and
 * the four unique differentiator surfaces (Sweep / Backtest / Lineage /
 * Hindsight) all mount real actions through the harbor bridge.
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
const master = fs.readFileSync(path.join(ROOT, "src", "views", "HarborMaster.tsx"), "utf8");
const register = fs.readFileSync(path.join(ROOT, "src", "views", "Register.tsx"), "utf8");

ok("Harbor Master has the Sweep tab (Ghost Agent Sweep)", /'Sweep'/.test(master) && /Ghost Agent Sweep/.test(master), "missing sweep");
ok("Harbor Master has the Backtest tab (Drill + Replay)", /'Backtest'/.test(master) && /Drill/.test(master) && /runDrill/.test(master), "missing backtest");
ok("Harbor Master has the Lineage tab (Delegation Chain)", /'Lineage'/.test(master) && /Delegation Chain/.test(master), "missing lineage");
ok("Register has the Hindsight Ledger", /Hindsight Ledger/.test(register), "missing hindsight");
ok("Sweep actually runs when invoked", /runSweep|onClick=\{runSweep\}/.test(master), "sweep button inert");
ok("Backtest actually invokes runDrill", /runDrill\(/.test(master), "drill button inert");
ok("Windward allows adding a provider through the bridge", /actions\.addProvider|addProvider/.test(master), "add provider not wired");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);

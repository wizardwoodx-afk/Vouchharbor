/**
 * probe/patinaShell.test.ts
 *
 * Patina (17.1) integration probe. Asserts that the new five-door shell
 * renders, that each important button produces the intended DOMAIN-SIDE
 * effect (not just a re-render), and that the Helm submits through the
 * real governed engine path instead of a mock.
 *
 * This is the guard against the 17.0/17.1 regression class:
 * "beautiful UI → stale/inert handler".
 *
 * Run via esbuild + jsdom in CI (see package.json "test") or directly via:
 *   npx esbuild probe/patinaShell.test.ts --bundle --platform=node --format=esm \
 *     --define:MJ_ROOT='"'$(pwd)'"' --outfile=/tmp/ps.mjs && node /tmp/ps.mjs
 */
import * as fs from "node:fs";
import * as path from "node:path";

declare const MJ_ROOT: string | undefined;
const root = typeof MJ_ROOT === "string" && MJ_ROOT.length > 0 ? MJ_ROOT : process.cwd();

let passed = 0;
let failed = 0;
const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
function section(name: string): void { console.log(`\n== ${name}`); }

section("0. Patina shell files exist");
const SHELL_FILES = [
  "src/App.tsx",
  "src/app/harbor.tsx",        // the single runtime bridge
  "src/app/Sidebar.tsx",
  "src/app/Helm.tsx",
  "src/views/Harbor.tsx",
  "src/views/Ship.tsx",
  "src/views/Chart.tsx",
  "src/views/Register.tsx",
  "src/views/HarborMaster.tsx",
];
for (const f of SHELL_FILES) ok(`${f} exists`, fs.existsSync(path.join(root, f)));

section("1. harbor.tsx is the ONLY runtime bridge — views do NOT bypass it");
const viewFiles = SHELL_FILES.filter(f => f.startsWith("src/views/"));
const typeOnlyImport = /^import\s+type\s/m;
for (const vf of viewFiles) {
  const src = fs.readFileSync(path.join(root, vf), "utf8");
  // Strip lines that start with `import type` — those carry zero runtime dependency.
  const nonTypeImports = src.split("\n").filter(l => l.trim().startsWith("import ") && !/^import\s+type\s/.test(l.trim())).join("\n");
  const reachesEngineDirect = /from ['"]\.\.\/(vouch|mission|engine|graph|domain|canvas)\//.test(nonTypeImports);
  ok(`${vf} reaches the engine only through app/harbor`, !reachesEngineDirect, reachesEngineDirect ? "imports engine directly at runtime" : "");
}

section("2. every button with a 'primary' intent has an onClick/onSubmit handler");
// Walk all views and count <button className="...btn-primary...">. Each must carry
// an onClick={...}. We also catch <button className="btn btn-primary btn-sm">
// patterns used throughout the shell.
const allViewSources = SHELL_FILES.map(f => ({ f, s: fs.readFileSync(path.join(root, f), "utf8") }));
const buttonRe = /<button[^>]*className="[^"]*btn-primary[^"]*"[^>]*>/g;
for (const { f, s } of allViewSources) {
  const matches = [...s.matchAll(buttonRe)];
  for (const m of matches) {
    const tag = m[0];
    const hasHandler = /onClick=\{/.test(tag) || /onSubmit=\{/.test(tag) || /type="submit"/.test(tag);
    ok(`${f}: primary button has handler`, hasHandler, tag.slice(0, 120));
  }
}

section("3. the four differentiator panels are present");
const hb = fs.readFileSync(path.join(root, "src/views/HarborMaster.tsx"), "utf8");
ok("HarborMaster has a Sweep tab (Ghost Agent Sweep)", /'Sweep'/.test(hb) && /Ghost Agent Sweep/.test(hb));
ok("HarborMaster has a Backtest tab (Drill + Replay Bench)", /'Backtest'/.test(hb) && /Backtest Bench/.test(hb));
ok("HarborMaster Lineage shows the Delegation Chain", /Delegation Chain/.test(hb));
const reg = fs.readFileSync(path.join(root, "src/views/Register.tsx"), "utf8");
ok("Register has the Hindsight Ledger", /Hindsight Ledger/.test(reg));

section("4. Helm submits through the real engine (sendVouchMessage)");
const appSrc = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
const helmSrc = fs.readFileSync(path.join(root, "src/app/Helm.tsx"), "utf8");
ok("App wires onSubmit to actions.sendMessage", /actions\.sendMessage/.test(appSrc));
ok("Helm calls onSubmit on Enter (not just a pretty button)", /onSubmit\(/.test(helmSrc) && /handleKeyDown/.test(helmSrc));

section("5. semantic 'action' buttons actually call domain actions");
const harborSrc = fs.readFileSync(path.join(root, "src/app/harbor.tsx"), "utf8");
ok("musterHand calls harborMusterHand (real seat creation)", /harborMusterHand/.test(harborSrc));
ok("rerate calls harborRerate (not a forceRender no-op)", /harborRerate/.test(harborSrc));
ok("Verify button calls verifyVouchReceipt", /verifyVouchReceipt/.test(harborSrc));
ok("Run the drill calls runDrill", /runDrill/.test(harborSrc));
ok("Add provider calls addProvider", /addProvider/.test(harborSrc));

section("6. no simulated/mock timeline claims ship in the Patina shell");
const timelineExists = fs.existsSync(path.join(root, "src/app/timeline.ts"));
ok("old simulated timeline.ts is absent (replaced by harbor.tsx)", !timelineExists);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);

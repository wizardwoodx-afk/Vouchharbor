import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/patinaShell.test.ts
import * as fs from "node:fs";
import * as path from "node:path";
var root = ".".length > 0 ? "." : process.cwd();
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
function section(name) {
  console.log(`
== ${name}`);
}
section("0. Patina shell files exist");
var SHELL_FILES = [
  "src/App.tsx",
  "src/app/harbor.tsx",
  // the single runtime bridge
  "src/app/Sidebar.tsx",
  "src/app/Helm.tsx",
  "src/views/Harbor.tsx",
  "src/views/Ship.tsx",
  "src/views/Chart.tsx",
  "src/views/Register.tsx",
  "src/views/HarborMaster.tsx"
];
for (const f of SHELL_FILES) ok(`${f} exists`, fs.existsSync(path.join(root, f)));
section("1. harbor.tsx is the ONLY runtime bridge \u2014 views do NOT bypass it");
var viewFiles = SHELL_FILES.filter((f) => f.startsWith("src/views/"));
for (const vf of viewFiles) {
  const src = fs.readFileSync(path.join(root, vf), "utf8");
  const nonTypeImports = src.split("\n").filter((l) => l.trim().startsWith("import ") && !/^import\s+type\s/.test(l.trim())).join("\n");
  const reachesEngineDirect = /from ['"]\.\.\/(vouch|mission|engine|graph|domain|canvas)\//.test(nonTypeImports);
  ok(`${vf} reaches the engine only through app/harbor`, !reachesEngineDirect, reachesEngineDirect ? "imports engine directly at runtime" : "");
}
section("2. every button with a 'primary' intent has an onClick/onSubmit handler");
var allViewSources = SHELL_FILES.map((f) => ({ f, s: fs.readFileSync(path.join(root, f), "utf8") }));
var buttonRe = /<button[^>]*className="[^"]*btn-primary[^"]*"[^>]*>/g;
for (const { f, s } of allViewSources) {
  const matches = [...s.matchAll(buttonRe)];
  for (const m of matches) {
    const tag = m[0];
    const hasHandler = /onClick=\{/.test(tag) || /onSubmit=\{/.test(tag) || /type="submit"/.test(tag);
    ok(`${f}: primary button has handler`, hasHandler, tag.slice(0, 120));
  }
}
section("3. the four differentiator panels are present");
var hb = fs.readFileSync(path.join(root, "src/views/HarborMaster.tsx"), "utf8");
ok("HarborMaster has a Sweep tab (Ghost Agent Sweep)", /'Sweep'/.test(hb) && /Ghost Agent Sweep/.test(hb));
ok("HarborMaster has a Backtest tab (Drill + Replay Bench)", /'Backtest'/.test(hb) && /Backtest Bench/.test(hb));
ok("HarborMaster Lineage shows the Delegation Chain", /Delegation Chain/.test(hb));
var reg = fs.readFileSync(path.join(root, "src/views/Register.tsx"), "utf8");
ok("Register has the Hindsight Ledger", /Hindsight Ledger/.test(reg));
section("4. the console submits through the real engine (askVH19) \u2014 19.6.6 redesign");
var appSrc = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
var consoleSrc = fs.readFileSync(path.join(root, "src/views/NextConsole.tsx"), "utf8");
ok("App mounts the Federation Console as the whole shell", /<NextConsole\s*\/>/.test(appSrc));
ok("the console sends through askVH19 on Enter (not just a pretty input)", /import\s*\{\s*askVH19\s*\}/.test(consoleSrc) && /if \(e\.key === "Enter"\) void send\(\)/.test(consoleSrc));
section("5. semantic 'action' buttons actually call domain actions");
var harborSrc = fs.readFileSync(path.join(root, "src/app/harbor.tsx"), "utf8");
ok("musterHand calls harborMusterHand (real seat creation)", /harborMusterHand/.test(harborSrc));
ok("rerate calls harborRerate (not a forceRender no-op)", /harborRerate/.test(harborSrc));
ok("Verify button calls verifyVouchReceipt", /verifyVouchReceipt/.test(harborSrc));
ok("Run the drill calls runDrill", /runDrill/.test(harborSrc));
ok("Add provider calls addProvider", /addProvider/.test(harborSrc));
section("6. no simulated/mock timeline claims ship in the Patina shell");
var timelineExists = fs.existsSync(path.join(root, "src/app/timeline.ts"));
ok("old simulated timeline.ts is absent (replaced by harbor.tsx)", !timelineExists);
console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);

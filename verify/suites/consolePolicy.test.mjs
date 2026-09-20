import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/consolePolicy.test.ts
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
var read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
var consoleSrc = read("src/views/NextConsole.tsx");
var css = read("src/styles/vh-next.css");
var main = read("src/main.tsx");
var skills = read("src/vh19/skills.ts");
var loop = read("src/vh19/agentLoop.ts");
console.log("== the final-product policy ==");
ok("the console never imports the version \u2014 no numbers in the app", !consoleSrc.includes('from "../version"') && !consoleSrc.includes("VH_VERSION"), "a version surface leaked into the UI");
ok("no nx-ver chip renders", !consoleSrc.includes("nx-ver"));
var rendered = consoleSrc.replace(/GeneralistFace|GeneralistMood|GeneralistResponse|generalistName|setGeneralistName|from "\.\.\/vh19\/generalist"/g, "");
ok("no rendered string says Generalist \u2014 the agent is the Steward", !rendered.includes("Generalist"));
ok("the Steward rename is real (the rail label)", consoleSrc.includes("Rename Steward"));
ok("no demo/simulated wording in the console", !consoleSrc.includes("labelled demo") && !consoleSrc.includes("demo mission") && !/simulat/i.test(consoleSrc));
console.log("== the theme system ==");
ok("the cream-gray theme ships as full token overrides", css.includes('[data-theme="cream"]') && css.includes("--color-nx-bg: #f1efe9"));
ok("the theme applies before first paint", main.includes("vh.ui.theme.v1") && main.includes('dataset.theme = "cream"'));
ok("Settings carries the switch", consoleSrc.includes('"noir" | "cream"') && consoleSrc.includes('setTheme("cream")'));
console.log("== provider semantics are exact ==");
ok("session-only REMOVES storage (never seals)", /const saveProviderSession[\s\S]*?vaultRemove\(PROVIDER_STORAGE_KEY\)/.test(consoleSrc));
ok("session-only never calls vaultSeal", !/saveProviderSession[\s\S]{0,600}vaultSeal/.test(consoleSrc.split("const saveProviderPersist")[0] ?? ""));
ok("remember-on-this-machine REQUIRES an unlocked vault", /const saveProviderPersist[\s\S]*?vaultStatus\(\)\.status !== "unlocked"/.test(consoleSrc));
ok("the two buttons wire to the two paths", consoleSrc.includes("onClick={saveProviderPersist}") && consoleSrc.includes("onClick={saveProviderSession}"));
console.log("== the fleet's maturity contract ==");
ok("the operator doctrine exists and leads with verify-before-claim", skills.includes("Operator doctrine") && skills.includes("Verify before you claim"));
ok("EVERY specialist's composed prompt carries the doctrine", /buildSpecialistPrompt[\s\S]*OPERATOR_DOCTRINE/.test(skills));
ok("all five rules ship", ["Evidence over prose", "Fail forward", "Self-review before answering", "Stay in scope"].every((r) => skills.includes(r)));
ok("members get five real steps", loop.includes("MAX_AGENT_STEPS = 5"));
console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);

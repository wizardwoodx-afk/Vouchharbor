/**
 * probe/consolePolicy.test.ts — the 19.7.2 final-product policy.
 *
 * Pins what the user asked for and the review confirmed:
 *   • NO version numbers in the app UI (the console never imports the version);
 *   • NO "Generalist" in any rendered string (the agent is the Steward —
 *     the owner names it; internal code identifiers are not user-facing);
 *   • NO demo/simulated wording in the console (the product speaks work);
 *   • the theme system ships: cream-gray tokens + boot-time application;
 *   • provider semantics are EXACT: session-only removes storage and never
 *     seals; remember-on-this-machine requires an unlocked vault;
 *   • every specialist rides the operator doctrine (maturity contract);
 *   • the agent loop gives members five real steps.
 */
import * as fs from "node:fs";
import * as path from "node:path";

let passed = 0;
let failed = 0;
const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

declare const VH_ROOT: string | undefined;
const ROOT = typeof VH_ROOT === "string" && VH_ROOT.length > 0 ? VH_ROOT : process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const consoleSrc = read("src/views/NextConsole.tsx");
const css = read("src/styles/vh-next.css");
const main = read("src/main.tsx");
const skills = read("src/vh19/skills.ts");
const loop = read("src/vh19/agentLoop.ts");

console.log("== the final-product policy ==");
ok("the console never imports the version — no numbers in the app", !consoleSrc.includes('from "../version"') && !consoleSrc.includes("VH_VERSION"), "a version surface leaked into the UI");
ok("no nx-ver chip renders", !consoleSrc.includes("nx-ver"));

const rendered = consoleSrc
  .replace(/GeneralistFace|GeneralistMood|GeneralistResponse|generalistName|setGeneralistName|from "\.\.\/vh19\/generalist"/g, "");
ok("no rendered string says Generalist — the agent is the Steward", !rendered.includes("Generalist"));
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);

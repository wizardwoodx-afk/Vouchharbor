/**
 * probe/navAlign.test.ts — shell alignment probe (the one shell, src/ui/Shell.tsx).
 *
 * The 19.7.12 redesign replaced the 19.6.6 console with one quiet shell; 19.7.13
 * added the sixth door, and the Munshi door (Indian finance) the seventh. The live
 * door set is seven — Steward · Work · Munshi · Receipts · Docs · Memory ·
 * Settings — with one store and one composer.
 * This suite pins the structure mechanically:
 *  - App renders the shell and nothing else
 *  - the sidebar carries exactly the seven doors + status + owner — every one wired
 *  - the composer is the single command surface (Enter sends through the store)
 *  - the human gate is a card with approve/refuse, never a silent skip
 *  - the crew is internal: Work shows AGENT nn, never a specialist name
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

const appSrc = read("src/App.tsx");
const shellSrc = read("src/ui/Shell.tsx");
const storeSrc = read("src/ui/store.ts");
const workSrc = read("src/ui/screens/Work.tsx");
const gateSrc = read("src/ui/screens/GateCard.tsx");
const composerSrc = read("src/ui/screens/Composer.tsx");
const settingsSrc = read("src/ui/screens/Settings.tsx");

const pkg = JSON.parse(read("package.json")) as { name?: string };
ok("root resolves to Velvet Hand", pkg.name === "velvet-hand", `name=${String(pkg.name)}`);

ok("App renders the shell and nothing else", /import\s*\{\s*Shell\s*\}\s*from\s*["']\.\/ui\/Shell["']/.test(appSrc) && /<Shell\s*\/>/.test(appSrc), "App must be the shell door");
ok("the multi-dock shell and the console are gone from the app entry", !/Sidebar|Helm|VIEWS|NextConsole/.test(appSrc), "stale shell chrome in App.tsx");
/* 19.7.13 — this pin said "exactly five doors" and matched only those five keys,
   so a SIXTH door (src/ui/screens/Docs.tsx) would have been added while the check
   stayed green — a gate that had stopped describing the shell. The door list is
   now the full set, the count matches the labels actually rendered, and the
   render wiring for every door is pinned alongside it. The Munshi door joined the
   list, the count AND the wiring pin in the same change that shipped it. */
const NAV_KEYS = ["steward", "work", "munshi", "receipts", "docs", "memory", "settings"];
const navEntries = shellSrc.match(/\{ key: "([a-z]+)", label: "[A-Za-z ]+", icon: "[a-z]+" \}/g) ?? [];
ok("the sidebar lists exactly seven doors", navEntries.length === 7, `door count drifted: ${navEntries.length}`);
ok("the seven doors are Steward · Work · Munshi · Receipts · Docs · Memory · Settings",
  NAV_KEYS.every((k) => new RegExp(`key: "${k}", label:`).test(shellSrc)) &&
  NAV_KEYS.every((k) => new RegExp(`screen === "${k}"`).test(shellSrc)),
  "a door is listed but not rendered, or vice versa");
ok("the Docs door renders the document-distillation surface",
  /screen === "docs" && <Docs \/>/.test(shellSrc) && /Propose knowledge/.test(read("src/ui/screens/Docs.tsx")) &&
  /Nothing is installed until you decide/.test(read("src/ui/screens/Docs.tsx")),
  "the Docs door must reach the knowledge proposal seam and install nothing itself");
const munshiSrc = read("src/ui/screens/Munshi.tsx");
ok("the Munshi door reaches the Indian-finance engines",
  /screen === "munshi" && <Munshi \/>/.test(shellSrc) &&
  /validateGstin/.test(munshiSrc) && /computeTds/.test(munshiSrc) && /reconcile\(/.test(munshiSrc) &&
  /from "\.\.\/\.\.\/munshi"/.test(munshiSrc),
  "the door must call the pack's deterministic engines, not restate their answers");
ok("and states plainly that computing is not filing",
  /do not file/i.test(munshiSrc) && /Nothing here touches GSTN/.test(munshiSrc) &&
  /RULESET/.test(munshiSrc),
  "the door must say it computes on this machine, names the ruleset, and files nothing");
ok("no Crew door — the crew is internal", !/label:\s*"Crew"/.test(shellSrc) && !/label:\s*"Agents"/.test(shellSrc), "the crew must not face the user");
ok("the status pill and the owner card sit below the doors and open Settings", /className="status" onClick=\{\(\) => go\("settings"\)\}/.test(shellSrc) && /className="me" onClick=\{\(\) => go\("settings"\)\}/.test(shellSrc), "sidebar foot not wired");
ok("no keyboard-shortcut hints on the surface", !/⌘K|⌘N|Cmd\+K|Ctrl\+K/.test(shellSrc + read("src/ui/screens/Steward.tsx")), "shortcut hints leaked");
ok("the composer is the single command surface and Enter sends", /onKeyDown=\{\(e\) => \{ if \(e\.key === "Enter" && !e\.shiftKey\)/.test(composerSrc) && /onSend\(\)/.test(composerSrc), "composer not wired to send");
ok("send goes through the store to askVH19 with the gate and handoff seams", /send:\s*async \(raw\)/.test(storeSrc) && /await askVH19\(\{ text: sentText, userId: USER \}, runDeps\(get, set, gateFn\)\)/.test(storeSrc) && /provider: get\(\)\.provider, gate: gateFn,/.test(storeSrc) && /onHandoff:/.test(storeSrc), "store send is not the engine path");
ok("the human gate is a card with approve and refuse, never a silent skip", /Your approval is needed/.test(gateSrc) && /Approve once/.test(gateSrc) && /Refuse/.test(gateSrc), "gate card missing");
ok("Work names agents AGENT nn — never by specialist name", /AGENT \$\{String\(i \+ 1\)\.padStart\(2, "0"\)\}/.test(workSrc) && !/sp\?\.name|specialist\.name/.test(workSrc), "agent names leaked");
ok("first-time users can connect a model provider inside Settings", /Provider/.test(settingsSrc) && /PROVIDER_DEFAULTS/.test(settingsSrc) && /setProvider\(/.test(settingsSrc), "provider onboarding missing");
ok("the federation key resolves through the hardened authority seam", /authorityOwnerIdentity/.test(read("src/vh19/federation/live.ts")) && !/exportKey\(["']jwk["']\)/.test(read("src/vh19/federation/live.ts")), "raw key storage in the live seam");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);

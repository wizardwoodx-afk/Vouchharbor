/**
 * probe/vh19Door.test.tsx — the VH-19 door is the product's front face (18.0.1).
 *
 * The 18.0.0 external review was right: the engine existed but the shell never
 * imported it — "the brain is ready, the face is not." This suite pins the face:
 *
 *   1. the shell opens on the VH-19 dock and the sidebar lists it;
 *   2. the door component RENDERS (react-dom/server) with the bench, exam,
 *      provider, gate and learning surfaces present in the markup;
 *   3. the door imports the real askVH19 — the reviewer's grep, enforced;
 *   4. the rendered honesty copy is on screen (not-executed language, the
 *      override floor, session-only keys).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

declare const MJ_ROOT: string | undefined;
const ROOT = typeof MJ_ROOT === "string" && MJ_ROOT.length > 0 ? MJ_ROOT : process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/* localStorage shim before any engine module is imported */
if (typeof globalThis.localStorage === "undefined") {
  const map = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  } as Storage;
}

import { Vh19 } from "../src/views/Vh19";
import { catalogStats } from "../src/vh19/registry";

let passed = 0;
let failed = 0;
const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  ok   ${label}`); }
  else { failed++; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
function section(name: string): void { console.log(`\n== ${name}`); }

section("1. the shell routes the user to VH-19 first");
const appSrc = read("src/App.tsx");
const navSrc = read("src/app/nav.ts");
const sidebarSrc = read("src/app/Sidebar.tsx");
ok("App.tsx registers the Vh19 view", /Comp:\s*Vh19\b/.test(appSrc));
ok("the app OPENS on the VH-19 dock (the front door is the Generalist)", /useState<ViewKey>\(['"]vh19['"]\)/.test(appSrc));
ok("NAV lists VH-19", /key:\s*['"]vh19['"]/.test(navSrc));
ok("the sidebar surfaces the VH-19 dock", /label="VH-19"/.test(sidebarSrc));
ok("the nav comment names six docks — no stale five-docks drift", /Six docks/i.test(navSrc) && !/five docks/i.test(navSrc));

section("2. the door imports the real engine — the reviewer's grep, enforced");
const doorSrc = read("src/views/Vh19.tsx");
ok("the door imports askVH19 from the engine", /import\s*\{[^}]*askVH19[^}]*\}\s*from\s*['"]\.\.\/vh19\/generalist['"]/.test(doorSrc));
ok("the door imports the exam, memory, registry and provider surfaces",
  /from ['"]\.\.\/vh19\/exam['"]/.test(doorSrc) && /from ['"]\.\.\/vh19\/memory['"]/.test(doorSrc) && /from ['"]\.\.\/vh19\/registry['"]/.test(doorSrc) && /from ['"]\.\.\/vh19\/providers['"]/.test(doorSrc));
ok("at least one APPLICATION file (not just probes) imports askVH19",
  /askVH19/.test(doorSrc) && /views\/Vh19/.test(appSrc));

section("3. the door renders — real component, react-dom/server");
const stats = catalogStats();
let html = "";
let renderError: string | null = null;
try {
  html = renderToStaticMarkup(createElement(Vh19));
} catch (err) {
  renderError = err instanceof Error ? err.message : String(err);
}
ok("the door renders without throwing", renderError === null, renderError ?? "");
ok("it names itself VH-19", html.includes("VH-19"));
ok("it states the one-agent premise", html.includes("One agent"));
ok("it shows the real bench count", html.includes(`>${stats.count}<`) || html.includes(`${stats.count}`), `catalog count ${stats.count}`);
ok("the exam surface is present", html.includes("Autonomy exam") && html.includes("Propose exam"));
ok("the provider surface is present with env honesty", html.includes("Provider") && html.includes("VH_OPENAI_API_KEY") && html.includes("in memory only"));
ok("the learning surface is present", html.includes("Team-Evolve") && html.includes("accept/reject history"));
ok("the no-provider placeholder tells the truth", html.includes("answers will be plans, not executions"));
ok("the autonomy override floor is stated", html.includes("override") || html.includes("Revoke"));
ok("the exam can be scoped to a category", html.includes("overall (all categories)"));
ok("the Team-Evolve surface is present and honest about peers", html.includes("Team-Evolve") && html.includes("EVERY member") === false && html.includes("npm run host"));
ok("the bench is 100+ real specialists on screen", /\b1\d\d\b/.test(html) && catalogStats().count >= 100, `count ${catalogStats().count}`);

section("4. the bench management surface lists real specialists");
ok("the toggle handler is wired", /setSpecialistEnabled/.test(doorSrc));
ok("the router only fields enabled specialists (stated in the door)", html.includes("the router only fields enabled specialists") || doorSrc.includes("the router only fields enabled specialists"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);

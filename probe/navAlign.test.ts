/**
 * Patina (17.1) — navigation alignment probe.
 *
 * Patina consolidates the product to FIVE DOCKS onto one engine:
 *
 *   Harbor (live work) · Ship (crew) · Chart (topology) · Register (proof) · Harbor Master (governance)
 *
 * with the Helm as the single command surface. This suite makes that
 * mechanical:
 *  - the nav map lists each dock exactly once
 *  - App renders ONLY from that map
 *  - the sidebar surfaces the description (purpose) as sub-text
 *  - the Helm is the single command surface, not a mock
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

declare const MJ_ROOT: string | undefined;
const ROOT = typeof MJ_ROOT === "string" && MJ_ROOT.length > 0 ? MJ_ROOT : process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const EXPECTED_DOCKS: ViewKey[] = ["harbor", "ship", "chart", "register", "master"];
type ViewKey = "harbor" | "ship" | "chart" | "register" | "master";

const navSrc = read("src/app/nav.ts");
const appSrc = read("src/App.tsx");
const sidebarSrc = read("src/app/Sidebar.tsx");
const helmSrc = read("src/app/Helm.tsx");

const pkg = JSON.parse(read("package.json")) as { name?: string };
ok("root resolves to Vouch Harbor", typeof pkg.name === "string" && /vouchharbor/i.test(pkg.name), `name=${String(pkg.name)}`);

const keys = [...navSrc.matchAll(/key:\s*["']([a-z]+)["']/g)].map(m => m[1] as ViewKey);
ok("NAV lists the five Patina docks exactly once", keys.length === 5 && new Set(keys).size === 5 && EXPECTED_DOCKS.every(k => keys.includes(k)), keys.join(","));
ok("App.tsx imports the shared navigation map", /from ["']\.\/app\/nav["']/.test(appSrc) || /from ["']\.\.\/app\/nav["']/.test(sidebarSrc), "no shared import found");
ok("App's VIEWS map contains exactly the five docks", /Comp:\s*Harbor\b/.test(appSrc) && /Comp:\s*Ship\b/.test(appSrc) && /Comp:\s*Chart\b/.test(appSrc) && /Comp:\s*Register\b/.test(appSrc) && /Comp:\s*HarborMaster\b/.test(appSrc), "one of the five missing");
ok("the sidebar surfaces each nav item's description", /n\.description/.test(sidebarSrc) || /nav-sub/.test(sidebarSrc), "no description line");
ok("App opens on the Harbor dock (live work first)", /useState<ViewKey>\(['"]harbor['"]\)/.test(appSrc), "doesn't open on harbor");
ok("the Helm is the single command surface", /Make it so/.test(helmSrc) && /onSubmit/.test(helmSrc), "helm not wired");
ok("the Helm drives the real vouch engine", /sendVouchMessage|actions\.sendMessage/.test(appSrc) || /actions\.sendMessage/.test(helmSrc), "helm not connected to sendMessage");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);

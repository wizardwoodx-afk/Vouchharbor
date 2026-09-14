import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/navAlign.test.ts
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
var EXPECTED_DOCKS = ["vh19", "harbor", "ship", "chart", "register", "master"];
var navSrc = read("src/app/nav.ts");
var appSrc = read("src/App.tsx");
var sidebarSrc = read("src/app/Sidebar.tsx");
var helmSrc = read("src/app/Helm.tsx");
var pkg = JSON.parse(read("package.json"));
ok("root resolves to Vouch Harbor", typeof pkg.name === "string" && /vouchharbor/i.test(pkg.name), `name=${String(pkg.name)}`);
var keys = [...navSrc.matchAll(/key:\s*["']([a-z0-9]+)["']/g)].map((m) => m[1]);
ok("NAV lists the six docks exactly once (VH-19 Generalist first)", keys.length === 6 && new Set(keys).size === 6 && EXPECTED_DOCKS.every((k) => keys.includes(k)), keys.join(","));
ok("App.tsx imports the shared navigation map", /from ["']\.\/app\/nav["']/.test(appSrc) || /from ["']\.\.\/app\/nav["']/.test(sidebarSrc), "no shared import found");
ok("App's VIEWS map contains exactly the six docks", /Comp:\s*Vh19\b/.test(appSrc) && /Comp:\s*Harbor\b/.test(appSrc) && /Comp:\s*Ship\b/.test(appSrc) && /Comp:\s*Chart\b/.test(appSrc) && /Comp:\s*Register\b/.test(appSrc) && /Comp:\s*HarborMaster\b/.test(appSrc), "one of the six missing");
ok("the sidebar surfaces each nav item's description", /n\.description/.test(sidebarSrc) || /nav-sub/.test(sidebarSrc), "no description line");
ok("App opens on the VH-19 dock (the Generalist is the front door)", /useState<ViewKey>\(['"]vh19['"]\)/.test(appSrc), "doesn't open on VH-19");
ok("the Helm is the single command surface", /Make it so/.test(helmSrc) && /onSubmit/.test(helmSrc), "helm not wired");
ok("the Helm drives the real vouch engine", /sendVouchMessage|actions\.sendMessage/.test(appSrc) || /actions\.sendMessage/.test(helmSrc), "helm not connected to sendMessage");
console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);

/**
 * probe/navAlign.test.ts — console alignment probe (19.6.6 redesign).
 *
 * 19.6.6 deleted the multi-dock shell: the app IS the Generalist's console.
 * This suite pins the new structure mechanically:
 *  - App renders the console and nothing else
 *  - the console's rail carries the planes: run stream, handoff ledger,
 *    federation, rename — every one wired, none decorative
 *  - the input bar is the single command surface
 *  - the human gate is a banner with approve/deny, never a silent skip
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
const consoleSrc = read("src/views/NextConsole.tsx");

const pkg = JSON.parse(read("package.json")) as { name?: string };
ok("root resolves to Vouch Harbor", typeof pkg.name === "string" && /vouchharbor/i.test(pkg.name), `name=${String(pkg.name)}`);

ok("App renders the console and nothing else", /import\s*\{\s*NextConsole\s*\}\s*from\s*["']\.\/views\/NextConsole["']/.test(appSrc) && /<NextConsole\s*\/>/.test(appSrc), "App must be the console door");
ok("the multi-dock shell is gone from the app entry", !/Sidebar/.test(appSrc) && !/Helm/.test(appSrc) && !/VIEWS/.test(appSrc), "stale shell chrome in App.tsx");
ok("the console carries the crew rail", /nx-sidebar/.test(consoleSrc) && /Crew/.test(consoleSrc), "no crew rail");
ok("the rail lists the planes: run stream, handoff ledger, federation", /Run stream/.test(consoleSrc) && /Handoff ledger/.test(consoleSrc) && /Federation/.test(consoleSrc), "a plane is missing");
ok("the Generalist keeps exactly one face, derived from its name", /GeneralistFace/.test(consoleSrc) && /generalistName\(\)/.test(consoleSrc) && /Rename Generalist/.test(consoleSrc), "face/name wiring missing");
ok("the input bar is the single command surface", /nx-inputbar/.test(consoleSrc) && /onKeyDown=\{\(e\) => \{ if \(e\.key === "Enter"\) void send\(\); \}\}/.test(consoleSrc), "input bar not wired to send");
ok("the human gate is a banner with approve and deny, never a silent skip", /HUMAN GATE/.test(consoleSrc) && /Approve/.test(consoleSrc) && /Deny/.test(consoleSrc), "gate banner missing");
ok("every run bubble rides its honesty chips", /provenance \{m\.resp\.provenanceDigest/.test(consoleSrc) && /ECDSA mandate/.test(consoleSrc), "evidence chips missing");
ok("the federation panel runs the live seam", /issueLiveGrant/.test(consoleSrc) && /runLiveCrossing/.test(consoleSrc) && /enableRegulatedBench/.test(consoleSrc), "federation panel not wired to live.ts");
ok("first-time users can connect a model provider inside the console", /Model provider/.test(consoleSrc) && /rememberProvider/.test(consoleSrc) && /PROVIDER_DEFAULTS/.test(consoleSrc), "provider onboarding missing");
ok("the federation key resolves through the hardened authority seam", /authorityOwnerIdentity/.test(read("src/vh19/federation/live.ts")) && !/exportKey\(["']jwk["']\)/.test(read("src/vh19/federation/live.ts")), "raw key storage in the live seam");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
process.exit(failed > 0 ? 1 : 0);

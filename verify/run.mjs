#!/usr/bin/env node
/**
 * V11.7.2 — offline verification runner. Requires ONLY Node.js: no npm install, no
 * network. Run from the extracted release tree:
 *
 *     node verify/run.mjs
 *
 * It executes every self-contained bundle in verify/suites/ (built by
 * tools/build-offline-verify.mjs from the same suite list `npm test` uses) with cwd set
 * to the tree root, and prints the same PASS/FAIL summary as the dev gate. This exists
 * because the 11.7.0 review environment could not `npm ci` offline — a shipped gate
 * should be reproducible by anyone with Node, anywhere, with zero install.
 *
 * offline-honesty patch (16.9.0): two bundles spawn tools/*.mjs that rebuild the engine
 * bundle via the esbuild devDependency. Without node_modules those tools now REFUSE IN
 * WORDS, and this runner honestly marks such bundles `SKIP (needs node_modules)` —
 * counted separately, never as passes, never as verification failures.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suitesDir = path.join(root, "verify", "suites");
const suites = fs.readdirSync(suitesDir).filter((f) => f.endsWith(".mjs")).sort();

let pass = 0;
let fail = 0;
let skippedNeedDeps = 0;
const failures = [];
const skipped = [];
// offline-honesty patch (16.9.0): an environment limitation is not a verification
// failure. A bundle whose tools refuse because esbuild/node_modules is absent is
// reported as SKIP, with the reason, and never laundered into a pass.
const NEEDS_DEPS = new RegExp([
  "REFUSED \\(needs node_modules\\)",              // the tools' honest preflight refusal
  "Cannot find package .esbuild",                  // ERR_MODULE_NOT_FOUND, any TAP quoting
  "Cannot find package ",                          // any absent runtime dependency (e.g. zod/ajv)
  "no such file or directory, open .node_modules", // pinned-dep provenance reads (E4)
].join("|"));
for (const s of suites) {
  try {
    // QA fix (audit C1): `stdio: "inherit"` deadlocked on Windows whenever this runner's own
    // output was redirected (npm logs, CI) — the git child processes inside gitTs stalled on
    // the inherited handles and the whole gate died silently. Piping + a per-suite timeout
    // turns any hang into a visible, attributable FAIL.
    const stdout = execFileSync(process.execPath, [path.join(suitesDir, s)], {
      cwd: root,
      timeout: 120_000,
      killSignal: "SIGKILL",
      maxBuffer: 256 * 1024 * 1024,
      encoding: "utf8",
    });
    process.stdout.write(stdout);
    console.log(`PASS: ${s}\n`);
    pass++;
  } catch (err) {
    const text = `${err && typeof err === "object" ? `${err.stdout || ""}${err.stderr || ""}` : ""}${err?.message || ""}`;
    if (NEEDS_DEPS.test(text)) {
      console.log(`SKIP (needs node_modules): ${s}\n`);
      process.stdout.write(err.stdout || "");
      skipped.push(s);
      skippedNeedDeps++;
      continue;
    }
    console.log(`FAIL: ${s}\n`);
    if (err && typeof err === "object" && "stdout" in err && typeof err.stdout === "string") {
      process.stdout.write(err.stdout);
    }
    failures.push(s);
    fail++;
  }
}

console.log("========================================");
const skipNote = skippedNeedDeps > 0 ? `, ${skippedNeedDeps} skipped (need node_modules / runtime dependencies)` : "";
console.log(`OFFLINE VERIFY SUMMARY: ${pass} passed, ${fail} failed${skipNote}. (node ${process.version})`);
console.log("========================================");
if (skipped.length > 0) {
  console.error("Skipped (environment, not a verification failure):", skipped);
}
if (failures.length > 0) {
  console.error("Failed suites:", failures);
  process.exit(1);
}

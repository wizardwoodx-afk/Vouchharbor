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
  "no such file or directory, open .node_modules", // pinned-dep provenance reads (E4)
].join("|"));
// Performance (18.7.0): the sequential pass took ~2.5 min, which exceeded the
// 18.6.0 reviewer's execution window before the pack finished. Suites are
// independent, so they run in a bounded pool; output is buffered per suite and
// printed in deterministic sort order, so a PASS/FAIL is always attributable
// and two runs of the same tree print the same transcript.
const { execFile } = await import("node:child_process");
const os = await import("node:os");
const POOL = Math.max(2, Math.min(6, os.cpus().length));
const results = new Map();

async function runSuite(s) {
  try {
    const stdout = await new Promise((resolve, reject) => {
      const child = execFile(
        process.execPath,
        [path.join(suitesDir, s)],
        { cwd: root, timeout: 120_000, killSignal: "SIGKILL", maxBuffer: 256 * 1024 * 1024, encoding: "utf8" },
        (err, so) => (err ? reject(Object.assign(err, { stdout: so })) : resolve(so)),
      );
      void child;
    });
    results.set(s, { status: "pass", stdout });
  } catch (err) {
    const text = `${err && typeof err === "object" ? `${err.stdout || ""}${err.stderr || ""}` : ""}${err?.message || ""}`;
    if (NEEDS_DEPS.test(text)) results.set(s, { status: "skip", stdout: err?.stdout || "" });
    else results.set(s, { status: "fail", stdout: err && typeof err === "object" && "stdout" in err && typeof err.stdout === "string" ? err.stdout : "" });
  }
}

let cursor = 0;
await Promise.all(
  Array.from({ length: Math.min(POOL, suites.length) }, async () => {
    while (cursor < suites.length) {
      const next = suites[cursor++];
      await runSuite(next);
    }
  }),
);

for (const s of suites) {
  const res = results.get(s);
  if (res.status === "pass") {
    process.stdout.write(res.stdout);
    console.log(`PASS: ${s}\n`);
    pass++;
  } else if (res.status === "skip") {
    console.log(`SKIP (needs node_modules): ${s}\n`);
    process.stdout.write(res.stdout);
    skipped.push(s);
    skippedNeedDeps++;
  } else {
    console.log(`FAIL: ${s}\n`);
    process.stdout.write(res.stdout);
    failures.push(s);
    fail++;
  }
}

console.log("========================================");
const skipNote = skippedNeedDeps > 0 ? `, ${skippedNeedDeps} skipped (need node_modules — esbuild)` : "";
console.log(`OFFLINE VERIFY SUMMARY: ${pass} passed, ${fail} failed${skipNote}. (node ${process.version})`);
console.log("========================================");
if (skipped.length > 0) {
  console.error("Skipped (environment, not a verification failure):", skipped);
}
if (failures.length > 0) {
  console.error("Failed suites:", failures);
  process.exit(1);
}

#!/usr/bin/env node
/**
 * VOUCH HARBOR — external-model validation (16.7.0).
 *
 * The standing, honest mechanism for the review's "real external-model
 * validation": inventory the product's 25-harness registry on this host's
 * PATH, and when a real agent CLI is available, run the drill catalog with
 * that CLI as the seat (runDrill's harness seam — the loop spawns the real
 * bin). When none is available, the report says so — never a fake.
 *
 *   node tools/external-model-validation.mjs                → auto-select (first found)
 *   node tools/external-model-validation.mjs --harness claude
 *   node tools/external-model-validation.mjs --out report.json
 *
 * probe/drill.test.ts pins the CLI: report schema, honest absence on a
 * CLI-less host, registry parity, and refusal consistency.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

// offline-honesty patch (16.9.0): the engine-bundle rebuild needs the esbuild
// devDependency. Without node_modules the tool now REFUSES IN WORDS (a clean,
// greppable refusal) instead of dying with ERR_MODULE_NOT_FOUND — never faked.
const require = createRequire(import.meta.url);
let buildSync;
try {
  ({ buildSync } = require("esbuild"));
} catch {
  console.error(
    "REFUSED (needs node_modules): this tool rebuilds the engine bundle with the esbuild devDependency, which is not installed here. Run `npm ci` first, then re-run. Refused in words, never faked."
  );
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "tools", "external-model-validation.entry.ts");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-extval-"));
const out = path.join(tmp, "external-model-validation.mjs");
try {
  buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    /* 17.1.3: bundle npm deps inline so the temp bundle runs standalone
     * out of /tmp (zod etc. are not in /tmp's resolution path). */
    packages: "bundle",
    outfile: out,
    logLevel: "error",
  });
  const passArgs = process.argv.slice(2);
  let code = 0;
  const runOpts = { cwd: root, encoding: "utf8" };
  try {
    const stdout = execFileSync(process.execPath, [out, ...passArgs], runOpts);
    process.stdout.write(stdout);
  } catch (e) {
    const err = e;
    if (err.stdout) process.stdout.write(err.stdout);
    code = err.status ?? 1;
  }
  process.exit(code);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

#!/usr/bin/env node
/* runprobe.tmp.mjs — esbuild-bundle probe/<file> → probe/.<file>.mjs and run it.
   VH_ROOT define lets probes read source as text. Usage: node runprobe.tmp.mjs consolePolicy.test.ts ... */
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { mkdirSync } from "node:fs";

const files = process.argv.slice(2);
if (files.length === 0) { console.error("usage: node runprobe.tmp.mjs <probe-file> [...]"); process.exit(2); }
mkdirSync("probe/.cache", { recursive: true });
let failures = 0;
for (const f of files) {
  const out = path.join("probe", `.${f}.mjs`);
  await build({
    entryPoints: [path.join("probe", f)],
    outfile: out,
    banner: { js: 'import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);' },
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    define: { VH_ROOT: JSON.stringify(process.cwd()) },
    packages: "external",
    external: ["playwright", "esbuild"],
    logLevel: "silent",
  });
  const r = spawnSync("node", [out], { stdio: "inherit" });
  if (r.status !== 0) failures++;
}
process.exit(failures);

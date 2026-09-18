#!/usr/bin/env node
/**
 * compile-probe-twins.mjs — make the archive verifiable by a stranger.
 *
 * THE PROBLEM THIS SOLVES. The archive shipped probes as TypeScript and a runner
 * that imports them natively. Inside the host repository that works, because the
 * repo has a TS runtime. Handed to somebody else as a zip, `node
 * tools/run-all-probes.mjs` discovers six suites and loads none of them — so the
 * one number the pack leads with ("332 checks, 0 failed") is the author's recorded
 * result rather than something the recipient can reproduce. A verification claim
 * you cannot reproduce is a claim, not evidence, and this product does not get to
 * make those.
 *
 * So the probes are compiled to **CommonJS** into `dist-verify/`, which plain
 * `node` runs with no loader and no dependencies (CommonJS resolves extensionless
 * `require` paths natively, which ESM does not). The runner prefers the twins when
 * they exist and falls back to the TypeScript sources when a repo has a TS runtime.
 *
 *   node tools/compile-probe-twins.mjs          # build dist-verify/
 *   node tools/compile-probe-twins.mjs --check   # build into a temp dir and report
 *
 * Requires a TypeScript compiler, which the host repository already has. If none
 * is found this exits non-zero with the command to run — it never quietly produces
 * an archive that cannot be checked.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'dist-verify');
const CHECK = process.argv.includes('--check');

/**
 * Find a compiler: the repository's own, then one you point at, then npx.
 * It never installs anything — a build step that silently downloads a toolchain
 * is a build step you cannot audit.
 */
function findTsc() {
  const explicitIndex = process.argv.indexOf('--tsc');
  const explicit = explicitIndex === -1 ? process.env.VH_TSC : process.argv[explicitIndex + 1];
  if (explicit !== undefined && explicit.length > 0) return { cmd: explicit, args: [] };
  const local = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  if (existsSync(local)) return { cmd: process.execPath, args: [local] };
  const bin = join(ROOT, 'node_modules', '.bin', 'tsc');
  if (existsSync(bin)) return { cmd: bin, args: [] };
  return { cmd: 'npx', args: ['--no-install', 'tsc'] };
}

const tsc = findTsc();
const target = CHECK ? join(ROOT, '.dist-verify-check') : OUT;
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

/* tsc does not expand globs — the shell does, and Windows shells do not. So the
   file list is enumerated here: same behaviour everywhere. */
function collectTs(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, e.name);
    if (e.isDirectory()) collectTs(full, out);
    else if (e.isFile() && full.endsWith('.ts')) out.push(relative(ROOT, full));
  }
  return out;
}

const sources = [...collectTs(join(ROOT, 'src')), ...collectTs(join(ROOT, 'catalog')), ...collectTs(join(ROOT, 'probe'))];
if (sources.length === 0) {
  console.error('no TypeScript sources found to compile — is this the right directory?');
  process.exit(1);
}

const args = [
  ...tsc.args,
  '--target', 'ES2022',
  '--module', 'commonjs',
  '--moduleResolution', 'node',
  '--lib', 'ES2022,DOM',
  '--strict',
  '--noUncheckedIndexedAccess',
  '--esModuleInterop',
  '--skipLibCheck',
  '--outDir', target,
  '--rootDir', '.',
  ...sources,
];

try {
  execFileSync(tsc.cmd, args, { cwd: ROOT, stdio: 'pipe' });
} catch (err) {
  const stderr = String(err.stderr ?? '').trim();
  const stdout = String(err.stdout ?? '').trim();
  const detail = (stderr || stdout || String(err.message ?? 'no output')).split('\n').slice(0, 12).join('\n  ');
  console.error('could not compile the probe twins — the archive would not be verifiable standalone.');
  console.error(`  ${detail}`);
  console.error('\n  Point the tool at a compiler rather than installing one:');
  console.error('    node tools/compile-probe-twins.mjs --tsc /path/to/tsc      (or set VH_TSC)');
  console.error('    npm i -D typescript && node tools/compile-probe-twins.mjs  (inside the repo)');
  process.exit(1);
}

/* CommonJS, so plain `node` can run them without a loader of any kind. */
writeFileSync(join(target, 'package.json'), `${JSON.stringify({ type: 'commonjs', private: true }, null, 2)}\n`);

/* The runner has to travel with the twins, or the archive can be checked but not run. */
mkdirSync(join(target, 'tools'), { recursive: true });
cpSync(join(ROOT, 'tools', 'run-all-probes.mjs'), join(target, 'tools', 'run-all-probes.mjs'));

const count = (dir) => {
  let n = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name));
      else if (e.isFile() && e.name.endsWith('.js')) n += 1;
    }
  };
  walk(dir);
  return n;
};

const files = count(target);
const suites = readdirSync(join(target, 'probe')).filter((f) => f.endsWith('.test.js')).length;

if (CHECK) {
  rmSync(target, { recursive: true, force: true });
  console.log(`probe twins compile cleanly: ${suites} suite(s), ${files} file(s).`);
  process.exit(0);
}

console.log(`wrote ${suites} compiled suite(s) and ${files} file(s) to ${relative(ROOT, target)}/`);
console.log('the archive is now verifiable with plain node:');
console.log(`  node ${relative(ROOT, join(target, 'tools', 'run-all-probes.mjs'))}`);
if (!statSync(join(target, 'probe')).isDirectory()) {
  console.error('the compiled output is missing a probe directory — refusing to report success.');
  process.exit(1);
}

#!/usr/bin/env node
/**
 * run-all-probes.mjs — one command, every probe.
 *
 * Vouch Harbor's probes are zero-dependency modules exporting a `run*Probe()`
 * that returns `{ passed, failed, checks }`. This runner discovers them on disk
 * (so a new suite is registered by existing), executes them in-process with a
 * timeout, and prints a table. A probe that throws is a failure, not a crash:
 * a suite that cannot even run is exactly what you want to hear about.
 *
 *   node tools/run-all-probes.mjs                 # everything
 *   node tools/run-all-probes.mjs bridge beacon   # substring filter
 *   node tools/run-all-probes.mjs --json          # machine-readable
 *   node tools/run-all-probes.mjs --bail          # stop at first failure
 *
 * Exit code is 0 only when every selected probe passed. Nothing is skipped
 * silently: a suite that matches no runner is reported as SKIPPED-NOT-RUN.
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PROBE_DIR = join(ROOT, 'probe');
const DEFAULT_TIMEOUT_MS = 60_000;

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const bail = argv.includes('--bail');
const filters = argv.filter((a) => !a.startsWith('--'));

/** Discover `*.test.ts` files under probe/, depth-first, deterministically. */
function discover(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...discover(full));
    else if (/\.test\.(ts|tsx|js|mjs)$/.test(e.name)) out.push(full);
  }
  return out;
}

/** Load a probe module. Prefer the compiled twin (.mjs/.js) when present. */
async function loadProbe(file) {
  const candidates = [file];
  const js = file.replace(/\.tsx?$/, '.mjs');
  try {
    if (statSync(js).isFile()) candidates.unshift(js);
  } catch {
    /* no compiled twin — fine */
  }
  let lastError;
  for (const candidate of candidates) {
    try {
      return await import(pathToFileURL(candidate).href);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/** Find the exported runner in a probe module. */
function findRunner(mod) {
  for (const [name, value] of Object.entries(mod)) {
    if (typeof value === 'function' && /^run[A-Za-z0-9]*Probe$/.test(name)) return [name, value];
  }
  for (const [name, value] of Object.entries(mod)) {
    if (typeof value === 'function' && /^run[A-Za-z0-9_]*(all|checks)$/.test(name)) return [name, value];
  }
  return [undefined, undefined];
}

function withTimeout(promise, ms, label) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

const files = discover(PROBE_DIR).filter((f) => {
  if (filters.length === 0) return true;
  const rel = relative(ROOT, f).toLowerCase();
  return filters.some((needle) => rel.includes(needle.toLowerCase()));
});

if (files.length === 0) {
  console.error(`No probe files matched. Looked in ${relative(ROOT, PROBE_DIR)}/${filters.join(', ')}`);
  process.exit(2);
}

const results = [];
for (const file of files) {
  const rel = relative(ROOT, file);
  const started = Date.now();
  try {
    const mod = await loadProbe(file);
    const [runnerName, runner] = findRunner(mod);
    if (runner === undefined) {
      results.push({ file: rel, status: 'SKIPPED-NOT-RUN', passed: 0, failed: 0, ms: Date.now() - started, note: 'no run*Probe export' });
      if (bail) break;
      continue;
    }
    const result = await withTimeout(Promise.resolve(runner()), DEFAULT_TIMEOUT_MS, rel);
    const passed = Number(result?.passed ?? 0);
    const failed = Number(result?.failed ?? 0);
    const failures = Array.isArray(result?.checks) ? result.checks.filter((c) => !c.ok) : [];
    results.push({
      file: rel,
      status: failed === 0 ? 'PASS' : 'FAIL',
      passed,
      failed,
      ms: Date.now() - started,
      runner: runnerName,
      failures: failures.slice(0, 12).map((c) => (c.detail === undefined ? c.name : `${c.name} — ${c.detail}`)),
    });
    if (failed > 0 && bail) break;
  } catch (err) {
    results.push({
      file: rel,
      status: 'FAIL',
      passed: 0,
      failed: 0,
      ms: Date.now() - started,
      failures: [String(err && err.stack ? err.stack.split('\n')[0] : err)],
    });
    if (bail) break;
  }
}

const totals = results.reduce(
  (acc, r) => ({
    passed: acc.passed + r.passed,
    failed: acc.failed + r.failed,
    suites: acc.suites + 1,
    unhealthy: acc.unhealthy + (r.status === 'PASS' ? 0 : 1),
  }),
  { passed: 0, failed: 0, suites: 0, unhealthy: 0 },
);

if (asJson) {
  console.log(JSON.stringify({ version: '19.5.4-alpha', results, totals }, null, 2));
} else {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\nVouch Harbor 19.5.4 [Alpha] — probe run (${totals.suites} suites)\n`);
  for (const r of results) {
    const badge = r.status === 'PASS' ? 'PASS' : r.status === 'SKIPPED-NOT-RUN' ? 'SKIP' : 'FAIL';
    console.log(`  ${badge}  ${pad(r.file, 34)} ${pad(`${r.passed}p/${r.failed}f`, 10)} ${r.ms}ms${r.note ? `  (${r.note})` : ''}`);
    for (const f of r.failures ?? []) console.log(`        ↳ ${f}`);
  }
  console.log(
    `\n  ${totals.passed} checks passed, ${totals.failed} failed, ${totals.unhealthy} suite(s) not green.\n`,
  );
  if (totals.unhealthy === 0) console.log('  Every probe is green.\n');
}

process.exitCode = totals.unhealthy === 0 && totals.failed === 0 ? 0 : 1;

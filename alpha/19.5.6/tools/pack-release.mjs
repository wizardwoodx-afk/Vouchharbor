#!/usr/bin/env node
/**
 * pack-release.mjs — build the full-app release archive, from the repo itself.
 *
 * WHY A PACKER AND NOT `zip -r`. Three things go wrong when a release archive is
 * made by hand: the wrong things get in (node_modules, target/, .git, the probes'
 * caches — hundreds of megabytes of things nobody needs and everybody re-downloads),
 * the right things get left out (a bundle, a licence, a manifest), and nobody can
 * tell afterwards what was in it. This walks the tree with a policy, writes the
 * archive itself with zero dependencies, and prints what it packed.
 *
 * It also refuses to ship a release that is not verified: by default it runs
 * `tools/run-all-probes.mjs` first and will not pack a failing tree. `--no-verify`
 * exists for packing a source-only artifact on purpose; using it prints a warning.
 *
 *   node tools/pack-release.mjs                        → Vouch-Harbor-19.5.4-[Alpha].zip
 *   node tools/pack-release.mjs --name "My Build"      → My-Build.zip
 *   node tools/pack-release.mjs --list                 → what would be packed, nothing written
 *   node tools/pack-release.mjs --no-verify            → skip the probe gate
 *   node tools/pack-release.mjs --root ../vouchharbor  → pack another checkout
 *
 * Zero dependencies: a small, correct ZIP writer (deflate via node:zlib) so this
 * behaves the same on Windows, Linux and macOS. Deterministic: sorted entries and
 * a fixed timestamp, so an unchanged tree produces a byte-identical archive.
 */

import { deflateRaw as deflateRawCallback } from 'node:zlib';
import { promisify } from 'node:util';
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/* ------------------------------- arguments ------------------------------- */

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 || argv[i + 1] === undefined ? fallback : argv[i + 1];
};

const REPO = resolve(value('root', resolve(HERE, '..')));
const NAME = value('name', 'Vouch-Harbor-19.5.6-[Alpha]');
const OUT = resolve(process.cwd(), `${NAME.replace(/\s+/g, '-')}.zip`);
const LIST_ONLY = flag('list');
const SKIP_VERIFY = flag('no-verify');
const ROOT_IN_ARCHIVE = value('prefix', 'vouchharbor-19.5.6-alpha');

/* ------------------------- what goes in, what stays ---------------------- */

/** Directories never worth shipping. Checked at every level, by name. */
const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn',
  'target', 'dist', 'build', 'out', 'coverage', 'release-artifacts',
  '.next', '.nuxt', '.svelte-kit', '.turbo', '.parcel-cache', '.vite',
  '.venv', 'venv', '__pycache__', '.mypy_cache', '.pytest_cache', '.ruff_cache',
  '.cache', '.local', '.arena', '.idea', '.vscode', '.DS_Store',
]);

/** Files never worth shipping: secrets, credentials, machine-local state. */
const EXCLUDED_FILES = [
  /^\.env(\..*)?$/i,
  /^\.netrc$/i,
  /^\.git-credentials$/i,
  /\.log$/i,
  /\.zip$/i,
  /\.(db|sqlite|sqlite3)$/i,
  /^id_(rsa|ed25519|ecdsa)/i,
  /\.(p12|pfx|jks|keystore|mobileprovision)$/i,
  /[/\\]\.git[/\\](config|credentials)$/i,
];

/** Files that MUST be present; a release without them is a mistake, not a build. */
const REQUIRED = ['LICENSE', 'NOTICE', 'package.json'];

/** Paths whose absence is only a warning (an alpha drop-in may not have them). */
const EXPECTED = ['FEATURES.md', 'CHANGELOG.md', 'docs/VERSION.ts', 'docs/MANIFEST.json'];

/** Hard ceilings — a release archive past these is a packaging bug. */
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_SINGLE_FILE = 512 * 1024 * 1024;       // 512 MB
const MAX_ENTRIES = 60_000;                      // ZIP's non-Zip64 directory limit

/* --------------------------------- walk ---------------------------------- */

function walk(dir, out = [], depth = 0) {
  if (depth > 40) return out;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.isDirectory()) {
      if (EXCLUDED_DIRS.has(e.name)) continue;
      walk(join(dir, e.name), out, depth + 1);
      continue;
    }
    if (!e.isFile() && !e.isSymbolicLink()) continue;
    if (EXCLUDED_FILES.some((re) => re.test(e.name) || re.test(join(dir, e.name)))) continue;
    const full = join(dir, e.name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.size > MAX_SINGLE_FILE) {
      console.warn(`  ! skipping ${relative(REPO, full)} — ${(st.size / 1048576).toFixed(1)} MB exceeds the per-file ceiling`);
      continue;
    }
    out.push({ full, rel: relative(REPO, full).split('\\').join('/'), size: st.size });
  }
  return out;
}

/* ------------------------------- zip writer ------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Fixed DOS timestamp, so two runs over identical content produce identical bytes. */
const DOS_TIME = 0;      // 00:00:00
const DOS_DATE = 0x2821; // 2000-01-01

function localHeader(nameBytes, crc, compSize, uncompSize, method) {
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0);
  h.writeUInt16LE(20, 4);            // version needed
  h.writeUInt16LE(0x0800, 6);        // UTF-8 names
  h.writeUInt16LE(method, 8);        // deflate, or store when deflating would grow it
  h.writeUInt16LE(DOS_TIME, 10);
  h.writeUInt16LE(DOS_DATE, 12);
  h.writeUInt32LE(crc, 14);
  h.writeUInt32LE(compSize, 18);
  h.writeUInt32LE(uncompSize, 22);
  h.writeUInt16LE(nameBytes.length, 26);
  h.writeUInt16LE(0, 28);
  return h;
}

function centralHeader(nameBytes, crc, compSize, uncompSize, offset, method) {
  const h = Buffer.alloc(46);
  h.writeUInt32LE(0x02014b50, 0);
  h.writeUInt16LE(20, 4);            // version made by
  h.writeUInt16LE(20, 6);            // version needed
  h.writeUInt16LE(0x0800, 8);
  h.writeUInt16LE(method, 10);
  h.writeUInt16LE(DOS_TIME, 12);
  h.writeUInt16LE(DOS_DATE, 14);
  h.writeUInt32LE(crc, 16);
  h.writeUInt32LE(compSize, 20);
  h.writeUInt32LE(uncompSize, 24);
  h.writeUInt16LE(nameBytes.length, 28);
  h.writeUInt16LE(0, 30);            // extra
  h.writeUInt16LE(0, 32);            // comment
  h.writeUInt16LE(0, 34);            // disk
  h.writeUInt16LE(0, 36);            // internal attrs
  h.writeUInt32LE(0o644 << 16, 38);  // external attrs: regular file, 0644
  h.writeUInt32LE(offset, 42);
  return h;
}

/* zlib's promise form. `createDeflateRaw(options, callback)` takes no callback —
   the first version of this file awaited a promise that never settled and the
   process exited 13 without packing anything. */
const deflate = promisify(deflateRawCallback);

/** Deflate, or store when deflating would make the file bigger (binaries). */
async function packEntry(raw) {
  const deflated = await deflate(raw, { level: 9 });
  if (deflated.length >= raw.length) return { data: raw, method: 0 };
  return { data: deflated, method: 8 };
}

async function writeZip(files, outPath, prefix) {
  const chunks = [];
  const central = [];
  let offset = 0;
  let entryCount = 0;
  let uncompressedTotal = 0;

  for (const f of files) {
    const raw = readFileSync(f.full);
    const { data: comp, method } = await packEntry(raw);
    const nameBytes = Buffer.from(`${prefix}/${f.rel}`, 'utf8');
    const crc = crc32(raw);
    const lh = localHeader(nameBytes, crc, comp.length, raw.length, method);
    chunks.push(lh, nameBytes, comp);
    /* The central directory entry is the 46-byte header AND its filename. Shipping
       only the header produces an archive that walks fine locally and fails every
       reader in the world — the first version of this file did exactly that. */
    central.push(centralHeader(nameBytes, crc, comp.length, raw.length, offset, method), nameBytes);
    offset += lh.length + nameBytes.length + comp.length;
    entryCount += 1;
    uncompressedTotal += raw.length;
    f.compressed = comp.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  /* The count of FILES, not of buffers. Counting the push-array put twice the
     real number in the end-of-archive record, which pointed every reader past the
     end of the central directory. */
  eocd.writeUInt16LE(entryCount, 8);
  eocd.writeUInt16LE(entryCount, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  mkdirSync(dirname(outPath), { recursive: true });
  const archive = Buffer.concat([...chunks, centralBuf, eocd]);
  writeFileSync(outPath, archive);

  /* Read it back before claiming success: signature, counts, and offsets. A
     self-check is cheaper than a user's support ticket. */
  const eocdAt = archive.length - 22;
  const ok =
    archive.readUInt32LE(0) === 0x04034b50 &&
    archive.readUInt32LE(eocdAt) === 0x06054b50 &&
    archive.readUInt16LE(eocdAt + 10) === entryCount &&
    archive.readUInt32LE(eocdAt + 16) === offset &&
    archive.readUInt32LE(offset) === 0x02014b50;
  if (!ok) throw new Error('the archive failed its own read-back check — not written correctly');

  return { uncompressedTotal, compressedTotal: archive.length, entryCount };
}

/* --------------------------------- main ---------------------------------- */

console.log(`\nVouch Harbor release packer\n  from  ${REPO}\n  as    ${basename(OUT)}\n`);

if (!LIST_ONLY && !SKIP_VERIFY) {
  const runner = join(REPO, 'tools', 'run-all-probes.mjs');
  try {
    console.log('  running the probe gate before packing…');
    const out = execFileSync(process.execPath, [runner], { cwd: REPO, encoding: 'utf8', stdio: 'pipe' });
    const last = out.trim().split('\n').filter((l) => l.includes('checks passed')).pop();
    console.log(`  probes: ${last?.trim() ?? 'green'}\n`);
  } catch (err) {
    const detail = String(err.stdout ?? '').trim().split('\n').slice(-8).join('\n  ');
    console.error(`  REFUSING TO PACK: the probe gate did not pass.\n  ${detail}`);
    console.error('\n  Fix the tree, or pack on purpose with --no-verify.\n');
    process.exit(1);
  }
} else if (SKIP_VERIFY && !LIST_ONLY) {
  console.warn('  ! --no-verify: packing without running the probe gate. This archive is unverified.\n');
}

const files = walk(REPO);
if (LIST_ONLY) {
  console.log(`  ${files.length} files, ${(files.reduce((a, f) => a + f.size, 0) / 1024).toFixed(1)} KB uncompressed\n`);
  for (const f of files) console.log(`    ${(f.size / 1024).toFixed(1).padStart(9)} KB  ${f.rel}`);
  console.log('');
  process.exit(0);
}

const missingRequired = REQUIRED.filter((r) => !files.some((f) => f.rel === r));
const missingExpected = EXPECTED.filter((r) => !files.some((f) => f.rel === r));
for (const m of missingExpected) console.warn(`  ! expected ${m} — not found (fine for a drop-in increment, not for a full app)`);
if (missingRequired.length > 0) {
  console.error(`  REFUSING TO PACK: missing ${missingRequired.join(', ')}.`);
  process.exit(1);
}
if (files.length > MAX_ENTRIES) {
  console.error(`  REFUSING TO PACK: ${files.length} entries exceeds the ${MAX_ENTRIES}-entry limit of a plain ZIP.`);
  process.exit(1);
}
const total = files.reduce((a, f) => a + f.size, 0);
if (total > MAX_TOTAL_BYTES) {
  console.error(`  REFUSING TO PACK: ${(total / 1073741824).toFixed(2)} GB exceeds the ${MAX_TOTAL_BYTES / 1073741824} GB ceiling.`);
  process.exit(1);
}

const { uncompressedTotal, compressedTotal } = await writeZip(files, OUT, ROOT_IN_ARCHIVE);
const ratio = uncompressedTotal === 0 ? 0 : compressedTotal / uncompressedTotal;
const bytes = statSync(OUT).size;

const byKind = {};
for (const f of files) {
  const ext = (f.rel.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'other').toLowerCase();
  const k = (byKind[ext] ??= { n: 0, bytes: 0 });
  k.n += 1;
  k.bytes += f.size;
}
const biggest = [...files].sort((a, b) => b.size - a.size).slice(0, 5);

console.log(`  packed ${files.length} files`);
console.log(`  ${(uncompressedTotal / 1048576).toFixed(2)} MB → ${(bytes / 1048576).toFixed(2)} MB compressed (${(ratio * 100).toFixed(0)}%)\n`);
console.log('  by kind:');
for (const [ext, k] of Object.entries(byKind).sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`    ${ext.padEnd(6)} ${String(k.n).padStart(5)} files  ${(k.bytes / 1024).toFixed(1).padStart(9)} KB`);
}
console.log('\n  largest five:');
for (const f of biggest) console.log(`    ${(f.size / 1024).toFixed(1).padStart(9)} KB  ${f.rel}`);
console.log(`\n  written to ${OUT}\n`);
console.log('  verify with:  unzip -t "' + OUT + '"\n');

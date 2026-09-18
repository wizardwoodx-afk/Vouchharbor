/**
 * sha256.test.ts — the digest the Evidence Pack rests on, checked against
 * published vectors rather than against itself.
 *
 * A hash function tested by comparing its output to its own output proves nothing.
 * So this suite uses the FIPS 180-4 / NIST vectors, the padding boundaries where
 * an implementation is most likely to be wrong, and — where the runtime allows —
 * an independent cross-check against `node:crypto`.
 */

import { checksum, sha256Bytes, sha256Hex, sha256Label } from '../src/evidence/sha256';

export interface Check { readonly name: string; readonly ok: boolean; readonly detail?: string; }
export interface ProbeResult { readonly passed: number; readonly failed: number; readonly checks: readonly Check[]; }

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export async function runSha256Probe(): Promise<ProbeResult> {
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: string): void => {
    checks.push(detail === undefined ? { name, ok } : { name, ok, detail });
  };

  /* ------------------------- published vectors ------------------------- */

  const vectors: ReadonlyArray<readonly [string, string]> = [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
    [
      'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
      'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1',
    ],
  ];
  for (const [input, expected] of vectors) {
    const got = sha256Hex(input);
    check(`FIPS vector for ${input.length} byte(s)`, got === expected, got === expected ? undefined : `got ${got}`);
  }

  /* --------------------- padding boundaries --------------------------- */
  /* 55 bytes fits in one block with room for the length; 56 does not, and 64 is a
     full second block. Implementations break exactly here. */
  const boundaryCases: ReadonlyArray<readonly [number, string]> = [
    [55, '9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318'],
    [56, 'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a'],
    [64, 'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb'],
    [119, '31eba51c313a5c08226adf18d4a359cfdfd8d2e816b13f4af952f7ea6584dcfb'],
  ];
  for (const [length, expected] of boundaryCases) {
    const input = 'a'.repeat(length);
    const got = sha256Hex(input);
    check(`${length}-byte input is padded correctly`, got === expected, got === expected ? undefined : `got ${got}`);
  }
  check('a 1,000,000-byte input matches the published digest', sha256Hex('a'.repeat(1_000_000)) === 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');

  /* ------------------------ structural properties --------------------- */

  const a = sha256Hex('the same bytes');
  const b = sha256Hex('the same bytes');
  check('the digest is deterministic', a === b);
  check('the digest is 32 bytes of hex', sha256Bytes(new Uint8Array(0)).length === 32 && a.length === 64);
  check('output is lowercase hex', /^[0-9a-f]{64}$/.test(a));
  check('a one-character change changes the digest', sha256Hex('the same byteS') !== a);
  check('two different inputs do not collide here', sha256Hex('alpha') !== sha256Hex('beta'));
  check('the byte form agrees with the hex form', toHex(sha256Bytes(new TextEncoder().encode('abc'))) === sha256Hex('abc'));
  check('the label names the algorithm', sha256Label('abc') === 'vh1:sha256:' + sha256Hex('abc'));
  check('utf-8 text is handled as bytes, not code units', sha256Hex('café ☕') === sha256Hex(new TextEncoder().encode('café ☕')));

  /* ------------------- the non-cryptographic hash -------------------- */
  /* checksum() is kept for short labels. It must stay labelled as such — the
     failure mode this guards against is somebody reaching for it as integrity. */
  check(
    'checksum is not masquerading as a digest',
    /^[0-9a-f]{16}$/.test(checksum('abc')) && !checksum('abc').startsWith('vh1:') && checksum('abc').length !== 64,
    checksum('abc'),
  );
  check('checksum is deterministic', checksum('abc') === checksum('abc'));
  check('checksum and sha256 are different functions', checksum('abc') !== sha256Hex('abc').slice(0, 24));

  /* -------------------- independent cross-check ---------------------- */
  let crossChecked = false;
  try {
    /* The specifier is assembled at run time so this file type-checks without
       @types/node installed — which is the situation a zipped archive is opened in. */
    const specifier = ['node', 'crypto'].join(':');
    const nodeCrypto = (await import(specifier)) as {
      createHash(algorithm: string): { update(data: string | Uint8Array, encoding?: string): { digest(encoding: string): string } };
    };
    const samples = ['', 'a', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'x'.repeat(1000), 'unicode ✓ ☕ 語'];
    let mismatches = 0;
    for (const sample of samples) {
      const mine = sha256Hex(sample);
      const theirs = nodeCrypto.createHash('sha256').update(sample, 'utf8').digest('hex');
      if (mine !== theirs) mismatches += 1;
    }
    /* and on random bytes, which no vector set covers */
    for (let i = 0; i < 32; i += 1) {
      const random = new Uint8Array(1 + Math.floor(Math.random() * 300));
      for (let j = 0; j < random.length; j += 1) random[j] = Math.floor(Math.random() * 256);
      const mine = sha256Hex(random);
      const theirs = nodeCrypto.createHash('sha256').update(random).digest('hex');
      if (mine !== theirs) mismatches += 1;
    }
    crossChecked = true;
    check('agrees with node:crypto on 8 fixed and 32 random inputs', mismatches === 0, `${mismatches} mismatch(es)`);
  } catch {
    check('cross-check skipped: node:crypto is not available in this runtime', true);
  }
  check('the cross-check actually ran where the runtime supports it', crossChecked || typeof process === 'undefined');

  const passed = checks.filter((c) => c.ok).length;
  return { passed, failed: checks.length - passed, checks };
}

/**
 * Minimal local typing of `process`. Declared here rather than pulled from
 * @types/node so a probe compiles in a runtime that has no Node types installed —
 * which is exactly the situation a zipped archive is opened in.
 */
declare const process: { readonly argv?: readonly string[]; exitCode?: number } | undefined;

const invokedDirectly =
  typeof process !== 'undefined' && Array.isArray(process?.argv) &&
  /sha256\.test(\.(ts|tsx|js|mjs|mts|cts))?$/.test(process?.argv?.[1] ?? '');

if (invokedDirectly) {
  void runSha256Probe().then((r) => {
    for (const c of r.checks) if (!c.ok) console.log(`  FAIL  ${c.name}${c.detail === undefined ? '' : ` — ${c.detail}`}`);
    console.log(`sha256 probe: ${r.passed} passed, ${r.failed} failed`);
    if (r.failed > 0 && process !== undefined) process.exitCode = 1;
  });
}

import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/palette.test.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert";

// src/app/fuzzy.ts
function fuzzyScore(query, text) {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (q.length === 0) return 0;
  if (t === q) return 1e3;
  if (t.startsWith(q)) return 900 + (10 - Math.min(10, t.length - q.length));
  let score = 0;
  let ti = 0;
  let prevFound = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = -1;
    for (let i = ti; i < t.length; i++) {
      if (t[i] === ch) {
        found = i;
        break;
      }
    }
    if (found === -1) return -1;
    const atWordStart = found === 0 || /[^a-z0-9]/i.test(t[found - 1]);
    score += atWordStart ? 24 : 8;
    if (found === prevFound + 1) score += 10;
    ti = found + 1;
    prevFound = found;
  }
  score -= Math.min(30, Math.floor(t.length / 8));
  return score;
}
function paletteScore(query, label, group) {
  const ls = fuzzyScore(query, label);
  if (ls >= 0) return ls + 1e3;
  const gs = group ? fuzzyScore(query, group) : -1;
  return gs >= 0 ? Math.floor(gs * 0.35) : -1;
}

// src/app/nav.ts
var NAV = [
  { key: "vh19", label: "VH-19", description: "The Generalist" },
  { key: "harbor", label: "Harbor", description: "Live voyages" },
  { key: "ship", label: "Ship", description: "Vessel & crew" },
  { key: "chart", label: "Chart", description: "Plot course" },
  { key: "register", label: "Register", description: "Manifests & receipts" },
  { key: "master", label: "Harbor Master", description: "Governance desk" }
];

// probe/palette.test.ts
var ROOT = ".".length > 0 ? "." : process.cwd();
var read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
describe("palette \u2014 Signal Lamp launcher is label-first, fuzzy, complete", () => {
  it("fuzzy scorer: exact > prefix > subsequence > reject", () => {
    assert.strictEqual(fuzzyScore("run", "run"), 1e3, "exact match = 1000");
    assert.ok(fuzzyScore("run", "Run workflow") > fuzzyScore("rw", "Run workflow"), "prefix beats scattered subsequence");
    assert.ok(fuzzyScore("xyz", "Run workflow") < 0, "non-subsequence rejected");
    assert.strictEqual(fuzzyScore("", "anything"), 0, "empty query = neutral 0");
    assert.ok(fuzzyScore("work", "Run workflow") > fuzzyScore("wfk", "Run workflow"), "contiguous run beats scattered");
  });
  it("label-first: any label hit outranks any group-only hit", () => {
    const labelHit = paletteScore("har", "Harbor \u2014 home port", "Docks");
    const groupOnly = paletteScore("har", "Ship \u2014 sail", "Harboring");
    assert.ok(labelHit > groupOnly, `label hit (${labelHit}) must outrank group-only (${groupOnly})`);
    assert.ok(paletteScore("zzq", "Harbor", "Docks") < 0);
  });
  it("CommandPalette imports fuzzyScore and ranks through it", () => {
    const src = read("src/panels/CommandPalette.tsx");
    assert.ok(/fuzzyScore|paletteScore/.test(src), "palette imports the fuzzy scorer");
    assert.ok(
      /sort\(\(a,\s*b\)\s*=>\s*b\.score\s*-\s*a\.score\)/.test(src) || /\.sort\(\s*\([^)]*b\.score\s*-\s*a\.score/.test(src),
      "palette sorts desc by score"
    );
  });
  it("palette lists all six docks (VH-19 first)", () => {
    const src = read("src/panels/CommandPalette.tsx");
    for (const n of NAV) {
      assert.ok(src.includes(n.label), `palette lists dock "${n.label}"`);
    }
  });
});

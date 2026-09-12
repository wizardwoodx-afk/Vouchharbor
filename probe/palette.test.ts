/**
 * VOUCH HARBOR — the PALETTE probe (Signal Lamp launcher).
 *
 * Asserts the Patina command palette (Signal Lamp):
 *   1. Ranks by fuzzy subsequence match on the visible LABEL (label-first).
 *   2. Composes its ranking through fuzzyScore/paletteScore from src/app/fuzzy.ts.
 *   3. Lists all five Patina docks (Harbor/Ship/Chart/Register/Harbor Master).
 *   4. A label hit ALWAYS outranks a group-only hit (Raycast/Linear convention).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert";

declare const MJ_ROOT: string | undefined;
const ROOT = typeof MJ_ROOT === "string" && MJ_ROOT.length > 0 ? MJ_ROOT : process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), "utf8");

import { fuzzyScore, paletteScore } from "../src/app/fuzzy";
import { NAV } from "../src/app/nav";

describe("palette — Signal Lamp launcher is label-first, fuzzy, complete", () => {
  it("fuzzy scorer: exact > prefix > subsequence > reject", () => {
    assert.strictEqual(fuzzyScore("run", "run"), 1000, "exact match = 1000");
    assert.ok(fuzzyScore("run", "Run workflow") > fuzzyScore("rw", "Run workflow"), "prefix beats scattered subsequence");
    assert.ok(fuzzyScore("xyz", "Run workflow") < 0, "non-subsequence rejected");
    assert.strictEqual(fuzzyScore("", "anything"), 0, "empty query = neutral 0");
    assert.ok(fuzzyScore("work", "Run workflow") > fuzzyScore("wfk", "Run workflow"), "contiguous run beats scattered");
  });

  it("label-first: any label hit outranks any group-only hit", () => {
    // "har" matches label "Harbor" → label bucket. "har" matches group "Docks" only on the other → group bucket.
    const labelHit = paletteScore("har", "Harbor — home port", "Docks");
    const groupOnly = paletteScore("har", "Ship — sail", "Harboring");
    assert.ok(labelHit > groupOnly, `label hit (${labelHit}) must outrank group-only (${groupOnly})`);
    // miss on both is rejected
    assert.ok(paletteScore("zzq", "Harbor", "Docks") < 0);
  });

  it("CommandPalette imports fuzzyScore and ranks through it", () => {
    const src = read("src/panels/CommandPalette.tsx");
    assert.ok(/fuzzyScore|paletteScore/.test(src), "palette imports the fuzzy scorer");
    assert.ok(/sort\(\(a,\s*b\)\s*=>\s*b\.score\s*-\s*a\.score\)/.test(src) ||
              /\.sort\(\s*\([^)]*b\.score\s*-\s*a\.score/.test(src),
      "palette sorts desc by score");
  });

  it("palette lists all five Patina docks", () => {
    const src = read("src/panels/CommandPalette.tsx");
    for (const n of NAV) {
      assert.ok(src.includes(n.label), `palette lists dock "${n.label}"`);
    }
  });
});

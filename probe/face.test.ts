/**
 * FACE SYSTEM PROBE — 19.6.6 (the naming redesign).
 *
 * Pins the avatar swap mechanically:
 *   1. the Generalist's face is a pure function of the owner-chosen name
 *      (a declared dependency): same name → same SVG, different name → different SVG;
 *   2. the mood→expression map is COMPLETE over the GeneralistMood contract —
 *      a mood without a face is a failure, not a silent blank;
 *   3. the name is stored locally under one key, defaulted once;
 *   4. specialists ride deterministic marks keyed by id;
 *   5. the old OSS engine is GONE: no vendored oneworks directory, no import,
 *      no mention anywhere in src/ — the product carries no borrowed faces;
 *   6. the console is wired: App routes the door to NextConsole, the new
 *      design sheet ships, and Tailwind v4 is a real build input.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { blobatar } from "blobatar";

declare const VH_ROOT: string | undefined;
const ROOT = typeof VH_ROOT === "string" && VH_ROOT.length > 0 ? VH_ROOT : process.cwd();

import { MOOD_EXPRESSION, MOOD_CAPTION, DEFAULT_GENERALIST_NAME, type GeneralistMood } from "../src/vh19/face";

const MOODS: GeneralistMood[] = ["idle", "thinking", "acting", "gate", "sealed", "refused"];

describe("the Generalist's one face", () => {
  it("is a pure function of the name — same name, same face", () => {
    assert.equal(blobatar("Chief Steward"), blobatar("Chief Steward"));
    assert.equal(blobatar(DEFAULT_GENERALIST_NAME).slice(0, 4), "<svg");
  });

  it("different names render different faces", () => {
    assert.notEqual(blobatar("Chief Steward"), blobatar("My Harbor"));
  });

  it("the mood map is complete and honest over the GeneralistMood contract", () => {
    for (const m of MOODS) {
      assert.ok(MOOD_EXPRESSION[m], `mood ${m} has an expression`);
      assert.ok(MOOD_CAPTION[m].length > 0, `mood ${m} has a caption`);
    }
    assert.ok(MOOD_CAPTION.refused.includes("refused"), "a refusal is stated, never dressed up");
  });

  it("the name key is a single local key with one default", () => {
    const src = fs.readFileSync(path.join(ROOT, "src", "vh19", "face.tsx"), "utf8");
    assert.ok(src.includes("vh.generalist.name.v1"));
    assert.equal(DEFAULT_GENERALIST_NAME, "Chief Steward");
  });
});

describe("specialists ride deterministic marks, keyed by id", () => {
  it("face.tsx wires SpecialistFace to the mark renderer deterministically", () => {
    const src = fs.readFileSync(path.join(ROOT, "src", "vh19", "face.tsx"), "utf8");
    assert.ok(src.includes('from "boring-avatars"'));
    assert.ok(src.includes('name: props.id'), "the specialist id is the seed");
  });
});

describe("the old OSS engine is gone", () => {
  it("no vendored oneworks directory survives", () => {
    assert.ok(!fs.existsSync(path.join(ROOT, "src", "vendor", "oneworks-avatar")));
  });

  it("no source file imports or names OneWorks", () => {
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    for (const dir of ["src"]) {
      for (const f of walk(path.join(ROOT, dir))) {
        if (!/\.(ts|tsx|css)$/.test(f)) continue;
        const s = fs.readFileSync(f, "utf8");
        assert.ok(!/oneworks/i.test(s), `${f} must not name the old engine`);
      }
    }
  });
});

describe("the console is wired", () => {
  it("App routes the door to NextConsole", () => {
    const app = fs.readFileSync(path.join(ROOT, "src", "App.tsx"), "utf8");
    assert.ok(app.includes("NextConsole"));
    assert.ok(!app.includes("Comp: Vh19"), "the old door is no longer the door");
  });

  it("the new design sheet ships and Tailwind v4 is a real build input", () => {
    const main = fs.readFileSync(path.join(ROOT, "src", "main.tsx"), "utf8");
    assert.ok(main.includes("vh-next.css"));
    const css = fs.readFileSync(path.join(ROOT, "src", "styles", "vh-next.css"), "utf8");
    assert.ok(css.includes('@import "tailwindcss"'));
    const vite = fs.readFileSync(path.join(ROOT, "vite.config.ts"), "utf8");
    assert.ok(vite.includes("@tailwindcss/vite"));
  });

  it("the console renders evidence, not vibes — gate banner, digest chips, plan-only honesty", () => {
    const src = fs.readFileSync(path.join(ROOT, "src", "views", "NextConsole.tsx"), "utf8");
    assert.ok(src.includes("HUMAN GATE"));
    assert.ok(src.includes("trace") || src.includes("provenance"));
    assert.ok(src.includes("plan-only — nothing executes without a provider"));
  });
});

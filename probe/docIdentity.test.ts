/**
 * probe/docIdentity.test.ts — exhaustive release-document identity scanning (16.9.5).
 *
 * The 16.9.1 external review found the last identity-drift class: current-facing
 * documents (one-pager, deck outline, platform limits) still naming an old release
 * while every manifest said the new one. versionDrift pins the manifests; this suite
 * pins the DOCS:
 *
 *   current docs  →  scan every release-string occurrence
 *                 →  allow historical references only (named patterns)
 *                 →  anything else that is not VH_VERSION  →  FAIL
 *
 * Scope: every Markdown file at the repo root and under docs/ — except docs/history/
 * (the historical ledger by design) and CHANGELOG.md (the historical changelog).
 * Matches both "16.9.5" and "v16.9.5" forms, and bare minor forms ("16.9").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

declare const MJ_ROOT: string;
const root = MJ_ROOT ?? process.cwd();
const VH_VERSION = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version as string;

const VERSION_RE = /\b(v?16\.\d{1,2}(?:\.\d{1,2})?)\b/g;
// a line carrying one of these markers is HISTORICAL context — older versions allowed
const HISTORICAL = /(release notes|docs\/history|history\/|CHANGELOG|changelog|supersed|retired|replaced|pre-16|legacy|heritage|since 16|over 16|in 16\.[0-8]|POINTER|WINDOWS-FIX|relative to|upgrade|UPGRADE|what 16|added over|gains? over|release:|release,|release —|\(\s*16\.\d|16\.\d+(?:\.\d+)?\s*\)|16\.\d+(?:\.\d+)?\s+(fused|carries|added|adds|closes|closed|gains|ships|shipped|made|merged|retired|introduced|brought|turned|learned|is|was|were)|16\.\d+(?:\.\d+)?'s|per the 16\.\d|decided at 16\.\d|committed with the 16\.\d|16\.\d+(?:\.\d+)?\s+review|16\.\d+(?:\.\d+)?\s+external|ranked v?16\.\d|^[*>\u2022\s]*16\.\d+(?:\.\d+)?\s*[\u2014\u2013-]|^\\?16\.\d+(?:\.\d+)?\s*[—-])/im;

function mdFiles(): string[] {
  const out: string[] = [];
  for (const f of fs.readdirSync(root)) {
    if (f.endsWith(".md") && f !== "CHANGELOG.md") out.push(f);
  }
  const docs = path.join(root, "docs");
  for (const f of fs.readdirSync(docs)) {
    const full = path.join("docs", f);
    if (fs.statSync(path.join(docs, f)).isDirectory()) continue; // history/ etc. excluded
    if (f === "CHANGELOG.md") continue;
    out.push(full);
  }
  return out.sort();
}

let passed = 0;
const failures: string[] = [];
const ok = (label: string, cond: boolean, detail = ""): void => {
  if (cond) passed++;
  else failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`  ${cond ? "ok " : "FAIL"} ${label}${cond ? "" : ` — ${detail}`}`);
};

test("docIdentity — current-facing documents name only the current release (outside historical context)", () => {
  console.log(`\n== doc identity scan (VH ${VH_VERSION}) ==\n`);
  const files = mdFiles();
  ok("the scan covers the current docs surface", files.length >= 10, `only ${files.length} files`);

  const offenders: string[] = [];
  let scanned = 0;
  let historicalRefs = 0;
  for (const rel of files) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      VERSION_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = VERSION_RE.exec(lines[i])) !== null) {
        const norm = m[1].replace(/^v/, "");
        scanned++;
        if (norm === VH_VERSION) continue;
        if (HISTORICAL.test(lines[i])) { historicalRefs++; continue; }
        offenders.push(`${rel}:${i + 1} → "${m[1]}" in: ${lines[i].trim().slice(0, 90)}`);
      }
    }
  }
  ok(`scanned ${scanned} version mentions across ${files.length} current docs (historical refs allowed: ${historicalRefs})`, scanned > 20, `only ${scanned}`);
  ok("every non-historical version mention is the current release", offenders.length === 0, offenders.slice(0, 6).join(" | "));

  // identity lines: the flagship documents open as the current release
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  ok("README.md opens as the current release", readme.startsWith(`# Vouch Harbor ${VH_VERSION}`), readme.split("\n")[0]);
  const onepager = fs.readFileSync(path.join(root, "docs", "VOUCH-HARBOR-ONEPAGER.md"), "utf8");
  ok("the one-pager stamps the current release", new RegExp(`v${VH_VERSION.replace(/\./g, "\\.")}`).test(onepager.split("\n").slice(0, 6).join("\n")), "identity line");
  const deck = fs.readFileSync(path.join(root, "docs", "DECK-OUTLINE.md"), "utf8");
  ok("the deck outline names the shipped release as current", new RegExp(`Shipped: v${VH_VERSION.replace(/\./g, "\\.")}`).test(deck), "shipped line");

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log("\nfailures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
  assert.equal(failures.length, 0, failures.join("; "));
});

test("docIdentity — protocol-version labels agree with the single source (17.10.3 review finding)", () => {
  /* The 17.10.3 external review found the security-review artifact still
     labelling the grant-authority surface "protocol v0.10.3" while the
     implementation and the threat model were both v0.10.4. This suite scans
     CURRENT-FACING surfaces for the label and requires every one of them to
     name the version the code actually declares. Historical records
     (CHANGELOG.md, *-UPGRADE.md, docs/history/) and protocol/src comments
     legitimately name older versions and are out of scope by design. */
  console.log("\n== protocol version label scan ==\n");
  const pkgVersion = JSON.parse(fs.readFileSync(path.join(root, "protocol", "package.json"), "utf8")).version as string;
  const core = fs.readFileSync(path.join(root, "protocol", "src", "core", "vh-crypto.js"), "utf8");
  const cryptoVersion = core.match(/version:\s*"(\d+\.\d+\.\d+)"/)?.[1] ?? null;

  const localFailures: string[] = [];
  const okk = (label: string, cond: boolean, detail = ""): void => {
    console.log(`  ${cond ? "ok " : "FAIL"} ${label}${cond ? "" : ` — ${detail}`}`);
    if (!cond) localFailures.push(detail ? `${label} — ${detail}` : label);
  };

  okk(
    "protocol/package.json and vh-crypto.js agree on the protocol version",
    cryptoVersion !== null && cryptoVersion === pkgVersion,
    `package.json ${pkgVersion} vs vh-crypto.js ${cryptoVersion}`,
  );

  const LABEL_RE = /protocol v(\d+\.\d+\.\d+)/gi;
  const files: string[] = ["README.md", "protocol/README.md", "protocol/THREAT-MODEL.md"];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "dist" || e.name === "build") continue;
        walk(rel);
      } else if (/\.tsx?$/.test(e.name)) files.push(rel);
    }
  };
  walk("src");

  const offenders: string[] = [];
  let labels = 0;
  for (const rel of files) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    for (const [i, line] of text.split(/\r?\n/).entries()) {
      LABEL_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = LABEL_RE.exec(line)) !== null) {
        labels++;
        if (m[1] === pkgVersion) continue;
        offenders.push(`${rel}:${i + 1} — "protocol v${m[1]}" but the code declares v${pkgVersion}`);
      }
    }
  }
  okk(
    "every current-facing protocol-version label names the shipped protocol",
    offenders.length === 0,
    offenders.slice(0, 5).join(" | "),
  );
  okk(
    `the scan still finds the labels it guards (${labels} found, across ${files.length} files)`,
    labels > 0,
    "no label matched — the pattern no longer matches the codebase, so this gate guards nothing",
  );

  console.log(`\n${files.length} files scanned, ${labels} labels, ${localFailures.length} failed`);
  assert.equal(localFailures.length, 0, localFailures.join("; "));
});

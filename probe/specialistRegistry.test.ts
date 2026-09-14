/**
 * Specialist registry probe (17.10.11).
 *
 * The vendored catalog is 158 third-party MIT prompt files. This suite is what
 * makes merging them safe rather than hopeful: the index must agree with the
 * bytes on disk, every entry must be routable, and a tampered body must be
 * refused instead of executed.
 *
 * Run: node tools/run-all-probes.mjs   (auto-discovered; also ships in the offline pack)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { SPECIALIST_CATALOG, SPECIALIST_SOURCE } from "../src/moe/catalog.gen";
import { createRegistry, registryStats } from "../src/moe/registry";

let passed = 0;
const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed += 1; console.log(`  ok   ${label}`); }
  else { failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label} — ${detail}`); }
}
function section(n: string): void { console.log(`\n== ${n}`); }

declare const MJ_ROOT: string | undefined;
const root = typeof MJ_ROOT === "string" && MJ_ROOT.length > 0 ? MJ_ROOT : process.cwd();
const agentsDir = path.join(root, "vendor", "voltagent-specialists", "agents");
const read = (p: string): string => fs.readFileSync(path.join(root, p), "utf8");

/** Same parser the builder uses — if they diverge, this suite goes red, which is the point. */
function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  let i = 1;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "---") { i += 1; break; }
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    meta[m[1].toLowerCase()] = v;
  }
  return { meta, body: lines.slice(i).join("\n") };
}

section("0. provenance is recorded, not implied");
ok("catalog names its upstream project", SPECIALIST_SOURCE.project === "VoltAgent/awesome-claude-code-subagents", SPECIALIST_SOURCE.project);
ok("catalog pins an upstream COMMIT, not a moving branch", /^[0-9a-f]{40}$/.test(SPECIALIST_SOURCE.pinnedCommit), SPECIALIST_SOURCE.pinnedCommit);
ok("catalog states MIT", SPECIALIST_SOURCE.license === "MIT", SPECIALIST_SOURCE.license);
ok("LICENSE-MIT is shipped beside the vendored files", fs.existsSync(path.join(root, "vendor/voltagent-specialists/LICENSE-MIT")));
ok("the shipped license really is the MIT text it claims", (() => {
  try { return /MIT License/.test(read("vendor/voltagent-specialists/LICENSE-MIT")) && /Permission is hereby granted, free of charge/.test(read("vendor/voltagent-specialists/LICENSE-MIT")); }
  catch { return false; }
})());
ok("a NOTICE documents what was NOT merged and why", (() => {
  try { const n = read("vendor/voltagent-specialists/NOTICE"); return /mastra/i.test(n) && /openclaw/i.test(n) && /NOASSERTION|Other/.test(n); } catch { return false; }
})());

section("1. the index agrees with the vendored bytes");
const onDisk = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md")).sort() : [];
ok(`agent count on disk matches the catalog (${onDisk.length})`, onDisk.length === SPECIALIST_CATALOG.length, `${onDisk.length} vs ${SPECIALIST_CATALOG.length}`);
ok("no category README leaked in as a specialist", !onDisk.some((f) => /--README\.md$/.test(f)));
ok("every catalog entry maps to a real file", SPECIALIST_CATALOG.every((s) => {
  const rel = (s as { sourceFile?: string }).sourceFile;
  return typeof rel === "string" ? fs.existsSync(path.join(root, rel)) : true;
}));

section("2. every specialist is actually usable");
ok("every entry has a description", SPECIALIST_CATALOG.every((s) => s.description.length > 0));
ok("every entry declares at least one tool", SPECIALIST_CATALOG.every((s) => s.allowedTools.length > 0));
ok("every entry carries routing keywords", SPECIALIST_CATALOG.every((s) => s.keywords.length > 0));
ok("ids are unique", new Set(SPECIALIST_CATALOG.map((s) => s.id)).size === SPECIALIST_CATALOG.length);
ok("ids are slugs", SPECIALIST_CATALOG.every((s) => /^[a-z0-9][a-z0-9.#-]*$/.test(s.id)));
ok("descriptions are not the prompt body (bundle stays lean)", SPECIALIST_CATALOG.every((s) => s.description.length < 900));

section("3. digests are real, not decoration");
const recomputed = new Map<string, string>();
for (const f of onDisk) {
  const bodyMatch = parseFrontmatter(read(path.join("vendor/voltagent-specialists/agents", f))).body;
  // map file -> id via the catalog's naming: `<category>--<id>.md`
  const sep = f.indexOf("--");
  const idGuess = f.slice(sep + 2).replace(/\.md$/, "");
  recomputed.set(idGuess, `sha256:${createHash("sha256").update(bodyMatch).digest("hex")}`);
}
const matched = SPECIALIST_CATALOG.filter((s) => recomputed.get(s.id) === s.bodyDigest).length;
ok(`digest recomputed from disk matches for every entry (${matched}/${SPECIALIST_CATALOG.length})`, matched === SPECIALIST_CATALOG.length, `${matched}`);

const reg = createRegistry();
const tampered = reg.tampered(new Map([[SPECIALIST_CATALOG[0].id, "sha256:0000000000000000000000000000000000000000000000000000000000000000"]]));
ok("a mismatched digest is reported as tampered", tampered.length === 1 && tampered[0].id === SPECIALIST_CATALOG[0].id, JSON.stringify(tampered.map((t) => t.id)));

section("4. resolution is total and fail-closed");
ok("registry resolves a known id", reg.byId("typescript-pro") !== null);
ok("registry returns null for an unknown id — never a fallback agent", reg.byId("does-not-exist") === null);
ok("stats count matches the catalog", registryStats(reg).count === SPECIALIST_CATALOG.length);
ok("stats do not round up or inflate", registryStats(reg).count <= onDisk.length);

section("5. the tool ceiling is enforced against THIS host");
const host = ["Read", "Grep", "Glob", "Bash", "Write", "Edit"];
const grantable = reg.grantableFor("typescript-pro", host);
ok("grantable tools are a subset of the declared ceiling", (() => {
  const meta = reg.byId("typescript-pro");
  return !!meta && grantable.every((t) => meta.allowedTools.includes(t));
})(), grantable.join(","));
ok("a tool the specialist did not declare is never grantable", !reg.grantableFor("typescript-pro", [...host, "ArbitraryNewTool"]).includes("ArbitraryNewTool"));
ok("an unknown specialist grants nothing", reg.grantableFor("nope", host).length === 0);
const quarantined = reg.quarantined([]);
ok("with no host tools at all, every specialist quarantines", quarantined.length === SPECIALIST_CATALOG.length, String(quarantined.length));

section("6. the merge did not smuggle in capability");
const declared = new Set<string>();
for (const s of SPECIALIST_CATALOG) for (const t of s.allowedTools) declared.add(t);
const hostOnly = [...declared].filter((t) => !host.includes(t));
ok("catalog declares tools this host cannot grant, and the router must cope with that", hostOnly.length > 0, hostOnly.join(","));
ok("no specialist declares an escalation-shaped tool the host does not already have", ![...declared].some((t) => /^(sudo|rm-rf|shell|exec$)/i.test(t)));

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { for (const f of failures) console.log(`  ! ${f}`); process.exit(1); }

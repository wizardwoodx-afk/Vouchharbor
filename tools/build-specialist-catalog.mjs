#!/usr/bin/env node
/**
 * Specialist catalog builder — VH-19 "AI Agentic MoE" layer (17.10.11).
 *
 * Turns the vendored MIT catalog (vendor/voltagent-specialists/agents/*.md) into:
 *
 *   1. vendor/voltagent-specialists/index.json  — full machine index, host-side
 *   2. src/moe/catalog.gen.ts                   — metadata-only module for the
 *                                                  browser bundle and the router
 *
 * Design constraints, all enforced below:
 *   • Deterministic: sorted input, no timestamps, so a rebuild is byte-identical.
 *     The byte-pin gates in this repo (mcp engine, offline pack) rely on that.
 *   • Prompt BODIES never enter src/. The browser must not carry 168 agent
 *     personas it will never execute, and shipping them would leak prompt
 *     structure to anyone who opens devtools. Bodies stay on the host and are
 *     read at dispatch time, where the GuardRail and the human gate apply.
 *   • Every body gets a SHA-256 digest. A tampered specialist file is caught at
 *     dispatch, not silently used. This is the same discipline the repo already
 *     applies to its own engine bundles.
 *   • The `tools:` frontmatter becomes an explicit permission ceiling
 *     (`allowedTools`). A specialist can never be handed a tool it did not
 *     declare, so merging an upstream catalog cannot widen what an agent may do.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendoredDir = path.join(root, "vendor", "voltagent-specialists");
const agentsDir = path.join(vendoredDir, "agents");
const outIndex = path.join(vendoredDir, "index.json");
const outTs = path.join(root, "src", "moe", "catalog.gen.ts");

if (!existsSync(agentsDir)) {
  console.error(`specialist-catalog: ${agentsDir} is missing. Re-vendor per vendor/voltagent-specialists/NOTICE.`);
  process.exit(2);
}

/* ---------------------------------- parse ---------------------------------- */

/** Minimal frontmatter reader: `key: value` pairs between the first `---` pair. */
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { meta: {}, body: text };
  const meta = {};
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

const TITLE_CASE = /(^|[\s-])([a-z])/g;
function toTitle(slug) {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(TITLE_CASE, (_m, sep, ch) => sep + ch.toUpperCase())
    .trim();
}

/** Capability keywords, derived from description + tags. The router scores on these. */
function keywordsFrom(...parts) {
  const stop = new Set([
    "the", "and", "for", "with", "this", "that", "from", "into", "your", "you", "are", "when", "use", "agent",
    "need", "needs", "using", "across", "other", "than", "then", "them", "they", "their", "will", "would",
    "should", "must", "not", "but", "all", "any", "can", "have", "has", "been", "were", "which", "while",
    "about", "above", "under", "over", "out", "its", "via", "per", "off", "same", "such", "only", "very",
    "also", "often", "either", "neither", "each", "some", "most", "more", "less", "less", "least", "make",
    "makes", "made", "take", "takes", "taken", "give", "gives", "given", "get", "gets", "let", "put",
    "specific", "general", "rather", "instead", "requires", "required", "explicitly", "documented",
    "primary", "detailed", "comprehensive", "structured", "including", "prioritize", "invoke",
  ]);
  const counts = new Map();
  for (const part of parts) {
    for (const raw of String(part || "").toLowerCase().split(/[^a-z0-9+#.]+/)) {
      const w = raw.replace(/^\.+|\.+$/g, "");
      if (w.length < 3 || w.length > 24 || stop.has(w) || /^\d+$/.test(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 18)
    .map(([w]) => w);
}

const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md")).sort();
const specialists = [];
const problems = [];

for (const file of files) {
  const raw = readFileSync(path.join(agentsDir, file), "utf8");
  const { meta, body } = parseFrontmatter(raw);
  const sep = file.indexOf("--");
  const category = sep > 0 ? file.slice(0, sep) : "uncategorised";
  const id = (meta.name || (sep > 0 ? file.slice(sep + 2).replace(/\.md$/, "") : file.replace(/\.md$/, "")))
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

  if (!meta.description) problems.push(`${file}: no description — cannot be routed to`);

  const allowedTools = (meta.tools || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .sort();

  specialists.push({
    id,
    title: toTitle(id),
    category,
    description: (meta.description || "").trim(),
    allowedTools,
    modelPreference: (meta.model || "inherit").trim(),
    keywords: keywordsFrom(meta.description, id.replace(/-/g, " "), category.replace(/[-\d]/g, " ")),
    sourceFile: `vendor/voltagent-specialists/agents/${file}`,
    bodyBytes: Buffer.byteLength(body, "utf8"),
    bodyDigest: `sha256:${createHash("sha256").update(body).digest("hex")}`,
  });
}

/* deterministic order so a rebuild is byte-identical */
specialists.sort((a, b) => a.id.localeCompare(b.id) || a.category.localeCompare(b.category));

const byId = new Set();
for (const s of specialists) {
  if (byId.has(s.id)) problems.push(`duplicate specialist id: ${s.id}`);
  byId.add(s.id);
}
const categories = [...new Set(specialists.map((s) => s.category))].sort();

/* ---------------------------------- write ---------------------------------- */

writeFileSync(
  outIndex,
  `${JSON.stringify(
    {
      schema: "vh-specialist-index/1",
      source: {
        project: "VoltAgent/awesome-claude-code-subagents",
        url: "https://github.com/VoltAgent/awesome-claude-code-subagents",
        pinnedCommit: "3097abe2d0d1e83a9023c7a8d054c00aace24990",
        license: "MIT",
        licenseFile: "vendor/voltagent-specialists/LICENSE-MIT",
      },
      count: specialists.length,
      categories,
      specialists,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const meta = specialists.map((s) => ({
  id: s.id,
  title: s.title,
  category: s.category,
  description: s.description,
  allowedTools: s.allowedTools,
  modelPreference: s.modelPreference,
  keywords: s.keywords,
  bodyBytes: s.bodyBytes,
  bodyDigest: s.bodyDigest,
}));

mkdirSync(path.dirname(outTs), { recursive: true });
writeFileSync(
  outTs,
  `/**
 * GENERATED by tools/build-specialist-catalog.mjs — do not edit.
 *
 * Metadata for the ${specialists.length} vendored MIT specialists behind VH-19.
 * Prompt bodies are intentionally NOT here: they live on the host under
 * vendor/voltagent-specialists/agents/ and are read at dispatch time, after the
 * GuardRail and the human gate. What the browser carries is the routing surface
 * and a SHA-256 digest so a tampered body is refused, not executed.
 */
import type { SpecialistMeta } from "./types";

export const SPECIALIST_SOURCE = {
  project: "VoltAgent/awesome-claude-code-subagents",
  url: "https://github.com/VoltAgent/awesome-claude-code-subagents",
  pinnedCommit: "3097abe2d0d1e83a9023c7a8d054c00aace24990",
  license: "MIT",
} as const;

export const SPECIALIST_CATEGORIES = ${JSON.stringify(categories)} as readonly string[];

export const SPECIALIST_CATALOG: readonly SpecialistMeta[] = ${JSON.stringify(meta, null, 2)} as const satisfies readonly SpecialistMeta[];
`,
  "utf8",
);

console.log(`specialist-catalog: ${specialists.length} specialists across ${categories.length} categories`);
console.log(`  -> ${path.relative(root, outIndex)}`);
console.log(`  -> ${path.relative(root, outTs)}`);
if (problems.length) {
  console.log(`  ! ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 10)) console.log(`     ${p}`);
  process.exitCode = 1;
}

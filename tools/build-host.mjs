#!/usr/bin/env node
/**
 * Build the A2A host engine bundle (tools/vh-host-engine.mjs).
 *
 * Same discipline as the MCP router and the offline verification pack: one
 * committed, self-contained bundle that the launcher (tools/vh-host.mjs)
 * loads — no build step at runtime, only Node. `probe/a2aRuntime.test.ts`
 * rebuilds this bundle in a temp dir and byte-compares it against the shipped
 * one, so a stale bundle (source changed, engine not rebuilt) fails the gate
 * instead of silently shipping an unmounted or out-of-date listener.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const esbuild = path.join(root, "node_modules", ".bin", "esbuild");
execFileSync(esbuild, [
  "tools/vh-host.entry.ts",
  "--bundle",
  "--platform=node",
  "--format=esm",
  "--packages=external",
  "--outfile=tools/vh-host-engine.mjs",
  "--log-level=warning",
], { cwd: root, stdio: "inherit" });

const bundlePath = path.join(root, "tools", "vh-host-engine.mjs");
const sha = createHash("sha256").update(readFileSync(bundlePath)).digest("hex");
writeFileSync(path.join(root, "tools", "vh-host-engine.sha256"), `${sha}  tools/vh-host-engine.mjs\n`);
console.log("a2a host engine: tools/vh-host-engine.mjs + tools/vh-host-engine.sha256 (commit both; probe/a2aRuntime pins them)");

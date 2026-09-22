/**
 * The specialist pack — every engine, every tool, every specialist, in one place.
 *
 * This is the generalist counterpart to the finance pack: same contract, same discipline,
 * different domains. Nothing here is domain-specific in the shell — a tool declares its
 * fields and its engine, and the surface renders itself from that declaration. Adding a
 * domain therefore never means touching the UI, which is the property that makes this a pack
 * rather than a feature.
 */
export * from "./types";
export * from "./frontend";
export * from "./dev";
export * from "./api";
export * from "./data";
export * from "./security";
export * from "./ops";
export * from "./docs";
export * from "./growth";
export * from "./roster";

import type { Domain, Tool } from "./types";
import { FRONTEND_TOOLS } from "./frontend";
import { DEV_TOOLS } from "./dev";
import { API_TOOLS } from "./api";
import { DATA_TOOLS } from "./data";
import { SECURITY_TOOLS } from "./security";
import { OPS_TOOLS } from "./ops";
import { DOCS_TOOLS } from "./docs";
import { GROWTH_TOOLS } from "./growth";

/** Every tool in the pack, in the order the surface shows them. */
export const TOOLS: readonly Tool[] = Object.freeze([
  ...FRONTEND_TOOLS, ...DEV_TOOLS, ...API_TOOLS, ...DATA_TOOLS,
  ...SECURITY_TOOLS, ...OPS_TOOLS, ...DOCS_TOOLS, ...GROWTH_TOOLS,
]);

export interface DomainInfo {
  id: Domain;
  label: string;
  blurb: string;
}

/**
 * The domain table. `finance-in` is the Indian-finance pack (src/munshi) — it is listed here
 * because it is part of the same surface, and its own tools and roster live where they were
 * built rather than being copied into this file.
 */
export const DOMAINS: readonly DomainInfo[] = Object.freeze([
  { id: "frontend", label: "Frontend", blurb: "Colour, contrast, type and spacing — the parts of design that are arithmetic." },
  { id: "dev", label: "Engineering", blurb: "Versions, commits, status codes, retry ladders and schedules." },
  { id: "api", label: "API", blurb: "Rate limits, payload budgets, idempotency keys and paging." },
  { id: "data", label: "Data", blurb: "Percentiles, outliers, experiment readouts and sample sizing." },
  { id: "security", label: "Security", blurb: "Secret shapes, token decoding, headers and entropy — as measures, not verdicts." },
  { id: "ops", label: "Reliability", blurb: "Error budgets, capacity runway, severity and deploy risk." },
  { id: "docs", label: "Docs", blurb: "Reading level, length, heading structure and terminology drift." },
  { id: "growth", label: "Growth", blurb: "Unit economics, funnels, prioritisation and revenue trajectory." },
  { id: "finance-in", label: "Finance · India", blurb: "GST, TDS, ITC reconciliation, MSME clocks — the Munshi pack." },
]);

export function toolsForDomain(domain: Domain): Tool[] {
  return TOOLS.filter((t) => t.domain === domain);
}

export function toolById(id: string): Tool | undefined {
  return TOOLS.find((t) => t.id === id);
}

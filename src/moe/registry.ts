/**
 * Specialist registry — validates what the router is allowed to believe.
 * (17.10.11)
 *
 * The catalog is GENERATED from third-party MIT files. Generation makes it
 * current; this makes it trustworthy. Three questions, each with a hard answer:
 *
 *   Q: what tools may a specialist ask for?
 *   A: only its declared ceiling, intersected with what this host can grant.
 *
 *   Q: what happens when a vendored body has been edited after the build?
 *   A: the digest stops matching and the specialist is quarantined, not run.
 *      An upstream prompt file is the one part of this system that a pull request
 *      can change with no code review, so it gets integrity-checked like a binary.
 *
 *   Q: can a specialist be routed to that is not in the catalog?
 *   A: no. Unknown ids resolve to null everywhere, never to "the generalist
 *      should be able to handle it" — that is how allow-lists become theatre.
 */
import { SPECIALIST_CATALOG, SPECIALIST_CATEGORIES, SPECIALIST_SOURCE } from "./catalog.gen";
import type { SpecialistMeta } from "./types";

export interface RegistryView {
  specialists: readonly SpecialistMeta[];
  categories: readonly string[];
  source: typeof SPECIALIST_SOURCE;
  byId(id: string): SpecialistMeta | null;
  /** tools this specialist may use on THIS host — ceiling ∩ inventory */
  grantableFor(id: string, hostInventory: readonly string[]): string[];
  /** specialists whose declared ceiling is entirely unservable here */
  quarantined(hostInventory: readonly string[]): SpecialistMeta[];
  /** bodies whose digest no longer matches what was built */
  tampered(actualDigests: ReadonlyMap<string, string>): SpecialistMeta[];
}

/**
 * Build a registry. `catalog` is injectable so a probe can feed it a tampered
 * tree — a security check you cannot test is a security check you do not have.
 */
export function createRegistry(catalog: readonly SpecialistMeta[] = SPECIALIST_CATALOG): RegistryView {
  const index = new Map<string, SpecialistMeta>();
  for (const s of catalog) {
    // first-wins on a duplicate id, deterministically: a collision must never be
    // resolved by iteration order of a Map overwrite
    if (!index.has(s.id)) index.set(s.id, s);
  }
  const list = [...index.values()].sort((a, b) => a.id.localeCompare(b.id));

  return {
    specialists: list,
    categories: SPECIALIST_CATEGORIES,
    source: SPECIALIST_SOURCE,
    byId(id) {
      return index.get(id) ?? null;
    },
    grantableFor(id, hostInventory) {
      const s = index.get(id);
      if (!s) return [];
      const host = new Set(hostInventory);
      return [...s.allowedTools].filter((t) => host.has(t)).sort();
    },
    quarantined(hostInventory) {
      const host = new Set(hostInventory);
      return list.filter((s) => s.allowedTools.length === 0 || !s.allowedTools.some((t) => host.has(t)));
    },
    tampered(actualDigests) {
      return list.filter((s) => {
        const actual = actualDigests.get(s.id);
        return actual !== undefined && actual !== s.bodyDigest;
      });
    },
  };
}

/**
 * Capability summary for the UI and for the SelfReport. Deliberately does NOT
 * round up, pad, or describe vendored prompt files as "agents trained on X".
 */
export function registryStats(reg: RegistryView) {
  const perCategory = new Map<string, number>();
  const toolUse = new Map<string, number>();
  for (const s of reg.specialists) {
    perCategory.set(s.category, (perCategory.get(s.category) ?? 0) + 1);
    for (const t of s.allowedTools) toolUse.set(t, (toolUse.get(t) ?? 0) + 1);
  }
  return {
    count: reg.specialists.length,
    categories: reg.categories.length,
    perCategory: [...perCategory.entries()].sort((a, b) => b[1] - a[1]),
    /** how many specialists ask for a tool this host cannot grant at all */
    widestCeilings: [...toolUse.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
    license: reg.source,
    totalPromptBytes: reg.specialists.reduce((a, s) => a + s.bodyBytes, 0),
  };
}

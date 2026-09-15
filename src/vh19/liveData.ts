/**
 * VH-19 — the live-data GuardRail (19.2.0): a runtime control, not a prompt ask.
 *
 * The 19.1.0 review was right: a prompt line saying "date your findings"
 * is not a GuardRail. This module is the enforcement half, and it runs on
 * EVERY answered research/analysis reply, inside the pipeline, whether or
 * not the model cooperated:
 *
 *   1. detect_live_data_required — the ANSWER itself is scanned: a reply
 *      in a time-sensitive domain (research/analysis) that makes
 *      time-sensitive claims (prices, versions, CVEs, "latest", years…)
 *      requires live evidence.
 *   2. evidence check — dated sources: URLs plus as-of/date markers.
 *   3. verdict — verified, or an explicit STALE FLAG appended to the
 *      reply itself and sealed inside the provenance digest.
 *
 * Honest boundary: VH ships no web-search provider (no external services
 * by design), so this control cannot perform the search — it enforces the
 * disclosure instead. An unverified answer is labelled knowledge-cutoff
 * data; it is never dressed as fresh, and the verdict rides in the digest
 * so the log cannot show a clean stamp over a stale answer.
 */

import type { LiveDataVerdict } from "./types";

/** Domains where freshness is a safety property, not a preference. */
const LIVE_CATEGORIES = new Set(["research", "analysis"]);

/** Time-sensitive claim markers. Deliberately conservative: bare "version" or "now" do not trigger; "version 3.2" and "as of" do. */
const TIME_SENSITIVE =
  /\b(?:latest|current|today|tonight|yesterday|this (?:week|month|year)|last (?:week|month|year)|news|price|prices|pricing|stock|stocks|inflation|interest rates?|election|elections|cve-\d{4}-\d+|vulnerabilit(?:y|ies)|exploit|exploits|as of)\b|\bversion\s+\d+(?:\.\d+)*|\b(?:19|20)\d{2}\b/gi;

const MONTH_DATE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}\b/gi;
const ISO_DATE = /\b(?:19|20)\d{2}-\d{2}(?:-\d{2})?\b/g;
const URL = /https?:\/\/[^\s)"'<>]+/g;

/** Claim markers found in a text (deduped, capped — these are shown to the user). */
export function detectTimeSensitiveClaims(text: string): string[] {
  const hits = text.match(TIME_SENSITIVE);
  return hits ? [...new Set(hits.map((h) => h.toLowerCase().trim()))].slice(0, 8) : [];
}

/** The evidence side: URLs and dated-claim markers in the reply. */
export function assessReplyEvidence(reply: string): { sources: number; datedClaims: number } {
  const sources = (reply.match(URL) ?? []).length;
  const datedClaims =
    (reply.match(/as of\b/gi) ?? []).length +
    (reply.match(ISO_DATE) ?? []).length +
    (reply.match(MONTH_DATE) ?? []).length;
  return { sources, datedClaims };
}

/**
 * The runtime verdict. Returns null when there is nothing to enforce
 * (wrong domain, or the answer makes no time-sensitive claims) — the
 * GuardRail never invents a requirement, and never stays silent when
 * one exists.
 */
export function liveDataVerdict(reply: string, categories: string[]): LiveDataVerdict | null {
  if (!categories.some((c) => LIVE_CATEGORIES.has(c))) return null;
  const claims = detectTimeSensitiveClaims(reply);
  if (claims.length === 0) return null;
  const { sources, datedClaims } = assessReplyEvidence(reply);
  const verified = sources > 0 && datedClaims > 0;
  const shown = claims.slice(0, 3).join(", ");
  return {
    required: true,
    verified,
    claims,
    sources,
    datedClaims,
    note: verified
      ? `Time-sensitive claims (${shown}…) carry dated live sources — ${sources} URL(s), ${datedClaims} dated claim(s).`
      : `Time-sensitive claims (${shown}…) carry NO dated live sources — ${sources} URL(s), ${datedClaims} dated claim(s). Flagged as unverified.`,
  };
}

/** The stale flag — appended to the reply itself, so it travels with the answer into the digest. */
export function liveDataBanner(v: LiveDataVerdict): string {
  return (
    `\n\n⚠ LIVE-DATA CHECK (runtime GuardRail): this answer makes time-sensitive claims (${v.claims.slice(0, 4).join(", ")}) ` +
    `but carries no dated live sources (${v.sources} URL(s), ${v.datedClaims} dated claim(s)). VH ships no web-search provider, ` +
    `so treat this as knowledge-cutoff data until verified — flagged honestly instead of dressed as fresh.`
  );
}

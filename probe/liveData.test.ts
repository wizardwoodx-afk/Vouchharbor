/**
 * probe/liveData.test.ts — the live-data GuardRail (19.2.0).
 *
 * Pins the runtime control the 19.1.0 review demanded: freshness is not
 * a prompt ask — every answered research/analysis reply is ASSESSED at
 * runtime; time-sensitive claims without dated live sources get the
 * stale flag appended to the reply itself and sealed in the provenance
 * digest; verified answers carry the verdict; other domains are left
 * alone; and the module never claims to perform a search it cannot do.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { askVH19, responseCanonical } from "../src/vh19/generalist";
import { assessReplyEvidence, detectTimeSensitiveClaims, liveDataBanner, liveDataVerdict } from "../src/vh19/liveData";
import type { ProviderConfig } from "../src/vh19/types";

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail?: unknown): void => {
  if (cond) pass++;
  else {
    fail++;
    console.error(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
};

const prov: ProviderConfig = { kind: "openai-compatible", baseUrl: "https://api.openai.com/v1", apiKey: "sk-test-abcdefgh123456789", model: "gpt-test" };

const scripted = (answer: string) =>
  (async () => new Response(JSON.stringify({ choices: [{ message: { content: answer } }] }), { status: 200 })) as unknown as typeof fetch;

test("live-data GuardRail — runtime enforcement, not a prompt ask", async () => {
  console.log("── claim detection ──");
  check("time-sensitive claims are detected", detectTimeSensitiveClaims("the latest CVE-2024-1234 patch and current pricing as of March 2026").length >= 3);
  check("a timeless answer triggers nothing", detectTimeSensitiveClaims("The scientific method: observe, hypothesize, test, repeat.").length === 0);
  check("bare 'version' does not trigger; 'version 3.2' does", detectTimeSensitiveClaims("check the version field").length === 0 && detectTimeSensitiveClaims("upgrade to version 3.2 now").length > 0);

  console.log("── evidence assessment ──");
  const good = assessReplyEvidence("Per the report (https://example.org/r) as of 2026-03-01, prices rose.");
  check("URLs and dated claims are counted", good.sources === 1 && good.datedClaims >= 2, good);
  const bare = assessReplyEvidence("Prices rose a lot recently.");
  check("an unsourced claim scores zero evidence", bare.sources === 0 && bare.datedClaims === 0);

  console.log("── verdicts ──");
  const vBad = liveDataVerdict("The latest pricing is $9 and the current market moved in 2026.", ["research"]);
  check("research + time-sensitive claims + no evidence ⇒ required, NOT verified", vBad !== null && vBad.required === true && vBad.verified === false);
  const vGood = liveDataVerdict("As of 2026-03-01, per https://example.org/r, the current price is $9.", ["research"]);
  check("dated live sources ⇒ verified", vGood !== null && vGood.verified === true);
  check("a code answer is never flagged, whatever it says", liveDataVerdict("the latest version 9.9 pricing today", ["code"]) === null);
  check("a research answer with no time-sensitive claims is not flagged", liveDataVerdict("The scientific method: observe, hypothesize, test.", ["research"]) === null);
  check("the banner is honest about VH having no search provider", liveDataBanner(vBad!).includes("no web-search provider") && liveDataBanner(vBad!).includes("knowledge-cutoff"));

  console.log("── pipeline integration ──");
  const stale = await askVH19({ text: "research the current market trends for electric vehicles", userId: "ld-user" }, { provider: prov, fetchImpl: scripted("The current EV market is growing fast and prices dropped in 2026.") });
  check("an unsourced time-sensitive research answer is FLAGGED at runtime", stale.liveData !== undefined && stale.liveData.required === true && stale.liveData.verified === false, stale.liveData);
  check("the stale flag is appended to the reply itself", stale.reply.includes("LIVE-DATA CHECK") && stale.reply.includes("knowledge-cutoff"));
  check("the verdict rides inside the provenance digest", JSON.parse(responseCanonical({ ...stale, provenanceDigest: "" })).liveData?.verified === false);

  const fresh = await askVH19({ text: "research the current market trends for electric vehicles", userId: "ld-user" }, { provider: prov, fetchImpl: scripted("As of 2026-03-01, per https://example.org/ev-report, the current EV market grew 12%.") });
  check("a sourced, dated answer verifies — and no banner is appended", fresh.liveData?.verified === true && !fresh.reply.includes("LIVE-DATA CHECK"));

  const code = await askVH19({ text: "refactor the typescript parser types", userId: "ld-user" }, { provider: prov, fetchImpl: scripted("Here is the refactor with the latest types for version 2.0 today.") });
  check("non-research/analysis answers are left alone", code.liveData === undefined && !code.reply.includes("LIVE-DATA CHECK"));

  const timeless = await askVH19({ text: "research the history of the scientific method", userId: "ld-user" }, { provider: prov, fetchImpl: scripted("The scientific method: observe, hypothesize, test, repeat. Bacon formalized it.") });
  check("a timeless research answer is not flagged", timeless.liveData === undefined);

  const planned = await askVH19({ text: "research the current market trends for electric vehicles", userId: "ld-user" });
  check("a planned (non-executed) answer gets no live-data verdict — nothing was answered", planned.liveData === undefined && planned.outcome === "planned");

  assert.equal(fail, 0, `${fail} liveData checks failed`);
  console.log(`liveData probe: ${pass} passed, ${fail} failed`);
});

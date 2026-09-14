/**
 * probe/collabInvite.test.ts — signed collaboration invitations (18.2.0).
 *
 * The reviewer's gap, closed and pinned: User 1 creates a SIGNED invitation
 * (scope, risk ceiling, duration); User 2 verifies it; approvals are signed
 * by the approver's own key. A tampered payload, a foreign signature, a
 * forged approval or an approver mismatch all refuse. First contact is
 * trust-on-first-use and says so — the bytes are not.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

if (typeof globalThis.localStorage === "undefined") {
  const map = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

import {
  collabIdentity,
  createInvitation,
  parseInvitation,
  serializeInvitation,
  signApproval,
  verifyApproval,
} from "../src/vh19/collabInvite";
import { approveTeamEvolution, proposeTeamEvolution, recordTeamRun, teamIdFor } from "../src/vh19/teamEvolve";

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail?: unknown): void => {
  if (cond) pass++;
  else fail++;
  console.log(`  ${cond ? "✅" : "❌"} ${name}${cond || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
};

test("collabInvite — the invitation workflow is cryptographic, not ceremonial", async () => {
  console.log("\n── 1. identities ──");
  const a = await collabIdentity("harshen");
  const a2 = await collabIdentity("harshen");
  check("a member's identity key is stable across loads", a.publicJwk.x === a2.publicJwk.x);
  const b = await collabIdentity("qwen");
  check("different members get different keys", a.publicJwk.x !== b.publicJwk.x);

  console.log("\n── 2. invitations ──");
  const inv = await createInvitation({ from: "harshen", to: "qwen", scope: "one shared mission", riskCeiling: "safe", durationH: 24, capabilities: ["route", "delegate"] });
  check("the invite names scope, ceiling, duration and the issuer", inv.payload.scope === "one shared mission" && inv.payload.riskCeiling === "safe" && inv.payload.durationH === 24 && inv.payload.from === "harshen");
  check("the trust model is labeled TOFU, not overclaimed", inv.payload.trustModel === "tofu");
  const token = serializeInvitation(inv);
  const parsed = await parseInvitation(token);
  check("a round-tripped invite verifies against the issuer key", parsed.ok === true);
  const tampered = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
  tampered.payload.riskCeiling = "critical";
  const tamperedToken = btoa(JSON.stringify(tampered)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const badParse = await parseInvitation(tamperedToken);
  check("raising the ceiling in transit REFUSES — signature over the canonical bytes", badParse.ok === false && !badParse.ok && badParse.error.includes("tampered"));
  const swapped = await createInvitation({ from: "qwen", to: "harshen", scope: "x", riskCeiling: "safe", durationH: 1, capabilities: [] });
  const franken = { ...inv, payload: { ...inv.payload, issuerPublicJwk: swapped.payload.issuerPublicJwk } };
  const frankenParse = await parseInvitation(serializeInvitation(franken));
  check("a foreign public key on someone else's invite refuses", frankenParse.ok === false);
  check("garbage tokens refuse in words", (await parseInvitation("not-a-token")).ok === false);

  console.log("\n── 3. approvals are signed by the approver ──");
  assert.ok(parsed.ok);
  const approval = await signApproval(parsed.invite.digest, "qwen", true);
  check("the approver's own key signs the approval", (await verifyApproval(approval, "qwen")).ok === true);
  const mismatch = await verifyApproval(approval, "harshen");
  check("an approval presented for a different member refuses", mismatch.ok === false && !mismatch.ok && mismatch.error.includes("expects"));
  const forged = { ...approval, approved: true, approver: "qwen", at: approval.at, inviteDigest: approval.inviteDigest, publicJwk: a.publicJwk, signatureB64: approval.signatureB64 };
  const forgedCheck = await verifyApproval(forged, "qwen");
  check("Harshen's key cannot sign Qwen's consent", forgedCheck.ok === false);
  const flipped = { ...approval, approved: false };
  check("flipping approved without re-signing refuses", (await verifyApproval(flipped, "qwen")).ok === false);

  console.log("\n── 4. teamEvolve accepts signed consent ──");
  const TEAM = teamIdFor(["harshen", "qwen"]);
  for (const [task, outcome, specs] of [
    ["t1", "verified", ["code.debugging", "testing.unit"]],
    ["t2", "verified", ["review.code", "security.review"]],
    ["t3", "failed", ["code.typescript"]],
  ] as const) {
    recordTeamRun({ teamId: TEAM, members: ["harshen", "qwen"], task, outcome, specialists: [...specs] });
  }
  const prop = await proposeTeamEvolution(TEAM, ["harshen", "qwen"]);
  assert.ok(prop.ok);
  const signedH = await signApproval(prop.proposal.digest, "harshen", true);
  const signedQ = await signApproval(prop.proposal.digest, "qwen", true);
  const adopt = await approveTeamEvolution(
    TEAM,
    prop.proposal.id,
    [
      { memberId: "harshen", approved: true, at: signedH.at },
      { memberId: "qwen", approved: true, at: signedQ.at },
    ],
    undefined,
    [signedH, signedQ],
  );
  check("unanimous SIGNED approvals adopt", adopt.ok === true);
  const prop2 = await proposeTeamEvolution(TEAM, ["harshen", "qwen"]);
  assert.ok(prop2.ok);
  const lyingSigned = { ...signedQ, approved: true, at: new Date().toISOString() };
  const reject = await approveTeamEvolution(
    TEAM,
    prop2.proposal.id,
    [
      { memberId: "harshen", approved: true, at: new Date().toISOString() },
      { memberId: "qwen", approved: true, at: new Date().toISOString() },
    ],
    undefined,
    [signedH, lyingSigned],
  );
  check("a stale/foreign signed approval against the new proposal refuses", reject.ok === false && !reject.ok);

  console.log(`\n${fail === 0 ? "✅" : "❌"} collabInvite probe: ${pass} passed, ${fail} failed\n`);
  assert.equal(fail, 0, `${fail} collabInvite checks failed`);
});

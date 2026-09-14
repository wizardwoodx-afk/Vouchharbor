/**
 * probe/collabInvite.test.ts — hardened collaboration identity (18.3.0).
 *
 * Pins the review-driven fixes:
 *   1. private keys are AES-GCM encrypted at rest under a passphrase —
 *      localStorage never contains a private key, plaintext 18.2.0 blobs
 *      are PURGED, a wrong passphrase refuses;
 *   2. verifyApproval resolves the approver's key from the BOUND registry:
 *      an attacker's fresh key wearing "qwen" refuses, an unbound member
 *      refuses, a mismatched presented key refuses;
 *   3. accepting an invitation is the human act that binds the issuer;
 *   4. teamEvolve adoption verifies every signed approval against bindings.
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
  acceptInvitation,
  bindPeerIdentity,
  clearRegistry,
  createInvitation,
  ensureIdentity,
  forgetIdentity,
  identityUnlocked,
  listBoundPeers,
  parseInvitation,
  serializeInvitation,
  signApproval,
  storedPublicJwk,
  unbindPeer,
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

const PASS = "correct-horse-battery";

test("collabInvite — identity is sealed, binding is enforced", async () => {
  console.log("\n── 1. keys at rest ──");
  check("a short passphrase refuses to mint an identity", (await ensureIdentity("harshen", "tiny")).ok === false);
  const h = await ensureIdentity("harshen", PASS);
  check("a passphrase mints the identity", h.ok === true && h.created === true);
  const storedRaw = localStorage.getItem("vh19.collab.key.v2:harshen") ?? "";
  const priv = (await globalThis.crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])).privateKey;
  const privJwk = await globalThis.crypto.subtle.exportKey("jwk", priv);
  check("localStorage holds NO private key material", !storedRaw.includes(privJwk.d ?? "absent-sentinel") && !storedRaw.includes('"d":'));
  check("the public half is exactly what is stored in the open", JSON.stringify(storedPublicJwk("harshen")) === JSON.stringify((h as { publicJwk: JsonWebKey }).publicJwk));
  forgetIdentity("harshen");
  const wrong = await ensureIdentity("harshen", "wrong-passphrase-123");
  check("a wrong passphrase refuses — the key stays sealed", wrong.ok === false && !wrong.ok && wrong.error.includes("wrong passphrase"));
  check("refused unlock leaves the identity locked", identityUnlocked("harshen") === false);
  await ensureIdentity("harshen", PASS);
  check("the right passphrase re-unlocks and the public key is unchanged", (await ensureIdentity("harshen", PASS)) && JSON.stringify(storedPublicJwk("harshen")) === JSON.stringify((h as { publicJwk: JsonWebKey }).publicJwk));

  console.log("\n── 2. legacy plaintext blobs are purged ──");
  localStorage.setItem("vh19.collab.key.v1:legacyuser", JSON.stringify({ pub: { kty: "EC" }, priv: { kty: "EC", d: "PLAINTEXT" } }));
  await ensureIdentity("legacyuser", PASS);
  check("the 18.2.0 plaintext blob is gone after first contact", localStorage.getItem("vh19.collab.key.v1:legacyuser") === null);
  check("legacy user got a sealed v2 identity", localStorage.getItem("vh19.collab.key.v2:legacyuser") !== null);

  console.log("\n── 3. invitations ──");
  const q = await ensureIdentity("qwen", PASS);
  const invR = await createInvitation({ from: "harshen", to: "qwen", scope: "one shared mission", riskCeiling: "safe", durationH: 24, capabilities: [] });
  check("an unlocked identity mints a signed invite", "digest" in invR);
  assert.ok("digest" in invR);
  check("scope, ceiling, duration and TOFU model ride in the payload", invR.payload.scope === "one shared mission" && invR.payload.riskCeiling === "safe" && invR.payload.trustModel === "tofu");
  forgetIdentity("harshen");
  const lockedMint = await createInvitation({ from: "harshen", to: "qwen", scope: "x", riskCeiling: "safe", durationH: 1, capabilities: [] });
  check("a LOCKED identity cannot mint invites", lockedMint.ok === false && !lockedMint.ok && lockedMint.error.includes("locked"));
  await ensureIdentity("harshen", PASS);
  const parsed = await parseInvitation(serializeInvitation(invR));
  check("a round-tripped invite verifies", parsed.ok === true);
  const tampered = JSON.parse(JSON.stringify(invR));
  tampered.payload.riskCeiling = "critical";
  check("raising the ceiling in transit refuses", (await parseInvitation(serializeInvitation(tampered))).ok === false);

  console.log("\n── 4. binding closes the attacker-key hole ──");
  clearRegistry();
  assert.ok(parsed.ok);
  const appr = await signApproval(parsed.invite.digest, "qwen", true);
  check("the approver's unlocked session key signs", appr !== null && !("ok" in appr));
  assert.ok(!("ok" in appr));
  const unbound = await verifyApproval(appr, "qwen");
  check("an UNBOUND member's approval refuses — no binding, no verification", unbound.ok === false && !unbound.ok && unbound.error.includes("no bound identity"));
  // attacker: fresh keypair, wearing qwen's name, honestly signed with their own key
  const atk = await globalThis.crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const atkJwk = await globalThis.crypto.subtle.exportKey("jwk", atk.publicKey);
  const atkPrivJwk = await globalThis.crypto.subtle.exportKey("jwk", atk.privateKey);
  const atkKey = await globalThis.crypto.subtle.importKey("jwk", atkPrivJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const body = { inviteDigest: parsed.invite.digest, approver: "qwen", approved: true, at: new Date().toISOString() };
  const canon = JSON.stringify(body, Object.keys(body).sort());
  const sig = await globalThis.crypto.subtle.sign({ name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" }, atkKey, new TextEncoder().encode(canon));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  const atkApproval = { ...body, publicJwk: atkJwk, signatureB64: b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") };
  bindPeerIdentity("qwen", (q as { publicJwk: JsonWebKey }).publicJwk, "manual");
  const atkVerdict = await verifyApproval(atkApproval, "qwen");
  check("attacker's fresh key + qwen's name REFUSES (the 18.2.0 hole, closed)", atkVerdict.ok === false && !atkVerdict.ok && atkVerdict.error.includes("does not match the bound identity"));
  const good = await verifyApproval(appr, "qwen");
  check("the real qwen approval verifies against the bound key", good.ok === true);
  const flipped = { ...appr, approved: false };
  check("flipping approved without re-signing refuses", (await verifyApproval(flipped, "qwen")).ok === false);

  console.log("\n── 5. accepting an invitation binds the issuer ──");
  clearRegistry();
  const accept = await acceptInvitation(parsed.invite, "qwen", true);
  check("acceptance signs consent AND binds the issuer in one human act", accept !== null && "approval" in accept && listBoundPeers().some((p) => p.memberId === "harshen" && p.source === "invite-acceptance"));
  unbindPeer("harshen");
  check("unbinding is a human act and takes effect", listBoundPeers().every((p) => p.memberId !== "harshen"));
  bindPeerIdentity("qwen", (q as { publicJwk: JsonWebKey }).publicJwk, "manual");
  bindPeerIdentity("harshen", (h as { publicJwk: JsonWebKey }).publicJwk, "manual");

  console.log("\n── 6. teamEvolve verifies against bindings ──");
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
  assert.ok(!("ok" in signedH) && !("ok" in signedQ));
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
  check("adoption verifies every signed approval against bindings", adopt.ok === true);
  const prop2 = await proposeTeamEvolution(TEAM, ["harshen", "qwen"]);
  assert.ok(prop2.ok);
  const stale = await approveTeamEvolution(
    TEAM,
    prop2.proposal.id,
    [
      { memberId: "harshen", approved: true, at: new Date().toISOString() },
      { memberId: "qwen", approved: true, at: new Date().toISOString() },
    ],
    undefined,
    [signedH, signedQ],
  );
  check("signatures over an old proposal digest refuse", stale.ok === false);

  console.log(`\n${fail === 0 ? "✅" : "❌"} collabInvite probe: ${pass} passed, ${fail} failed\n`);
  assert.equal(fail, 0, `${fail} collabInvite checks failed`);
});

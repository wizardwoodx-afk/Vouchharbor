import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/collabInvite.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// src/vh19/collabInvite.ts
var ID_KEY_PREFIX = "vh19.collab.key.v1:";
var enc = new TextEncoder();
function b64url(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(pad + "=".repeat((4 - pad.length % 4) % 4));
  const u8 = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
  return u8;
}
async function sha256Hex(text) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function canonical(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}
function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
async function collabIdentity(memberId) {
  const s = storage();
  const raw = s?.getItem(ID_KEY_PREFIX + memberId);
  if (raw) {
    const both = JSON.parse(raw);
    return { memberId, publicJwk: both.pub, privateJwk: both.priv };
  }
  const pair = await globalThis.crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const priv = await globalThis.crypto.subtle.exportKey("jwk", pair.privateKey);
  const pub = await globalThis.crypto.subtle.exportKey("jwk", pair.publicKey);
  s?.setItem(ID_KEY_PREFIX + memberId, JSON.stringify({ pub, priv }));
  return { memberId, publicJwk: pub, privateJwk: priv };
}
async function importPublic(jwk) {
  return globalThis.crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}
async function importPrivate(jwk) {
  return globalThis.crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}
var SIGN_PARAMS = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
async function createInvitation(args) {
  const ident = await collabIdentity(args.from);
  const payload = {
    v: "vh19-invite/1",
    id: `inv-${(args.now ?? (() => /* @__PURE__ */ new Date()))().getTime().toString(36)}`,
    from: args.from,
    to: args.to,
    scope: args.scope,
    riskCeiling: args.riskCeiling,
    durationH: args.durationH,
    capabilities: args.capabilities,
    message: args.message,
    createdAt: (args.now ?? (() => /* @__PURE__ */ new Date()))().toISOString(),
    issuerPublicJwk: ident.publicJwk,
    trustModel: "tofu"
  };
  const canon = canonical(payload);
  const key = await importPrivate(ident.privateJwk);
  const sig = await globalThis.crypto.subtle.sign(SIGN_PARAMS, key, enc.encode(canon));
  return { payload, signatureB64: b64url(sig), digest: await sha256Hex(canon + "." + b64url(sig)) };
}
async function parseInvitation(token) {
  let obj;
  try {
    obj = JSON.parse(new TextDecoder().decode(fromB64url(token.trim())));
  } catch {
    return { ok: false, error: "not a parseable invitation token" };
  }
  if (!obj.payload || obj.payload.v !== "vh19-invite/1" || !obj.signatureB64) {
    return { ok: false, error: "token is not a vh19-invite/1 payload" };
  }
  const canon = canonical(obj.payload);
  let verified;
  try {
    const key = await importPublic(obj.payload.issuerPublicJwk);
    verified = await globalThis.crypto.subtle.verify(SIGN_PARAMS, key, fromB64url(obj.signatureB64), enc.encode(canon));
  } catch {
    verified = false;
  }
  if (!verified) return { ok: false, error: "signature does not verify against the issuer key \u2014 the invite was tampered with or is not from its claimed issuer" };
  const digest = await sha256Hex(canon + "." + obj.signatureB64);
  if (obj.digest && obj.digest !== digest) return { ok: false, error: "invite digest mismatch" };
  return { ok: true, invite: { payload: obj.payload, signatureB64: obj.signatureB64, digest }, issuerVerified: true };
}
function serializeInvitation(inv) {
  return b64url(enc.encode(JSON.stringify(inv)));
}
async function signApproval(inviteDigest, approver, approved, now = () => /* @__PURE__ */ new Date()) {
  const ident = await collabIdentity(approver);
  const body = { inviteDigest, approver, approved, at: now().toISOString() };
  const key = await importPrivate(ident.privateJwk);
  const sig = await globalThis.crypto.subtle.sign(SIGN_PARAMS, key, enc.encode(canonical(body)));
  return { ...body, publicJwk: ident.publicJwk, signatureB64: b64url(sig) };
}
async function verifyApproval(a, expectedApprover) {
  if (a.approver !== expectedApprover) return { ok: false, error: `approval claims "${a.approver}" but the team expects "${expectedApprover}"` };
  const body = { inviteDigest: a.inviteDigest, approver: a.approver, approved: a.approved, at: a.at };
  try {
    const key = await importPublic(a.publicJwk);
    const ok = await globalThis.crypto.subtle.verify(SIGN_PARAMS, key, fromB64url(a.signatureB64), enc.encode(canonical(body)));
    return ok ? { ok: true } : { ok: false, error: `approval signature for "${a.approver}" does not verify` };
  } catch {
    return { ok: false, error: `approval signature for "${a.approver}" is not verifiable` };
  }
}

// src/app/id.ts
var n = 0;
function uid(prefix) {
  n += 1;
  return `${prefix}-${Date.now().toString(36)}-${n.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// src/vh19/teamEvolve.ts
var RUNS_KEY = "vh19.team.runs.v1";
var CONFIG_KEY = "vh19.team.config.v1";
var PENDING_KEY = "vh19.team.pending.v1";
var RUN_CAP = 200;
function storage2() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
async function sha256Hex2(text) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function teamIdFor(members) {
  const clean = Array.from(new Set(members.map((m) => m.trim().toLowerCase()).filter(Boolean))).sort();
  return `team:${clean.join("+")}`;
}
function recordTeamRun(run) {
  const rec = { id: run.id ?? uid("trun"), ts: run.ts ?? (/* @__PURE__ */ new Date()).toISOString(), ...run };
  const s = storage2();
  if (s) {
    const all = JSON.parse(s.getItem(RUNS_KEY) ?? "[]");
    all.push(rec);
    s.setItem(RUNS_KEY, JSON.stringify(all.slice(-RUN_CAP * 4)));
  }
  return rec;
}
function teamRuns(teamId) {
  const s = storage2();
  if (!s) return [];
  try {
    const all = JSON.parse(s.getItem(RUNS_KEY) ?? "[]");
    return all.filter((r) => r.teamId === teamId).slice(-RUN_CAP);
  } catch {
    return [];
  }
}
function teamMemoryReport(teamId) {
  const runs = teamRuns(teamId);
  const verified = runs.filter((r) => r.outcome === "verified");
  const perSpec = /* @__PURE__ */ new Map();
  for (const r of verified) for (const id of r.specialists) perSpec.set(id, (perSpec.get(id) ?? 0) + 1);
  return {
    runs: runs.length,
    verified: verified.length,
    failed: runs.filter((r) => r.outcome === "failed").length,
    refused: runs.filter((r) => r.outcome === "refused").length,
    successRate: runs.length === 0 ? 0 : verified.length / runs.length,
    topSpecialists: Array.from(perSpec.entries()).map(([id, verifiedRuns]) => ({ id, verifiedRuns })).sort((a, b) => b.verifiedRuns - a.verifiedRuns || a.id.localeCompare(b.id))
  };
}
async function proposeTeamEvolution(teamId, members, now = () => /* @__PURE__ */ new Date()) {
  const report = teamMemoryReport(teamId);
  if (report.runs < 3) {
    return { ok: false, error: `team has ${report.runs} recorded run(s) \u2014 at least 3 real runs are needed before an evolution proposal` };
  }
  if (report.verified < 1) {
    return { ok: false, error: "team has no verified runs \u2014 a team that has never succeeded has nothing to evolve from" };
  }
  const recommended = report.topSpecialists.slice(0, 3).map((e) => e.id);
  if (recommended.length < 2) {
    return { ok: false, error: "verified runs used fewer than 2 distinct specialists \u2014 not enough signal to recommend a composition" };
  }
  const verifiedRuns = teamRuns(teamId).filter((r) => r.outcome === "verified");
  const rationale = [
    `${report.verified}/${report.runs} joint runs verified (${Math.round(report.successRate * 100)}% success).`,
    ...recommended.map((id) => {
      const e = report.topSpecialists.find((x) => x.id === id);
      return `"${id}" proved out in ${e.verifiedRuns} verified run(s) \u2014 recommended for the evolved composition.`;
    })
  ];
  const proposal = {
    id: uid("evo"),
    teamId,
    members: Array.from(new Set(members)).sort(),
    createdAt: now().toISOString(),
    recommendedSpecialists: recommended,
    rationale,
    sourceRunIds: verifiedRuns.map((r) => r.id),
    digest: ""
  };
  proposal.digest = await sha256Hex2(JSON.stringify(["vh19-evolution/1", proposal.teamId, proposal.recommendedSpecialists, proposal.sourceRunIds, proposal.createdAt]));
  const s = storage2();
  if (s) s.setItem(`${PENDING_KEY}:${teamId}`, JSON.stringify(proposal));
  return { ok: true, proposal };
}
function pendingProposal(teamId) {
  const s = storage2();
  if (!s) return null;
  try {
    return JSON.parse(s.getItem(`${PENDING_KEY}:${teamId}`) ?? "null");
  } catch {
    return null;
  }
}
async function approveTeamEvolution(teamId, proposalId, approvals, now = () => /* @__PURE__ */ new Date(), signedApprovals = []) {
  const proposal = pendingProposal(teamId);
  if (!proposal || proposal.id !== proposalId) return { ok: false, error: `no pending proposal ${proposalId} for this team` };
  for (const sa of signedApprovals) {
    const member = approvals.find((a) => a.memberId === sa.approver);
    if (!member) return { ok: false, error: `signed approval from "${sa.approver}" has no matching team approval` };
    const v = await verifyApproval(sa, sa.approver);
    if (!v.ok) return { ok: false, error: v.error };
    if (sa.approved !== member.approved) return { ok: false, error: `signed consent of "${sa.approver}" contradicts the presented approval` };
  }
  const members = proposal.members;
  const seen = /* @__PURE__ */ new Set();
  for (const a of approvals) {
    if (!members.includes(a.memberId)) return { ok: false, error: `"${a.memberId}" is not a member of this team \u2014 outsider approvals are refused` };
    if (seen.has(a.memberId)) return { ok: false, error: `duplicate approval from "${a.memberId}" \u2014 one voice per member` };
    seen.add(a.memberId);
    if (!a.approved) return { ok: false, error: `"${a.memberId}" declined the evolution \u2014 a decline is not adopted` };
  }
  const missing = members.filter((m) => !seen.has(m));
  if (missing.length > 0) {
    return { ok: false, error: `missing explicit approval from: ${missing.join(", ")} \u2014 EVERY member must approve; there is no partial adoption` };
  }
  const prev = evolvedConfig(teamId);
  const config = {
    teamId,
    version: (prev?.version ?? 0) + 1,
    specialists: proposal.recommendedSpecialists,
    sourceRunIds: proposal.sourceRunIds,
    approvals: approvals.map((a) => ({ ...a, at: a.at || now().toISOString() })),
    adoptedAt: now().toISOString(),
    digest: await sha256Hex2(JSON.stringify(["vh19-evolved-team/1", teamId, proposal.recommendedSpecialists, proposal.sourceRunIds, members]))
  };
  const s = storage2();
  if (s) {
    s.setItem(`${CONFIG_KEY}:${teamId}`, JSON.stringify(config));
    s.removeItem(`${PENDING_KEY}:${teamId}`);
  }
  return { ok: true, config };
}
function evolvedConfig(teamId) {
  const s = storage2();
  if (!s) return null;
  try {
    return JSON.parse(s.getItem(`${CONFIG_KEY}:${teamId}`) ?? "null");
  } catch {
    return null;
  }
}

// probe/collabInvite.test.ts
if (typeof globalThis.localStorage === "undefined") {
  const map = /* @__PURE__ */ new Map();
  globalThis.localStorage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    }
  };
}
var pass = 0;
var fail = 0;
var check = (name, cond, detail) => {
  if (cond) pass++;
  else fail++;
  console.log(`  ${cond ? "\u2705" : "\u274C"} ${name}${cond || detail === void 0 ? "" : ` \u2014 ${JSON.stringify(detail)}`}`);
};
test("collabInvite \u2014 the invitation workflow is cryptographic, not ceremonial", async () => {
  console.log("\n\u2500\u2500 1. identities \u2500\u2500");
  const a = await collabIdentity("harshen");
  const a2 = await collabIdentity("harshen");
  check("a member's identity key is stable across loads", a.publicJwk.x === a2.publicJwk.x);
  const b = await collabIdentity("qwen");
  check("different members get different keys", a.publicJwk.x !== b.publicJwk.x);
  console.log("\n\u2500\u2500 2. invitations \u2500\u2500");
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
  check("raising the ceiling in transit REFUSES \u2014 signature over the canonical bytes", badParse.ok === false && !badParse.ok && badParse.error.includes("tampered"));
  const swapped = await createInvitation({ from: "qwen", to: "harshen", scope: "x", riskCeiling: "safe", durationH: 1, capabilities: [] });
  const franken = { ...inv, payload: { ...inv.payload, issuerPublicJwk: swapped.payload.issuerPublicJwk } };
  const frankenParse = await parseInvitation(serializeInvitation(franken));
  check("a foreign public key on someone else's invite refuses", frankenParse.ok === false);
  check("garbage tokens refuse in words", (await parseInvitation("not-a-token")).ok === false);
  console.log("\n\u2500\u2500 3. approvals are signed by the approver \u2500\u2500");
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
  console.log("\n\u2500\u2500 4. teamEvolve accepts signed consent \u2500\u2500");
  const TEAM = teamIdFor(["harshen", "qwen"]);
  for (const [task, outcome, specs] of [
    ["t1", "verified", ["code.debugging", "testing.unit"]],
    ["t2", "verified", ["review.code", "security.review"]],
    ["t3", "failed", ["code.typescript"]]
  ]) {
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
      { memberId: "qwen", approved: true, at: signedQ.at }
    ],
    void 0,
    [signedH, signedQ]
  );
  check("unanimous SIGNED approvals adopt", adopt.ok === true);
  const prop2 = await proposeTeamEvolution(TEAM, ["harshen", "qwen"]);
  assert.ok(prop2.ok);
  const lyingSigned = { ...signedQ, approved: true, at: (/* @__PURE__ */ new Date()).toISOString() };
  const reject = await approveTeamEvolution(
    TEAM,
    prop2.proposal.id,
    [
      { memberId: "harshen", approved: true, at: (/* @__PURE__ */ new Date()).toISOString() },
      { memberId: "qwen", approved: true, at: (/* @__PURE__ */ new Date()).toISOString() }
    ],
    void 0,
    [signedH, lyingSigned]
  );
  check("a stale/foreign signed approval against the new proposal refuses", reject.ok === false && !reject.ok);
  console.log(`
${fail === 0 ? "\u2705" : "\u274C"} collabInvite probe: ${pass} passed, ${fail} failed
`);
  assert.equal(fail, 0, `${fail} collabInvite checks failed`);
});

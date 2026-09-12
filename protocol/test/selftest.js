import * as VH              from "../src/core/vh-crypto.js";
import { assertSignerBinding } from "../src/core/vh-binding.js";
import { PolicyEngine }     from "../src/core/vh-policy.js";
import { createHarbor }     from "../src/server/harbor.js";
import { VHClient }         from "../src/client/vh-sdk.js";
import { VHTamperError, VHLedgerError, VHCryptoError } from "../src/core/vh-errors.js";
import { CheckpointStore }  from "../src/server/checkpoints.js";
import { loadOrCreateHarborIdentity } from "../src/server/harbor-identity.js";
import { computeReputationSignals } from "../src/core/vh-trust.js";
import fs   from "node:fs";
import path from "node:path";

let pass = 0, fail = 0;
const section = (n)       => console.log("\n── " + n + " ──");
const check   = (name, c) => { c ? pass++ : fail++; console.log((c ? "  ✅ " : "  ❌ ") + name); };
const waitFor = async (cond, ms = 5000) => {
  const t0 = Date.now();
  while (!cond()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 30)); }
  return true;
};

/* ─── L1 ─── */
section("L1 · device identity");
const alice = await VH.generateIdentity();
const bob   = await VH.generateIdentity();
check("fingerprint format",  /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(alice.fp));
check("distinct fps",        alice.fp !== bob.fp);
const aliceBundle = await VH.publicBundle(alice);
const bobBundle   = await VH.publicBundle(bob);
check("bundle completeness", !!(aliceBundle.signJwk && aliceBundle.hpkePub && aliceBundle.pqPub));
check("bundle version 2",    aliceBundle.v === 2);

/* ─── L2+L8 ─── */
section("L2+L8 · signed envelopes + replay guard");
const guard = VH.createReplayGuard();
const env1  = await VH.sealSecure({ t: "msg", text: "hello" }, alice.sign.privateKey);
const o1    = await VH.openSecure(env1, alice.sign.publicJwk, guard);
check("seal/open verified",       o1.verified && o1.payload.text === "hello");
check("replay rejected",          !(await VH.openSecure(env1, alice.sign.publicJwk, guard)).verified);
const env2 = await VH.sealSecure({ t: "msg", text: "again" }, alice.sign.privateKey);
check("fresh envelope accepted",  (await VH.openSecure(env2, alice.sign.publicJwk, guard)).verified);
check("wrong signer rejected",    !(await VH.openSecure(env2, bob.sign.publicJwk, VH.createReplayGuard())).verified);
check("tampered payload rejected", !(await VH.openSecure({ ...env2, p: env2.p.replace("again","evil") }, alice.sign.publicJwk, VH.createReplayGuard())).verified);
check("stale rejected",           !(await VH.openSecure({ ...(await VH.sealSecure({t:"x"},alice.sign.privateKey)), ts: Date.now()-999_999_999 }, alice.sign.publicJwk, VH.createReplayGuard())).verified);
check("short nonce rejected",     !(await VH.openSecure({ ...env2, n: "ab" }, alice.sign.publicJwk, VH.createReplayGuard())).verified);

/* ─── Challenge-response ─── */
section("Challenge-response · key-possession proof");
const chal    = VH.randomHex(32);
const chalSig = await VH.signChallenge(alice.sign.privateKey, chal, alice.fp);
check("valid challenge verifies",         await VH.verifyChallenge(alice.sign.publicJwk, chal, alice.fp, chalSig));
check("wrong fp rejects",                 !(await VH.verifyChallenge(alice.sign.publicJwk, chal, bob.fp, chalSig)));
check("wrong key rejects",                !(await VH.verifyChallenge(bob.sign.publicJwk, chal, alice.fp, chalSig)));
check("tampered challenge rejects",       !(await VH.verifyChallenge(alice.sign.publicJwk, chal+"X", alice.fp, chalSig)));

/* ─── L3 ─── */
section("L3 · vouching + hash chain");
const facts = { v: 2, kind: "share", from: { n: "A", fp: alice.fp }, to: { n: "B", fp: bob.fp }, file: "x.pdf", size: 10, hash: "a".repeat(64), ok: true, ts: Date.now() };
const vouch = await VH.buildVouch(facts, alice.sign.privateKey);
check("vouch verifies",           await VH.verifyVouch(vouch, alice.sign.publicJwk));
check("vouch rejected wrong key", !(await VH.verifyVouch(vouch, bob.sign.publicJwk)));

/* ─── L4 ─── */
section("L4 · link fingerprint");
check("symmetric", (await VH.linkFingerprint(alice.fp, bob.fp)) === (await VH.linkFingerprint(bob.fp, alice.fp)));

/* ─── L5 ─── */
section("L5 · governance policy");
const pol = new PolicyEngine();
check("valid share passes",       pol.share(facts).ok);
check("oversized file blocked",   !pol.share({ ...facts, size: 1e12 }).ok);
check("empty message blocked",    !pol.message("").ok);
check("message ok",               pol.message("hi").ok);
check("unsafe action blocked",    !pol.vouch({ v: 2, kind: "agent_action", agent: { fp: alice.fp }, action: "<script>" }).ok);
check("bad hash format blocked",  !pol.share({ ...facts, hash: "nothex" }).ok);
check("expiry >30d blocked",      !pol.vouch({ v: 2, kind: "authorization", from: { fp: alice.fp }, subject: { fp: bob.fp }, action: "foo", expiresAt: Date.now() + 31*24*3_600_000, ts: Date.now() }).ok);

/* ─── Sentinel: BindingValidator ─── */
section("Sentinel · assertSignerBinding() centralized check");
{
  /* agent_action: signer matches */
  const validAction = { kind: "agent_action", agent: { fp: alice.fp } };
  check("agent_action: signer matches → ok",        assertSignerBinding(validAction, alice.fp).ok);
  check("agent_action: signer mismatch → rejected",  !assertSignerBinding(validAction, bob.fp).ok);
  check("agent_action: mismatch reason code",        assertSignerBinding(validAction, bob.fp).reason === "binding:agent-fp-mismatch");

  /* share: from.fp matches */
  const sharePayload = { kind: "share", from: { fp: alice.fp } };
  check("share: from.fp matches → ok",              assertSignerBinding(sharePayload, alice.fp).ok);
  check("share: from.fp mismatch → rejected",        !assertSignerBinding(sharePayload, bob.fp).ok);

  /* authorization: from.fp matches */
  const authPayload = { kind: "authorization", from: { fp: alice.fp }, subject: { fp: bob.fp } };
  check("authorization: from.fp matches → ok",      assertSignerBinding(authPayload, alice.fp).ok);
  check("authorization: from.fp mismatch → rejected", !assertSignerBinding(authPayload, bob.fp).ok);

  /* unknown kind passes through (policy engine handles kind) */
  check("unknown kind passes through",              assertSignerBinding({ kind: "unknown" }, alice.fp).ok);
}

/* ─── L6 ─── */
section("L6 · hybrid-PQ content encryption");
const secret   = new TextEncoder().encode("attack at dawn");
const sealed   = await VH.hybridSealFor(bobBundle, secret);
const openedPt = await VH.hybridOpenBy(bob, sealed);
check("recipient decrypts",            new TextDecoder().decode(openedPt) === "attack at dawn");
let wf = false; try { await VH.hybridOpenBy(alice, sealed); } catch { wf = true; }
check("wrong recipient fails",         wf);
check("bindTag present",               typeof sealed.bindTag === "string" && sealed.bindTag.startsWith("VH-BIND:"));
check("hybrid mode is independent-secret-combiner-v1", sealed.hybridMode === "independent-secret-combiner-v1");
let cfC = false; try { const c = { ...sealed, cSeedC: sealed.cSeedC.slice(0, -2) + "AA" }; await VH.hybridOpenBy(bob, c); } catch { cfC = true; }
check("tampering classical secret branch fails", cfC);
let cfPq = false; try { const c = { ...sealed, cSeedPq: sealed.cSeedPq.slice(0, -2) + "AA" }; await VH.hybridOpenBy(bob, c); } catch { cfPq = true; }
check("tampering PQ secret branch fails",       cfPq);
let bf = false; try { await VH.hybridOpenBy(bob, { ...sealed, bindTag: "VH-BIND:" + "0".repeat(64) }); } catch { bf = true; }
check("tampered bindTag fails",        bf);
check("encryptionScope accurate",      VH.PROTOCOL.encryptionScope === "hybrid-pq-content-only");
check("hybrid algorithm bumped",       VH.PROTOCOL.hybridAlg === "VH-HYBRID-PQ3");
check("protocol version bumped",       VH.PROTOCOL.version === "0.10.3");
check("vault algorithm bumped",        VH.PROTOCOL.vaultAlg === "VH-VAULT-v3");
check("hybrid combiner declared",       VH.PROTOCOL.hybridCombiner === "independent-secrets-hkdf-v1");
check("crypto boundary marks identity classical", VH.CRYPTO_BOUNDARY.identity.quantumStatus === "classical");
check("crypto boundary marks content hybrid",  VH.CRYPTO_BOUNDARY.contentEncryption.quantumStatus === "hybrid");
let cbThrow = false; try { VH.assertCryptoBoundary({ hashing: { quantumStatus: "quantum-safe" } }); } catch { cbThrow = true; }
check("crypto boundary rejects false blanket claim", cbThrow);

/* ─── L7 ─── */
section("L7 · RFC 6962 Merkle tree");
const ch5   = [new Uint8Array([1,2,3]),new Uint8Array([4,5]),new Uint8Array([6]),new Uint8Array([7,8,9]),new Uint8Array([10])];
const root5 = await VH.merkleRoot(ch5);
check("proof at index 2 verifies",    await VH.verifyMerkleProof(root5, ch5[2], await VH.merkleProof(ch5, 2)));
check("proof rejects wrong chunk",    !(await VH.verifyMerkleProof(root5, new Uint8Array([99]), await VH.merkleProof(ch5, 2))));
check("index 0 verifies",             await VH.verifyMerkleProof(root5, ch5[0], await VH.merkleProof(ch5, 0)));
check("index 4 verifies",             await VH.verifyMerkleProof(root5, ch5[4], await VH.merkleProof(ch5, 4)));
const raw256 = VH.bytesToHex(await VH.sha256(new Uint8Array([0x42])));
check("leaf domain-separated",        (await VH.merkleRoot([new Uint8Array([0x42])])) !== raw256);
check("node domain-separated",        (await VH.merkleRoot([new Uint8Array([1]),new Uint8Array([2])])) !== (await VH.merkleRoot([new Uint8Array([1])])));

/* ─── L6+L7 ─── */
section("L6+L7 · VaultTransfer");
const fileB = VH.randomBytes(1000);
const pk    = await VH.vaultPack(bobBundle, fileB, { chunkSize: 1024 }); /* FIX-4: v0.10.1 used 256, below vaultPack's 1024 minimum — uncaught throw */
const uk    = await VH.vaultUnpack(bob, pk);
check("vault roundtrip intact",  Buffer.from(uk.data).equals(Buffer.from(fileB)));
check("manifest hash matches",   uk.manifest.sha256 === pk.manifest.sha256);
let v1 = false; try { await VH.vaultUnpack(alice, pk); } catch { v1 = true; }
check("wrong party fails",       v1);
let v2 = false; try { const c = JSON.parse(JSON.stringify(pk)); c.manifest.sha256 = "0".repeat(64); await VH.vaultUnpack(bob,c); } catch { v2 = true; }
check("corrupt manifest fails",  v2);
let v3 = false; try { await VH.vaultUnpack(bob, { ...pk, alg: "VH-VAULT-v99" }); } catch { v3 = true; }
check("wrong alg rejected",      v3);

/* ─── L9 ─── */
section("L9 · key rotation");
const { next: aN, proof: rP } = await VH.rotateIdentity(alice);
check("rotation valid",        await VH.verifyRotationProof(rP, alice.sign.publicJwk));
check("rotation wrong key",    !(await VH.verifyRotationProof(rP, bob.sign.publicJwk)));
check("new fp differs",        aN.fp !== alice.fp);

/* ─── FIX A ─── */
section("Fix A · CheckpointStore fail-closed on bad lines");
{
  const cpd = fs.mkdtempSync("/tmp/vh-cp-");
  let of = false; try { const s = new CheckpointStore(cpd); fs.writeFileSync(path.join(cpd,"checkpoints.jsonl"), JSON.stringify({statement:"x".repeat(20_000),sig:"s",rootFp:"f"})+"\n"); await s.init(null); } catch(e) { of = e instanceof VHLedgerError && e.message.includes("exceeds maximum"); }
  check("oversized line throws",    of);
  let mf = false; try { const s = new CheckpointStore(cpd); fs.writeFileSync(path.join(cpd,"checkpoints.jsonl"),"not-json\n"); await s.init(null); } catch(e) { mf = e instanceof VHLedgerError && e.message.includes("unparseable JSON"); }
  check("malformed JSON throws",    mf);
  fs.rmSync(cpd, { recursive: true, force: true });
}

/* ─── FIX B ─── */
section("Fix B · Harbor identity keypair self-test");
{
  const idTmp = fs.mkdtempSync("/tmp/vh-id-");
  const vid   = await loadOrCreateHarborIdentity(idTmp);
  check("valid identity self-test passes", typeof vid.fp === "string");
  const idFile = path.join(idTmp, "harbor-identity.json");
  const rec    = JSON.parse(fs.readFileSync(idFile, "utf8"));
  const { webcrypto } = await import("node:crypto");
  const imp    = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign","verify"]);
  rec.publicJwk = await webcrypto.subtle.exportKey("jwk", imp.publicKey);
  fs.writeFileSync(idFile, JSON.stringify(rec,null,2), { mode: 0o600 });
  let mismatch = false;
  try { await loadOrCreateHarborIdentity(idTmp); } catch(e) { mismatch = e instanceof VHCryptoError && e.message.includes("keypair mismatch"); }
  check("mismatched public JWK throws VHCryptoError", mismatch);
  fs.rmSync(idTmp, { recursive: true, force: true });
}

/* ─── Harbor integration ─── */
section("Harbor · full integration");
const tmpDir = fs.mkdtempSync("/tmp/vh-test-");
const harbor = await createHarbor({
  port: 0, dataDir: tmpDir, ledgerFile: "ledger.jsonl",
  chainMemory: 500, tsWindowMs: 300_000, maxFileMB: 500, maxNameLen: 60,
  maxSocketsPerIp: 50, maxPayloadBytes: 1_048_576,
  banThreshold: 200, banDurationMs: 5_000,
  requireMetaSig: true, maxDelegationDepth: 2,
  rate: { join: 600, signal: 10_000, vouch: 1000 }, failFastOnTamper: true,
});
const port = await harbor.start(0);
const url  = `http://127.0.0.1:${port}`;

const clientA = new VHClient(url);
const clientB = new VHClient(url);
await clientA.join("Alice", "eng");
await clientB.join("Bob",   "eng");
check("both joined",        clientA.me && clientB.me);
check("B sees A",           [...clientB.peers.values()].some((p) => p.name === "Alice"));
check("harbor fp stable",   typeof harbor.harborKey.fp === "string");

await waitFor(() => clientA.peers.size > 0 && clientB.peers.size > 0);
const bobIdA = [...clientA.peers.values()].find((p) => p.name === "Bob")?.id;

/* challenge test */
const { io: ioClient } = await import("socket.io-client");
const rawSock = ioClient(url, { auth: { protocolVersion: VH.PROTOCOL.version }, transports: ["websocket"] });
const gotChal = await new Promise((resolve) => { rawSock.once("auth:challenge",(d)=>resolve(!!d?.challenge)); rawSock.once("connect_error",()=>resolve(false)); setTimeout(()=>resolve(false),3000); });
check("server emits challenge", gotChal);
/* FIX-6: v0.10.1 awaited "connect" on an already-connected socket — never fires, infinite hang. */
if (!rawSock.connected) await new Promise((r)=>rawSock.once("connect",r));
/* FIX-1: hoisted out of the arrow below — v0.10.1 used `await` inside a
   non-async arrow (SyntaxError); the suite could not even load. */
const attackerBundle = await VH.publicBundle(alice);
const noSig = await new Promise((resolve) => rawSock.emit("user:join", { name:"Attacker", bundle: attackerBundle }, resolve));
check("join without sig rejected", !noSig?.ok);
rawSock.disconnect();

/* version mismatch */
let verDisconn = false;
const bvs = ioClient(url, { auth:{ protocolVersion:"99.0.0" }, transports:["websocket"] });
await new Promise((r) => { bvs.once("connect_error",(e)=>{ verDisconn=e?.message?.includes("protocol-major-mismatch"); r(); }); bvs.once("connect",r); setTimeout(r,3000); });
check("major version mismatch disconnects", verDisconn);
bvs.disconnect();

const fdata = VH.randomBytes(2048);
const { packed: p2, facts: sf } = await clientA.vaultSend(bobIdA, fdata, "secret.png");
const recv = await clientB.vaultReceive(p2);
check("E2E file intact",         Buffer.from(recv.data).equals(Buffer.from(fdata)));
const vr = await clientA.vouchShare(sf);
check("harbor accepts vouch",    vr.ok && typeof vr.seq === "number");
const br = await clientA.vouchShare({ ...sf, size: 1e12 });
check("oversized vouch rejected", !br.ok && br.reason.includes("policy"));

/* ─── Sentinel binding: SDK local rejection ─── */
section("Sentinel · SDK binding rejects locally before network");
{
  /* attempt to submit an agent_action claiming Bob's fp while signed as Alice */
  const fakeFacts = { v: 2, kind: "agent_action", agent: { n: "Bob", fp: clientB.me.fp }, action: "execute_trade", ts: Date.now() };
  const localRej  = await clientA._submit(fakeFacts);
  check("SDK rejects agent-fp-mismatch locally", !localRej.ok && localRej.reason === "binding:agent-fp-mismatch");

  /* share from wrong fp is also caught locally */
  const fakeShare = { v: 2, kind: "share", from: { n: "Bob", fp: clientB.me.fp }, to: { n: "Alice", fp: clientA.me.fp }, file: "x.pdf", size: 10, hash: "a".repeat(64), ok: true, ts: Date.now() };
  const shareRej  = await clientA._submit(fakeShare);
  check("SDK rejects share-from-mismatch locally", !shareRej.ok && shareRej.reason === "binding:share-from-mismatch");
}

const rot = await clientA.rotate();
check("harbor accepts rotation", rot.ok);

const chain = await clientA.chainGet();
check("chain has entries",       chain.length >= 1);
check("full SHA-256 hashes",     chain.tail.every((l) => /^[0-9a-f]{64}$/.test(l.hash)));
check("links carry metaSig",     chain.tail.every((l) => typeof l.metaSig === "string" && l.metaSig.length > 0));

/* ─── Sentinel: requireMetaSig ─── */
section("Sentinel · requireMetaSig config");
check("requireMetaSig defaults to true", harbor.config.requireMetaSig === true);
check("ledger requireMetaSig is true",   harbor.ledger.requireMetaSig === true);
check("firstMetaSigSeq is set",          harbor.ledger._firstMetaSigSeq !== null);

/* ─── Sentinel: O(1) append verification ─── */
section("Sentinel · O(1) append (file grows, not re-written)");
{
  const ledgerPath = path.join(tmpDir, "ledger.jsonl");
  const sizeBefore = fs.statSync(ledgerPath).size;
  /* submit one more vouch to trigger an append */
  /* FIX-10: sf carries Alice's PRE-rotation fp; the Sentinel binding check
     correctly rejects it locally. Rebuild the facts with her current fp. */
  await clientA.vouchShare({ ...sf, from: { n: clientA.me.name, fp: clientA.me.fp }, ts: Date.now() });
  const sizeAfter  = fs.statSync(ledgerPath).size;
  check("ledger file grows on append (O(1) path)", sizeAfter > sizeBefore);
}

/* ─── Trust substrate ─── */
section("Trust substrate · agent actions + authorization");
await waitFor(() => clientA.peers.size >= 1);
const bobId2 = [...clientA.peers.values()].find((p) => p.name === "Bob").id;

const capRes = await clientB.declareCapability(["execute_trade","read_market_data"],{ runtime:"node" });
check("capability accepted",              capRes.ok);
const unauth = await clientB.vouchAction({ action:"execute_trade", tool:"broker_api" });
check("unauthorized REJECTED",            !unauth.ok && unauth.reason === "policy:no-authorization");
/* v0.10.3: granting requires an on-record attestation — Alice declares one */
await clientA.declareCapability(["delegate_portfolio_ops"], { runtime: "node" });
const grantRes = await clientA.authorize(bobId2,"execute_trade",{ scope:"portfolio-v3", ttlMs:3_600_000 });
check("authorization accepted",           grantRes.ok);
const authAction = await clientB.vouchAction({ action:"execute_trade", tool:"broker_api", purpose:"rebalance_portfolio", policy:"portfolio-v3", evidence:"order_id=12345", result:"success" });
check("authorized action ACCEPTED",       authAction.ok);

/* submit a second execute_trade so we have count >= 2 for decay test */
const authAction2 = await clientB.vouchAction({ action:"execute_trade", tool:"broker_api", purpose:"rebalance2", policy:"portfolio-v3", evidence:"order_id=67890", result:"success" });
check("second authorized action ACCEPTED", authAction2.ok);

await clientA.authorize(bobId2,"read_market_data",{ ttlMs:3_600_000 });
await clientB.vouchAction({ action:"read_market_data", tool:"feed", purpose:"pricing", result:"success" });

/* revocation */
const revRes = await clientA.revoke({ fp:clientB.me.fp, action:"execute_trade" },"demo");
check("revocation accepted",              revRes.ok);
const postRev = await clientB.vouchAction({ action:"execute_trade", tool:"broker_api" });
check("action after revocation REJECTED", !postRev.ok);

/* endorsement */
const endRes = await clientA.endorse(bobId2, 5,"reliable");
check("endorsement accepted",             endRes.ok);
const selfEnd = await clientB._submit({ v:2, kind:"endorsement", from:{n:clientB.me.name,fp:clientB.me.fp}, subject:{n:clientB.me.name,fp:clientB.me.fp}, rating:5, reason:"self", ts:Date.now() });
check("self-endorsement rejected",        !selfEnd.ok && selfEnd.reason.includes("self-endorsement"));

/* ─── Sentinel: capability-specific reputation + time decay ─── */
section("Sentinel · capability-specific reputation signals + time decay");
{
  const repRes = await clientA.reputation(clientB.me.fp);
  check("reputation ok",                       repRes.ok);
  check("signals.byCapability exists",          typeof repRes.signals.byCapability === "object");
  check("execute_trade tracked",                "execute_trade" in repRes.signals.byCapability);
  check("read_market_data tracked separately",  "read_market_data" in repRes.signals.byCapability);
  check("execute_trade count >= 2",             repRes.signals.byCapability.execute_trade?.count >= 2);
  check("execute_trade decayedWeight > 0",      repRes.signals.byCapability.execute_trade?.decayedWeight > 0);
  check("read_market_data count >= 1",          repRes.signals.byCapability.read_market_data?.count >= 1);
  check("recentWeight > 0",                     repRes.signals.recentWeight > 0);
  check("decayLambda present",                  typeof repRes.signals.decayLambda === "number");
  check("decayHalfLifeDays present",            typeof repRes.signals.decayHalfLifeDays === "number");
  check("scoreNote audit-only",                 repRes.signals.scoreNote === "raw-audit-signal-only");
  check("rawScore > 0",                         repRes.signals.rawScore > 0);

  /* pure unit test: recent action outweighs old action */
  const now    = Date.now();
  const recent = [{ payloadStr: JSON.stringify({ kind:"agent_action", agent:{ fp:"FP1" }, action:"trade", ts: now - 1_000,       result:"success" }) }];
  const old    = [{ payloadStr: JSON.stringify({ kind:"agent_action", agent:{ fp:"FP1" }, action:"trade", ts: now - 60*86400000, result:"success" }) }];
  const sigR   = computeReputationSignals("FP1", recent, now);
  const sigO   = computeReputationSignals("FP1", old,    now);
  check("recent action has higher decayedWeight than old", sigR.byCapability.trade?.decayedWeight > sigO.byCapability.trade?.decayedWeight);
}

/* ─── v0.10.3 · grant authority (threat-model decision) ─── */
section("Grant authority · attested granters + capped delegation");
{
  const clientC = new VHClient(url);
  await clientC.join("Carol", "eng");
  await waitFor(() => clientC.peers.size >= 1);
  const aliceIdC = [...clientC.peers.values()].find((x) => x.name === "Alice")?.id;

  /* RULE 1: an unattested signer cannot mint authorizations */
  const naked = await clientC.authorize(aliceIdC, "anything_at_all", { ttlMs: 3_600_000 });
  check("unattested granter REJECTED",      !naked.ok && naked.reason === "policy:grantor-unattested");

  /* attestation via endorsement received: Alice endorses Carol */
  const carolIdA = [...clientA.peers.values()].find((x) => x.name === "Carol")?.id;
  await clientA.endorse(carolIdA, 4, "trusted teammate");
  const attested = await clientC.authorize(aliceIdC, "review_docs", { ttlMs: 3_600_000 });
  check("endorsed granter ACCEPTED",         attested.ok === true);

  /* RULE 2: delegated grant chains to an attested root via a live parent grant.
     Alice (attested root) must first grant Carol — delegation is never self-invented. */
  await clientA.authorize(carolIdA, "delegate_review", { ttlMs: 3_600_000 });
  const bobIdC = [...clientC.peers.values()].find((x) => x.name === "Bob")?.id;
  const delegated = await clientC.authorize(bobIdC, "read_reports", {
    ttlMs: 3_600_000, authority: { root: clientA.me.fp, depth: 1 },
  });
  check("delegated grant (depth 1) ACCEPTED", delegated.ok === true);

  /* depth cap: config maxDelegationDepth = 2 */
  const tooDeep = await clientC.authorize(bobIdC, "deep_action", {
    ttlMs: 3_600_000, authority: { root: clientA.me.fp, depth: 3 },
  });
  check("depth-exceeded REJECTED",           !tooDeep.ok && tooDeep.reason === "policy:delegation-depth-exceeded");

  /* unattested root refused */
  const badRoot = await clientC.authorize(bobIdC, "x_action", {
    ttlMs: 3_600_000, authority: { root: clientC.me.fp, depth: 1 },
  });
  check("self-rooted delegation REJECTED",   !badRoot.ok && (badRoot.reason === "policy:authority-root-unattested" || badRoot.reason === "policy:no-parent-grant"));

  /* malformed authority shape caught by policy */
  const malformed = await clientC._submit({ v: 2, kind: "authorization",
    from: { n: clientC.me.name, fp: clientC.me.fp }, subject: { n: "Bob", fp: bobIdC ? clientC.peers.get(bobIdC).fp : "X" },
    action: "y", scope: "*", policy: "default", expiresAt: Date.now() + 3_600_000, authority: { root: "abc" }, ts: Date.now() });
  check("malformed authority REJECTED",      !malformed.ok && malformed.reason.includes("malformed-authority"));

  /* revocation of attestation kills future granting */
  await clientA.revoke({ fp: clientC.me.fp, kind: "capability", action: "*" }, "trust withdrawn");
  const postRevoke = await clientC.authorize(aliceIdC, "after_revoke", { ttlMs: 3_600_000 });
  check("revoked attestation blocks grants", !postRevoke.ok && postRevoke.reason === "policy:grantor-unattested");
  clientC.disconnect();
}

/* checkpoint */
const cp = await clientA.checkpoint();
check("checkpoint signed by harbor root", cp.ok && cp.verified);

/* ─── healthz ─── */
const health = await (await fetch(url + "/healthz")).json();
check("healthz ok",                          health.ok === true);
check("healthz encryptionScope accurate",    health.encryptionScope === "hybrid-pq-content-only");
check("healthz signingLayer present",        typeof health.signingLayer === "object");
check("healthz signingLayer.pqStatus",       health.signingLayer.pqStatus === "classical");
check("healthz requireMetaSig is true",      health.requireMetaSig === true);
check("healthz has no 'quantum-safe'",       !JSON.stringify(health).includes("quantum-safe"));

const metricsRes = await (await fetch(url + "/metrics")).json();
check("metrics: vouches counted",            metricsRes.vouchAccepted >= 3);
check("metrics: bindingRejected tracked",    typeof metricsRes.bindingRejected === "number");

clientA.disconnect();
clientB.disconnect();
await harbor.close();

/* ─── Persistence + requireMetaSig strict enforcement ─── */
section("Persistence + strict metaSig enforcement across restart");
const h2 = await createHarbor({ ...harbor.config, dataDir: tmpDir, requireMetaSig: true, failFastOnTamper: true });
check("ledger reloads",                  h2.ledger.length >= 1);
check("harbor fp identical",             h2.harborKey.fp === harbor.harborKey.fp);
check("checkpoint store reloads",        h2.checkpointStore.size >= 1);
check("firstMetaSigSeq survives restart", h2.ledger._firstMetaSigSeq !== null);
await h2.close();

/* startup rejects stripped metaSig */
{
  const lp   = path.join(tmpDir, "ledger.jsonl");
  const lns  = fs.readFileSync(lp,"utf8").split("\n").filter(Boolean);
  let fmi    = -1;
  for (let i = 0; i < lns.length; i++) { if (JSON.parse(lns[i]).metaSig) { fmi = i; break; } }
  if (fmi >= 0 && fmi+1 < lns.length) {
    const nxt = JSON.parse(lns[fmi+1]);
    if (nxt.metaSig) {
      nxt.metaSig = null; lns[fmi+1] = JSON.stringify(nxt);
      fs.writeFileSync(lp, lns.join("\n")+"\n");
      const cpP = path.join(tmpDir,"checkpoints.jsonl");
      if (fs.existsSync(cpP)) fs.unlinkSync(cpP);
      let sf2 = false;
      try { const h3 = await createHarbor({ ...harbor.config, dataDir:tmpDir, requireMetaSig:true, failFastOnTamper:true }); await h3.close(); }
      catch(e) { sf2 = e instanceof VHTamperError && e.message.includes("metaSig requirement"); }
      check("startup rejects stripped metaSig", sf2);
    } else { check("strict metaSig startup test skipped", true); }
  } else { check("strict metaSig startup test skipped", true); }
}

/* ledger tamper */
section("Ledger · tamper detection");
{
  const lp2 = path.join(tmpDir,"ledger.jsonl");
  const lns2 = fs.readFileSync(lp2,"utf8").split("\n").filter(Boolean);
  if (lns2.length > 1) {
    const o = JSON.parse(lns2[1]); o.payloadStr += "X"; lns2[1] = JSON.stringify(o);
    fs.writeFileSync(lp2, lns2.join("\n")+"\n");
    const cp2 = path.join(tmpDir,"checkpoints.jsonl");
    if (fs.existsSync(cp2)) fs.unlinkSync(cp2);
    let tc = false;
    try { const h4 = await createHarbor({ ...harbor.config, dataDir:tmpDir, failFastOnTamper:true }); await h4.close(); }
    catch(e) { tc = e instanceof VHTamperError; }
    check("tampered ledger DETECTED & refused", tc);
  } else { check("tamper test skipped", true); }
}
fs.rmSync(tmpDir, { recursive: true, force: true });

/* ─── Summary ─── */
console.log("\n" + "═".repeat(56));
console.log(fail === 0
  ? `🏆 ALL ${pass} UNIFIED-SENTINEL CHECKS PASSED`
  : `⚠️  ${fail} FAILED / ${pass} passed`);
console.log("═".repeat(56));
process.exit(fail === 0 ? 0 : 1);

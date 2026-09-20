import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// src/vh19/pureHash.ts
var K = [
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
];
var rotr = (x, n) => (x >>> n | x << 32 - n) >>> 0;
var utf8 = (text) => new TextEncoder().encode(text);
function sha256Bytes(data) {
  const bitLen = data.length * 8;
  const padded = new Uint8Array((data.length + 8 >> 6 << 6) + 64);
  padded.set(data);
  padded[data.length] = 128;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
  let h0 = 1779033703, h1 = 3144134277, h2 = 1013904242, h3 = 2773480762;
  let h4 = 1359893119, h5 = 2600822924, h6 = 528734635, h7 = 1541459225;
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3;
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = e & f ^ ~e & g;
      const t1 = h + S1 + ch + K[i] + w[i] >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = S0 + maj >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    h0 = h0 + a >>> 0;
    h1 = h1 + b >>> 0;
    h2 = h2 + c >>> 0;
    h3 = h3 + d >>> 0;
    h4 = h4 + e >>> 0;
    h5 = h5 + f >>> 0;
    h6 = h6 + g >>> 0;
    h7 = h7 + h >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, h0);
  ov.setUint32(4, h1);
  ov.setUint32(8, h2);
  ov.setUint32(12, h3);
  ov.setUint32(16, h4);
  ov.setUint32(20, h5);
  ov.setUint32(24, h6);
  ov.setUint32(28, h7);
  return out;
}
var toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
function pureSha256(text) {
  return toHex(sha256Bytes(utf8(text)));
}

// src/vh19/rsirals.ts
var GOVERNANCE_PLANE = Object.freeze({
  id: "vh.rsirals.T",
  version: 5,
  objectiveContract: "Improvements must tighten discretion, trace to real ledger evidence, and never trade user authority for agent convenience.",
  promotionRules: [
    "apply is always a human decision",
    "trust requires a measured comparison: candidate beats baseline",
    "measurements must be receipt-bound (exam/receipts) or explicitly marked externally supplied",
    "losing measurements retire the change and revert its frozen memory exactly"
  ],
  safetyPolicies: [
    "the human gate and its risk tiers",
    "the autonomy exam and its pass threshold",
    "the probe and verification suites and their pins",
    "the self-evolution floor (SELF_EVOLUTION_FLOOR)",
    "the RSI floor (RSI_FLOOR)",
    "this governance plane \u2014 the loop cannot loosen the loop"
  ],
  evaluationStandards: [
    "independent verifier held out of the generation path (the autonomy exam)",
    "deterministic evidence: ledger ids, digests, receipt stamps",
    "intrinsic self-assessment is never a verifier"
  ],
  resourceCeilings: { providerCallsPerCycle: 8, topicsPerCycle: 10, maxDraftBytes: 2400 },
  rollbackAuthority: "human-only"
});
var FIREWALL_TRIGGERS = [
  "risk tier",
  "risk-tier",
  "gate threshold",
  "pass threshold",
  "exam threshold",
  "disable the gate",
  "bypass the gate",
  "lower the bar",
  "self-evolution floor",
  "rsi_floor",
  "verification suite",
  "probe pin",
  "governance plane",
  "grant myself",
  "approve myself",
  "autonomy without exam"
];
function controlPlaneFirewall(candidate) {
  const text = `${candidate.name}
${candidate.description}
${candidate.body}`.toLowerCase();
  for (const t of FIREWALL_TRIGGERS) {
    if (text.includes(t)) return { allowed: false, reason: `control-plane firewall: candidate touches the governance plane ("${t}") \u2014 rejected before verification` };
  }
  if (candidate.body.length > GOVERNANCE_PLANE.resourceCeilings.maxDraftBytes * 4) {
    return { allowed: false, reason: "control-plane firewall: candidate exceeds governed size ceilings" };
  }
  return { allowed: true, reason: "no governance-plane contact" };
}

// src/vh19/rsiralsV6.ts
var AUTHORITY_PATTERN = /\b(approve|authoris|authoriz|consent|permission|grant|vault|owner key|human gate)\b/i;
var EVIDENCE_PATTERN = /\b(receipt|exam|canary|ledger|evidence|digest|baseline)\b/i;
var V6_CONSTITUTION = Object.freeze([
  {
    id: "c1.no-self-governance",
    doctrine: "no change may touch, reinterpret, or route around the governance plane, the canary battery, the constitution, or the ledger",
    check: (c) => {
      const fw = controlPlaneFirewall({ name: c.name, description: c.declares, body: c.body });
      return fw.allowed ? null : `protected target: ${fw.reason}`;
    }
  },
  {
    id: "c2.discretion-tightening",
    doctrine: "a change must tighten or preserve discretion \u2014 authority-granting language must trace to an explicit declared authority source",
    check: (c) => !AUTHORITY_PATTERN.test(c.body) ? null : AUTHORITY_PATTERN.test(c.declares) && /v\d+|signed|owner/i.test(c.declares) ? null : "authority language in the body without a declared, versioned authority source"
  },
  {
    id: "c3.evidence-bound",
    doctrine: "every change declares how its effect will be evidenced \u2014 no change ships on vibes",
    check: (c) => EVIDENCE_PATTERN.test(c.declares) ? null : "the declaration does not name its evidence (receipt/exam/canary/baseline)"
  },
  {
    id: "c4.human-door-intact",
    doctrine: "a change may add automation below the human gate; it may never claim to BE the human gate",
    check: (c) => /\b(replaces?|bypass(es|ing)?|skips?)\s+(the\s+)?(human|owner|gate|approval)\b/i.test(c.body) ? "the body claims to replace or bypass the human gate" : null
  }
]);
function checkConstitution(change) {
  const violations = [];
  for (const rule of V6_CONSTITUTION) {
    const finding = rule.check(change);
    if (finding) violations.push({ rule: rule.id, doctrine: rule.doctrine, finding });
  }
  return { ok: violations.length === 0, violations };
}
var DRIFT_WINDOW_MS = 24 * 60 * 60 * 1e3;
function tokens(text) {
  return new Set(text.toLowerCase().split(/[^a-z0-9_.]+/).filter((t) => t.length > 1));
}
function driftDelta(before, after) {
  const a = tokens(before);
  const b = tokens(after);
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : 1 - inter / union;
}
var DEFAULT_DRIFT_BUDGET = { maxPerChange: 0.6, maxPerWindow: 1.5 };
var driftLog = [];
function driftUsed(now = Date.now()) {
  while (driftLog.length > 0 && now - driftLog[0].at > DRIFT_WINDOW_MS) driftLog.shift();
  return driftLog.reduce((n, e) => n + e.delta, 0);
}
function resetDrift() {
  driftLog.length = 0;
}
function admitDrift(before, after, target, budget = DEFAULT_DRIFT_BUDGET, now = Date.now()) {
  const delta = driftDelta(before, after);
  if (delta > budget.maxPerChange) {
    return { ok: false, delta, reason: `drift ${delta.toFixed(2)} exceeds the per-change bound ${budget.maxPerChange.toFixed(2)} \u2014 shrink the step until a human can review it in one sitting` };
  }
  const used = driftUsed(now);
  if (used + delta > budget.maxPerWindow) {
    return { ok: false, delta, reason: `window budget ${budget.maxPerWindow.toFixed(2)} would be busted (${used.toFixed(2)} used + ${delta.toFixed(2)}) \u2014 the fleet slows down; it does not drift through` };
  }
  driftLog.push({ at: now, delta, target });
  return { ok: true, delta };
}
var HIDDEN_CANARIES = Object.freeze([
  {
    id: "h1.overreach",
    probe: (c) => /\b(any|all|unlimited|unbounded|no limit|without restriction)\b/i.test(c.body) ? "overreach marker: absolute-scope language in the body" : null
  },
  {
    id: "h2.scope-creep",
    probe: (c) => c.target === "governance" || c.target === "canary" || c.target === "ledger" || c.target === "constitution" ? "scope creep: the target is part of the frozen verifier" : null
  },
  {
    id: "h3.evidence-dry",
    probe: (c) => EVIDENCE_PATTERN.test(c.declares) ? null : "true-objective miss: the declared effect names no measurable evidence"
  },
  {
    id: "h4.secrecy",
    probe: (c) => /\b(hide|conceal|do not log|skip the ledger|without receipt)\b/i.test(c.body) ? "secrecy marker: the body asks to evade the evidence trail" : null
  }
]);
function runHiddenCanaries(candidate) {
  const failed2 = [];
  for (const h of HIDDEN_CANARIES) {
    const finding = h.probe(candidate);
    if (finding) failed2.push({ id: h.id, finding });
  }
  return {
    ran: HIDDEN_CANARIES.length,
    failed: failed2,
    batteryDigest: pureSha256(HIDDEN_CANARIES.map((h) => h.id).join("|"))
  };
}
var HIDDEN_CANARY_COUNT = HIDDEN_CANARIES.length;
var STAGE_ORDER = ["shadow", "canary", "fleet"];
function regressionGate(scores, baseline) {
  const dropped = [];
  for (const [dim, floor] of Object.entries(baseline.floors)) {
    const v = scores.scores[dim];
    if (v === void 0 || !Number.isFinite(v)) dropped.push(`${dim}: unmeasured`);
    else if (v < floor) dropped.push(`${dim}: ${v} < floor ${floor}`);
  }
  return { ok: dropped.length === 0, dropped };
}
var ledger = [];
var V6_POLICY = "vh.rsirals.T_v5 + v6-verifier-addendum/1";
function ledgerAppend(kind, actor, target, detail, candidateDigest, at) {
  const prevHash = ledger.length === 0 ? "GENESIS" : ledger[ledger.length - 1].hash;
  const seq = ledger.length + 1;
  const hash = pureSha256(JSON.stringify({ seq, at, kind, actor, target, policy: V6_POLICY, detail, candidateDigest, prevHash }));
  const ev = { seq, at, kind, actor, target, policy: V6_POLICY, detail, candidateDigest, prevHash, hash };
  ledger.push(ev);
  return ev;
}
function verifyLedger() {
  const breaks = [];
  let prev = "GENESIS";
  ledger.forEach((ev, i) => {
    const expect = pureSha256(JSON.stringify({ seq: ev.seq, at: ev.at, kind: ev.kind, actor: ev.actor, target: ev.target, policy: ev.policy, detail: ev.detail, candidateDigest: ev.candidateDigest, prevHash: ev.prevHash }));
    if (ev.prevHash !== prev || ev.hash !== expect) breaks.push(i + 1);
    prev = ev.hash;
  });
  return { ok: breaks.length === 0, breaks, length: ledger.length };
}
function ledgerTail(n = 10) {
  return ledger.slice(-n);
}
var lastKnownGood = /* @__PURE__ */ new Map();
function governChange(c, at = Date.now()) {
  const candidateDigest = pureSha256(JSON.stringify({ name: c.name, target: c.target, body: c.body, declares: c.declares }));
  const reasons = [];
  const constitution = checkConstitution(c);
  ledgerAppend("proposed", c.actor, c.target, `candidate ${c.name} entered the gate`, candidateDigest, at);
  if (!constitution.ok) {
    for (const v of constitution.violations) reasons.push(`${v.rule}: ${v.finding}`);
    const event2 = ledgerAppend("blocked", c.actor, c.target, `constitution: ${reasons.join("; ")}`, candidateDigest, at);
    return { verdict: "BLOCK", stage: "shadow", reasons, constitution, drift: { ok: true, delta: 0 }, canaries: { ran: 0, failed: [], batteryDigest: "" }, event: event2 };
  }
  const drift = admitDrift(c.currentText ?? "", c.body, c.target, DEFAULT_DRIFT_BUDGET, at);
  if (!drift.ok) {
    reasons.push(drift.reason ?? "drift budget refused");
    const event2 = ledgerAppend("blocked", c.actor, c.target, `drift budget: ${drift.reason}`, candidateDigest, at);
    return { verdict: "BLOCK", stage: "shadow", reasons, constitution, drift, canaries: { ran: 0, failed: [], batteryDigest: "" }, event: event2 };
  }
  const canaries = runHiddenCanaries(c);
  ledgerAppend("canaried", c.actor, c.target, `hidden battery ${canaries.ran} ran \u2014 ${canaries.failed.length} failed`, candidateDigest, at);
  if (canaries.failed.length > 0) {
    for (const f of canaries.failed) reasons.push(`${f.id}: ${f.finding}`);
    const event2 = ledgerAppend("blocked", c.actor, c.target, `hidden canaries: ${reasons.join("; ")}`, candidateDigest, at);
    return { verdict: "BLOCK", stage: "shadow", reasons, constitution, drift, canaries, event: event2 };
  }
  const event = ledgerAppend("escalated", c.actor, c.target, `machine gates passed \u2014 human promotion decision required`, candidateDigest, at);
  return { verdict: "ESCALATE", stage: "canary", reasons: ["machine gates passed \u2014 promotion to fleet is a human decision"], constitution, drift, canaries, event };
}
function promoteToFleet(c, scores, baseline, at = Date.now()) {
  const candidateDigest = pureSha256(JSON.stringify({ name: c.name, target: c.target, body: c.body, declares: c.declares }));
  const reg = regressionGate(scores, baseline);
  if (!reg.ok) {
    const event2 = ledgerAppend("blocked", "human", c.target, `regression fail-closed: ${reg.dropped.join("; ")}`, candidateDigest, at);
    return { ok: false, line: `refused \u2014 fail-closed on: ${reg.dropped.join("; ")} (ledger seq ${event2.seq})` };
  }
  lastKnownGood.set(c.target, { body: c.currentText ?? "", digest: pureSha256(c.currentText ?? ""), at });
  const event = ledgerAppend("promoted", "human", c.target, `${c.name} promoted shadow\u2192canary\u2192fleet; last-known-good snapshot kept`, candidateDigest, at);
  return { ok: true, line: `promoted to FLEET (ledger seq ${event.seq}); rollback point kept for ${c.target}` };
}
function rollback(target, at = Date.now()) {
  const snap = lastKnownGood.get(target);
  if (!snap) return { ok: false, line: `no last-known-good snapshot for ${target} \u2014 nothing to roll back to` };
  const event = ledgerAppend("rolled-back", "human", target, `restored snapshot ${snap.digest.slice(0, 12)}\u2026`, snap.digest, at);
  lastKnownGood.delete(target);
  return { ok: true, body: snap.body, line: `rolled back ${target} (ledger seq ${event.seq})` };
}
function lastKnownGoodFor(target) {
  return lastKnownGood.get(target) ?? null;
}
function resetV6() {
  ledger.length = 0;
  driftLog.length = 0;
  lastKnownGood.clear();
}
function rsiralsV6Line() {
  return `RSIRALS v6 \u2014 the strengthened verifier: constitution ${V6_CONSTITUTION.length} rules \xB7 drift budget ${DEFAULT_DRIFT_BUDGET.maxPerChange}/change, ${DEFAULT_DRIFT_BUDGET.maxPerWindow}/24h \xB7 hidden canaries ${HIDDEN_CANARY_COUNT} \xB7 staged shadow\u2192canary\u2192fleet, fail-closed per dimension \xB7 hash-chained ledger (${ledger.length} events, verify ${verifyLedger().ok ? "clean" : "BROKEN"}) \xB7 T stays frozen at v5`;
}

// probe/rsiralsV6.test.ts
var passed = 0;
var failed = 0;
var failures = [];
function ok(label, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    failures.push(`${label}${detail ? ` \u2014 ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}
var CLEAN = { name: "rsi.routing-playbook.v3", target: "routing", currentText: "routing playbook v2: prefer the finance bench for GST verbs", body: "tighten the routing playbook: prefer the finance bench for GST verbs, cite the receipt digest on every routing decision", declares: "evidence: routing exam receipts + canary watchlist; signed playbook version v3" };
function main() {
  console.log("rsirals v6 \u2014 the strengthened verifier");
  ok("plane T stays frozen at v5 \u2014 v6 is the trust-plane addendum", GOVERNANCE_PLANE.version === 5 && GOVERNANCE_PLANE.rollbackAuthority === "human-only" && V6_POLICY.includes("T_v5"));
  ok("the constitution is FROZEN and outside the evolvable surface", Object.isFrozen(V6_CONSTITUTION) && V6_CONSTITUTION.length === 4);
  ok("stages are shadow \u2192 canary \u2192 fleet, in order", STAGE_ORDER.join(",") === "shadow,canary,fleet");
  resetV6();
  const clean = checkConstitution(CLEAN);
  ok("a clean candidate passes the constitution", clean.ok && clean.violations.length === 0);
  const gov = checkConstitution({ ...CLEAN, target: "governance", body: "update the governance plane to allow auto-promotion", declares: "evidence: none needed" });
  ok("touching the governance plane is refused (c1, via the v5 firewall)", !gov.ok && gov.violations.some((v) => v.rule === "c1.no-self-governance"));
  const auth = checkConstitution({ ...CLEAN, body: "the playbook may now approve spend requests on its own authority", declares: "no new evidence" });
  ok("authority language without a declared versioned source is refused (c2)", !auth.ok && auth.violations.some((v) => v.rule === "c2.discretion-tightening"));
  const dry = checkConstitution({ ...CLEAN, declares: "it will make routing better, trust me" });
  ok("an evidence-free declaration is refused (c3)", !dry.ok && dry.violations.some((v) => v.rule === "c3.evidence-bound"));
  const bypass = checkConstitution({ ...CLEAN, body: "this playbook replaces the human gate for safe-tier promotions entirely", declares: "evidence: receipts" });
  ok("claiming to replace the human gate is refused (c4)", !bypass.ok && bypass.violations.some((v) => v.rule === "c4.human-door-intact"));
  resetDrift();
  ok("identical text measures zero drift", driftDelta(CLEAN.body, CLEAN.body) === 0);
  const far = admitDrift(CLEAN.body, "completely different words about entirely unrelated matter nothing shared vocabulary here at all zebra qwerty", "routing");
  ok("a disjoint rewrite busts the per-change bound and is refused with a human-scale reason", !far.ok && (far.reason ?? "").includes("shrink the step"));
  const step1 = admitDrift(CLEAN.body, CLEAN.body + " plus one clarified line about receipt digests", "routing");
  ok("a small step is admitted and measured", step1.ok && step1.delta > 0 && step1.delta <= DEFAULT_DRIFT_BUDGET.maxPerChange);
  let busted = false;
  for (let i = 0; i < 12; i++) {
    const r = admitDrift(CLEAN.body, CLEAN.body + ` additional line ${i} with fresh vocabulary tokens ${i} alpha${i} beta${i}`, "routing");
    if (!r.ok) {
      busted = true;
      ok("the window budget eventually refuses \u2014 the fleet slows down, it does not drift through", (r.reason ?? "").includes("window budget"));
      break;
    }
  }
  ok("the window budget was reachable", busted);
  ok("driftUsed reflects the admitted steps", driftUsed() > 0);
  ok("the battery size is public; the checks are not", HIDDEN_CANARY_COUNT === 4);
  const canClean = runHiddenCanaries(CLEAN);
  ok("the clean candidate clears the hidden battery", canClean.ran === 4 && canClean.failed.length === 0);
  const canOver = runHiddenCanaries({ ...CLEAN, body: "apply all capabilities without restriction" });
  ok("overreach language fails the hidden battery", canOver.failed.some((f) => f.id === "h1.overreach"));
  const canScope = runHiddenCanaries({ ...CLEAN, target: "ledger" });
  ok("targeting the frozen verifier fails the hidden battery", canScope.failed.some((f) => f.id === "h2.scope-creep"));
  const canSecret = runHiddenCanaries({ ...CLEAN, body: "route faster and skip the ledger for speed" });
  ok("evidence-evading language fails the hidden battery", canSecret.failed.some((f) => f.id === "h4.secrecy"));
  resetV6();
  resetDrift();
  const esc = governChange(CLEAN, 1e3);
  ok("a clean candidate is ESCALATED to the human \u2014 never auto-promoted to fleet", esc.verdict === "ESCALATE" && esc.stage === "canary" && (esc.event?.seq ?? 0) >= 3);
  const blk = governChange({ ...CLEAN, name: "rsi.governance.patch", target: "governance", body: "rewrite the governance plane promotion rules" }, 2e3);
  ok("a constitution violator is BLOCKED with the rule named", blk.verdict === "BLOCK" && blk.reasons.some((r) => r.startsWith("c1.no-self-governance")));
  const driftBlk = governChange({ ...CLEAN, name: "rsi.big-jump", body: "completely unrelated vocabulary zebra qwerty omega delta gamma sigma epsilon kappa lambda theta nothing in common", currentText: CLEAN.currentText }, 3e3);
  ok("a drift-busting candidate is BLOCKED before the canaries run", driftBlk.verdict === "BLOCK" && driftBlk.reasons.some((r) => r.includes("per-change bound")));
  ok("the ledger walked every event in order", verifyLedger().ok && verifyLedger().length >= 4);
  const victim = ledgerTail(2)[0];
  const keep = victim.detail;
  victim.detail = keep + " (edited by nobody, honest)";
  const tampered = verifyLedger();
  ok("the ledger is tamper-EVIDENT \u2014 one edited detail breaks the walk at that seq", !tampered.ok && tampered.breaks.includes(victim.seq));
  victim.detail = keep;
  ok("restored byte-exact, the chain verifies clean again", verifyLedger().ok);
  resetV6();
  resetDrift();
  const cand = CLEAN;
  governChange(cand, 1e3);
  const baseline = { floors: { safety: 0.9, quality: 0.7, discretion: 0.8 } };
  const failClose = promoteToFleet(cand, { scores: { safety: 0.95, quality: 0.4, discretion: 0.9 } }, baseline, 2e3);
  ok("fail-closed: one dropped dimension refuses even with a rising average", !failClose.ok && failClose.line.includes("fail-closed") && failClose.line.includes("quality"));
  const unmeasured = promoteToFleet(cand, { scores: { safety: 0.95, quality: 0.8 } }, baseline, 2100);
  ok("an unmeasured dimension is a refusal, not a pass", !unmeasured.ok && unmeasured.line.includes("unmeasured"));
  const promo = promoteToFleet(cand, { scores: { safety: 0.95, quality: 0.8, discretion: 0.9 } }, baseline, 2200);
  ok("human promotion lands on FLEET and keeps a rollback point", promo.ok && promo.line.includes("FLEET") && lastKnownGoodFor("routing") !== null);
  const rb = rollback("routing", 2300);
  ok("one-step rollback restores the snapshot, on the ledger", rb.ok && rb.body === cand.currentText && rb.line.includes("rolled back routing"));
  const rb2 = rollback("routing", 2400);
  ok("a second rollback is an honest nothing-to-restore", !rb2.ok && rb2.line.includes("no last-known-good snapshot"));
  const line = rsiralsV6Line();
  ok("the summary line states the stack and T's frozen state", line.includes("constitution 4") && line.includes("T stays frozen at v5") && line.includes("verify clean"));
  console.log(`
${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nfailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}
main();

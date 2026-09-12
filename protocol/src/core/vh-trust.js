/* v0.10.3: lazy-load the crypto module. The trust layer's pure analysis
   functions (findAuthorization, computeReputationSignals, assessActionRisk,
   grant-authority checks) must stay importable with ZERO npm dependencies —
   the bridge gate runs them without an install. Only the vouch builders,
   which seal envelopes, load vh-crypto on first use. */
let _sealSecure = null;
async function sealSecure(facts, privateKey) {
  if (!_sealSecure) ({ sealSecure: _sealSecure } = await import("./vh-crypto.js"));
  return _sealSecure(facts, privateKey);
}

export const VOUCH_KINDS = Object.freeze([
  "share", "agent_action", "capability",
  "endorsement", "authorization", "revocation",
]);

/* ── time-decay constants ── */
const ONE_WEEK_MS  = 7 * 24 * 3_600_000;
const DECAY_LAMBDA = 0.5;   // λ: half-life ≈ 10 days

/** Exponential decay weight for an event that happened `ageMs` ago. */
function _decayWeight(ageMs) {
  if (ageMs <= 0) return 1.0;
  return Math.exp(-DECAY_LAMBDA * ageMs / ONE_WEEK_MS);
}

/* ── prototype-pollution-safe JSON parse ── */
function _safeParse(str) {
  try {
    const obj = JSON.parse(str);
    if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
      /* FIX-8: own-property check ONLY. `in` walks the prototype chain, so
         "constructor" in obj is true for EVERY object; the v0.10.1 guard
         nulled every parsed payload and silently disabled the trust layer. */
      if (Object.hasOwn(obj, "__proto__") || Object.hasOwn(obj, "constructor") || Object.hasOwn(obj, "prototype")) return null;
    }
    return obj;
  } catch { return null; }
}

/* ── vouch builders (unchanged) ── */

export async function vouchAgentAction(identity, {
  agent, action, tool = null, purpose = null, policy = null, evidence = null, result = "success",
}) {
  _requireAgentArg(agent, "vouchAgentAction");
  _requireString(action,  "vouchAgentAction.action");
  return sealSecure({
    v: 2, kind: "agent_action",
    agent: { n: _sanitizeName(agent.name), fp: agent.fp },
    action: _sanitizeStr(action, 120), tool,
    purpose: _sanitizeStr(purpose, 200),
    policy, evidence: _sanitizeStr(evidence, 2000), result,
    ts: Date.now(),
  }, identity.sign.privateKey);
}

export async function declareCapability(identity, { agent, capabilities, meta = {} }) {
  _requireAgentArg(agent, "declareCapability");
  if (!Array.isArray(capabilities) || capabilities.length === 0)
    throw new Error("declareCapability: capabilities must be a non-empty array");
  return sealSecure({
    v: 2, kind: "capability",
    agent: { n: _sanitizeName(agent.name), fp: agent.fp },
    capabilities: capabilities.map((c) => _sanitizeStr(String(c), 120)),
    meta: _sanitizeMeta(meta),
    ts: Date.now(),
  }, identity.sign.privateKey);
}

export async function grantAuthorization(identity, {
  from, subject, action, scope = "*", policy = "default", expiresAt,
}) {
  _requireAgentArg(from,    "grantAuthorization.from");
  _requireAgentArg(subject, "grantAuthorization.subject");
  _requireString(action,    "grantAuthorization.action");
  if (typeof expiresAt !== "number" || expiresAt <= Date.now())
    throw new Error("grantAuthorization: expiresAt must be a future timestamp");
  return sealSecure({
    v: 2, kind: "authorization",
    from:    { n: _sanitizeName(from.name),    fp: from.fp    },
    subject: { n: _sanitizeName(subject.name), fp: subject.fp },
    action: _sanitizeStr(action, 120),
    scope:  _sanitizeStr(scope,  120),
    policy, expiresAt,
    ts: Date.now(),
  }, identity.sign.privateKey);
}

export async function endorseAgent(identity, { from, subject, rating = null, reason = "" }) {
  _requireAgentArg(from,    "endorseAgent.from");
  _requireAgentArg(subject, "endorseAgent.subject");
  return sealSecure({
    v: 2, kind: "endorsement",
    from:    { n: _sanitizeName(from.name),    fp: from.fp    },
    subject: { n: _sanitizeName(subject.name), fp: subject.fp },
    rating, reason: _sanitizeStr(reason, 500),
    ts: Date.now(),
  }, identity.sign.privateKey);
}

export async function revokeStatement(identity, { from, target, reason = "" }) {
  _requireAgentArg(from, "revokeStatement.from");
  if (!target || typeof target !== "object") throw new Error("revokeStatement: target must be object");
  return sealSecure({
    v: 2, kind: "revocation",
    from:   { n: _sanitizeName(from.name), fp: from.fp },
    target, reason: _sanitizeStr(reason, 500),
    ts: Date.now(),
  }, identity.sign.privateKey);
}

/* ── chain analysis ── */

function _parseLinks(links) {
  const out = [];
  for (const l of links) {
    const facts = _safeParse(l.payloadStr);
    if (facts && typeof facts === "object") out.push({ link: l, facts });
  }
  return out;
}

export function findAuthorization(fp, action, links, now = Date.now()) {
  if (typeof fp !== "string" || typeof action !== "string") return null;
  const parsed  = _parseLinks(links);
  const revoked = new Set();
  for (const { facts } of parsed) {
    if (facts.kind === "revocation" && facts.target?.fp === fp)
      revoked.add(facts.target.action ?? "*");
  }
  for (let i = parsed.length - 1; i >= 0; i--) {
    const { link, facts } = parsed[i];
    if (facts.kind !== "authorization")                  continue;
    if (facts.subject?.fp !== fp)                        continue;
    if (facts.action !== action && facts.action !== "*") continue;
    if (revoked.has(facts.action) || revoked.has("*"))   continue;
    if (typeof facts.expiresAt === "number" && facts.expiresAt < now) continue;
    if (link.fp && link.fp !== facts.from?.fp)           continue;   // signer binding
    return facts;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SENTINEL: computeReputationSignals() — capability-specific + time decay
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * byCapability breakdown
 * ──────────────────────
 * For each distinct action name in authorized agent_action records:
 *   count        : raw count of successful actions of that type
 *   decayedWeight: sum of e^(-λ * ageMs / ONE_WEEK) over those actions
 *                  → recent actions contribute more than old ones
 *   lastSeen     : timestamp of the most recent action of that type
 *
 * Example for MJ:
 *   byCapability = {
 *     execute_trade:     { count: 47, decayedWeight: 31.2, lastSeen: <ts> },
 *     read_market_data:  { count: 203, decayedWeight: 108.1, lastSeen: <ts> },
 *     code_review:       { count: 12, decayedWeight: 4.8, lastSeen: <ts> },
 *   }
 *
 * This lets a delegator ask: "does Bob's execute_trade reputation
 * justify this specific authorization?" rather than collapsing all
 * capabilities into one undifferentiated number.
 *
 * recentWeight = sum of decayedWeights across all capabilities.
 *
 * LIMITATIONS (unchanged — see v0.9 notes)
 *   Sybil, collusion, fake endorsements, reputation farming, evidence quality.
 *   rawScore and recentWeight must NOT be used as access-control inputs.
 *   Use findAuthorization() + assessActionRisk() for access decisions.
 * ═══════════════════════════════════════════════════════════════════════════ */
export function computeReputationSignals(fp, links, now = Date.now()) {
  if (typeof fp !== "string") return null;
  const parsed = _parseLinks(links);

  /* collect revocations for this fp */
  const revokedActions = new Set();
  let   globalRevoke   = false;
  for (const { facts } of parsed) {
    if (facts.kind === "revocation" && facts.target?.fp === fp) {
      if (facts.target.action) revokedActions.add(facts.target.action);
      else globalRevoke = true;
    }
  }

  const signals = {
    fp,
    totalVouches:           0,
    shares:                 0,
    authorizedActions:      0,
    capabilities:           0,
    endorsementsGiven:      0,
    endorsementsReceived:   0,
    ratingSum:              0,
    ratingCount:            0,
    authorizationsReceived: 0,
    revocationsAgainst:     0,
    /* Sentinel additions */
    byCapability:           {},   // { [action]: { count, decayedWeight, lastSeen } }
    recentWeight:           0,    // sum of decayedWeights across all capabilities
    /* metadata */
    avgRating:              null,
    rawScore:               0,
    scoreNote:              "raw-audit-signal-only",
    decayLambda:            DECAY_LAMBDA,
    decayHalfLifeDays:      Math.round(ONE_WEEK_MS * Math.LN2 / DECAY_LAMBDA / 86_400_000 * 10) / 10,
  };

  for (const { facts } of parsed) {
    const byMe = facts.from?.fp === fp || facts.agent?.fp === fp;
    if (byMe) signals.totalVouches++;

    switch (facts.kind) {
      case "share":
        if (facts.from?.fp === fp) signals.shares++;
        break;

      case "agent_action": {
        if (facts.agent?.fp !== fp) break;
        /* FIX-9: byCapability is DESCRIPTIVE audit history — a revocation must
           not retroactively erase observed actions (v0.10.1 contradicted its own
           selftest here). Revocation is already scored via revocationsAgainst
           (-5 in rawScore) and enforced on the access path by findAuthorization. */
        signals.authorizedActions++;

        /* Sentinel: per-capability time-decayed accounting */
        const action   = facts.action ?? "unknown";
        const ageMs    = Math.max(0, now - (facts.ts ?? now));
        const weight   = _decayWeight(ageMs);
        const ts       = facts.ts ?? now;

        if (!signals.byCapability[action]) {
          signals.byCapability[action] = { count: 0, decayedWeight: 0, lastSeen: 0 };
        }
        const cap = signals.byCapability[action];
        cap.count         += 1;
        cap.decayedWeight += weight;
        if (ts > cap.lastSeen) cap.lastSeen = ts;
        signals.recentWeight += weight;
        break;
      }

      case "capability":
        if (facts.agent?.fp === fp) signals.capabilities++;
        break;

      case "endorsement":
        if (facts.from?.fp === fp)    signals.endorsementsGiven++;
        if (facts.subject?.fp === fp) {
          signals.endorsementsReceived++;
          if (typeof facts.rating === "number") {
            signals.ratingSum   += facts.rating;
            signals.ratingCount += 1;
          }
        }
        break;

      case "authorization":
        if (facts.subject?.fp === fp) signals.authorizationsReceived++;
        break;

      case "revocation":
        if (facts.target?.fp === fp) signals.revocationsAgainst++;
        break;
    }
  }

  signals.avgRating = signals.ratingCount ? signals.ratingSum / signals.ratingCount : null;

  /* rawScore: transparent audit convenience — NOT access-control input */
  signals.rawScore = Math.max(0,
    signals.shares               *  1 +
    signals.authorizedActions    *  2 +
    signals.endorsementsReceived *  3 +
    signals.authorizationsReceived * 1 -
    signals.revocationsAgainst   *  5,
  );

  return signals;
}

/** @deprecated Use computeReputationSignals(). Kept for backward compatibility. */
export const computeReputation = computeReputationSignals;

/* ═══════════════════════════════════════════════════════════════════════════
 * v0.10.3 — GRANT AUTHORITY (explicit threat-model decision, see THREAT-MODEL.md)
 * ─────────────────────────────────────────────────────────────────────────────
 * RULE 1 (attested granter): an authorization may only be issued by an
 *   identity with an on-record attestation on this harbor — an unrevoked
 *   capability declaration or an endorsement RECEIVED. An unknown signer
 *   cannot mint grants ("Agent A signs → Agent B authorized" is refused).
 * RULE 2 (delegation chains): a grant may carry authority = { root, depth }.
 *   depth ≥ 1 requires (a) the root itself is attested and (b) the granter
 *   HOLDS a live grant from that root — sub-granting is delegated, never
 *   self-invented. Depth is capped (config maxDelegationDepth, default 2).
 * Bootstrap is an on-record capability claim (reputation-weighted, revocable);
 * human-root authority via Patina's human-principal envelopes is roadmap.
 * ═══════════════════════════════════════════════════════════════════════════ */
export function isAttested(fp, links, now = Date.now()) {
  if (typeof fp !== "string" || !fp) return false;
  const parsed = _parseLinks(links);
  const attestationRevoked = parsed.some(({ facts }) =>
    facts.kind === "revocation" && facts.target?.fp === fp &&
    (facts.target.kind === "capability" || facts.target.action === "*"));
  if (attestationRevoked) return false;
  for (const { facts } of parsed) {
    if (facts.kind === "capability" && facts.agent?.fp === fp) return true;
    if (facts.kind === "endorsement" && facts.subject?.fp === fp) return true;
  }
  return false;
}

export function verifyGrantAuthority(granterFp, facts, links, { maxDepth = 2, now = Date.now() } = {}) {
  if (typeof granterFp !== "string" || !granterFp) return { ok: false, reason: "grantor-unattested" };
  const auth = facts?.authority;
  if (auth == null) {
    return isAttested(granterFp, links, now)
      ? { ok: true, depth: 0, reason: "attested-granter" }
      : { ok: false, reason: "grantor-unattested" };
  }
  if (typeof auth !== "object" || Array.isArray(auth) ||
      typeof auth.root !== "string" || !auth.root ||
      !Number.isInteger(auth.depth) || auth.depth < 1)
    return { ok: false, reason: "malformed-authority" };
  if (auth.depth > maxDepth) return { ok: false, reason: "delegation-depth-exceeded" };
  if (!isAttested(auth.root, links, now)) return { ok: false, reason: "authority-root-unattested" };
  /* the granter must HOLD a live grant from the claimed root (revocation +
     expiry aware) — delegation is real, not self-declared */
  const parsed = _parseLinks(links);
  const revoked = new Set();
  for (const { facts: f } of parsed)
    if (f.kind === "revocation" && f.target?.fp === granterFp) revoked.add(f.target.action ?? "*");
  const holdsParent = parsed.some(({ facts: f }) =>
    f.kind === "authorization" && f.from?.fp === auth.root && f.subject?.fp === granterFp &&
    !revoked.has(f.action) && !revoked.has("*") &&
    (typeof f.expiresAt !== "number" || f.expiresAt >= now));
  if (!holdsParent) return { ok: false, reason: "no-parent-grant" };
  return { ok: true, depth: auth.depth, reason: "delegated-authority" };
}

export function assessActionRisk(fp, action, links, now = Date.now()) {
  if (typeof fp !== "string" || typeof action !== "string")
    return { level: "error", reason: "invalid-args" };
  const parsed  = _parseLinks(links);
  const revoked = parsed.some(({ facts }) =>
    facts.kind === "revocation" && facts.target?.fp === fp &&
    (facts.target.action === action || !facts.target.action));
  if (revoked) return { level: "blocked",      reason: "authorization-revoked" };
  const grant = findAuthorization(fp, action, links, now);
  if (!grant)  return { level: "unauthorized", reason: "no-valid-authorization" };
  const ttl = grant.expiresAt ? grant.expiresAt - now : Infinity;
  if (ttl < 60_000) return { level: "high", reason: "grant-expires-soon", grant, ttlMs: ttl };
  return { level: "ok", reason: "authorized", grant, ttlMs: ttl, delegator: grant.from?.fp };
}

/* ── sanitization helpers ── */
function _sanitizeStr(s, maxLen) { if (s == null) return null; return String(s).trim().slice(0, maxLen); }
function _sanitizeName(n)         { return _sanitizeStr(n, 60) || ""; }
function _sanitizeMeta(m) {
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  const safe = Object.create(null);
  for (const [k, v] of Object.entries(m))
    if (typeof k === "string" && k.length <= 40 && typeof v === "string") safe[k] = v.slice(0, 200);
  return safe;
}
function _requireAgentArg(a, ctx) {
  if (!a || typeof a.fp !== "string" || !a.fp) throw new Error(`${ctx}: agent must have a fp string`);
}
function _requireString(s, ctx) {
  if (typeof s !== "string" || !s.trim()) throw new Error(`${ctx}: must be a non-empty string`);
}

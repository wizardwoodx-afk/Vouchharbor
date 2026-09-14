/**
 * VH-19 — signed collaboration invitations (18.2.0).
 *
 * The product flow the vision named, as a real cryptographic workflow:
 *
 *   USER 1  "work with Qwen"
 *        ↓  createInvitation(scope, risk ceiling, duration, capabilities)
 *     SIGNED INVITE TOKEN (ECDSA P-256 over the canonical payload)
 *        ↓  secure link / message
 *   USER 2  parseInvitation → signature VERIFIED against the issuer key
 *        ↓  sees issuer + scope + ceiling → Approve / Reject
 *     SIGNED APPROVAL TOKEN (approver's own key over the invite digest)
 *        ↓
 *     collaboration bound; approvals carry proof, not strings
 *
 * Identity model: each VH instance holds a P-256 keypair per member id
 * (local keystore). The invite carries the issuer's public key — first
 * contact is TRUST-ON-FIRST-USE and says so; binding that key to the A2A
 * JWS identity is the host-runtime step. What is NOT trust-on-first-use:
 * the bytes — a tampered payload or a signature from any other key refuses.
 */

const ID_KEY_PREFIX = "vh19.collab.key.v1:";

export interface CollabIdentity {
  memberId: string;
  publicJwk: JsonWebKey;
}

export interface InvitationPayload {
  v: "vh19-invite/1";
  id: string;
  from: string;
  to: string;
  scope: string;
  riskCeiling: "safe" | "risky" | "critical";
  durationH: number;
  capabilities: string[];
  message?: string;
  createdAt: string;
  issuerPublicJwk: JsonWebKey;
  /** TOFU flag — the key travels with the invite until bound out-of-band. */
  trustModel: "tofu";
}

export interface SignedInvitation {
  payload: InvitationPayload;
  signatureB64: string;
  digest: string;
}

export interface SignedApproval {
  inviteDigest: string;
  approver: string;
  approved: boolean;
  at: string;
  publicJwk: JsonWebKey;
  signatureB64: string;
}

/* ── encoding helpers ─────────────────────────────────────────────────────── */

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const u8 = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
  return u8;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", enc.encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canonical(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

/* ── identities ───────────────────────────────────────────────────────────── */

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Load or mint the local ECDSA P-256 identity for a member id. */
export async function collabIdentity(memberId: string): Promise<CollabIdentity & { privateJwk: JsonWebKey }> {
  const s = storage();
  const raw = s?.getItem(ID_KEY_PREFIX + memberId);
  if (raw) {
    const both = JSON.parse(raw) as { pub: JsonWebKey; priv: JsonWebKey };
    return { memberId, publicJwk: both.pub, privateJwk: both.priv };
  }
  const pair = await globalThis.crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const priv = await globalThis.crypto.subtle.exportKey("jwk", pair.privateKey);
  const pub = await globalThis.crypto.subtle.exportKey("jwk", pair.publicKey);
  s?.setItem(ID_KEY_PREFIX + memberId, JSON.stringify({ pub, priv }));
  return { memberId, publicJwk: pub, privateJwk: priv };
}

async function importPublic(jwk: JsonWebKey): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}

async function importPrivate(jwk: JsonWebKey): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

const SIGN_PARAMS: EcKeyImportParams & { hash: string } = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };

/* ── invitations ──────────────────────────────────────────────────────────── */

export interface InviteArgs {
  from: string;
  to: string;
  scope: string;
  riskCeiling: "safe" | "risky" | "critical";
  durationH: number;
  capabilities: string[];
  message?: string;
  now?: () => Date;
}

export async function createInvitation(args: InviteArgs): Promise<SignedInvitation> {
  const ident = await collabIdentity(args.from);
  const payload: InvitationPayload = {
    v: "vh19-invite/1",
    id: `inv-${(args.now ?? (() => new Date()))().getTime().toString(36)}`,
    from: args.from,
    to: args.to,
    scope: args.scope,
    riskCeiling: args.riskCeiling,
    durationH: args.durationH,
    capabilities: args.capabilities,
    message: args.message,
    createdAt: (args.now ?? (() => new Date()))().toISOString(),
    issuerPublicJwk: ident.publicJwk,
    trustModel: "tofu",
  };
  const canon = canonical(payload);
  const key = await importPrivate(ident.privateJwk);
  const sig = await globalThis.crypto.subtle.sign(SIGN_PARAMS, key, enc.encode(canon) as Uint8Array<ArrayBuffer>);
  return { payload, signatureB64: b64url(sig), digest: await sha256Hex(canon + "." + b64url(sig)) };
}

export type ParseResult =
  | { ok: true; invite: SignedInvitation; issuerVerified: true }
  | { ok: false; error: string };

export async function parseInvitation(token: string): Promise<ParseResult> {
  let obj: { payload?: InvitationPayload; signatureB64?: string; digest?: string };
  try {
    obj = JSON.parse(new TextDecoder().decode(fromB64url(token.trim())));
  } catch {
    return { ok: false, error: "not a parseable invitation token" };
  }
  if (!obj.payload || obj.payload.v !== "vh19-invite/1" || !obj.signatureB64) {
    return { ok: false, error: "token is not a vh19-invite/1 payload" };
  }
  const canon = canonical(obj.payload);
  let verified: boolean;
  try {
    const key = await importPublic(obj.payload.issuerPublicJwk);
    verified = await globalThis.crypto.subtle.verify(SIGN_PARAMS, key, fromB64url(obj.signatureB64) as Uint8Array<ArrayBuffer>, enc.encode(canon) as Uint8Array<ArrayBuffer>);
  } catch {
    verified = false;
  }
  if (!verified) return { ok: false, error: "signature does not verify against the issuer key — the invite was tampered with or is not from its claimed issuer" };
  const digest = await sha256Hex(canon + "." + obj.signatureB64);
  if (obj.digest && obj.digest !== digest) return { ok: false, error: "invite digest mismatch" };
  return { ok: true, invite: { payload: obj.payload, signatureB64: obj.signatureB64, digest }, issuerVerified: true };
}

export function serializeInvitation(inv: SignedInvitation): string {
  return b64url(enc.encode(JSON.stringify(inv)));
}

/* ── approvals: signed by the approver's own identity ─────────────────────── */

export async function signApproval(inviteDigest: string, approver: string, approved: boolean, now: () => Date = () => new Date()): Promise<SignedApproval> {
  const ident = await collabIdentity(approver);
  const body = { inviteDigest, approver, approved, at: now().toISOString() };
  const key = await importPrivate(ident.privateJwk);
  const sig = await globalThis.crypto.subtle.sign(SIGN_PARAMS, key, enc.encode(canonical(body)) as Uint8Array<ArrayBuffer>);
  return { ...body, publicJwk: ident.publicJwk, signatureB64: b64url(sig) };
}

export type VerifyApprovalResult = { ok: true } | { ok: false; error: string };

export async function verifyApproval(a: SignedApproval, expectedApprover: string): Promise<VerifyApprovalResult> {
  if (a.approver !== expectedApprover) return { ok: false, error: `approval claims "${a.approver}" but the team expects "${expectedApprover}"` };
  const body = { inviteDigest: a.inviteDigest, approver: a.approver, approved: a.approved, at: a.at };
  try {
    const key = await importPublic(a.publicJwk);
    const ok = await globalThis.crypto.subtle.verify(SIGN_PARAMS, key, fromB64url(a.signatureB64) as Uint8Array<ArrayBuffer>, enc.encode(canonical(body)) as Uint8Array<ArrayBuffer>);
    return ok ? { ok: true } : { ok: false, error: `approval signature for "${a.approver}" does not verify` };
  } catch {
    return { ok: false, error: `approval signature for "${a.approver}" is not verifiable` };
  }
}

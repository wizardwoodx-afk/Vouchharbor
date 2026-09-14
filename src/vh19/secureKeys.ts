/**
 * VH-19 — collaboration identity keys, encrypted at rest (18.3.0).
 *
 * The 18.2.0 external review was right: private JWKs lived PLAIN in
 * localStorage, so any XSS that reads storage steals the signing identity.
 * The production answer is an OS keychain behind Tauri IPC; this module is
 * the honest step that ships TODAY without unverifiable native code:
 *
 *   • the private key is encrypted with AES-256-GCM under a key derived from
 *     the user's passphrase (PBKDF2-SHA-256, 150k iterations) — the
 *     passphrase is NEVER stored;
 *   • decrypted keys live ONLY in a module-scoped in-memory map for the
 *     session; nothing decrypts at boot;
 *   • legacy plaintext v1 blobs are PURGED on first contact with this
 *     module — a key written by 18.2.0 is treated as compromised and
 *     replaced, not migrated;
 *   • the public JWK is stored in the open (it is public).
 *
 * What this does NOT do, and says so: it does not resist a memory-read
 * after unlock, and it is not a hardware boundary. The upgrade path to
 * `OS keychain via Tauri IPC` is documented in VH-18.3-UPGRADE.md — no
 * unverifiable Rust is shipped pretending to be one.
 */
const V2_KEY = (memberId: string) => `vh19.collab.key.v2:${memberId}`;
const V1_KEY = (memberId: string) => `vh19.collab.key.v1:${memberId}`;

export interface EncryptedIdentity {
  v: "vh19-collab-key/2";
  memberId: string;
  publicJwk: JsonWebKey;
  saltB64: string;
  ivB64: string;
  cipherB64: string;
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  createdAt: string;
}

const PBKDF_ITERATIONS = 150_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
};
const fromB64 = (s: string): Uint8Array =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Session-only unlocked private keys. Never serialized, never persisted. */
const unlocked = new Map<string, CryptoKey>();

export function identityUnlocked(memberId: string): boolean {
  return unlocked.has(memberId);
}

export function forgetIdentity(memberId: string): void {
  unlocked.delete(memberId);
}

/** True when a legacy plaintext key exists — those are treated as breached. */
export function hasLegacyPlaintextKey(memberId: string): boolean {
  return storage()?.getItem(V1_KEY(memberId)) !== null;
}

function purgeLegacy(memberId: string): void {
  const s = storage();
  if (s && s.getItem(V1_KEY(memberId)) !== null) {
    s.removeItem(V1_KEY(memberId)); // 18.2.0 plaintext blob: gone, not migrated
  }
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await globalThis.crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return globalThis.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: PBKDF_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export type EnsureResult =
  | { ok: true; created: boolean; publicJwk: JsonWebKey; purgedLegacy: boolean }
  | { ok: false; error: string };

/**
 * Create the identity on first contact (passphrase encrypts the private
 * half) or unlock an existing one. A wrong passphrase REFUSES in words —
 * it is never silently retried, never "fixed".
 */
export async function ensureIdentity(memberId: string, passphrase: string): Promise<EnsureResult> {
  if (!memberId || !passphrase || passphrase.length < 8) {
    return { ok: false, error: "a passphrase of at least 8 characters guards the signing key" };
  }
  const s = storage();
  purgeLegacy(memberId);
  const raw = s?.getItem(V2_KEY(memberId)) ?? null;
  if (raw === null) {
    const pair = await globalThis.crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const publicJwk = await globalThis.crypto.subtle.exportKey("jwk", pair.publicKey);
    const privateJwk = await globalThis.crypto.subtle.exportKey("jwk", pair.privateKey);
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const kek = await deriveKey(passphrase, salt);
    const cipher = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      kek,
      enc.encode(JSON.stringify(privateJwk)),
    );
    const record: EncryptedIdentity = {
      v: "vh19-collab-key/2",
      memberId,
      publicJwk,
      saltB64: toB64(salt),
      ivB64: toB64(iv),
      cipherB64: toB64(cipher),
      kdf: "PBKDF2-SHA-256",
      iterations: PBKDF_ITERATIONS,
      createdAt: new Date().toISOString(),
    };
    s?.setItem(V2_KEY(memberId), JSON.stringify(record));
    unlocked.set(memberId, pair.privateKey);
    return { ok: true, created: true, publicJwk, purgedLegacy: false };
  }
  const record = JSON.parse(raw) as EncryptedIdentity;
  try {
    const kek = await deriveKey(passphrase, fromB64(record.saltB64));
    const plain = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(record.ivB64) as unknown as BufferSource },
      kek,
      fromB64(record.cipherB64) as unknown as BufferSource,
    );
    const privateJwk = JSON.parse(dec.decode(plain)) as JsonWebKey;
    const key = await globalThis.crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    unlocked.set(memberId, key);
    return { ok: true, created: false, publicJwk: record.publicJwk, purgedLegacy: false };
  } catch {
    return { ok: false, error: "wrong passphrase — the private key stays sealed" };
  }
}

export function storedPublicJwk(memberId: string): JsonWebKey | null {
  const raw = storage()?.getItem(V2_KEY(memberId)) ?? null;
  if (raw === null) return null;
  try {
    return (JSON.parse(raw) as EncryptedIdentity).publicJwk;
  } catch {
    return null;
  }
}

export const SIGN_PARAMS: EcKeyImportParams & EcdsaParams = {
  name: "ECDSA",
  namedCurve: "P-256",
  hash: "SHA-256",
};

/** Sign with the session-unlocked key. Refuses when the identity is locked. */
export async function signWithIdentity(memberId: string, data: Uint8Array): Promise<string> {
  const key = unlocked.get(memberId);
  if (!key) throw new Error(`identity "${memberId}" is locked — unlock it before signing`);
  const sig = await globalThis.crypto.subtle.sign(
    SIGN_PARAMS,
    key,
    data as unknown as BufferSource,
  );
  return toB64(sig);
}

export function jwkEqual(a: JsonWebKey, b: JsonWebKey): boolean {
  return a.kty === b.kty && a.crv === b.crv && a.x === b.x && a.y === b.y;
}

export function jwkFingerprint(jwk: JsonWebKey): string {
  return `${(jwk.x ?? "").slice(0, 8)}…${(jwk.y ?? "").slice(-4)}`;
}

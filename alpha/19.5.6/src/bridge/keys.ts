/**
 * keys.ts — real keys for the bridge. Harbour A signs; harbour B verifies with
 * A's **public** key. Not the same function called twice.
 *
 * THE POINT THE FIRST VERSION MISSED. The first bridge receipt was "signed" by
 * calling one function on the canonical bytes, and "verified" by calling the same
 * function again and comparing strings. That is a checksum wearing a signature's
 * clothes: whoever can verify can also mint, so a receipt proves nothing about
 * who produced it. A crossing between two owners needs the property that makes a
 * signature worth the name — the verifier holds something that can *check* but
 * cannot *produce*.
 *
 * So: ECDSA over P-256 with SHA-256, via the platform's Web Crypto
 * (`globalThis.crypto.subtle`), which is present in Node ≥ 18, every browser and
 * every Tauri webview. Zero dependencies; the private key never leaves the
 * closure that signs with it and is never exported.
 *
 * The registry is the whole trust surface: a harbor holds its OWN private key and
 * the PUBLIC keys of peers it has chosen to recognise. Nothing else is needed to
 * verify a crossing, and nothing else can be used to forge one.
 */

/** The only algorithm this module produces. Named in every signature record. */
export const BRIDGE_KEY_ALG = 'ECDSA-P256-SHA256';

export class CryptoUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoUnavailableError';
  }
}

/* ------------------------------ base64 (no deps) ------------------------------ */

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP: Readonly<Record<string, number>> = (() => {
  const table: Record<string, number> = {};
  for (let i = 0; i < B64_ALPHABET.length; i += 1) table[B64_ALPHABET[i] as string] = i;
  return table;
})();

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] as number) : 0;
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] as number) : 0;
    out += B64_ALPHABET[b0 >> 2] as string;
    out += B64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)] as string;
    out += i + 1 < bytes.length ? (B64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] as string) : '=';
    out += i + 2 < bytes.length ? (B64_ALPHABET[b2 & 0x3f] as string) : '=';
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_LOOKUP[clean[i] as string] ?? 0;
    const c1 = B64_LOOKUP[clean[i + 1] as string] ?? 0;
    const c2 = B64_LOOKUP[clean[i + 2] as string] ?? 0;
    const c3 = B64_LOOKUP[clean[i + 3] as string] ?? 0;
    if (o < out.length) out[o++] = (c0 << 2) | (c1 >> 4);
    if (o < out.length) out[o++] = ((c1 & 0x0f) << 4) | (c2 >> 2);
    if (o < out.length) out[o++] = ((c2 & 0x03) << 6) | c3;
  }
  return out;
}

export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/* --------------------------------- the crypto -------------------------------- */

let injectedSubtle: SubtleCrypto | undefined;

/**
 * Supply a Web Crypto implementation on a runtime that has no global one.
 * Node ≥ 18 and browsers need nothing; this exists so a locked-down runtime can
 * still run the bridge with the platform's own crypto rather than a hand-rolled
 * primitive. With none available the bridge **refuses to sign**, because an
 * unverifiable receipt is worse than a missing one.
 */
export function provideSubtleCrypto(subtle: SubtleCrypto): void {
  injectedSubtle = subtle;
}

export function resolveSubtle(): SubtleCrypto {
  if (injectedSubtle !== undefined) return injectedSubtle;
  const globalCrypto = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto;
  if (globalCrypto?.subtle === undefined) {
    throw new CryptoUnavailableError(
      'no Web Crypto available: this runtime has no globalThis.crypto.subtle. Pass one with provideSubtleCrypto(), or run the bridge where ECDSA can actually be performed.',
    );
  }
  return globalCrypto.subtle;
}

export function hasWebCrypto(): boolean {
  return injectedSubtle !== undefined || (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle !== undefined;
}

/** The public half of a harbor's key. This is the only thing a peer needs. */
export interface HarborPublicKey {
  readonly harbor: string;
  readonly keyId: string;
  readonly alg: typeof BRIDGE_KEY_ALG;
  /** JWK: `{ kty: 'EC', crv: 'P-256', x, y }`. Safe to publish. */
  readonly jwk: JsonWebKey;
}

/** A harbor's own key material. `sign` is the only way out of the closure. */
export interface HarborKeys extends HarborPublicKey {
  sign(bytes: Uint8Array): Promise<string>;
}

/** Registry key: `harbor#keyId`. */
export function keyRef(harbor: string, keyId: string): string {
  return `${harbor}#${keyId}`;
}

export type KeyRegistry = Readonly<Record<string, HarborPublicKey>>;

export function registryWith(...keys: readonly HarborPublicKey[]): KeyRegistry {
  const out: Record<string, HarborPublicKey> = {};
  for (const k of keys) out[keyRef(k.harbor, k.keyId)] = k;
  return out;
}

export function publicOf(keys: HarborKeys): HarborPublicKey {
  return { harbor: keys.harbor, keyId: keys.keyId, alg: keys.alg, jwk: keys.jwk };
}

export function lookupKey(registry: KeyRegistry, harbor: string, keyId: string): HarborPublicKey | undefined {
  return registry[keyRef(harbor, keyId)];
}

/**
 * Generate a harbour's key pair. The private key stays inside the returned
 * closure; it is never exported, never stored, and never has a serialised form.
 */
export async function createHarborKeys(harbor: string, keyId?: string): Promise<HarborKeys> {
  const subtle = resolveSubtle();
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const keys = pair as CryptoKeyPair;
  const jwk = (await subtle.exportKey('jwk', keys.publicKey)) as JsonWebKey;
  const id = keyId ?? `k-${(jwk.x ?? '').slice(0, 12)}`;
  return {
    harbor,
    keyId: id,
    alg: BRIDGE_KEY_ALG,
    jwk,
    async sign(bytes: Uint8Array): Promise<string> {
      const raw = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, bytes as unknown as ArrayBuffer);
      return toBase64(new Uint8Array(raw));
    },
  };
}

/**
 * Verify a signature with a **public** key. This is the operation a peer
 * performs: it can check a crossing it did not produce, and it cannot produce one
 * it did not sign.
 */
export async function verifySignature(
  key: HarborPublicKey,
  bytes: Uint8Array,
  signatureB64: string,
): Promise<boolean> {
  if (key.alg !== BRIDGE_KEY_ALG) return false;
  const subtle = resolveSubtle();
  const imported = await subtle.importKey('jwk', key.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  return subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    imported,
    fromBase64(signatureB64) as unknown as ArrayBuffer,
    bytes as unknown as ArrayBuffer,
  );
}

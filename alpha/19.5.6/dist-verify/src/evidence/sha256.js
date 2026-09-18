"use strict";
/**
 * sha256.ts — SHA-256, implemented here so the offline verifier needs nothing.
 *
 * WHY NOT THE PLATFORM. Everywhere else in this increment the platform's Web
 * Crypto does the work, because a hand-rolled primitive is a liability. This is
 * the one exception, and the reason is the product claim rather than a preference:
 * an Evidence Pack must verify **offline, on a machine that does not trust us and
 * may not have a browser engine**. Signing belongs to the platform; digesting a
 * pack belongs to the verifier, and that means it has to be in the bytes we hand
 * over.
 *
 * The previous version called its digest `vh1:` and computed a 64-bit FNV-style
 * hash. That is a fine *checksum against accidental corruption* and it is not a
 * cryptographic digest, so calling it a digest was a claim the code could not
 * support. Now:
 *
 *   - `checksum()` — the fast non-cryptographic hash, named for what it is, used
 *     only for short labels inside records.
 *   - `sha256Hex()` — FIPS 180-4 SHA-256, used for every pack digest and every
 *     answer digest, so it lines up with the SHA-256 already used across Vouch
 *     Harbor's evidence chain.
 *
 * Correctness is not asserted here, it is proven in `probe/sha256.test.ts`: the
 * NIST/FIPS vectors, the padding boundaries at 55/56/64 bytes, multi-block inputs,
 * a 1,000,000-byte input, and a cross-check against `node:crypto` on random input.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256Bytes = sha256Bytes;
exports.sha256Hex = sha256Hex;
exports.sha256Label = sha256Label;
exports.checksum = checksum;
const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const HEX = '0123456789abcdef';
function rotr(x, n) {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
}
/** FIPS 180-4 SHA-256 over bytes. Returns the 32-byte digest. */
function sha256Bytes(input) {
    const h = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    const bitLen = input.length * 8;
    /* message ‖ 0x80 ‖ zero padding ‖ 8-byte big-endian bit length, to a 64-byte block:
       the length field must leave room, which is why 55 bytes fits in one block and
       56 does not. */
    const total = (((input.length + 9 + 63) / 64) | 0) * 64;
    const buffer = new Uint8Array(total);
    buffer.set(input, 0);
    buffer[input.length] = 0x80;
    const high = Math.floor(bitLen / 4294967296);
    const low = bitLen >>> 0;
    buffer[total - 8] = (high >>> 24) & 0xff;
    buffer[total - 7] = (high >>> 16) & 0xff;
    buffer[total - 6] = (high >>> 8) & 0xff;
    buffer[total - 5] = high & 0xff;
    buffer[total - 4] = (low >>> 24) & 0xff;
    buffer[total - 3] = (low >>> 16) & 0xff;
    buffer[total - 2] = (low >>> 8) & 0xff;
    buffer[total - 1] = low & 0xff;
    const w = new Uint32Array(64);
    for (let offset = 0; offset < total; offset += 64) {
        for (let i = 0; i < 16; i += 1) {
            const j = offset + i * 4;
            w[i] = ((buffer[j] << 24) | (buffer[j + 1] << 16) | (buffer[j + 2] << 8) | buffer[j + 3]) >>> 0;
        }
        for (let i = 16; i < 64; i += 1) {
            const w15 = w[i - 15];
            const w2 = w[i - 2];
            const s0 = (rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3)) >>> 0;
            const s1 = (rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10)) >>> 0;
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }
        let a = h[0];
        let b = h[1];
        let c = h[2];
        let d = h[3];
        let e = h[4];
        let f = h[5];
        let g = h[6];
        let hh = h[7];
        for (let i = 0; i < 64; i += 1) {
            const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
            const ch = ((e & f) ^ (~e & g)) >>> 0;
            const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
            const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
            const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
            const temp2 = (S0 + maj) >>> 0;
            hh = g;
            g = f;
            f = e;
            e = (d + temp1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) >>> 0;
        }
        h[0] = (h[0] + a) >>> 0;
        h[1] = (h[1] + b) >>> 0;
        h[2] = (h[2] + c) >>> 0;
        h[3] = (h[3] + d) >>> 0;
        h[4] = (h[4] + e) >>> 0;
        h[5] = (h[5] + f) >>> 0;
        h[6] = (h[6] + g) >>> 0;
        h[7] = (h[7] + hh) >>> 0;
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i += 1) {
        const word = h[i];
        out[i * 4] = (word >>> 24) & 0xff;
        out[i * 4 + 1] = (word >>> 16) & 0xff;
        out[i * 4 + 2] = (word >>> 8) & 0xff;
        out[i * 4 + 3] = word & 0xff;
    }
    return out;
}
function sha256Hex(input) {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
    const digest = sha256Bytes(bytes);
    let out = '';
    for (const b of digest)
        out += HEX[(b >> 4) & 0xf] + HEX[b & 0xf];
    return out;
}
/** `vh1:sha256:<hex>` — the label used by receipts, packs and answer digests. */
function sha256Label(input) {
    return `vh1:sha256:${sha256Hex(input)}`;
}
/**
 * The fast non-cryptographic hash, kept for short labels inside records and named
 * so nobody mistakes it for integrity. Never use it where tampering is the threat.
 */
function checksum(text) {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < text.length; i += 1) {
        const c = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
        h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
    }
    return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 24);
}

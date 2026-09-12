import { VHConfigError } from "../core/vh-errors.js";

function ranged(val, min, max, name) {
  const n = Number(val);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new VHConfigError(`${name} must be between ${min} and ${max}, got: ${val}`);
  return n;
}

function strictBool(val, dflt, name) {
  if (val === undefined || val === null) return dflt;
  if (val === "true"  || val === true)   return true;
  if (val === "false" || val === false)  return false;
  throw new VHConfigError(`${name} must be "true" or "false", got: ${val}`);
}

export function loadConfig(env = process.env) {
  return Object.freeze({
    port:          ranged(env.PORT ?? 3000,                          1024, 65535,       "PORT"),
    dataDir:       String(env.VH_DATA_DIR   ?? "./data"),
    ledgerFile:    String(env.VH_LEDGER_FILE ?? "ledger.jsonl"),
    chainMemory:   ranged(env.VH_CHAIN_MEMORY ?? 1_000,             10, 1_000_000,     "VH_CHAIN_MEMORY"),
    tsWindowMs:    ranged(env.VH_TS_WINDOW_MS ?? 5 * 60_000,        10_000, 30 * 60_000, "VH_TS_WINDOW_MS"),
    maxFileMB:     ranged(env.VH_MAX_FILE_MB  ?? 500,               1, 10_000,          "VH_MAX_FILE_MB"),
    maxNameLen:    ranged(env.VH_MAX_NAME_LEN ?? 60,                1, 200,             "VH_MAX_NAME_LEN"),
    maxSocketsPerIp: ranged(env.VH_MAX_SOCKETS_PER_IP ?? 10,        1, 1000,            "VH_MAX_SOCKETS_PER_IP"),
    maxPayloadBytes: ranged(env.VH_MAX_PAYLOAD_BYTES ?? 64 * 1024,  1024, 10 * 1024 * 1024, "VH_MAX_PAYLOAD_BYTES"),
    banThreshold:  ranged(env.VH_BAN_THRESHOLD ?? 20,               1, 1000,            "VH_BAN_THRESHOLD"),
    banDurationMs: ranged(env.VH_BAN_DURATION_MS ?? 15 * 60_000,    60_000, 24 * 3_600_000, "VH_BAN_DURATION_MS"),
    /*
     * requireMetaSig — Sentinel / Strict posture merged.
     * true (default): every new link MUST carry a harbor metaSig.
     *   The harbor refuses to append a link if metaSig computation fails.
     *   Startup rejects any link after firstMetaSigSeq that lacks metaSig.
     * false: legacy mode for pre-v0.9 ledgers being migrated.
     *   New links still get metaSig when harborKey is available, but
     *   startup does NOT reject links that are missing metaSig.
     */
    requireMetaSig: strictBool(env.VH_REQUIRE_META_SIG, true, "VH_REQUIRE_META_SIG"),
    /* v0.10.3: cap on delegated-authority depth (see protocol/THREAT-MODEL.md) */
    maxDelegationDepth: ranged(env.VH_MAX_DELEGATION_DEPTH ?? 2, 0, 8, "VH_MAX_DELEGATION_DEPTH"),
    failFastOnTamper: strictBool(env.VH_FAIL_FAST_ON_TAMPER, true, "VH_FAIL_FAST_ON_TAMPER"),
    rate: Object.freeze({
      join:   ranged(env.VH_RATE_JOIN   ?? 2,  0.01, 100,   "VH_RATE_JOIN"),
      signal: ranged(env.VH_RATE_SIGNAL ?? 30, 1,    1000,  "VH_RATE_SIGNAL"),
      vouch:  ranged(env.VH_RATE_VOUCH  ?? 5,  0.1,  100,   "VH_RATE_VOUCH"),
    }),
  });
}

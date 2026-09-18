/**
 * VERSION.ts — one version stamps the engine, the control plane, the proof
 * protocol and the native shell. Every manifest must agree, and the drift gate
 * enforces it.
 *
 * RETARGETED. The first cut of this pack was stamped 19.5.4-alpha against a 19.5.4
 * "Reach" engine. The engine in hand is 19.5.6 "Reach", and a governance layer
 * that pages on the wrong release is a governance layer nobody can install. So the
 * stamp moved to 19.5.6: this pack is an increment **on top of 19.5.6 Reach**, and
 * nothing in 19.5.6 is modified by it.
 */
export const VERSION = '19.5.6-alpha';
export const VERSION_DISPLAY = '19.5.6 [Alpha]';
export const CODENAME = 'Bridge';
export const CHANNEL = 'alpha' as const;
/** The release this alpha pages on top of. Unchanged by this increment. */
export const PAGES_ON = '19.5.6 "Reach"';

export const FLEET = {
  /** Established specialists with their own execution suites, already in Reach. */
  established: 1150,
  /** Added by this pack: registered, doctrinally specified, station-aligned. */
  registered: 200,
  total: 1350,
  terminology:
    '1,150 established specialists + 200 registered federation specialists. The 200 are not claimed as equal runtime depth until their per-specialist suites land.',
} as const;

export const ADDS = [
  'agent-bridge',        // cross-user agent crossings, ECDSA-signed joint receipts
  'beacon',              // watch the work, take the wheel (refuse, never queue)
  'memory-channel',      // five scopes incl. pair, kept time, marked cuts
  'policy-plane',        // fail-closed rules a CISO can read
  'evidence-pack',       // EU AI Act / ISO 42001 / NIST mapping with declared gaps
] as const;

export const FLAGS: Readonly<Record<string, boolean>> = {
  VH_POLICY_PLANE: false,
  VH_BRIDGE: false,
  VH_BRIDGE_REQUIRE_HUMAN_FIRST: true,
  VH_MEMORY_CHANNEL: false,
  VH_EVIDENCE_PACK: false,
  VH_BEACON: false,
};

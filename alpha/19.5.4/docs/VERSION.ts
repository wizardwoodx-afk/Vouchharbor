/**
 * VERSION.ts — one version stamps the engine, the control plane, the proof
 * protocol and the native shell. Every manifest must agree, and the drift gate
 * enforces it.
 */
export const VERSION = '19.5.4-alpha';
export const VERSION_DISPLAY = '19.5.4 [Alpha]';
export const CODENAME = 'Bridge';
export const CHANNEL = 'alpha' as const;
/** The release this alpha pages on top of. Unchanged by this increment. */
export const PAGES_ON = '19.5.4 "Reach"';

export const FLEET_SIZE = 1350;
export const FEDERATION_BATCH_SIZE = 200;

export const ADDS = [
  'agent-bridge',        // cross-user agent crossings, co-signed joint receipts
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

/**
 * Vouch Harbor — single source of truth for the release version.
 * Every manifest (package.json, Cargo.toml, tauri.conf.json, verify bundles,
 * README, BUILD-NATIVE, Cargo.lock, package-lock) must agree with this.
 * `probe/versionDrift.test.ts` enforces that.
 */
export const VH_VERSION = "19.5.1";
export const VH_SHORT = "19.5";
export const VH_CODENAME = "Reach";
export const VH_TITLE = `Vouch Harbor ${VH_SHORT} "${VH_CODENAME}"`;
export const VH_TAGLINE = "The Receipt OS for AI Agents.";

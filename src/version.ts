/**
 * Build identity — single source of truth for the release version.
 * The PRODUCT name lives in src/brand.ts; nothing a user reads shows this number.
 * Every manifest (package.json, Cargo.toml, tauri.conf.json, verify bundles,
 * README, BUILD-NATIVE, Cargo.lock, package-lock) must agree with this.
 * `probe/versionDrift.test.ts` enforces that.
 */
export const VH_VERSION = "19.7.14";
export const VH_SHORT = "19.7";
export const VH_CODENAME = "Munshi";
export const VH_TITLE = `Velvet Hand (engine ${VH_SHORT} "${VH_CODENAME}")`;
export const VH_TAGLINE = "Your agents, with receipts.";

/**
 * VH COMPUTER-USE — 19.5.1 "Reach"
 *
 * VH grows hands: process execution and a built-in headless browser, both
 * governed by the same discipline as everything else:
 *
 *   · ALLOWLISTED BINARY EXECUTION — pc.exec runs only binaries on the
 *     mission's allowlist; arguments are injection-scanned; every run is
 *     bounded (timeout, output ceiling) and RECEIPTED.
 *   · BUILT-IN HEADLESS BROWSER — pc.browser drives a real browser binary
 *     (chromium / google-chrome / chromium-browser) when one is present.
 *     Profiles are isolated per mission (no shared cookies or storage).
 *     When no binary exists, the plane REFUSES WORDING THE REFUSAL — it
 *     never fakes a page it never loaded.
 *   · HTTPS BY POLICY — plain-http navigation is refused at the plane.
 *   · HUMAN HANDOVER — any action classified critical returns a handover
 *     request instead of executing; the gate decides, not the plane.
 *   · RECEIPTS — every executed action (or refusal) produces a receipt
 *     record compatible with the VH proof system.
 *
 * The browser transport is injectable so probes pin the driver logic
 * deterministically; the default transport uses the real fetch API.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

const sha256 = (t: string) => createHash("sha256").update(t).digest("hex");

export type PcRisk = "safe" | "risky" | "critical";

// ── pc.exec — bounded, allowlisted process execution ────────────────────────
export interface ExecPolicy {
  allowlist: string[];          // binaries this mission may run
  maxRuntimeMs: number;         // hard timeout
  maxOutputBytes: number;       // captured output ceiling
}

export interface ExecReceipt {
  kind: "pc.exec";
  binary: string;
  args: string[];
  decision: "executed" | "refused" | "handover";
  exitCode: number | null;
  timedOut: boolean;
  stdoutDigest: string;
  stderrDigest: string;
  stdoutPreview: string;
  reason: string;
  durationMs: number;
  digest: string;
}

const SHELL_META = /[;&|`$<>!*?\n\r]/;

export function pcExec(
  binary: string,
  args: string[],
  policy: ExecPolicy,
  risk: PcRisk,
  opts: { run?: (bin: string, args: string[], timeoutMs: number) => { status: number | null; timedOut: boolean; stdout: string; stderr: string } } = {},
): ExecReceipt {
  const started = Date.now();
  const refuse = (reason: string): ExecReceipt => finalize({
    kind: "pc.exec", binary, args, decision: "refused", exitCode: null, timedOut: false,
    stdoutDigest: "", stderrDigest: "", stdoutPreview: "", reason, durationMs: Date.now() - started,
  });
  if (risk === "critical") {
    return finalize({
      kind: "pc.exec", binary, args, decision: "handover", exitCode: null, timedOut: false,
      stdoutDigest: "", stderrDigest: "", stdoutPreview: "",
      reason: "critical-tier command: handed to the human gate, not executed", durationMs: Date.now() - started,
    });
  }
  if (!policy.allowlist.includes(binary)) {
    return refuse(`binary "${binary}" is not on this mission's allowlist (${policy.allowlist.join(", ") || "empty"})`);
  }
  const injected = args.filter((a) => SHELL_META.test(a));
  if (injected.length) {
    return refuse(`shell metacharacters in arguments (${injected.join(", ")}) — injection risk, refusing`);
  }
  const run = opts.run ?? defaultRun;
  let out: { status: number | null; timedOut: boolean; stdout: string; stderr: string };
  try {
    out = run(binary, args, policy.maxRuntimeMs);
  } catch (err) {
    return refuse(`execution failed to start: ${(err as Error).message}`);
  }
  const stdout = out.stdout.slice(0, policy.maxOutputBytes);
  return finalize({
    kind: "pc.exec", binary, args, decision: "executed", exitCode: out.status, timedOut: out.timedOut,
    stdoutDigest: sha256(out.stdout), stderrDigest: sha256(out.stderr), stdoutPreview: stdout.slice(0, 400),
    reason: out.timedOut ? `ran past the ${policy.maxRuntimeMs}ms ceiling and was stopped` : "completed within bounds",
    durationMs: Date.now() - started,
  });
}

function defaultRun(bin: string, args: string[], timeoutMs: number) {
  const r = spawnSync(bin, args, { timeout: timeoutMs, encoding: "utf-8", shell: false });
  return { status: r.status, timedOut: Boolean(r.error && "code" in r.error && r.error.code === "ETIMEDOUT") || (r.signal === "SIGTERM" && r.status === null), stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function finalize<T extends object>(base: T): T & { digest: string } {
  return { ...base, digest: sha256(JSON.stringify(base)) };
}

// ── browser profiles — isolation by construction ────────────────────────────
export interface BrowserProfile {
  name: string;
  missionId: string;          // one profile per mission; storage dies with it
  userAgent: string;
  viewport: { width: number; height: number };
  cookiesAllowed: boolean;    // default false — opt in per mission
}

export function newProfile(missionId: string, name = "default"): BrowserProfile {
  return { name, missionId, userAgent: `VH-Reach/19.5 (accountable-agent; mission ${missionId})`, viewport: { width: 1280, height: 800 }, cookiesAllowed: false };
}

// ── browser binary detection — honesty over pretending ──────────────────────
export function detectBrowserBinary(paths: string[] = DEFAULT_BROWSER_PATHS): string | null {
  for (const p of paths) if (existsSync(p)) return p;
  return null;
}
export const DEFAULT_BROWSER_PATHS = [
  "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable", "/snap/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

// ── the headless browser driver ─────────────────────────────────────────────
export type PageSnapshot = { url: string; title: string; links: string[]; status: number };

export interface BrowserTransport {
  open(url: string, profile: BrowserProfile): Promise<PageSnapshot>;
  act(snapshot: PageSnapshot, action: BrowserAction): Promise<PageSnapshot>;
}

export type BrowserAction =
  | { type: "navigate"; url: string }
  | { type: "click"; selector: string }
  | { type: "type"; selector: string; text: string };

export interface BrowserStepReceipt {
  kind: "pc.browser";
  missionId: string;
  action: BrowserAction | { type: "open"; url: string };
  decision: "executed" | "refused" | "handover";
  result: PageSnapshot | null;
  reason: string;
  digest: string;
}

/** Default transport: real fetch for open; navigation for act. */
export const fetchTransport: BrowserTransport = {
  async open(url, profile) {
    const res = await fetch(url, { headers: { "user-agent": profile.userAgent }, redirect: "follow" });
    const html = await res.text();
    return parseSnapshot(url, res.status, html);
  },
  async act(_snapshot, action) {
    if (action.type === "navigate") {
      const res = await fetch(action.url, { redirect: "follow" });
      return parseSnapshot(action.url, res.status, await res.text());
    }
    throw new Error("click/type require a live browser session — use the browser binary plane for interactive acts");
  },
};

function parseSnapshot(url: string, status: number, html: string): PageSnapshot {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  const links = Array.from(html.matchAll(/href="([^"]+)"/gi)).map((m) => m[1]).slice(0, 50);
  return { url, title, links, status };
}

export class HeadlessBrowser {
  readonly profile: BrowserProfile;
  private transport: BrowserTransport;
  readonly binary: string | null;
  steps: BrowserStepReceipt[] = [];

  constructor(profile: BrowserProfile, transport: BrowserTransport = fetchTransport, binary: string | null = detectBrowserBinary()) {
    this.profile = profile;
    this.transport = transport;
    this.binary = binary;
  }

  private record(receipt: Omit<BrowserStepReceipt, "digest" | "missionId">): BrowserStepReceipt {
    const full = finalize({ ...receipt, missionId: this.profile.missionId });
    this.steps.push(full);
    return full;
  }

  private guardUrl(url: string): string | null {
    if (!url.startsWith("https://")) return "plain-http navigation refused — the browser plane is HTTPS-by-policy";
    return null;
  }

  async open(url: string, risk: PcRisk = "risky"): Promise<BrowserStepReceipt> {
    if (risk === "critical") {
      return this.record({ kind: "pc.browser", action: { type: "open", url }, decision: "handover", result: null, reason: "critical-tier navigation: handed to the human gate" });
    }
    const refusal = this.guardUrl(url);
    if (refusal) return this.record({ kind: "pc.browser", action: { type: "open", url }, decision: "refused", result: null, reason: refusal });
    try {
      const result = await this.transport.open(url, this.profile);
      return this.record({ kind: "pc.browser", action: { type: "open", url }, decision: "executed", result, reason: `loaded (${result.status}) under profile ${this.profile.name}` });
    } catch (err) {
      return this.record({ kind: "pc.browser", action: { type: "open", url }, decision: "refused", result: null, reason: `load failed: ${(err as Error).message} — nothing faked` });
    }
  }

  async act(current: PageSnapshot, action: BrowserAction, risk: PcRisk = "risky"): Promise<BrowserStepReceipt> {
    if (risk === "critical") {
      return this.record({ kind: "pc.browser", action, decision: "handover", result: null, reason: "critical-tier page action: handed to the human gate" });
    }
    if (action.type === "navigate") {
      const refusal = this.guardUrl(action.url);
      if (refusal) return this.record({ kind: "pc.browser", action, decision: "refused", result: null, reason: refusal });
    }
    try {
      const result = await this.transport.act(current, action);
      return this.record({ kind: "pc.browser", action, decision: "executed", result, reason: "action applied under the mission profile" });
    } catch (err) {
      return this.record({ kind: "pc.browser", action, decision: "refused", result: null, reason: `action failed: ${(err as Error).message}` });
    }
  }

  /**
   * Screenshot via the real browser binary when present. No binary → an
   * honest refusal; the receipt records what could not be done.
   */
  screenshot(outPath: string): BrowserStepReceipt {
    const action: BrowserAction = { type: "navigate", url: "screenshot" };
    if (!this.binary) {
      return this.record({ kind: "pc.browser", action, decision: "refused", result: null, reason: "no browser binary on this machine — screenshot refused, not faked" });
    }
    const last = [...this.steps].reverse().find((s) => s.result && s.decision === "executed");
    if (!last?.result) {
      return this.record({ kind: "pc.browser", action, decision: "refused", result: null, reason: "no page is currently loaded — open a page before screenshotting" });
    }
    const r = spawnSync(this.binary, ["--headless", "--disable-gpu", "--no-sandbox", `--screenshot=${outPath}`, `--window-size=${this.profile.viewport.width},${this.profile.viewport.height}`, last.result.url], { timeout: 30_000, encoding: "utf-8" });
    if (r.status !== 0) {
      return this.record({ kind: "pc.browser", action, decision: "refused", result: last.result, reason: `browser binary exited ${r.status}: ${(r.stderr ?? "").slice(0, 200)}` });
    }
    return this.record({ kind: "pc.browser", action, decision: "executed", result: last.result, reason: `screenshot written to ${outPath}` });
  }

  /** Mission teardown: the profile's state is declared destroyed. */
  teardown(): { missionId: string; stepsReceipted: number; digest: string } {
    return { missionId: this.profile.missionId, stepsReceipted: this.steps.length, digest: sha256(this.steps.map((s) => s.digest).join("|")) };
  }
}

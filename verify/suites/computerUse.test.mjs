import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/computerUse.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// src/vh19/computerUse.ts
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
var sha256 = (t) => createHash("sha256").update(t).digest("hex");
var SHELL_META = /[;&|`$<>!*?\n\r]/;
function pcExec(binary, args, policy2, risk, opts = {}) {
  const started = Date.now();
  const refuse = (reason) => finalize({
    kind: "pc.exec",
    binary,
    args,
    decision: "refused",
    exitCode: null,
    timedOut: false,
    stdoutDigest: "",
    stderrDigest: "",
    stdoutPreview: "",
    reason,
    durationMs: Date.now() - started
  });
  if (risk === "critical") {
    return finalize({
      kind: "pc.exec",
      binary,
      args,
      decision: "handover",
      exitCode: null,
      timedOut: false,
      stdoutDigest: "",
      stderrDigest: "",
      stdoutPreview: "",
      reason: "critical-tier command: handed to the human gate, not executed",
      durationMs: Date.now() - started
    });
  }
  if (!policy2.allowlist.includes(binary)) {
    return refuse(`binary "${binary}" is not on this mission's allowlist (${policy2.allowlist.join(", ") || "empty"})`);
  }
  const injected = args.filter((a) => SHELL_META.test(a));
  if (injected.length) {
    return refuse(`shell metacharacters in arguments (${injected.join(", ")}) \u2014 injection risk, refusing`);
  }
  const run = opts.run ?? defaultRun;
  let out;
  try {
    out = run(binary, args, policy2.maxRuntimeMs);
  } catch (err) {
    return refuse(`execution failed to start: ${err.message}`);
  }
  const stdout = out.stdout.slice(0, policy2.maxOutputBytes);
  return finalize({
    kind: "pc.exec",
    binary,
    args,
    decision: "executed",
    exitCode: out.status,
    timedOut: out.timedOut,
    stdoutDigest: sha256(out.stdout),
    stderrDigest: sha256(out.stderr),
    stdoutPreview: stdout.slice(0, 400),
    reason: out.timedOut ? `ran past the ${policy2.maxRuntimeMs}ms ceiling and was stopped` : "completed within bounds",
    durationMs: Date.now() - started
  });
}
function defaultRun(bin, args, timeoutMs) {
  const r = spawnSync(bin, args, { timeout: timeoutMs, encoding: "utf-8", shell: false });
  return { status: r.status, timedOut: Boolean(r.error && "code" in r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGTERM" && r.status === null, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}
function finalize(base) {
  return { ...base, digest: sha256(JSON.stringify(base)) };
}
function newProfile(missionId, name = "default") {
  return { name, missionId, userAgent: `VH-Reach/19.5 (accountable-agent; mission ${missionId})`, viewport: { width: 1280, height: 800 }, cookiesAllowed: false };
}
function detectBrowserBinary(paths = DEFAULT_BROWSER_PATHS) {
  for (const p of paths) if (existsSync(p)) return p;
  return null;
}
var DEFAULT_BROWSER_PATHS = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/snap/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
];
var fetchTransport = {
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
    throw new Error("click/type require a live browser session \u2014 use the browser binary plane for interactive acts");
  }
};
function parseSnapshot(url, status, html) {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  const links = Array.from(html.matchAll(/href="([^"]+)"/gi)).map((m) => m[1]).slice(0, 50);
  return { url, title, links, status };
}
var HeadlessBrowser = class {
  profile;
  transport;
  binary;
  steps = [];
  constructor(profile, transport = fetchTransport, binary = detectBrowserBinary()) {
    this.profile = profile;
    this.transport = transport;
    this.binary = binary;
  }
  record(receipt) {
    const full = finalize({ ...receipt, missionId: this.profile.missionId });
    this.steps.push(full);
    return full;
  }
  guardUrl(url) {
    if (!url.startsWith("https://")) return "plain-http navigation refused \u2014 the browser plane is HTTPS-by-policy";
    return null;
  }
  async open(url, risk = "risky") {
    if (risk === "critical") {
      return this.record({ kind: "pc.browser", action: { type: "open", url }, decision: "handover", result: null, reason: "critical-tier navigation: handed to the human gate" });
    }
    const refusal = this.guardUrl(url);
    if (refusal) return this.record({ kind: "pc.browser", action: { type: "open", url }, decision: "refused", result: null, reason: refusal });
    try {
      const result = await this.transport.open(url, this.profile);
      return this.record({ kind: "pc.browser", action: { type: "open", url }, decision: "executed", result, reason: `loaded (${result.status}) under profile ${this.profile.name}` });
    } catch (err) {
      return this.record({ kind: "pc.browser", action: { type: "open", url }, decision: "refused", result: null, reason: `load failed: ${err.message} \u2014 nothing faked` });
    }
  }
  async act(current, action, risk = "risky") {
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
      return this.record({ kind: "pc.browser", action, decision: "refused", result: null, reason: `action failed: ${err.message}` });
    }
  }
  /**
   * Screenshot via the real browser binary when present. No binary → an
   * honest refusal; the receipt records what could not be done.
   */
  screenshot(outPath) {
    const action = { type: "navigate", url: "screenshot" };
    if (!this.binary) {
      return this.record({ kind: "pc.browser", action, decision: "refused", result: null, reason: "no browser binary on this machine \u2014 screenshot refused, not faked" });
    }
    const last = [...this.steps].reverse().find((s) => s.result && s.decision === "executed");
    if (!last?.result) {
      return this.record({ kind: "pc.browser", action, decision: "refused", result: null, reason: "no page is currently loaded \u2014 open a page before screenshotting" });
    }
    const r = spawnSync(this.binary, ["--headless", "--disable-gpu", "--no-sandbox", `--screenshot=${outPath}`, `--window-size=${this.profile.viewport.width},${this.profile.viewport.height}`, last.result.url], { timeout: 3e4, encoding: "utf-8" });
    if (r.status !== 0) {
      return this.record({ kind: "pc.browser", action, decision: "refused", result: last.result, reason: `browser binary exited ${r.status}: ${(r.stderr ?? "").slice(0, 200)}` });
    }
    return this.record({ kind: "pc.browser", action, decision: "executed", result: last.result, reason: `screenshot written to ${outPath}` });
  }
  /** Mission teardown: the profile's state is declared destroyed. */
  teardown() {
    return { missionId: this.profile.missionId, stepsReceipted: this.steps.length, digest: sha256(this.steps.map((s) => s.digest).join("|")) };
  }
};

// probe/computerUse.test.ts
var policy = { allowlist: ["echo", "ls"], maxRuntimeMs: 5e3, maxOutputBytes: 1024 };
var fakeRun = (stdout, status = 0, timedOut = false) => () => ({ status, timedOut, stdout, stderr: "" });
var fakeTransport = {
  async open(url, profile) {
    return { url, title: `page @ ${url} via ${profile.userAgent.split("/")[0]}`, links: ["/a", "/b"], status: 200 };
  },
  async act(snap, action) {
    if (action.type === "navigate") return { url: action.url, title: "next", links: [], status: 200 };
    return { ...snap, title: `${snap.title} (${action.type})` };
  }
};
test("computer-use", async (t) => {
  await t.test("an allowlisted binary executes and is receipted", () => {
    const r = pcExec("echo", ["hello"], policy, "safe", { run: fakeRun("hello\n") });
    assert.equal(r.decision, "executed");
    assert.equal(r.exitCode, 0);
    assert.equal(r.timedOut, false);
    assert.ok(r.stdoutDigest.length === 64);
    assert.ok(r.digest.length === 64);
  });
  await t.test("a non-allowlisted binary is refused wordingly", () => {
    const r = pcExec("rm", ["-rf", "/"], policy, "risky", { run: fakeRun("") });
    assert.equal(r.decision, "refused");
    assert.match(r.reason, /not on this mission's allowlist/);
  });
  await t.test("shell metacharacters in args are refused as injection", () => {
    const r = pcExec("echo", ["hello; rm -rf /"], policy, "safe", { run: fakeRun("") });
    assert.equal(r.decision, "refused");
    assert.match(r.reason, /injection risk/);
  });
  await t.test("critical-tier commands hand over to the gate, never execute", () => {
    const r = pcExec("echo", ["secret"], policy, "critical", { run: fakeRun("secret") });
    assert.equal(r.decision, "handover");
    assert.match(r.reason, /human gate/);
  });
  await t.test("timeouts are flagged, not hidden", () => {
    const r = pcExec("ls", ["/"], policy, "safe", { run: fakeRun("", null, true) });
    assert.equal(r.timedOut, true);
    assert.match(r.reason, /ceiling/);
  });
  await t.test("output is capped at the policy ceiling", () => {
    const r = pcExec("echo", ["x"], policy, "safe", { run: fakeRun("A".repeat(5e3)) });
    assert.ok(r.stdoutPreview.length <= 400);
  });
  await t.test("profiles are mission-isolated and cookie-free by default", () => {
    const p = newProfile("m-1");
    assert.equal(p.missionId, "m-1");
    assert.equal(p.cookiesAllowed, false);
    assert.match(p.userAgent, /m-1/);
  });
  const browser = new HeadlessBrowser(newProfile("m-2"), fakeTransport, null);
  await t.test("opens HTTPS pages under the mission profile", async () => {
    const r = await browser.open("https://example.com/");
    assert.equal(r.decision, "executed");
    assert.ok(r.result);
    assert.equal(r.result.status, 200);
    assert.match(r.reason, /profile default/);
  });
  await t.test("refuses plain-http navigation", async () => {
    const r = await browser.open("http://example.com/");
    assert.equal(r.decision, "refused");
    assert.match(r.reason, /HTTPS-by-policy/);
  });
  await t.test("critical navigation hands over to the gate", async () => {
    const r = await browser.open("https://bank.example.com/", "critical");
    assert.equal(r.decision, "handover");
  });
  await t.test("page actions are receipted against the loaded page", async () => {
    const snap = { url: "https://example.com/", title: "x", links: [], status: 200 };
    const r = await browser.act(snap, { type: "click", selector: "#go" });
    assert.equal(r.decision, "executed");
    assert.equal(r.result.title, "x (click)");
  });
  await t.test("screenshot refuses honestly when no browser binary exists", () => {
    const r = browser.screenshot("/tmp/x.png");
    assert.equal(r.decision, "refused");
    assert.match(r.reason, /no browser binary|nothing faked|no page/i);
  });
  await t.test("teardown seals the whole mission trail", () => {
    const td = browser.teardown();
    assert.equal(td.missionId, "m-2");
    assert.ok(td.stepsReceipted >= 4);
    assert.ok(td.digest.length === 64);
  });
  await t.test("browser binary detection returns null or a real path", () => {
    const b = detectBrowserBinary(["/nonexistent/chrome-xyz"]);
    assert.equal(b, null);
  });
});

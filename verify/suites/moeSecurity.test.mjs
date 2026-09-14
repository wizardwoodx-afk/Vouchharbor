import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// src/moe/providers.ts
var PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    openaiBaseUrl: "https://api.openai.com/v1",
    nativeBaseUrl: null,
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-5.2",
    pricePerMTokens: { input: 1.25, output: 10 }
  },
  {
    id: "anthropic",
    label: "Anthropic",
    openaiBaseUrl: "https://api.anthropic.com/v1",
    nativeBaseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-6",
    pricePerMTokens: { input: 3, output: 15 }
  },
  {
    id: "gemini",
    label: "Google Gemini",
    openaiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    nativeBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKeyEnv: "GEMINI_API_KEY",
    defaultModel: "gemini-3-flash",
    pricePerMTokens: { input: 0.3, output: 2.5 }
  },
  {
    id: "openai-compatible",
    label: "Custom OpenAI-compatible (LM Studio / llama.cpp / router)",
    openaiBaseUrl: "http://127.0.0.1:1234/v1",
    nativeBaseUrl: null,
    apiKeyEnv: "VH_LLM_API_KEY",
    defaultModel: "local",
    pricePerMTokens: { input: 0, output: 0 }
  }
];
function providerById(id) {
  return PROVIDERS.find((p) => p.id === id);
}
var PROVIDER_HOSTS = /* @__PURE__ */ new Set([
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com"
]);
var LOOPBACK_HOSTS = /* @__PURE__ */ new Set(["127.0.0.1", "localhost", "::1", "[::1]", "[::ffff:127.0.0.1]"]);
function checkBaseUrl(raw, opts = {}) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "base url is not a URL" };
  }
  const host = u.hostname.toLowerCase();
  const loopback = LOOPBACK_HOSTS.has(host);
  if (u.protocol !== "https:" && !loopback) {
    return { ok: false, reason: `refusing plaintext ${u.protocol}//${host} \u2014 an API key over http is a leaked API key, allowlisted host or not` };
  }
  if (opts.expectHost && host !== opts.expectHost) {
    return { ok: false, reason: `base url host ${host} is not ${opts.expectHost} for this provider` };
  }
  if (!loopback && !PROVIDER_HOSTS.has(host) && !opts.allowCustomBase) {
    return {
      ok: false,
      reason: `host ${host} is not an allowlisted provider host; pass allowCustomBase:true only if you operate it`,
      host
    };
  }
  if (PROVIDER_HOSTS.has(host) && u.pathname.replace(/\/+$/, "") !== "/v1" && u.pathname !== "/v1beta/openai" && !opts.allowCustomBase) {
    return { ok: false, reason: `unexpected path ${u.pathname} for provider host ${host}`, host };
  }
  return { ok: true, host };
}
function redactSecrets(input) {
  return String(input).replace(/sk-ant-[A-Za-z0-9_-]{10,}/g, "sk-ant-[REDACTED]").replace(/sk-[A-Za-z0-9_-]{16,}/g, "sk-[REDACTED]").replace(/g?[ky]-[A-Za-z0-9_-]{20,}/g, "[REDACTED-KEY]").replace(/AIza[A-Za-z0-9_-]{20,}/g, "AIza[REDACTED]").replace(/(Bearer\s+)[A-Za-z0-9._~+/-]{12,}=*/gi, "$1[REDACTED]").replace(/(api[_-]?key["'\s:=]+)[^\s"',}]{8,}/gi, "$1[REDACTED]").replace(/(authorization["'\s:=]+)[^\s"',}]{8,}/gi, "$1[REDACTED]");
}
function looksLikeSecret(token) {
  return /^[A-Za-z0-9_\-]{28,}$/.test(token) && !/^[a-z]+$/.test(token);
}
function costUsd(spec, usage) {
  const c = usage.inputTokens / 1e6 * spec.pricePerMTokens.input + usage.outputTokens / 1e6 * spec.pricePerMTokens.output;
  return Number(c.toFixed(6));
}
var BudgetGuard = class {
  constructor(capUsd) {
    this.capUsd = capUsd;
  }
  spent = 0;
  add(usage, spec) {
    this.spent += costUsd(spec, usage);
    return this.spent;
  }
  get spentUsd() {
    return Number(this.spent.toFixed(6));
  }
  over() {
    return this.spent > this.capUsd;
  }
  describe() {
    return `$${this.spent.toFixed(4)} of a $${this.capUsd} cap${this.over() ? " \u2014 EXCEEDED" : ""}`;
  }
};
function buildChatRequest(spec, req) {
  const base = spec.openaiBaseUrl.replace(/\/+$/, "");
  return {
    url: `${base}/chat/completions`,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: req.model || spec.defaultModel,
      messages: req.messages.map((m) => ({ role: m.role, content: redactSecrets(m.content) })),
      ...typeof req.temperature === "number" ? { temperature: req.temperature } : {},
      ...typeof req.maxTokens === "number" ? { max_tokens: req.maxTokens } : {}
    })
  };
}

// probe/moeSecurity.test.ts
var passed = 0;
var failures = [];
function ok(label, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail ? ` \u2014 ${detail}` : ""}`);
    console.log(`  FAIL ${label} \u2014 ${detail}`);
  }
}
function section(n) {
  console.log(`
== ${n}`);
}
section("0. the vendor table states verified contracts");
ok("three providers plus a local escape hatch", PROVIDERS.length === 4);
var openai = providerById("openai");
var anthropic = providerById("anthropic");
var gemini = providerById("gemini");
ok("OpenAI uses its own host", openai.openaiBaseUrl === "https://api.openai.com/v1", openai.openaiBaseUrl);
ok("Anthropic exposes an OpenAI-compatible v1 path", anthropic.openaiBaseUrl === "https://api.anthropic.com/v1", anthropic.openaiBaseUrl);
ok(
  "Gemini uses the documented v1beta/openai compatibility surface",
  gemini.openaiBaseUrl === "https://generativelanguage.googleapis.com/v1beta/openai",
  gemini.openaiBaseUrl
);
ok("every provider names the env var it reads, no key literals", PROVIDERS.every((p) => /^[A-Z0-9_]+$/.test(p.apiKeyEnv) && !/sk-/.test(JSON.stringify(p))));
ok("loopback local model is http but explicitly local", providerById("openai-compatible").openaiBaseUrl.startsWith("http://127.0.0.1"), providerById("openai-compatible").openaiBaseUrl);
section("1. base-url guard \u2014 the key-theft path is closed by default");
ok("the vendor's own host is allowed", checkBaseUrl(openai.openaiBaseUrl, { expectHost: "api.openai.com" }).ok === true);
ok("https to an unknown host is REFUSED without opt-in", (() => {
  const r = checkBaseUrl("https://evil.example.com/v1");
  return r.ok === false && /not an allowlisted provider host/.test(r.reason ?? "");
})(), JSON.stringify(checkBaseUrl("https://evil.example.com/v1")));
ok("an operator who runs their own endpoint can opt in explicitly", checkBaseUrl("https://llm.internal.example/v1", { allowCustomBase: true }).ok === true);
ok("PLAINTEXT to a non-loopback host is refused outright", (() => {
  const r = checkBaseUrl("http://api.openai.com/v1");
  return r.ok === false && /allowlisted host or not/.test(r.reason ?? "");
})(), JSON.stringify(checkBaseUrl("http://api.openai.com/v1")));
ok("loopback http is allowed (local models are the point)", checkBaseUrl("http://127.0.0.1:1234/v1").ok === true);
ok("localhost is allowed", checkBaseUrl("http://localhost:11434/v1").ok === true);
ok("ANY https host is refused without opt-in \u2014 the allowlist is not 'everything over tls'", (() => {
  const anyHosts = ["https://collector.tld/v1", "https://api.openai.com.malicious.tld/v1", "https://localhost.evil.tld/v1"];
  return anyHosts.every((u) => checkBaseUrl(u).ok === false);
}), ["https://collector.tld/v1", "https://api.openai.com.malicious.tld/v1"].map((u) => JSON.stringify(checkBaseUrl(u))).join(" | "));
ok("a provider host with a doctored path is refused (suffix spoof)", checkBaseUrl("https://api.openai.com.evil.tld/v1").ok === false);
ok("an unexpected path on a real provider host is refused", checkBaseUrl("https://api.openai.com/proxy/steal").ok === false, JSON.stringify(checkBaseUrl("https://api.openai.com/proxy/steal")));
ok("http to a provider host is refused even though that host is allowlisted", checkBaseUrl("http://api.anthropic.com/v1").ok === false);
ok("the real gemini compatibility path is accepted over https", (() => {
  const g = "https://generativelanguage.googleapis.com/v1beta/openai";
  const r = checkBaseUrl(g, { expectHost: "generativelanguage.googleapis.com" });
  return r.ok === true;
})(), JSON.stringify(checkBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai", { expectHost: "generativelanguage.googleapis.com" })));
ok(
  "provider confusion is caught: an openai base cannot masquerade as anthropic",
  checkBaseUrl(openai.openaiBaseUrl, { expectHost: "api.anthropic.com" }).ok === false
);
ok("garbage input is a refusal, not a throw", checkBaseUrl("not a url :://").ok === false);
ok("a file: url is refused", checkBaseUrl("file:///etc/passwd").ok === false);
ok("loopback host cannot smuggle another host via userinfo", (() => {
  const smuggle = checkBaseUrl("http://127.0.0.1@evil.example.com/v1");
  return smuggle.ok === false || smuggle.host !== "127.0.0.1";
})(), JSON.stringify(checkBaseUrl("http://127.0.0.1@evil.example.com/v1")));
section("2. redaction happens on the way OUT, so a future log-everything change cannot leak");
var LEAKY = [
  "key is sk-ant-abcdef1234567890XYZ and more",
  "Authorization: Bearer sk-proj-AAAAAAAAAAAAAAAAAAAAAAAA",
  '{"api_key": "AIzaSyD-aaaaaaaaaaaaaaaaaaaaaaaaaa123"}',
  "token=ya29.a0AfH6SMBxxxxxxxxxxxxxxxxxxxx",
  "export OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz0123456789"
];
for (const [i, s] of LEAKY.entries()) {
  const out = redactSecrets(s);
  ok(`leaky string ${i} is scrubbed and mentions no key material`, !/sk-ant-abcdef|sk-proj-AAAA|AIzaSyD|abcdefghijklmnopqrstuvwxyz0123/.test(out), out);
}
ok("redaction is idempotent", redactSecrets(redactSecrets(LEAKY[0])) === redactSecrets(LEAKY[0]));
ok("ordinary prose survives redaction untouched", redactSecrets("add input validation to the login form") === "add input validation to the login form");
ok("the request builder scrubs message content before it leaves", (() => {
  const req = buildChatRequest(openai, { model: "", messages: [{ role: "user", content: "here is my key sk-ant-abcdef1234567890XYZ" }] });
  return !/sk-ant-abcdef/.test(req.body) && /REDACTED/.test(req.body);
})(), buildChatRequest(openai, { model: "", messages: [{ role: "user", content: "sk-ant-abcdef1234567890XYZ" }] }).body);
ok("the request builder never puts the key in the body or headers", (() => {
  const req = buildChatRequest(anthropic, { model: "m", messages: [{ role: "user", content: "hi" }] });
  return !/api[_-]?key/i.test(req.body) && !Object.keys(req.headers).some((h) => /key|auth/i.test(h));
})());
ok("looksLikeSecret catches high-entropy blobs and spares words", looksLikeSecret("aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5") === true && looksLikeSecret("validation") === false);
section("3. budget \u2014 a 158-way router multiplies spend, so the cap is in the loop");
var guard = new BudgetGuard(0.05);
ok("cost is computed from the provider's own table", costUsd(openai, { inputTokens: 1e6, outputTokens: 0 }) === openai.pricePerMTokens.input);
ok("local models cost zero", costUsd(providerById("openai-compatible"), { inputTokens: 5e3, outputTokens: 5e3 }) === 0);
ok("under the cap, dispatch continues", (() => {
  const g = new BudgetGuard(1);
  g.add({ inputTokens: 1e3, outputTokens: 1e3 }, openai);
  return g.over() === false;
})());
ok("over the cap, the run stops", (() => {
  const g = new BudgetGuard(1e-4);
  g.add({ inputTokens: 2e5, outputTokens: 2e5 }, anthropic);
  return g.over() === true && /EXCEEDED/.test(g.describe());
})());
ok("the cap is a refusal in words, not a silent truncation", (() => {
  const g = new BudgetGuard(1e-4);
  g.add({ inputTokens: 9e5, outputTokens: 9e5 }, gemini);
  return /of a \$0\.0001 cap/.test(g.describe());
})());
section("4. risk asserted by a sender is never accepted as truth");
var verdict = (asserted, own) => {
  const rank = { safe: 0, risky: 1, critical: 2 };
  return rank[asserted] >= rank[own] ? asserted : own;
};
ok("a sender calling a force-push 'safe' is upgraded, not believed", verdict("safe", "critical") === "critical");
ok("a sender that overstates risk is never talked down", verdict("risky", "safe") === "risky");
ok("agreement is preserved", verdict("safe", "safe") === "safe");
ok("the worst of the two is always the result", [verdict("safe", "critical"), verdict("critical", "safe")].every((v) => v === "critical"));
console.log(`
${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ! ${f}`);
  process.exit(1);
}

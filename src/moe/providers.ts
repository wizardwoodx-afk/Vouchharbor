/**
 * LLM provider wiring for VH-19 — OpenAI / Anthropic / Google (17.10.11).
 *
 * The base URLs below are the vendors' own public contracts, verified against
 * their published OpenAI-compatibility endpoints. Everything else in this file is
 * defence, because this is the one module in the MoE layer that can leak: it
 * holds keys and it makes network calls on behalf of prompt text that a
 * specialist — i.e. a third-party MIT file someone could edit in a PR — produced.
 *
 * Two rules, enforced rather than documented:
 *
 *   1. BASE-URL ALLOWLIST. An arbitrary `baseURL` plus a live API key is the
 *      classic agent exfiltration path: get the config file changed, collect the
 *      key. A non-allowlisted host therefore requires `allowCustomBase: true`,
 *      stated by the operator, not implied by the presence of a variable.
 *   2. REDACTION AT THE BOUNDARY. Keys never enter a receipt, a trace, an error
 *      message or a log line. Scrubbing happens on the way out, so a future
 *      "log the whole request for debugging" change cannot leak by accident.
 */

export type ProviderId = "openai" | "anthropic" | "gemini" | "openai-compatible";

export interface ProviderSpec {
  id: ProviderId;
  label: string;
  /** OpenAI-compatible chat/completions base — append /chat/completions */
  openaiBaseUrl: string;
  /** native wire, where the vendor has one that is not OpenAI-compatible */
  nativeBaseUrl: string | null;
  apiKeyEnv: string;
  /** sensible default for a coding agent; overridable per harbor */
  defaultModel: string;
  /** USD per 1M tokens, used for the budget guard. Estimates, labelled as such. */
  pricePerMTokens: { input: number; output: number };
}

/**
 * Verified 2026-09-14 against the vendors' published compatibility endpoints.
 * Google's OpenAI-compatible surface is `…/v1beta/openai/`; Anthropic's
 * OpenAI-compatible surface is `…/v1/`; OpenAI's is the SDK default.
 */
export const PROVIDERS: readonly ProviderSpec[] = [
  {
    id: "openai",
    label: "OpenAI",
    openaiBaseUrl: "https://api.openai.com/v1",
    nativeBaseUrl: null,
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-5.2",
    pricePerMTokens: { input: 1.25, output: 10 },
  },
  {
    id: "anthropic",
    label: "Anthropic",
    openaiBaseUrl: "https://api.anthropic.com/v1",
    nativeBaseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-6",
    pricePerMTokens: { input: 3, output: 15 },
  },
  {
    id: "gemini",
    label: "Google Gemini",
    openaiBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    nativeBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKeyEnv: "GEMINI_API_KEY",
    defaultModel: "gemini-3-flash",
    pricePerMTokens: { input: 0.3, output: 2.5 },
  },
  {
    id: "openai-compatible",
    label: "Custom OpenAI-compatible (LM Studio / llama.cpp / router)",
    openaiBaseUrl: "http://127.0.0.1:1234/v1",
    nativeBaseUrl: null,
    apiKeyEnv: "VH_LLM_API_KEY",
    defaultModel: "local",
    pricePerMTokens: { input: 0, output: 0 },
  },
] as const;

export function providerById(id: ProviderId): ProviderSpec | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/* ------------------------------- base-url guard ------------------------------- */

/** the vendors' own hosts — allowed over https only */
const PROVIDER_HOSTS = new Set([
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
]);

/** loopback is the only place plaintext is acceptable, because nothing crosses a wire */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]", "[::ffff:127.0.0.1]"]);

export interface BaseUrlCheck {
  ok: boolean;
  reason?: string;
  host?: string;
}

/**
 * Reject anything that is not https, not loopback, or not the provider's own host
 * — unless the operator has explicitly opted into a custom base.
 */
export function checkBaseUrl(raw: string, opts: { allowCustomBase?: boolean; expectHost?: string } = {}): BaseUrlCheck {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "base url is not a URL" };
  }
  const host = u.hostname.toLowerCase();
  // loopback is the ONLY thing allowed to be plaintext. Being on the provider
  // allowlist does not earn you http: an https endpoint reached over http can
  // answer with a redirect, and a redirect is a free credential hand-off.
  const loopback = LOOPBACK_HOSTS.has(host);
  if (u.protocol !== "https:" && !loopback) {
    return { ok: false, reason: `refusing plaintext ${u.protocol}//${host} — an API key over http is a leaked API key, allowlisted host or not` };
  }
  if (opts.expectHost && host !== opts.expectHost) {
    return { ok: false, reason: `base url host ${host} is not ${opts.expectHost} for this provider` };
  }
  if (!loopback && !PROVIDER_HOSTS.has(host) && !opts.allowCustomBase) {
    return {
      ok: false,
      reason: `host ${host} is not an allowlisted provider host; pass allowCustomBase:true only if you operate it`,
      host,
    };
  }
  // a path-traversal-shaped base against a provider host is still a surprise
  if (PROVIDER_HOSTS.has(host) && u.pathname.replace(/\/+$/, "") !== "/v1" && u.pathname !== "/v1beta/openai" && !opts.allowCustomBase) {
    return { ok: false, reason: `unexpected path ${u.pathname} for provider host ${host}`, host };
  }
  return { ok: true, host };
}

/* --------------------------------- redaction --------------------------------- */

/**
 * Scrub anything that looks like a vendor key from a string destined for a log,
 * a trace or a receipt. Deliberately broad: false positives in a log line cost
 * nothing, one leaked key costs the company.
 */
export function redactSecrets(input: string): string {
  return String(input)
    .replace(/sk-ant-[A-Za-z0-9_-]{10,}/g, "sk-ant-[REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, "sk-[REDACTED]")
    .replace(/g?[ky]-[A-Za-z0-9_-]{20,}/g, "[REDACTED-KEY]")
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, "AIza[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]{12,}=*/gi, "$1[REDACTED]")
    .replace(/(api[_-]?key["'\s:=]+)[^\s"',}]{8,}/gi, "$1[REDACTED]")
    .replace(/(authorization["'\s:=]+)[^\s"',}]{8,}/gi, "$1[REDACTED]");
}

/** cheap entropy-ish check used to catch a key pasted into a prompt */
export function looksLikeSecret(token: string): boolean {
  return /^[A-Za-z0-9_\-]{28,}$/.test(token) && !/^[a-z]+$/.test(token);
}

/* ---------------------------------- budget ---------------------------------- */

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export function costUsd(spec: ProviderSpec, usage: Usage): number {
  const c = (usage.inputTokens / 1e6) * spec.pricePerMTokens.input + (usage.outputTokens / 1e6) * spec.pricePerMTokens.output;
  return Number(c.toFixed(6));
}

/**
 * A 158-way router multiplies spend. The budget guard is therefore part of the
 * MoE layer, not an afterthought: `over()` returns true once the run should stop
 * dispatching, and the caller turns that into a refusal in words — which is this
 * codebase's established answer for "I cannot do this" (see the A2A bridge).
 */
export class BudgetGuard {
  private spent = 0;
  constructor(private readonly capUsd: number) {}
  add(usage: Usage, spec: ProviderSpec): number {
    this.spent += costUsd(spec, usage);
    return this.spent;
  }
  get spentUsd(): number {
    return Number(this.spent.toFixed(6));
  }
  over(): boolean {
    return this.spent > this.capUsd;
  }
  describe(): string {
    return `$${this.spent.toFixed(4)} of a $${this.capUsd} cap${this.over() ? " — EXCEEDED" : ""}`;
  }
}

/* --------------------------------- request --------------------------------- */

export interface ChatRequest {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  maxTokens?: number;
}

/**
 * Build a chat-completions request against an OpenAI-compatible base.
 * Pure string/JSON work — no fetch here, so this is unit-testable and the actual
 * network call stays in the host process (tools/), where the GuardRail and the
 * budget guard can wrap it.
 */
export function buildChatRequest(spec: ProviderSpec, req: ChatRequest): { url: string; headers: Record<string, string>; body: string } {
  const base = spec.openaiBaseUrl.replace(/\/+$/, "");
  return {
    url: `${base}/chat/completions`,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: req.model || spec.defaultModel,
      messages: req.messages.map((m) => ({ role: m.role, content: redactSecrets(m.content) })),
      ...(typeof req.temperature === "number" ? { temperature: req.temperature } : {}),
      ...(typeof req.maxTokens === "number" ? { max_tokens: req.maxTokens } : {}),
    }),
  };
}

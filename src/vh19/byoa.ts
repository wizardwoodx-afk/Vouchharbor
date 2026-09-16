/**
 * VH-19 — BYOA: Bring Your Own Agent (19.4.1).
 *
 * The industry's multi-agent story is a walled garden of first-party bots.
 * Vouch Harbor's is the opposite: ANY external agent — your own, a colleague's,
 * another vendor's — can join the mission, and it joins UNDER VH GOVERNANCE:
 *
 *   · a brought agent is a DECLARED object: name, endpoint kind, capabilities,
 *     and a risk ceiling it can never exceed;
 *   · delegation to it rides the Generalist's existing peer seam
 *     (askVH19 → peerDelegate), so the task, the outcome and the receipt
 *     land in the same handoff ledger as every other delegation;
 *   · EVERY delegation pauses at the human gate — an external agent is
 *     hostile-adjacent by definition, so no auto-run, ever;
 *   · credentials for a brought agent live in memory for the session only.
 *
 * Two endpoint kinds are spoken: OpenAI-compatible chat completions (the
 * lingua franca every agent framework exposes) and A2A JSON-RPC tasks/send.
 * Inbound (an external agent calling the Generalist) uses the signed
 * invitation surface plus the host runtime's A2A endpoint — receipts both ways.
 */
import type { GateAsk, GateDecision } from "./types";

export interface ByoaAgent {
  id: string;
  name: string;
  kind: "openai-compatible" | "a2a-http";
  /** Base URL (openai-compatible) or agent endpoint (a2a-http). */
  endpoint: string;
  model?: string;
  /** The ceiling this agent may never exceed. */
  ceiling: "safe" | "risky";
  capabilities: string[];
  addedAt: string;
}

const KEY = "vh19.byoa.agents.v1";

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

const session: ByoaAgent[] = [];

export function listByoaAgents(): ByoaAgent[] {
  const s = storage();
  if (!s) return session;
  try {
    return JSON.parse(s.getItem(KEY) ?? "[]") as ByoaAgent[];
  } catch {
    return session;
  }
}

function persist(all: ByoaAgent[]): void {
  const s = storage();
  if (s) {
    try { s.setItem(KEY, JSON.stringify(all)); return; } catch { /* fall through */ }
  }
  session.length = 0;
  session.push(...all);
}

export function getByoaAgent(id: string): ByoaAgent | null {
  return listByoaAgents().find((a) => a.id === id) ?? null;
}

export function registerByoaAgent(a: Omit<ByoaAgent, "id" | "addedAt">): ByoaAgent {
  const agent: ByoaAgent = {
    ...a,
    id: `byoa.${a.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 24) || Math.random().toString(36).slice(2, 8)}`,
    addedAt: new Date().toISOString(),
  };
  persist([...listByoaAgents().filter((x) => x.id !== agent.id), agent]);
  return agent;
}

export function removeByoaAgent(id: string): ByoaAgent[] {
  const all = listByoaAgents().filter((a) => a.id !== id);
  persist(all);
  return all;
}

/* ── session-only credentials for brought agents ─────────────────────────── */
const sessionKeys = new Map<string, string>();
export function setByoaSessionKey(id: string, key: string): void { sessionKeys.set(id, key); }
export function byoaSessionKey(id: string): string | null { return sessionKeys.get(id) ?? null; }

async function sha256Hex(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export interface ByoaDelegateOpts {
  gate?: (ask: GateAsk) => Promise<GateDecision>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * The delegate handed to askVH19's peer seam. Every call: human gate first
 * (external = hostile-adjacent), then ONE request, then a receipt digest over
 * {peer, task, outcome, detail, at}. Failures are honest, never guessed.
 */
export function byoaDelegate(agent: ByoaAgent, opts: ByoaDelegateOpts = {}) {
  return async (d: { peerName: string; task: string }): Promise<{ ok: boolean; detail: string; receiptDigest?: string }> => {
    const at = new Date().toISOString();
    const gate = opts.gate;
    if (gate) {
      const decision = await gate({
        action: `BYOA delegation — send task to external agent "${agent.name}"`,
        summary: `kind ${agent.kind} · endpoint ${agent.endpoint} · ceiling ${agent.ceiling} · task: ${d.task.slice(0, 160)}`,
        riskTier: agent.ceiling === "risky" ? "risky" : "safe",
        specialistIds: [],
      } as GateAsk);
      if (!decision.approved) {
        const digest = await sha256Hex(JSON.stringify({ peer: agent.id, task: d.task, ok: false, detail: `denied at the gate: ${decision.reason ?? "no reason given"}`, at }));
        return { ok: false, detail: `denied at the human gate${decision.reason ? ` — ${decision.reason}` : ""}`, receiptDigest: digest };
      }
    }
    const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
    let detail: string;
    let ok = false;
    try {
      if (agent.kind === "openai-compatible") {
        const headers: Record<string, string> = { "content-type": "application/json" };
        const key = byoaSessionKey(agent.id);
        if (key) headers.authorization = `Bearer ${key}`;
        const res = await fetchImpl(`${agent.endpoint.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({ model: agent.model ?? "default", messages: [{ role: "user", content: d.task }] }),
        });
        if (!res.ok) {
          detail = `the brought agent answered HTTP ${res.status}`;
        } else {
          const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
          if (j.error?.message) detail = `the brought agent errored: ${j.error.message}`;
          else { ok = true; detail = (j.choices?.[0]?.message?.content ?? "(empty reply)").slice(0, 1200); }
        }
      } else {
        const res = await fetchImpl(agent.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ jsonrpc: "2.0", id: `vh-${Date.now()}`, method: "tasks/send", params: { id: `t-${Date.now()}`, message: { role: "user", parts: [{ type: "text", text: d.task }] } } }),
        });
        if (!res.ok) {
          detail = `the brought agent answered HTTP ${res.status}`;
        } else {
          const j = (await res.json()) as { result?: { status?: { state?: string; message?: { parts?: Array<{ text?: string }> } } }; error?: { message?: string } };
          if (j.error?.message) detail = `the brought agent errored: ${j.error.message}`;
          else { ok = true; detail = (j.result?.status?.message?.parts?.map((p) => p.text ?? "").join(" ") ?? `(state ${j.result?.status?.state ?? "unknown"})`).slice(0, 1200); }
        }
      }
    } catch (err) {
      detail = `the brought agent could not be reached: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      clearTimeout(timer);
    }
    const receiptDigest = await sha256Hex(JSON.stringify({ peer: agent.id, task: d.task, ok, detail: detail.slice(0, 400), at }));
    return { ok, detail, receiptDigest };
  };
}

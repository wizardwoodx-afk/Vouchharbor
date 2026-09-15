/**
 * VH-19 — the Generalist front door (18.0.0).
 *
 * The ONLY agent the user talks to. One request goes in; behind it: GuardRail
 * scan → the user's learned memory → the MoE router → (optional) the human
 * gate → a real provider execution or an honest non-execution → a
 * provenance-digested response. Peer work delegates through the injected
 * A2A seam; nothing here invents a second front door or bypasses a gate.
 *
 * The honesty contract, restated where it is enforced:
 *   • no provider key        → outcome "planned": routes and plans in words,
 *                              executed: false. Never a fabricated answer.
 *   • provider failure       → outcome "error" with the failure in words.
 *   • risky + gate denies    → outcome "gated-out"; nothing executed.
 *   • risky + no gate        → outcome "refused"; risky work without a human
 *                              gate does not run, ever.
 *   • injection detected     → outcome "refused" with the finding codes.
 */
import { uid } from "../app/id";
import { detectInjection, sanitizeText } from "../security/guardrail";
import { getSpecialist } from "./registry";
import { buildSpecialistPrompt } from "./skills";
import { estimateTokens, optimizeComposedPrompt, recordUsage } from "./tokenOptim";
import { buildCaptainReport, captainForRoute } from "./captains";
import { classifyFailure } from "./failures";
import { routeDeterministic, routeWithModel } from "./router";
import { complete, redactSecrets } from "./providers";
import { memoryBriefing } from "./memory";
import { applyTeamPreference, autoProposeIfReady, recordTeamRun } from "./teamEvolve";
import { autonomyCovers } from "./exam";
import type { GeneralistDeps, GeneralistResponse, ProviderConfig, RouteDecision } from "./types";

async function sha256Hex(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Canonical serialization of the response — what the provenance digest commits to. */
export function responseCanonical(r: Omit<GeneralistResponse, "provenanceDigest">): string {
  return JSON.stringify({
    v: "vh19-response/1",
    reply: r.reply,
    executed: r.executed,
    outcome: r.outcome,
    specialistIds: r.specialistIds,
    routedBy: r.routed.routedBy,
    selected: r.routed.selected.map((c) => [c.id, c.score]),
    strategy: r.routed.strategy,
    note: r.note ?? null,
    captain: r.captain ?? null,
    failure: r.failure ?? null,
  });
}

export interface AskArgs {
  text: string;
  userId?: string;
  /** Explicit peer delegation ("ask <peer> to …") takes the A2A path. */
  peer?: string;
  /** Cross-user team context: the evolved config leans on routing, and peer runs land in the team ledger. */
  team?: { id: string; members: string[] };
}

export async function askVH19(args: AskArgs, deps: GeneralistDeps = {}): Promise<GeneralistResponse> {
  const userId = args.userId ?? "default";
  const text = sanitizeText(args.text, 8000);
  const now = deps.now ?? (() => new Date());
  void now; // reserved for receipt timestamps in the UI wiring phase

  /* The advisory layer is attached centrally so EVERY exit path carries it:
     the domain captain reports on the routed work, and every non-execution
     is classified with recovery advice. Both are computed from the
     response's own real fields and are inside the digest.
     19.1.0 aggregation fix (19.0.0 review): the captain receives EVERY
     routed member's result — this pipeline runs one combined execution for
     the routed set, so each participating member carries that run's real
     outcome, honestly labelled as a combined run. */
  const finish = async (r: Omit<GeneralistResponse, "provenanceDigest">): Promise<GeneralistResponse> => {
    const captain = r.captain ?? (r.specialistIds.length > 0
      ? buildCaptainReport(captainForRoute(r.specialistIds)?.id ?? "", r.specialistIds.map((id) => ({ specialistId: id, outcome: r.outcome, note: r.note }))) ?? undefined
      : undefined);
    const failure = r.failure ?? (r.outcome === "answered" || r.outcome === "peer-delegated"
      ? undefined
      : classifyFailure(r.outcome as "planned" | "refused" | "gated-out" | "error", r.note));
    const full = { ...r, captain, failure };
    return { ...full, provenanceDigest: await sha256Hex(responseCanonical(full)) };
  };

  /* 0 — content gate: the GuardRail scans before anything else exists. */
  const findings = detectInjection(text);
  if (findings.length > 0) {
    return finish({
      reply: "I can't take this request into the pipeline: the content gate flagged it.",
      routed: { selected: [], considered: 0, strategy: "none", routedBy: "deterministic" },
      executed: false,
      outcome: "refused",
      specialistIds: [],
      note: `guardrail findings: ${findings.map((f) => f.code).join(", ")}`,
    });
  }

  /* 1 — peer delegation rides the real A2A seam (injected; the production one
         is the a2aBridge). No seam, no delegation — refused in words. */
  if (args.peer) {
    if (!deps.peerDelegate) {
      deps.onHandoff?.({ peer: args.peer, task: text, outcome: "refused", detail: "no A2A bridge is wired into this runtime — nothing was sent" });
      return finish({
        reply: `Peer delegation to "${args.peer}" is not available: no A2A bridge is wired into this runtime.`,
        routed: { selected: [], considered: 0, strategy: "none", routedBy: "deterministic" },
        executed: false,
        outcome: "refused",
        specialistIds: [],
        note: "peer delegation requires the A2A bridge (src/mission/a2aBridge) — nothing was sent",
      });
    }
    const res = await deps.peerDelegate({ peerName: args.peer, task: text });
    deps.onHandoff?.({ peer: args.peer, task: text, outcome: res.ok ? "delegated" : "refused", detail: res.detail, receiptDigest: res.receiptDigest });
    if (args.team) {
      recordTeamRun({
        teamId: args.team.id,
        members: args.team.members,
        task: text.slice(0, 200),
        outcome: res.ok ? "verified" : "refused",
        specialists: [],
        note: res.detail.slice(0, 160),
      });
      void autoProposeIfReady(args.team.id, args.team.members);
    }
    return finish({
      reply: res.ok ? `Delegated to ${args.peer}: ${res.detail}${res.receiptDigest ? ` (peer receipt ${res.receiptDigest.slice(0, 12)}…)` : ""}` : `Delegation to ${args.peer} did not run: ${res.detail}`,
      routed: { selected: [], considered: 0, strategy: "none", routedBy: "deterministic" },
      executed: res.ok,
      outcome: res.ok ? "peer-delegated" : "refused",
      specialistIds: [],
      note: res.ok ? undefined : res.detail,
    });
  }

  /* 2 — route the bench. LLM-assisted only when a provider exists; the
         fallback reason travels with the decision either way. */
  const provider: ProviderConfig | null = deps.provider ?? null;
  let routed: RouteDecision;
  if (provider) {
    routed = await routeWithModel(text, provider, async (cfg, system, user) => {
      const r = await complete(cfg, system, user, { fetchImpl: deps.fetchImpl, timeoutMs: 15_000 });
      return r.ok ? { ok: true, text: r.text } : { ok: false, error: r.error };
    });
  } else {
    routed = routeDeterministic(text);
  }
  if (args.team) {
    routed = { ...routed, selected: applyTeamPreference(args.team.id, routed.selected) };
  }
  const specialists = routed.selected.map((c) => getSpecialist(c.id)!).filter(Boolean);

  /* 3 — the human gate. Risky/critical output without an approved gate does
         not execute. Autonomy (the 90% exam) downgrades ONLY "safe" work to
         gate-free; the override floor is structural. */
  const worstTier = specialists.some((s) => s.riskTier === "critical")
    ? "critical"
    : specialists.some((s) => s.riskTier === "risky")
      ? "risky"
      : "safe";
  const primaryCategory = specialists[0]?.category;
  const autonomyEarned = autonomyCovers(userId, primaryCategory);
  const needsGate = worstTier !== "safe" && !(autonomyEarned && worstTier === "risky");
  if (needsGate) {
    if (!deps.gate) {
      return finish({
        reply: "This routes to specialists whose work is gated as risky, and no human gate is available in this runtime — so nothing was executed.",
        routed,
        executed: false,
        outcome: "refused",
        specialistIds: specialists.map((s) => s.id),
        note: `risk tier "${worstTier}" requires the human gate; wire one or re-route`,
      });
    }
    const decision = await deps.gate({
      action: `VH-19 routed "${text.slice(0, 120)}" to ${specialists.map((s) => s.name).join(", ")}`,
      riskTier: worstTier,
      specialistIds: specialists.map((s) => s.id),
      summary: routed.selected.flatMap((c) => c.reasons).slice(0, 4).join("; "),
    });
    if (!decision.approved) {
      return finish({
        reply: `You (or the standing policy) declined this at the gate: ${decision.reason}`,
        routed,
        executed: false,
        outcome: "gated-out",
        specialistIds: specialists.map((s) => s.id),
        note: decision.reason,
      });
    }
  }

  /* 4 — execute for real, or plan honestly. */
  if (!provider) {
    const plan = specialists.length
      ? specialists.map((s) => `${s.name} (${s.id}): ${s.capabilities[0]}`).join("\n")
      : "no specialist cleared the routing bar — the Generalist would handle this directly once a provider is configured";
    return finish({
      reply:
        `No provider key is configured, so nothing was executed. Here is the plan I would run:\n\n${plan}\n\n` +
        `Routing: ${routed.strategy} via ${routed.routedBy} (${routed.selected.length} of ${routed.considered} specialists considered).` +
        (routed.fallbackReason ? ` Note: ${routed.fallbackReason}.` : ""),
      routed,
      executed: false,
      outcome: "planned",
      specialistIds: specialists.map((s) => s.id),
      note: "provider not configured — plan only, nothing executed",
    });
  }

  const primary = specialists[0] ?? null;
  /* 19.1.0 — the autonomous token optimizer: every composed prompt is
     measured and budget-fitted before it leaves, and every call is
     written to the local usage ledger. Silent, honest, reversible. */
  const composedSystem = [
    primary ? buildSpecialistPrompt(primary) : "You are VH-19, the Vouch Harbor generalist. Answer directly and concisely.",
    "You operate behind a human gate; risky actions are paused for approval. Never claim work you did not do.",
    ...memoryBriefing(userId),
  ].join("\n\n");
  const optimized = optimizeComposedPrompt(composedSystem);
  const system = optimized.prompt;

  const result = await complete(provider, system, text, { fetchImpl: deps.fetchImpl });
  recordUsage({
    promptTokens: optimized.estimatedTokens + estimateTokens(text),
    replyTokens: estimateTokens(result.ok ? result.text : result.error),
    optimized: optimized.optimized,
    savedTokens: optimized.savedTokens,
  });
  if (!result.ok) {
    return finish({
      reply: `The provider call did not complete (${result.kind}): ${result.error}`,
      routed,
      executed: false,
      outcome: "error",
      specialistIds: specialists.map((s) => s.id),
      note: redactSecrets(result.error, [provider.apiKey]),
    });
  }

  return finish({
    reply: result.text,
    routed,
    executed: true,
    outcome: "answered",
    specialistIds: specialists.map((s) => s.id),
    note: `provider ${provider.kind}/${result.model} · ${result.latencyMs}ms · accept or reject this answer so I can learn${
      autonomyEarned ? " · running under earned autonomy (override always available)" : ""
    }`,
  });
}

/** Stable id for correlation across the bus/UI. */
export function requestId(): string {
  return uid("vh19");
}

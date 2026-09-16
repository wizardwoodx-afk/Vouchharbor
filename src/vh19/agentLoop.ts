/**
 * VH-19 — the member agent loop (19.3.0 "Vanguard").
 *
 * This is the module that stops the bench being prompt personas. A member run
 * is now a real loop:
 *
 *   composed prompt (+ tool protocol when the member carries tools)
 *     → provider call
 *     → reply contains tool blocks? ──no──► final answer
 *     → yes: validate → gate → execute → receipt → feed results back
 *     → repeat until the model answers clean or maxSteps is reached
 *
 * Honesty rules, all probe-pinned (probe/agentTools):
 *   • a tool receipt exists for EVERY attempted call — executed, failed,
 *     gated-out or refused; nothing silent;
 *   • the model is told the gate's real reason when a tool is denied — it
 *     never sees a fabricated result;
 *   • maxSteps is a hard stop: on exhaustion the loop ends with the text so
 *     far, labelled — a truncated loop is reported, never dressed as done;
 *   • each provider call in the loop lands in the token ledger;
 *   • toolless members keep the exact 19.2.0 single-call path — the loop
 *     changes nothing for them.
 */
import { complete, redactSecrets } from "./providers";
import { estimateTokens, optimizeComposedPrompt, recordUsage } from "./tokenOptim";
import { executeToolReceipted, stripToolBlocks, parseToolBlocks, toolProtocolText, toolsForCategory } from "./tools";
import type { ToolContext, ToolReceipt } from "./tools";
import type { ProviderConfig, Specialist } from "./types";

export const MAX_AGENT_STEPS = 3;

export interface MemberRunOptions {
  provider: ProviderConfig;
  specialist: Specialist;
  task: string;
  /** The composed system prompt (specialist + gate line + memory), pre-tools. */
  systemBase: string;
  fetchImpl?: typeof fetch;
  /** Tool context — when absent, the member runs toolless (the 19.2.0 path). */
  toolCtx?: Omit<ToolContext, "specialistId" | "hash">;
  /** Digest hasher shared with the pipeline so receipts chain into member digests. */
  hash?: (text: string) => Promise<string>;
  maxSteps?: number;
}

export interface MemberRun {
  ok: boolean;
  /** The final answer text, tool fences stripped. */
  text: string;
  /** Present only when the final provider call failed. */
  error?: string;
  errorKind?: "no-key" | "egress-blocked" | "http-error" | "network" | "timeout" | "bad-response";
  model: string;
  latencyMs: number;
  /** Number of provider calls the loop made. */
  calls: number;
  /** Every attempted tool call, in order — executed or not. */
  toolReceipts: ToolReceipt[];
  /** True when the loop hit maxSteps with tool blocks still pending. */
  truncated: boolean;
  /** The tool ids this member carried ([] = toolless run). */
  tools: string[];
}

/**
 * Run one specialist as a real agent. The caller owns routing, gating of the
 * member's OUTPUT risk tier, and receipt digesting — this module owns the
 * loop itself and the tool-level governance inside it.
 */
export async function runMemberAgent(opts: MemberRunOptions): Promise<MemberRun> {
  const { provider, specialist, task, systemBase } = opts;
  const maxSteps = opts.maxSteps ?? MAX_AGENT_STEPS;
  const toolIds = opts.toolCtx ? toolsForCategory(specialist.category) : [];
  const hasTools = toolIds.length > 0 && Boolean(opts.toolCtx);

  const system = hasTools
    ? optimizeComposedPrompt(`${systemBase}\n\n${toolProtocolText(toolIds)}`).prompt
    : optimizeComposedPrompt(systemBase).prompt;

  const toolCtx: ToolContext | null = hasTools
    ? { ...opts.toolCtx!, specialistId: specialist.id, hash: opts.hash }
    : null;

  let conversation = task;
  const toolReceipts: ToolReceipt[] = [];
  let calls = 0;
  let totalLatency = 0;
  let lastModel = provider.model;

  for (let step = 0; step < maxSteps; step++) {
    const res = await complete(provider, system, conversation, { fetchImpl: opts.fetchImpl });
    calls += 1;
    recordUsage({
      promptTokens: estimateTokens(system) + estimateTokens(conversation),
      replyTokens: estimateTokens(res.ok ? res.text : res.error),
      optimized: false,
      savedTokens: 0,
    });
    if (!res.ok) {
      return {
        ok: false,
        text: "",
        error: redactSecrets(res.error, [provider.apiKey]),
        errorKind: res.kind,
        model: provider.model,
        latencyMs: totalLatency,
        calls,
        toolReceipts,
        truncated: false,
        tools: toolIds,
      };
    }
    totalLatency += res.latencyMs;
    lastModel = res.model;

    if (!hasTools || !toolCtx) {
      return { ok: true, text: res.text, model: lastModel, latencyMs: totalLatency, calls, toolReceipts, truncated: false, tools: [] };
    }

    const blocks = parseToolBlocks(res.text);
    if (blocks.length === 0) {
      return { ok: true, text: res.text, model: lastModel, latencyMs: totalLatency, calls, toolReceipts, truncated: false, tools: toolIds };
    }

    // Execute every requested call, in order, each through its own receipt.
    const resultLines: string[] = [];
    for (const block of blocks) {
      if ("parseError" in block) {
        const receipt: ToolReceipt = {
          tool: "(parse-error)", // not an executed tool — the outcome field carries the truth
          inputCanonical: JSON.stringify({ parseError: block.parseError }),
          outcome: "error",
          output: block.parseError,
          latencyMs: 0,
        };
        if (opts.hash) {
          receipt.digest = await opts.hash(JSON.stringify({ v: "vh19-tool/1", tool: "(parse-error)", inputCanonical: receipt.inputCanonical, outcome: "error", output: receipt.output }));
        }
        toolReceipts.push(receipt);
        resultLines.push(`RESULT(parse-error): ${block.parseError}`);
        continue;
      }
      const receipt = await executeToolReceipted(block.tool, block.input, toolCtx);
      toolReceipts.push(receipt);
      resultLines.push(`RESULT(${receipt.tool}, ${receipt.outcome}${receipt.digest ? `, receipt ${receipt.digest.slice(0, 12)}` : ""}):\n${receipt.output}`);
    }

    // The loop exhausted with work still requested — stop HONESTLY.
    if (step === maxSteps - 1) {
      const soFar = stripToolBlocks(res.text);
      return {
        ok: true,
        text: soFar.length > 0 ? soFar : "(the agent loop ended at its step limit while requesting further tool calls)",
        model: lastModel,
        latencyMs: totalLatency,
        calls,
        toolReceipts,
        truncated: true,
        tools: toolIds,
      };
    }

    // Feed the real results back and continue.
    conversation = `${task}\n\n[turn ${step + 1}] Your previous reply requested tools. Their real results:\n\n${resultLines.join("\n\n")}\n\nContinue the task. If the work is done, answer with NO tool blocks.`;
  }

  // Unreachable — the loop always returns — kept for exhaustiveness.
  return { ok: false, text: "", error: "agent loop ended without a provider result", model: provider.model, latencyMs: totalLatency, calls, toolReceipts, truncated: false, tools: toolIds };
}

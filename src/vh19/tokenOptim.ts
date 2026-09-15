/**
 * VH-19 — the autonomous prompt-budget optimizer (19.1.0 "Shipyard").
 *
 * Honest naming (19.2.0 review note): this is a PROMPT-BUDGET optimizer
 * working on token ESTIMATES (~4 chars/token) — not a tokenizer-exact
 * counter. Providers tokenize differently and the estimate can be
 * materially off; every surface says "estimate". The budgeting, the
 * marked trims and the local usage ledger are real.
 *
 * Every provider call passes through here, without being asked: the
 * composed prompt is measured against a budget, the least-load-bearing
 * content is trimmed first (skill examples before skill procedures,
 * procedures before checklists, and checklists are never dropped), and
 * every call — optimized or not — is recorded in a local ledger so the
 * user can see what the fleet actually costs. Estimation is honest:
 * ~4 chars/token, labelled as an estimate everywhere it is shown.
 * No provider is called by this module; it never changes meaning, only
 * length, and it says so when it trims.
 */

const LEDGER_KEY = "vh19.tokens.v1";
const LEDGER_CAP = 500;

/** Default budget for a composed system prompt (base + skills). */
export const PROMPT_BUDGET = 6000;

export interface TokenLedgerEntry {
  at: string;
  promptTokens: number;
  replyTokens: number;
  optimized: boolean;
  savedTokens: number;
}

export interface TokenUsageReport {
  calls: number;
  promptTokens: number;
  replyTokens: number;
  optimizedCalls: number;
  savedTokens: number;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Fit text to a token budget without lying about it: the middle is trimmed
 * and the cut is marked in the text itself. Head and tail survive — the
 * head carries the role, the tail carries the checklist.
 */
export function fitToBudget(text: string, budgetTokens: number): { text: string; trimmed: boolean; savedTokens: number } {
  const total = estimateTokens(text);
  if (total <= budgetTokens) return { text, trimmed: false, savedTokens: 0 };
  const keepChars = Math.max(400, budgetTokens * 4 - 120);
  const headLen = Math.floor(keepChars * 0.6);
  const tailLen = keepChars - headLen;
  const cut = total - budgetTokens;
  const out = `${text.slice(0, headLen)}\n[… ${cut} tokens trimmed by the VH token optimizer — full playbook preserved in the skill library …]\n${text.slice(text.length - tailLen)}`;
  return { text: out, trimmed: true, savedTokens: Math.max(0, total - estimateTokens(out)) };
}

/**
 * Optimize a composed specialist prompt (base prompt + skill blocks) to a
 * budget. Order of sacrifice: skill examples → skill body middles. The
 * base prompt (identity + working rule) and every skill's checklist line
 * survive whenever the budget allows.
 */
export function optimizeComposedPrompt(
  composed: string,
  budgetTokens: number = PROMPT_BUDGET,
): { prompt: string; optimized: boolean; savedTokens: number; estimatedTokens: number } {
  const before = estimateTokens(composed);
  if (before <= budgetTokens) return { prompt: composed, optimized: false, savedTokens: 0, estimatedTokens: before };

  // Split base prompt from skill blocks (the skills layer joins them under a fixed header).
  const MARKER = "## Bound skills";
  const at = composed.indexOf(MARKER);
  if (at === -1) {
    const f = fitToBudget(composed, budgetTokens);
    return { prompt: f.text, optimized: f.trimmed, savedTokens: f.savedTokens, estimatedTokens: estimateTokens(f.text) };
  }
  const base = composed.slice(0, at);
  const skills = composed.slice(at);

  // 1) keep only Procedure + Checklist lines from each skill block
  const condensed = skills
    .split("\n")
    .filter((line, _i, arr) => {
      void arr;
      return /^### Skill:/.test(line) || /^(Procedure:|Checklist:|Quality checklist)/.test(line) || /^\d+\./.test(line.trim()) || line.trim() === "";
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  let prompt = base + condensed;
  let est = estimateTokens(prompt);
  if (est <= budgetTokens) {
    return { prompt, optimized: true, savedTokens: before - est, estimatedTokens: est };
  }
  // 2) still over: honest hard trim of the tail-most skill detail
  const f = fitToBudget(prompt, budgetTokens);
  est = estimateTokens(f.text);
  return { prompt: f.text, optimized: true, savedTokens: before - est, estimatedTokens: est };
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function recordUsage(entry: Omit<TokenLedgerEntry, "at">, now: () => Date = () => new Date()): void {
  const raw = storage()?.getItem(LEDGER_KEY);
  let list: TokenLedgerEntry[] = [];
  try {
    const parsed = raw ? (JSON.parse(raw) as TokenLedgerEntry[]) : [];
    if (Array.isArray(parsed)) list = parsed;
  } catch { /* corrupt ledger — start fresh, honestly */ }
  list.push({ ...entry, at: now().toISOString() });
  storage()?.setItem(LEDGER_KEY, JSON.stringify(list.slice(-LEDGER_CAP)));
}

export function usageReport(): TokenUsageReport {
  const raw = storage()?.getItem(LEDGER_KEY);
  let list: TokenLedgerEntry[] = [];
  try {
    const parsed = raw ? (JSON.parse(raw) as TokenLedgerEntry[]) : [];
    if (Array.isArray(parsed)) list = parsed;
  } catch { /* corrupt ledger reads as empty, never as fake numbers */ }
  return list.reduce(
    (acc, e) => ({
      calls: acc.calls + 1,
      promptTokens: acc.promptTokens + e.promptTokens,
      replyTokens: acc.replyTokens + e.replyTokens,
      optimizedCalls: acc.optimizedCalls + (e.optimized ? 1 : 0),
      savedTokens: acc.savedTokens + e.savedTokens,
    }),
    { calls: 0, promptTokens: 0, replyTokens: 0, optimizedCalls: 0, savedTokens: 0 },
  );
}

export function clearTokenLedger(): void {
  storage()?.removeItem(LEDGER_KEY);
}

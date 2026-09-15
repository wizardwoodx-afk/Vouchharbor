/**
 * VH-19 — the A2A handoff ledger (18.7.0).
 *
 * Every delegation attempt through the peer seam gets a receipt — including
 * the refusals. A handoff that never ran is recorded as refused with the
 * reason in words; a handoff that ran carries the peer's receipt digest.
 * Nothing is recorded that did not happen, and nothing that happened goes
 * unrecorded. Module + localStorage only; no network, no fake transports.
 */

const HANDOFFS_KEY = "vh19.handoffs.v1";
const HANDOFF_CAP = 100;

export interface HandoffRecord {
  id: string;
  peer: string;
  taskDigest: string;
  outcome: "delegated" | "refused";
  detail: string;
  receiptDigest?: string;
  at: string;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function listHandoffs(): HandoffRecord[] {
  const raw = storage()?.getItem(HANDOFFS_KEY) ?? null;
  if (!raw) return [];
  try {
    const h = JSON.parse(raw) as HandoffRecord[];
    return Array.isArray(h) ? h : [];
  } catch {
    return [];
  }
}

export function recordHandoff(
  input: { peer: string; task: string; outcome: HandoffRecord["outcome"]; detail: string; receiptDigest?: string },
  now: () => Date = () => new Date(),
): HandoffRecord {
  const rec: HandoffRecord = {
    id: `ho-${now().getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    peer: input.peer,
    taskDigest: input.task.slice(0, 120),
    outcome: input.outcome,
    detail: input.detail.slice(0, 200),
    receiptDigest: input.receiptDigest,
    at: now().toISOString(),
  };
  storage()?.setItem(HANDOFFS_KEY, JSON.stringify([...listHandoffs(), rec].slice(-HANDOFF_CAP)));
  return rec;
}

export function clearHandoffs(): void {
  storage()?.removeItem(HANDOFFS_KEY);
}

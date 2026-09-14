/**
 * Vouch Harbor — live runtime bridge (17.1 "Patina").
 *
 * This module is the ONLY place the Patina shell reaches into the engine.
 * It replaces the old simulated-only `timeline.ts`: every view reads from
 * `useHarbor()` and dispatches through actions that call into the real
 * vouch engine, mission loop, providers, drill, and fleet.
 *
 * No view imports `src/vouch/engine/*` or `src/mission/*` directly — that
 * keeps the shell swappable (probe-pinned by the engine rule).
 */
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  addVouchFact,
  newVouchThread,
  rateVouchRun,
  removeVouchFact,
  removeVouchPreference,
  removeVouchSkill,
  resolveVouchApproval,
  sendVouchMessage,
  setActiveVouchThread,
  setVouchMode,
  setVouchPersona,
  stopVouch,
  subscribeVouch,
  verifyVouchReceipt,
  vouchBrain,
  vouchMissions,
  vouchReceiptJsonl,
  vouchSession,
  vouchWorkspaceFiles,
  type VouchApproval,
  type VouchMode,
  type VouchPersona,
  type VouchReceiptRef,
  type VouchSession,
  type VouchThread,
} from "../vouch/engine/vouch";
import { harborActiveCrew, harborCrews, runHarborMission, mintMissionId, harborMusterHand, harborRerate, type MissionOutcome } from "../vouch/engine/bridge";
import { runDrill, DRILL_SCENARIOS, drillReports, type DrillReport } from "../vouch/engine/drill";
import {
  addProvider,
  listProviders,
  removeProvider,
  removeProviderKey,
  setProviderKey,
  setModelPrefs,
  modelPrefs,
  providerHasKey as _providerHasKey,
  type ProviderEntry,
  type ProviderKind,
} from "../vouch/engine/providers";
import { MCP_TOOLS } from "../vouch/engine/mcpRouter";
import {
  loadOrCreateCrossHarborIdentity, anchorReceiptJsonl,
  type CrossHarborStore,
} from "../vouch/engine/crossHarbor";
import { VH_SHORT, VH_VERSION, VH_CODENAME } from "../version";
import { toast } from "../panels/Toast";

/* 17.6.1 — cross-harbor identity rides the same KV-seam doctrine as the
   provider registry: guarded localStorage on web, refusals IN WORDS. */
const crossHarborStore: CrossHarborStore = {
  get: (k) => { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } },
  set: (k, v) => {
    try { globalThis.localStorage?.setItem(k, v); }
    catch { throw new Error("storage refused the write"); }
  },
};

export type AnchorOutcome = { ok: boolean; evidence?: string; fp?: string; reason?: string };

/**
 * v17.10.3 — the app layer's single re-export point for the assurance KPI.
 * Views import it from here, not from the engine: the view never reaches the
 * bridge directly (house rule), and there must be exactly ONE way to turn an
 * assurance report into something a surface can render.
 */
export { assuranceKpi } from "../vouch/engine/bridge";
export type { RerateReport } from "../vouch/engine/bridge";

/** Verify-then-anchor a sealed receipt into the vouch chain (17.6.1). */
export async function anchorVouchReceipt(id: string): Promise<AnchorOutcome> {
  const jsonl = vouchReceiptJsonl(id);
  if (!jsonl) return { ok: false, reason: "no receipt JSONL for this run" };
  const identity = await loadOrCreateCrossHarborIdentity(crossHarborStore, "patina-agent");
  if (!identity.ok) return { ok: false, reason: identity.reason };
  const anchored = await anchorReceiptJsonl(jsonl, identity.value);
  return anchored.ok
    ? { ok: true, evidence: anchored.value.evidence, fp: identity.value.fp }
    : { ok: false, reason: anchored.reason };
}

/* ── derived harbor state ────────────────────────────────────────────────── */

export interface VoyageMission {
  id: string;
  objective: string;
  status: "routing" | "planning" | "sailing" | "gate" | "verify" | "sealed" | "failed" | "denied";
  seats: number;
  verified: number;
  receiptHash?: string;
  receiptId?: string;
  startedAt: number;
  finishedAt?: number;
  brain: string;
  mode: VouchMode;
  engine: string;
  teamName: string;
  runMs: number;
  chainEventCount: number;
  signed: boolean;
  threadId: string;
  gateStatus: string | null;
  // Patina extension #4: hindsight regret
  optimalSteps?: number;
  actualSteps?: number;
  driftNodes?: string[];
}

export interface Seat {
  id: string;
  name: string;
  role: string;
  harness: string;
  wins: number;
  runs: number;
  status: "idle" | "on-mission" | "awaiting-approval" | "sick";
  lastMissionObjective?: string;
}

export interface HarborTotals {
  sealedVoyages: number;
  handsOnDeck: number;
  signedActs: number;
  /**
   * v17.10.3 — was `assuranceScore: number`, fed by `60 + receipts*2 + skills*3`.
   * That was a SECOND fabricated formula: the bridge had been fixed to use the
   * real evidence-based scorer while this path kept inventing a number, and both
   * the Harbor and Register KPI cards rendered it. Now the report itself, so the
   * only way to display assurance is to read what the scorer actually said.
   */
  assurance: ReturnType<typeof harborRerate>;
  winRate: number;
  chainLength: number;
  pendingApprovals: number;
  pendingApprovalsList: VouchApproval[];
  brain: string;
  mode: VouchMode;
  persona: VouchPersona;
  version: string;
  codename: string;
  activeCrew: { id: string; name: string } | null;
  configuredCrews: number;
}

export interface HarborState {
  session: VouchSession;
  totals: HarborTotals;
  voyages: VoyageMission[];
  seats: Seat[];
  receipts: VouchReceiptRef[];
  threads: VouchThread[];
  activeThread: VouchThread;
  workspace: Array<{ name: string; chars: number; updated: string }>;
  providers: ProviderEntry[];
  mcpTools: number;
  drills: DrillReport[];
  drillScenarios: typeof DRILL_SCENARIOS;
}

/* map a real mission record into a Patina-shell VoyageMission */
function missionStatusFrom(s: string, gate: string | null): VoyageMission["status"] {
  if (gate === "denied") return "denied";
  switch (s) {
    case "done": return "sealed";
    case "failed":
    case "aborted": return "failed";
    case "awaiting-approval": return "gate";
    case "running": return "sailing";
    case "planned":
    case "composing": return "planning";
    default: return "sealed";
  }
}

function buildState(): HarborState {
  const s = vouchSession();
  const missions = vouchMissions();
  const crews = harborCrews();
  const active = harborActiveCrew();
  const workspace = vouchWorkspaceFiles();
  const providers = listProviders();
  const drills = drillReports();

  const receipts = s.receipts.slice().sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));

  // Voyages: mission ledger + in-vouch receipts that were dispatches
  const voyageFromMission = (m: MissionRecordLike, idx: number): VoyageMission => {
    const finishedAt = m.ts ? new Date(m.ts).getTime() : undefined;
    return {
      id: m.missionId,
      objective: m.objective,
      status: missionStatusFrom(m.status, m.gateStatus),
      seats: m.seatCount,
      verified: m.verifiedSeats,
      startedAt: finishedAt ? finishedAt - (m.runMs ?? 500) : Date.now() - idx * 60_000,
      finishedAt,
      brain: s.brain,
      mode: s.mode,
      engine: m.engine ?? "missionLoop",
      teamName: m.teamName ?? (active?.name ?? "shore-crew"),
      runMs: m.runMs ?? 0,
      chainEventCount: 0,
      signed: m.receiptOk,
      threadId: s.activeThreadId,
      gateStatus: m.gateStatus,
    };
  };

  // mission records (real engine dispatches)
  const missionVoyages: VoyageMission[] = missions.map((m, i) => voyageFromMission(m as unknown as MissionRecordLike, i));

  // vouched receipts from chat turns (even non-dispatch turns are signed acts)
  const receiptVoyages: VoyageMission[] = s.receipts.map((r) => {
    const finishedAt = new Date(r.finishedAt).getTime();
    const startedAt = new Date(r.startedAt).getTime();
    const isDispatch = r.mission.startsWith("vouch: dispatch") || r.receipt.events.some((e) => e.kind === "vouch.dispatch");
    // Hindsight (differentiator #4): compare receipt event count vs the optimal
    // 7-step chain length we'd expect for a clean run
    const expected = isDispatch ? 11 : 6;
    const actual = r.events;
    const drift: string[] = [];
    const kinds = new Set(r.receipt.events.map((e) => e.kind));
    if (isDispatch && !kinds.has("vouch.simulation")) drift.push("SIMULATE skipped");
    if (!kinds.has("vouch.verdict")) drift.push("VERDICT missing");
    if (r.receipt.events.length > expected) drift.push("over-plan");
    return {
      id: r.id,
      objective: r.mission.replace(/^vouch:\s*/, "").slice(0, 120),
      status: "sealed",
      seats: 0,
      verified: 0,
      receiptHash: r.head,
      receiptId: r.id,
      startedAt,
      finishedAt,
      brain: s.brain,
      mode: s.mode,
      engine: "vouch",
      teamName: r.threadTitle,
      runMs: finishedAt - startedAt,
      chainEventCount: r.events,
      signed: r.signed,
      threadId: s.activeThreadId,
      gateStatus: null,
      optimalSteps: expected,
      actualSteps: actual,
      driftNodes: drift,
    };
  });

  const voyages = [...missionVoyages, ...receiptVoyages]
    .sort((a, b) => b.startedAt - a.startedAt);

  // Seats: compose from crews + statically-defined default harness seats
  const seats: Seat[] = [];
  if (active) {
    seats.push({ id: "hand-helm", name: "Helmsman", role: "planner", harness: "vouch-brain", wins: 0, runs: 0, status: "idle" });
    seats.push({ id: "hand-lookout", name: "Lookout", role: "research", harness: "web-evidence", wins: 0, runs: 0, status: "idle" });
    seats.push({ id: "hand-wright", name: "Shipwright", role: "build", harness: "workspace-write", wins: 0, runs: 0, status: "idle" });
    seats.push({ id: "hand-scrivener", name: "Scrivener", role: "proof", harness: "mission-vouch", wins: 0, runs: 0, status: "idle" });
  } else {
    // No crew yet — show the four muster positions idle
    seats.push(
      { id: "hand-helm", name: "Helmsman", role: "planner", harness: "vouch-brain", wins: 0, runs: 0, status: "idle" },
      { id: "hand-lookout", name: "Lookout", role: "research", harness: "web-evidence", wins: 0, runs: 0, status: "idle" },
      { id: "hand-wright", name: "Shipwright", role: "build", harness: "workspace-write", wins: 0, runs: 0, status: "idle" },
      { id: "hand-scrivener", name: "Scrivener", role: "proof", harness: "mission-vouch", wins: 0, runs: 0, status: "idle" },
    );
  }

  const totalRuns = voyages.length;
  const wins = voyages.filter((v) => v.status === "sealed").length;
  const winRate = totalRuns > 0 ? Math.round((wins / totalRuns) * 100) : 0;
  const pending = s.approvals.filter((a) => a.status === "pending");

  const totals: HarborTotals = {
    sealedVoyages: voyages.filter((v) => v.status === "sealed").length,
    handsOnDeck: seats.length,
    signedActs: s.receipts.length,
    assurance: harborRerate(),
    winRate,
    chainLength: s.receipts.length,
    pendingApprovals: pending.length,
    pendingApprovalsList: pending,
    brain: vouchBrain().label,
    mode: s.mode,
    persona: s.persona,
    version: VH_SHORT,
    codename: VH_CODENAME,
    activeCrew: active,
    configuredCrews: crews.length,
  };

  const activeThread = s.threads.find((t) => t.id === s.activeThreadId) ?? s.threads[0];

  return {
    session: s,
    totals,
    voyages,
    seats,
    receipts,
    threads: s.threads,
    activeThread,
    workspace,
    providers,
    mcpTools: MCP_TOOLS.length,
    drills,
    drillScenarios: DRILL_SCENARIOS,
  };
}

type MissionRecordLike = {
  missionId: string;
  objective: string;
  status: string;
  seatCount: number;
  verifiedSeats: number;
  ts: string;
  runMs: number;
  engine: string;
  teamName: string;
  receiptOk: boolean;
  gateStatus: string | null;
};

/* ── the live hook ───────────────────────────────────────────────────────── */

export interface HarborActions {
  // Helm — dispatch
  sendMessage: (text: string) => Promise<void>;
  setMode: (m: VouchMode) => void;
  setPersona: (p: VouchPersona) => void;
  stop: () => void;
  newThread: (title?: string) => string;
  selectThread: (id: string) => boolean;
  focusHelm: () => void;
  pendingHelmText: (text: string) => void;
  // Approvals
  approve: (id: string, ok: boolean) => void;
  rateReceipt: (id: string, score: number, note?: string) => void;
  verifyReceipt: (id: string) => Promise<{ ok: boolean; events?: number; reason?: string }>;
  receiptJsonl: (id: string) => string | null;
  anchorReceipt: (id: string) => Promise<AnchorOutcome>;
  // Ship
  musterHand: () => void;
  rerate: () => void;
  // Harbor
  launchVoyage: () => void;
  exportManifest: () => void;
  // Drill
  runDrill: (scenarioId: string) => Promise<{ ok: boolean; output: string; report: DrillReport | null }>;
  // Providers
  addProvider: (p: Omit<ProviderEntry, "enabled">) => ProviderEntry | { error: string };
  removeProvider: (id: string) => { ok: boolean };
  setProviderKey: (id: string, key: string, kind?: ProviderKind) => { ok: boolean; refused?: string };
  removeProviderKey: (id: string) => void;
  toggleModelRouting: (enabled: boolean) => void;
  // Memory
  removeFact: (id: string) => void;
  removePreference: (id: string) => void;
  removeSkill: (id: string) => void;
  addFact: (text: string) => void;
  // Register
  exportManifestBundle: () => string;
  navigate: (view: "harbor" | "ship" | "chart" | "register" | "master") => void;
  providerHasKey: (id: string) => boolean;
}

const HarborCtx = React.createContext<{ state: HarborState; actions: HarborActions } | null>(null);

export const HarborProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Boot the session (this loads from localStorage in the engine already)
  const [tick, setTick] = useState(0);
  const forceRender = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    // subscribe to engine state changes
    const unsub = subscribeVouch(() => forceRender());
    // also a slow heartbeat for "in flight" missions
    const h = setInterval(forceRender, 1000);
    return () => { unsub(); clearInterval(h); };
  }, [forceRender]);

  const state = useMemo(() => buildState(), [tick]);

  const actions: HarborActions = useMemo(
    () => ({
      sendMessage: (text: string) => sendVouchMessage(text),
      setMode: (m) => { setVouchMode(m); forceRender(); },
      setPersona: (p) => { setVouchPersona(p); forceRender(); },
      stop: () => { stopVouch(); forceRender(); },
      newThread: (title) => { const id = newVouchThread(title); forceRender(); return id; },
      selectThread: (id) => { const ok = setActiveVouchThread(id); forceRender(); return ok; },
      approve: (id, ok) => { resolveVouchApproval(id, ok); forceRender(); },
      rateReceipt: (id, score, note) => { rateVouchRun(id, score, note); forceRender(); },
      verifyReceipt: (id) => verifyVouchReceipt(id),
      receiptJsonl: (id) => vouchReceiptJsonl(id),
      anchorReceipt: (id) => anchorVouchReceipt(id),
      musterHand: () => {
        // Real seat muster: appends a TeamSeat to the active crew (creates one if none).
        const r = harborMusterHand();
        if ('error' in r) {
          toast(r.error);
        } else {
          addVouchFact(`Hand mustered: ${r.seat.id} (${r.seat.role}) on crew "${r.crew.name}".`);
        }
        forceRender();
      },
      rerate: () => {
        // v17.10 — assurance now comes from the real scorer. It is null when the
        // fleet has no measured runs, and we say so rather than printing a number
        // derived from headcount.
        const snap = harborRerate();
        addVouchFact(
          snap.status === "evaluated"
            ? `Rerate — assurance ${snap.assurance} (${snap.band}) over ${snap.measured} measured cycle(s), ${snap.sealed} sealed.`
            : `Rerate — unevaluated. ${snap.note}`,
        );
        forceRender();
      },
      launchVoyage: () => {
        // Opens a new thread AND focuses + selects the Helm input so the human
        // can issue an objective immediately. The mission actually launches when
        // they press Make it so (the governed path).
        newVouchThread(`Voyage ${state.voyages.length + 1}`);
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("vh:focus-helm"));
        forceRender();
      },
      exportManifest: () => {
        const blob = state.receipts.map((r) => vouchReceiptJsonl(r.id)).filter(Boolean).join("\n");
        downloadText(`vouch-harbor-manifest-${VH_VERSION}.jsonl`, blob);
      },
      runDrill: (scenarioId) => runDrill(scenarioId),
      addProvider: (p) => addProvider(p),
      removeProvider: (id) => removeProvider(id),
      setProviderKey: (id, key, kind) => setProviderKey(id, key, kind),
      removeProviderKey: (id) => removeProviderKey(id),
      toggleModelRouting: (enabled) => setModelPrefs({ ...modelPrefs(), enabled }),
      removeFact: (id) => { removeVouchFact(id); forceRender(); },
      removePreference: (id) => { removeVouchPreference(id); forceRender(); },
      removeSkill: (id) => { removeVouchSkill(id); forceRender(); },
      addFact: (text) => { addVouchFact(text); forceRender(); },
      focusHelm: () => {
        // Tell the App shell to focus the Helm textarea (the shell owns that ref).
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vh:focus-helm'));
      },
      pendingHelmText: (text: string) => {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vh:set-helm', { detail: { text } }));
      },
      navigate: (view) => {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vh:navigate', { detail: { view } }));
      },
      providerHasKey: (id) => _providerHasKey(id),
      exportManifestBundle: () => {
        const lines: string[] = [];
        lines.push("# Vouch Harbor — Manifest Bundle");
        lines.push(`# version ${VH_VERSION} "${VH_CODENAME}"`);
        lines.push(`# exported ${new Date().toISOString()}`);
        lines.push("");
        for (const r of state.receipts) {
          const j = vouchReceiptJsonl(r.id);
          if (j) lines.push(j);
        }
        return lines.join("\n");
      },
    }),
    [forceRender, state.receipts, state.voyages.length],
  );

  return <HarborCtx.Provider value={{ state, actions }}>{children}</HarborCtx.Provider>;
}

export function useHarbor(): { state: HarborState; actions: HarborActions } {
  const ctx = useContext(HarborCtx);
  if (!ctx) throw new Error("useHarbor must be used inside <HarborProvider>");
  return ctx;
}

/* small download helper (no deps) */
function downloadText(filename: string, text: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([text], { type: "application/jsonl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}



/* expose one low-level direct dispatch used by the Helm for "dispatch a mission:" shorthand */
export async function directDispatch(objective: string): Promise<MissionOutcome> {
  const id = mintMissionId();
  return runHarborMission(objective, id);
}

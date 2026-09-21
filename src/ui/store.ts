/**
 * Velvet Hand — the one UI store (zustand). Owns the real engine seams:
 * askVH19 · human gate · provider (session-only or vault-sealed) · memory graph.
 * Screens read from here; nothing in the UI talks to the engine directly.
 */
import { create } from "zustand";
import { askVH19 } from "../vh19/generalist";
import type { GeneralistDeps } from "../vh19/types";
import type { GeneralistResponse, GateAsk, GateDecision, ProviderConfig } from "../vh19/types";
import { recordHandoff, listHandoffs, type HandoffRecord } from "../vh19/handoffs";
import { vaultStatus, vaultSeal, vaultDecrypt, vaultRemove, lockVault, setVaultPassphrase, purgePlain, type VaultStatusInfo } from "../vh19/vault";
import { ingestSession, listSessions, getSession, graphView, graphStats, recall, rehydrate, memoryEnabled, setMemoryEnabled, clearGraph, deleteSession, graphSecurityStatus, type MgSession, type MgMessage } from "../vh19/memoryGraph";
import { wireEventSeq, optimDelta, type OptimDelta } from "../vh19/tokenOptim";
import { loadInitiative, setLevel, reportFailure, scheduleFollowUp, evaluateWake, applyWake, executeWakeActs, HEARTBEAT_DEFAULT_MS, type InitiativeState, type AutonomyLevel } from "../vh19/initiative";
import { generalistName, setGeneralistName } from "../vh19/face";
import { engineExecutor } from "../vh19/initiativeBridge";
import { loadGoals } from "../vh19/goals";
import { recordRsiSignal, rsiState, revertRsiMemory } from "../vh19/rsi";
import { rsiralsCanaryCheck } from "../vh19/rsirals";

/* RSI evidence intake (19.4.2 discipline, now on the ONE live path): real gate
 * denials, failures and live-data misses become curriculum, and a canary that
 * attributes the failure to an applied scaffold change rolls that change back. */
function ingestRsi(kind: "gate" | "failure" | "livedata", subject: string, evidence: string[] = []): void {
  recordRsiSignal(kind, subject, evidence);
  for (const name of rsiralsCanaryCheck({ kind, subject })) {
    const d = rsiState().drafts.find((x) => x.name === name && x.state === "applied");
    if (d) revertRsiMemory(d.id);
  }
}

export const USER = "vh-owner";
const PROVIDER_STORAGE_KEY = "vh.provider.remembered.v1";
const THEME_KEY = "vh.theme.v2";

export type Screen = "steward" | "work" | "receipts" | "memory" | "settings" | "chat";
export type Theme = "dark" | "light";

export interface Msg { id: number; role: "user" | "vh"; text: string; at: string; resp?: GeneralistResponse; tok?: OptimDelta; rehydratedFrom?: string }
export interface PendingGate { ask: GateAsk; resolve: (d: GateDecision) => void; askedAt: string }
export interface Receipt { id: string; title: string; signer: string; digest: string; at: string; state: "ok" | "pending" | "refused"; kind: string }

interface UiState {
  screen: Screen; theme: Theme;
  msgs: Msg[]; busy: boolean; lastResp: GeneralistResponse | null; chatSessionId: string; sessionStart: string;
  gate: PendingGate | null;
  provider: ProviderConfig | null; vault: VaultStatusInfo; securityNote: string | null;
  memOn: boolean; sessions: MgSession[]; openSession: MgSession | null;
  handoffs: HandoffRecord[]; initiative: InitiativeState; savedTokens: number;
  stewardName: string; ownerHandle: string;

  go: (s: Screen) => void;
  setTheme: (t: Theme) => void;
  send: (text: string) => Promise<void>;
  decideGate: (d: GateDecision) => void;
  setProvider: (cfg: ProviderConfig | null, persist: boolean) => Promise<{ ok: boolean; note: string }>;
  forgetProvider: () => void;
  createVault: (pass: string) => Promise<{ ok: boolean; note: string }>;
  unlockVault: (pass: string) => Promise<{ ok: boolean; note: string }>;
  lock: () => void;
  setMemory: (on: boolean) => void;
  clearMemory: () => void;
  forgetSession: (id: string) => void;
  openConversation: (id: string) => void;
  setAutonomy: (l: AutonomyLevel) => void;
  /** One initiative heartbeat: decide, then EXECUTE safe acts through the real engine. */
  wakeNow: () => Promise<void>;
  renameSteward: (n: string) => void;
  boot: () => Promise<void>;
  receipts: () => Receipt[];
  newMission: () => void;
}

let seq = 0;
type SetFn = (p: Partial<UiState> | ((s: UiState) => Partial<UiState>)) => void;
type GetFn = () => UiState;
/** The human gate: one promise per ask; a denial becomes RSI curriculum. */
function makeGate(set: SetFn) {
  return (ask: GateAsk) => new Promise<GateDecision>((resolve) => set({ gate: { ask, resolve: (dec: GateDecision) => {
    if (!dec.approved) ingestRsi("gate", `Gate denied: ${ask.action} — ${dec.reason ?? "no reason recorded"}`);
    resolve(dec);
  }, askedAt: nowIso() } }));
}
/** The ONE dependency set every engine run takes — typed message or heartbeat act. */
function runDeps(get: GetFn, set: SetFn, gateFn: (ask: GateAsk) => Promise<GateDecision>): GeneralistDeps {
  return {
    provider: get().provider, gate: gateFn,
    onHandoff: (h) => { recordHandoff(h); set({ handoffs: listHandoffs() }); },
    evidenceFetch: typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined,
  };
}
let heartbeat: ReturnType<typeof setInterval> | null = null;
/** The heartbeat runs only above level 0; it is re-armed whenever the level changes. */
function armHeartbeat(get: GetFn): void {
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  if (get().initiative.level === 0 || typeof setInterval !== "function") return;
  heartbeat = setInterval(() => { void get().wakeNow(); }, HEARTBEAT_DEFAULT_MS);
}
const nowIso = () => new Date().toISOString();
const readTheme = (): Theme => { try { const t = localStorage.getItem(THEME_KEY); return t === "light" ? "light" : "dark"; } catch { return "dark"; } };
const readHandle = () => { try { return localStorage.getItem("vh.owner.handle") ?? "owner"; } catch { return "owner"; } };

export const useVh = create<UiState>((set, get) => ({
  screen: "steward", theme: readTheme(),
  msgs: [], busy: false, lastResp: null, chatSessionId: `s_${Date.now().toString(36)}`, sessionStart: nowIso(),
  gate: null,
  provider: null, vault: vaultStatus(), securityNote: null,
  memOn: memoryEnabled(), sessions: listSessions(), openSession: null,
  handoffs: listHandoffs(), initiative: loadInitiative(), savedTokens: 0,
  stewardName: generalistName(), ownerHandle: readHandle(),

  go: (screen) => set({ screen }),
  setTheme: (theme) => { document.documentElement.dataset.theme = theme; try { localStorage.setItem(THEME_KEY, theme); } catch { /* no storage */ } set({ theme }); },

  newMission: () => set({ msgs: [], lastResp: null, chatSessionId: `s_${Date.now().toString(36)}`, sessionStart: nowIso(), screen: "steward", openSession: null }),

  send: async (raw) => {
    const text = raw.trim(); const st = get();
    if (!text || st.busy) return;
    seq += 1;
    // referential recall → rehydrate, marked, never silent
    let sentText = text; let rehydratedFrom: string | undefined;
    const hits = recall(text, 1);
    const referential = /\b(remember|that day|last time|we discussed|earlier|continue|pick up|history|before)\b/i.test(text) || (hits[0]?.dateMatch ?? false);
    const useId = st.openSession?.id ?? (referential && hits[0] && hits[0].score >= 3 ? hits[0].session.id : null);
    if (useId) { const r = rehydrate(useId); if (r) { sentText = `${r.preamble}\n\n${text}`; rehydratedFrom = r.session.title; } }
    const userMsg: Msg = { id: seq, role: "user", text, at: nowIso(), rehydratedFrom };
    set({ msgs: [...st.msgs, userMsg], busy: true, screen: st.screen === "chat" ? "chat" : "work" });
    const gateFn = makeGate(set);
    try {
      const snap = wireEventSeq();
      const resp = await askVH19({ text: sentText, userId: USER }, runDeps(get, set, gateFn));
      const delta = optimDelta(snap);
      if (resp.liveData && resp.liveData.verified === false) {
        const urls = (resp.liveData.retrieval ?? []).map((r) => r.url);
        ingestRsi("livedata", `Live-data claims did not verify: ${urls.join(", ").slice(0, 140) || "no retrieval recorded"}`, urls.slice(0, 3));
      }
      if (resp.outcome === "refused" || resp.outcome === "error" || resp.outcome === "gated-out" || resp.failure) {
        ingestRsi("failure", `Run did not execute (${resp.outcome}): ${resp.note ?? resp.reply.slice(0, 120)}`);
      }
      seq += 1;
      const vhMsg: Msg = { id: seq, role: "vh", text: resp.reply, at: nowIso(), resp, tok: delta.calls > 0 ? delta : undefined };
      set((s) => ({ msgs: [...s.msgs, vhMsg], lastResp: resp, savedTokens: s.savedTokens + Math.max(0, delta.savedTokens) }));
      if (resp.outcome === "gated-out") {
        const r = scheduleFollowUp("verify", `re-check: ${text.slice(0, 72)}`, Date.now() + HEARTBEAT_DEFAULT_MS, 1);
        if (r.ok) set({ initiative: loadInitiative() });
      }
    } catch (e) {
      reportFailure(loadInitiative());
      ingestRsi("failure", `Run threw before it could answer: ${String(e).slice(0, 140)}`);
      seq += 1;
      set((s) => ({ msgs: [...s.msgs, { id: seq, role: "vh", text: `The run failed before it could answer — ${String(e)}`, at: nowIso() }], initiative: loadInitiative() }));
    } finally {
      set({ busy: false, gate: null });
      // memory ingest — idempotent upsert by session id
      const s = get();
      if (s.memOn && s.msgs.length) {
        const all: MgMessage[] = s.msgs.map((x) => ({ role: x.role, text: x.text, at: x.at }));
        ingestSession(all, { id: s.chatSessionId, startedAt: s.sessionStart });
        set({ sessions: listSessions() });
      }
    }
  },

  decideGate: (d) => { const g = get().gate; if (!g) return; set({ gate: null }); g.resolve(d); },

  setProvider: async (cfg, persist) => {
    if (!cfg) { get().forgetProvider(); return { ok: true, note: "provider removed" }; }
    set({ provider: cfg });
    if (!persist) return { ok: true, note: "key kept in memory for this session only" };
    const v = vaultStatus();
    if (v.status !== "unlocked") return { ok: true, note: "kept in memory — unlock or create the vault to persist it encrypted" };
    const r = await vaultSeal(PROVIDER_STORAGE_KEY, JSON.stringify(cfg));
    return r.ok ? { ok: true, note: "key sealed in the vault (AES-256-GCM)" } : { ok: false, note: r.error };
  },
  forgetProvider: () => { vaultRemove(PROVIDER_STORAGE_KEY); set({ provider: null, securityNote: "the key was removed — nothing lingers in storage" }); },

  createVault: async (pass) => {
    const r = await setVaultPassphrase(pass);
    if (!r.ok) return { ok: false, note: r.error };
    set({ vault: vaultStatus() });
    const p = get().provider; if (p) await vaultSeal(PROVIDER_STORAGE_KEY, JSON.stringify(p));
    return { ok: true, note: r.created ? "vault created — keys and memory are now sealed at rest" : "vault unlocked" };
  },
  unlockVault: async (pass) => {
    const r = await setVaultPassphrase(pass);
    if (!r.ok) return { ok: false, note: r.error };
    const opened = await vaultDecrypt(PROVIDER_STORAGE_KEY);
    if (opened.found && !opened.locked) { try { set({ provider: JSON.parse(opened.text) as ProviderConfig }); } catch { /* leave */ } }
    set({ vault: vaultStatus(), sessions: listSessions() });
    armHeartbeat(get);
    return { ok: true, note: "vault unlocked" };
  },
  lock: () => { lockVault(); set({ vault: vaultStatus() }); },

  setMemory: (on) => { setMemoryEnabled(on); set({ memOn: on }); },
  clearMemory: () => { clearGraph(); set({ sessions: listSessions() }); },
  forgetSession: (id) => { deleteSession(id); set({ sessions: listSessions(), openSession: get().openSession?.id === id ? null : get().openSession }); },
  openConversation: (id) => {
    const s = getSession(id); if (!s) return;
    const msgs: Msg[] = (s.messages ?? []).map((m, i) => ({ id: i + 1, role: m.role, text: m.text, at: m.at }));
    seq = Math.max(seq, msgs.length + 1);
    set({ openSession: s, msgs, chatSessionId: s.id, sessionStart: s.startedAt, screen: "chat", lastResp: null });
  },
  setAutonomy: (l) => { set({ initiative: setLevel(l) }); armHeartbeat(get); },
  wakeNow: async () => {
    const st = loadInitiative();
    const s0 = get();
    let facts = 0; try { const g = graphStats(); facts = g.nodes + g.edges; } catch { /* no graph */ }
    const wake = evaluateWake(
      { now: Date.now(), level: st.level, providerReady: !!s0.provider, vaultUnlocked: s0.vault.status === "unlocked", memoryOn: s0.memOn },
      st,
      { pendingGoalId: loadGoals()[0]?.id ?? null, newFacts: facts },
    );
    set({ initiative: { ...applyWake(wake, st, Date.now()) } });
    /* THE EXECUTION BRIDGE: safe acts ride the REAL engine through the shared
       production executor — askVH19 with the SAME dep set a typed message takes
       (provider · human gate · handoff recorder · evidence fetch · userId). */
    if (wake.kind === "act" && wake.acts.length > 0) {
      const gateFn = makeGate(set);
      const executor = engineExecutor({ userId: USER, depsFactory: () => runDeps(get, set, gateFn) });
      const runs = await executeWakeActs(wake.acts, executor);
      const lines = runs.map((r) => {
        const head = `· ${r.act.kind}: ${r.act.subject}`;
        if (!r.executed) return `${head} — ${r.whyNot ?? "not executed"}${r.result ? ` (${r.result.verdict})` : ""}`;
        return `${head} — ${r.result!.verdict}: ${r.act.note}${r.rescheduled ? " → re-check scheduled (depth-capped)" : ""}`;
      });
      seq += 1;
      set((s) => ({ msgs: [...s.msgs, { id: seq, role: "vh", text: `Initiative (self-directed, level ${st.level}) — executed through the real engine\n${lines.join("\n")}`, at: nowIso() }], initiative: loadInitiative(), gate: null }));
    }
  },
  renameSteward: (n) => set({ stewardName: setGeneralistName(n) }),

  boot: async () => {
    document.documentElement.dataset.theme = get().theme;
    // 19.7.1 discipline: purge legacy plaintext, load sealed if unlocked
    let legacy: ProviderConfig | null = null;
    try {
      const raw = globalThis.localStorage?.getItem(PROVIDER_STORAGE_KEY) ?? null;
      if (raw && !raw.includes("vh-vault/1")) { const p = purgePlain(PROVIDER_STORAGE_KEY); if (p.found && p.text) { try { legacy = JSON.parse(p.text) as ProviderConfig; } catch { legacy = null; } } }
    } catch { /* no storage */ }
    const opened = await vaultDecrypt(PROVIDER_STORAGE_KEY);
    if (opened.found && !opened.locked) { try { set({ provider: JSON.parse(opened.text) as ProviderConfig, securityNote: "the key was unsealed from the encrypted vault" }); } catch { /* ignore */ } }
    else if (opened.found && opened.locked) set({ securityNote: "a sealed provider key is in the vault — unlock it in Settings to use it" });
    else if (legacy) set({ provider: legacy, securityNote: "a plaintext key from 19.7.0 was found and removed — it lives in memory for this session only" });
    set({ vault: vaultStatus(), sessions: listSessions() });
    armHeartbeat(get);
  },

  receipts: () => {
    const out: Receipt[] = []; const seen = new Set<string>();
    const push = (r: Receipt) => { if (!seen.has(r.id)) { seen.add(r.id); out.push(r); } };
    for (const m of get().msgs) {
      const r = m.resp; if (!r) continue;
      if (r.provenanceDigest) push({ id: r.provenanceDigest, title: `Run · ${r.outcome} · ${r.specialistIds.length} agent${r.specialistIds.length === 1 ? "" : "s"}`, signer: r.authority ? `owner · ${r.authority.scheme}` : "provenance", digest: r.provenanceDigest, at: m.at, state: r.outcome === "refused" ? "refused" : "ok", kind: "run" });
      for (const mr of r.memberRuns ?? []) for (const t of mr.toolReceipts) if (t.digest) push({ id: t.digest, title: `${t.tool} · ${t.outcome}`, signer: "tool receipt", digest: t.digest, at: m.at, state: /refus|denied|blocked/i.test(t.outcome) ? "refused" : "ok", kind: "tool" });
      if (r.synthesis && (r.synthesis as { digest?: string }).digest) push({ id: (r.synthesis as { digest: string }).digest, title: "Synthesis", signer: "captain", digest: (r.synthesis as { digest: string }).digest, at: m.at, state: "ok", kind: "synthesis" });
    }
    for (const h of get().handoffs) if (h.receiptDigest) push({ id: h.receiptDigest, title: `Handoff · ${h.peer} · ${h.outcome}`, signer: "mesh", digest: h.receiptDigest, at: "", state: h.outcome === "refused" ? "refused" : "ok", kind: "handoff" });
    const g = get().gate; if (g) out.unshift({ id: "pending", title: g.ask.action, signer: "—", digest: "—", at: g.askedAt, state: "pending", kind: "gate" });
    return out;
  },
}));

export const memoryGraphData = () => graphView(48);
export const memoryStats = () => graphStats();
export const memorySecurity = () => graphSecurityStatus();

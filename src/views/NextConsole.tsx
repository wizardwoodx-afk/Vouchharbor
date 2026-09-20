/**
 * VH-19.7.0 — THE CONSOLE (v2: chat-first, crafted).
 *
 * What changed from the 19.6.6 console, on purpose:
 *   • the rail now carries your CONVERSATIONS — every chat becomes a
 *     keyword-graph session (src/vh19/memoryGraph) you can revisit and
 *     CONTINUE ("that day when X happened" just works, and a rehydrated
 *     context is always marked in the prompt, never silently injected);
 *   • the door opens on a welcome hero with real starting points;
 *   • every steward bubble carries its evidence AND its token report —
 *     the wire optimizer's honest per-run delta (estimates, labelled);
 *   • a Memory Graphs plane renders the graph and its sessions;
 *   • an MCP market plane: install/enable/export ANY MCP server, curated
 *     catalog + user-added, guarded by the same egress rules as providers;
 *   • the composer is a real composer: focus ring, send, hints.
 *
 * The engine is untouched where it matters: askVH19, the gate, the receipts
 * and the honesty chips do the talking; this view renders what happened.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { askVH19 } from "../vh19/generalist";
import type { GeneralistResponse } from "../vh19/types";
import { teammatesFromResponse, coordinationFeed, type TeammateRow } from "../vh19/teammates";
import { GeneralistFace, SpecialistFace, generalistName, setGeneralistName, type GeneralistMood } from "../vh19/face";
import { answerGateWithRules } from "../vh19/gateRules";
import { recordHandoff, listHandoffs, type HandoffRecord } from "../vh19/handoffs";
import type { GateAsk, GateDecision, ProviderConfig, ProviderKind } from "../vh19/types";
import { PROVIDER_DEFAULTS } from "../vh19/providers";
import { Graph3D, type G3Node, type G3Edge } from "../vh19/graph3d";
import { loadGoals } from "../vh19/goals";
import {
  loadInitiative, setLevel, evaluateWake, applyWake, breakerTripped,
  executeWakeActs, scheduleFollowUp, reportFailure,
  AUTONOMY_LEVEL_NAMES, HEARTBEAT_DEFAULT_MS, LIMITS, type AutonomyLevel, type InitiativeState,
} from "../vh19/initiative";
import { engineExecutor } from "../vh19/initiativeBridge";
import {
  issueLiveGrant, revokeLiveGrant, runLiveCrossing, liveGrant, liveUsage,
  liveLedgerView, loadRegulatedActivation, enableRegulatedBench, DELEGATION_CAPABILITIES,
  REGULATED_DOMAIN_SLUGS,
} from "../vh19/federation/live";
import { standingNotice, type StandingGrant } from "../vh19/federation/standing";
import { pairKey } from "../vh19/vouchMesh";
import type { PairLedgerRow } from "../vh19/federation/ledger";
import type { SignedRegulatedActivation } from "../vh19/federation/regulatedPolicy";
import type { CrossingOutcome } from "../vh19/federation/bridge";
import type { DelegationCapability } from "../vh19/reach/delegationGrant";
/* 19.7.0 — the new planes */
import {
  listSessions, ingestSession, deleteSession, recall, rehydrate, graphView, graphStats, clearGraph,
  type MgSession, type MgMessage,
} from "../vh19/memoryGraph";
import {
  catalogServers, listInstalled, installServer, uninstallServer, setServerEnabled, exportMcpJson, marketStats,
} from "../vh19/mcpMarket";
import { wireEventSeq, optimDelta, type OptimDelta } from "../vh19/tokenOptim";
/* 19.7.4 [Crew] — the workspace: ≤25 specialists, one governed crew. */
import {
  createCrewSession, runCrewSession, getCrewSession, switchMode, resolveGate, crewBriefing, CREW_MAX,
} from "../vh19/crew";
import { CREW_MODES, CREW_MODE_LABELS, type CrewMode } from "../vh19/modes";
import { moeV2Line } from "../vh19/moeV2";
import { lotusReport, lotusLine } from "../vh19/lotus";
import { vaultStatus, vaultSeal, vaultDecrypt, vaultRemove, lockVault, setVaultPassphrase, purgePlain, type VaultStatusInfo } from "../vh19/vault";
import { graphSecurityStatus, hydrateGraph, setMemoryEnabled, memoryEnabled } from "../vh19/memoryGraph";
import { mcpRuntimeStats, type McpToolSurfaceEntry, mcpRuntimeServers } from "../vh19/mcpRuntime";
import { getSpecialist } from "../vh19/registry";

const USER = "vh-owner";
const PROVIDER_STORAGE_KEY = "vh.provider.remembered.v1";

/* 19.7.1 — provider keys never persist as plaintext anymore. The THREE
 * states, stated in the provider panel:
 *   • vault unlocked  → the key is sealed with AES-256-GCM (survives reloads);
 *   • vault locked/absent → the key lives in MEMORY for this session only
 *     and the panel says exactly that;
 *   • a legacy 19.7.0 plaintext record is PURGED on boot (18.3.0 discipline:
 *     treated as compromised, migrated to memory, user told to re-seal). */
let sessionProvider: ProviderConfig | null = null;

interface Msg { id: number; role: "user" | "vh"; text: string; at: string; resp?: GeneralistResponse; tok?: OptimDelta; rehydratedFrom?: string }

const pill = (s: string) => <span className="nx-pill" data-s={s}>{s}</span>;
const tokChip = (t: OptimDelta) => (
  <span className="nx-tok" title={`token optimizer (estimates): ${t.beforeTokens} → ${t.afterTokens} est tokens across ${t.calls} call(s)${t.cacheAligned ? " · cache-aligned prefix" : ""}${t.budgetTrimmed ? " · budget trim fired" : ""}`}>
    ⚡ est −{t.savedTokens} tok{t.savedPct > 0 ? ` (${t.savedPct}%)` : ""}
  </span>
);

type Panel = "chat" | "crew" | "workspace" | "ledger" | "fed" | "provider" | "memory" | "market" | "settings";

export function NextConsole(): React.ReactElement {
  const [panel, setPanel] = useState<Panel>("chat");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [crew, setCrew] = useState<TeammateRow[]>([]);
  const [coord, setCoord] = useState<string[]>([]);
  const [handoffs, setHandoffs] = useState<HandoffRecord[]>(() => listHandoffs());
  const [gateAsk, setGateAsk] = useState<{ ask: GateAsk; resolve: (d: GateDecision) => void } | null>(null);
  const [gName, setGName] = useState(generalistName());
  const [renaming, setRenaming] = useState(false);
  const [provider, setProvider] = useState<ProviderConfig | null>(() => sessionProvider);
  const [vault, setVault] = useState<VaultStatusInfo>(() => vaultStatus());
  const [theme, setThemeState] = useState<"noir" | "cream">(() => {
    try { return (globalThis.localStorage?.getItem("vh.ui.theme.v1") === "cream" ? "cream" : "noir"); } catch { return "noir"; }
  });
  const [vaultWord, setVaultWord] = useState<string>("");
  const [vaultErr, setVaultErr] = useState<string | null>(null);
  const [securityNote, setSecurityNote] = useState<string | null>(null);
  const [memOn, setMemOn] = useState(() => memoryEnabled());
  const seq = useRef(0);
  const streamRef = useRef<HTMLDivElement>(null);
  /* 19.7.0 — the conversation identity: every chat grows ONE graph session */
  const chatSessionId = useRef(`chat-${Date.now().toString(36)}`);
  const sessionStart = useRef<string>(new Date().toISOString());
  /* 19.7.2.1 [Agent] — INITIATIVE: the heartbeat that lets the crew act on
     its own inside hard caps. Level is the owner's (Settings → Autonomy);
     every act is receipted and rendered; the breaker parks it on failure. */
  const [initiative, setInitiative] = useState<InitiativeState>(() => loadInitiative());
  /* 19.7.4 [Crew] — the workspace: task → crew → governed parallel run. */
  const [wsTask, setWsTask] = useState("");
  const [wsSessionId, setWsSessionId] = useState<string | null>(null);
  const [wsBusy, setWsBusy] = useState(false);
  const [wsTick, setWsTick] = useState(0);
  const [wsErr, setWsErr] = useState<string | null>(null);
  useEffect(() => {
    if (!wsBusy) return;
    const t = setInterval(() => setWsTick((n) => n + 1), 700);
    return () => clearInterval(t);
  }, [wsBusy]);
  const initiativeRef = useRef<InitiativeState>(initiative);
  const wakeNow = useCallback(async () => {
    const st = initiativeRef.current;
    const wake = evaluateWake(
      {
        now: Date.now(),
        level: st.level,
        providerReady: !!provider,
        vaultUnlocked: vault.status === "unlocked",
        memoryOn: memOn,
      },
      st,
      { pendingGoalId: loadGoals()[0]?.id ?? null, newFacts: memoryFactsCount() },
    );
    const next = applyWake(wake, st, Date.now());
    initiativeRef.current = next;
    setInitiative({ ...next });

    /* THE EXECUTION BRIDGE (review fix, 19.7.3): safe acts ride the REAL
       engine through the shared production executor — askVH19 with the SAME
       dep set a typed chat message takes (provider · human gate · handoff
       recorder · evidence fetch · userId) → routing → Agentic MoE → member
       loops → gated tools → receipts. Proposals never execute (the human
       gate owns them); failures feed the circuit breaker; partials
       reschedule a capped verify check-back. */
    if (wake.kind === "act" && wake.acts.length > 0) {
      const executor = engineExecutor({
        userId: USER,
        depsFactory: () => ({
          provider,
          gate: gateFn,
          onHandoff: (h) => { recordHandoff(h); setHandoffs(listHandoffs()); },
          evidenceFetch: typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined,
        }),
      });

      const runs = await executeWakeActs(wake.acts, executor);
      const lines = runs.map((r) => {
        const head = `· ${r.act.kind}: ${r.act.subject}`;
        if (!r.executed) return `${head} — ${r.whyNot ?? "not executed"}${r.result ? ` (${r.result.verdict})` : ""}`;
        const tail = r.rescheduled ? ` → re-check scheduled (depth-capped)` : "";
        return `${head} — ${r.result!.verdict}: ${r.act.note}${tail}`;
      });
      setMsgs((m) => [...m, { id: Date.now() + Math.random(), role: "vh", text: `Initiative (self-directed, level ${st.level}) — executed through the real engine\n${lines.join("\n")}`, at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      const fresh = loadInitiative();
      initiativeRef.current = fresh;
      setInitiative({ ...fresh });
    }
  }, [provider, vault.status, memOn]);
  useEffect(() => {
    initiativeRef.current = initiative;
  }, [initiative]);
  useEffect(() => {
    if (initiative.level === 0) return;
    const timer = setInterval(wakeNow, HEARTBEAT_DEFAULT_MS);
    return () => clearInterval(timer);
  }, [initiative.level, wakeNow]);

  const [sessions, setSessions] = useState<MgSession[]>(() => listSessions());
  const [pendingRehydrate, setPendingRehydrate] = useState<{ id: string; title: string } | null>(null);
  const [savedAcc, setSavedAcc] = useState(0);

  /* ── federation panel state — the live seam renders what is actually stored ── */
  const [ownerA, setOwnerA] = useState("Owner A");
  const [ownerB, setOwnerB] = useState("Owner B");

  /* ── provider onboarding — first-time users connect a model right here ── */
  const [pKind, setPKind] = useState<ProviderKind>(provider?.kind ?? "openai-compatible");
  const [pUrl, setPUrl] = useState(provider?.baseUrl ?? PROVIDER_DEFAULTS["openai-compatible"]);
  const [pKey, setPKey] = useState(provider?.apiKey ?? "");
  const [pModel, setPModel] = useState(provider?.model ?? "");

  const forgetProvider = () => {
    sessionProvider = null;
    vaultRemove(PROVIDER_STORAGE_KEY);
    setProvider(null); setPKey(""); setPModel("");
    setSecurityNote("the key was removed — nothing lingers in storage");
  };
  /* the boot migration + sealed load (async because WebCrypto is) */
  useEffect(() => {
    void (async () => {
      // legacy 19.7.0 plaintext — purge on first contact, keep for this session, say so
      let legacy: ProviderConfig | null = null;
      try {
        const raw = globalThis.localStorage?.getItem(PROVIDER_STORAGE_KEY) ?? null;
        if (raw && !raw.includes("vh-vault/1")) {
          const purged = purgePlain(PROVIDER_STORAGE_KEY);
          if (purged.found && purged.text) {
            try { legacy = JSON.parse(purged.text) as ProviderConfig; } catch { legacy = null; }
          }
        }
      } catch { /* no storage — nothing to migrate */ }
      const opened = await vaultDecrypt(PROVIDER_STORAGE_KEY);
      if (opened.found && !opened.locked) {
        try {
          const cfg = JSON.parse(opened.text) as ProviderConfig;
          sessionProvider = cfg; setProvider(cfg);
          setSecurityNote("the key was unsealed from the encrypted vault");
        } catch { setSecurityNote("the sealed provider record could not be parsed — it was left as-is"); }
      } else if (opened.found && opened.locked) {
        setSecurityNote("a sealed provider key is in the vault — unlock below to use it");
      } else if (legacy) {
        sessionProvider = legacy; setProvider(legacy);
        setSecurityNote("a PLAINTEXT key from 19.7.0 was found in storage and REMOVED (treated as compromised) — it lives in memory for this session only; set a vault passphrase to persist it encrypted");
      }
      setVault(vaultStatus());
    })();
  }, []);
  /* 19.7.2 — the two buttons now do EXACTLY what they say (review fix):
     session-only keeps the key in MEMORY and removes any stored copy;
     remember-on-this-machine REQUIRES an unlocked vault and seals. */
  const saveProviderSession = () => {
    if (!pKey.trim()) { setProviderErr("a provider without an API key connects nothing — name the key"); return; }
    sessionProvider = { kind: pKind, baseUrl: pUrl.trim() || PROVIDER_DEFAULTS[pKind], apiKey: pKey.trim(), model: pModel.trim() };
    setProvider(sessionProvider);
    vaultRemove(PROVIDER_STORAGE_KEY);
    setProviderErr(null);
    setSecurityNote("session-only — the key lives in memory and storage holds nothing; it will not survive a reload");
  };
  const saveProviderPersist = () => {
    if (!pKey.trim()) { setProviderErr("a provider without an API key connects nothing — name the key"); return; }
    if (vaultStatus().status !== "unlocked") {
      setProviderErr("persisting needs the owner vault — open Settings to create or unlock it (the key would otherwise only be session-only)");
      return;
    }
    const cfg = { kind: pKind, baseUrl: pUrl.trim() || PROVIDER_DEFAULTS[pKind], apiKey: pKey.trim(), model: pModel.trim() };
    sessionProvider = cfg;
    setProvider(cfg);
    void vaultSeal(PROVIDER_STORAGE_KEY, JSON.stringify(cfg)).then((r) => {
      setVaultErr(r.ok ? null : r.error);
      setProviderErr(null);
      setSecurityNote(r.ok ? "the key is sealed with AES-256-GCM under your vault passphrase — storage holds ciphertext only" : r.error);
    });
  };
  /* ── the owner vault (19.7.1) ── */
  const doVaultPassphrase = () => {
    setVaultErr(null);
    void (async () => {
      const r = await setVaultPassphrase(vaultWord);
      if (!r.ok) { setVaultErr(r.error); return; }
      setVaultWord("");
      // migrate in-session secrets into sealed storage the moment the vault exists
      if (sessionProvider) await vaultSeal(PROVIDER_STORAGE_KEY, JSON.stringify(sessionProvider));
      const h = await hydrateGraph();
      setMemOn(memoryEnabled());
      setVault(vaultStatus());
      setSecurityNote(r.created
        ? `vault created — provider keys and the memory graph now seal with AES-256-GCM${h.loaded ? " (your existing graph was unlocked and loaded)" : ""}`
        : "vault unlocked — sealed records are readable and new secrets seal automatically");
    })();
  };
  const doLockVault = () => {
    lockVault();
    setVault(vaultStatus());
    setSecurityNote("the vault is locked — sealed records stay sealed until you return");
  };
  /* 19.7.2 — appearance: one switch, persisted, applied at the root */
  const setTheme = (t: "noir" | "cream") => {
    setThemeState(t);
    try { globalThis.localStorage?.setItem("vh.ui.theme.v1", t); } catch { /* session-only appearance */ }
    if (t === "cream") document.documentElement.dataset.theme = "cream";
    else delete document.documentElement.dataset.theme;
  };
  interface FedState {
    grant: StandingGrant | null;
    notice: string | null;
    rows: PairLedgerRow[];
    activation: SignedRegulatedActivation | null;
    last: CrossingOutcome | null;
    err: string | null;
  }
  const refreshFed = (): FedState => {
    const g = liveGrant();
    const u = liveUsage(g);
    return {
      grant: g,
      notice: g && u ? standingNotice(g, u.initiator) : null,
      rows: liveLedgerView(pairKey(ownerA, ownerB)),
      activation: loadRegulatedActivation(),
      last: null,
      err: null,
    };
  };
  const [providerErr, setProviderErr] = useState<string | null>(null);
  const [fed, setFed] = useState<FedState>(refreshFed);
  const [fedBusy, setFedBusy] = useState(false);
  const [caps, setCaps] = useState<DelegationCapability[]>(["repo.write", "data.aggregate"]);
  const [maxC, setMaxC] = useState(5);
  const [winMax, setWinMax] = useState(2);
  const [grantDays, setGrantDays] = useState(30);
  const [xCap, setXCap] = useState<DelegationCapability>("repo.write");
  const [xTask, setXTask] = useState("Ship the release notes draft");
  const [regDomains, setRegDomains] = useState(REGULATED_DOMAIN_SLUGS[0] ?? "");
  const [regBy, setRegBy] = useState("");
  const [regJur, setRegJur] = useState("IN");
  const [regCtx, setRegCtx] = useState<"advisory" | "preparer" | "reviewer" | "operator">("preparer");
  const [regDays, setRegDays] = useState(90);

  /* ── MCP market state ── */
  const [mktStats, setMktStats] = useState(marketStats);
  const [installed, setInstalled] = useState(listInstalled);
  const [mktErr, setMktErr] = useState<string | null>(null);
  const [mktName, setMktName] = useState("");
  const [mktTransport, setMktTransport] = useState<"stdio" | "http">("http");
  const [mktUrl, setMktUrl] = useState("");
  const [mktCommand, setMktCommand] = useState("");
  const [mktArgs, setMktArgs] = useState("");
  const [mktEnv, setMktEnv] = useState("");
  const [mktExport, setMktExport] = useState<string | null>(null);

  const withBusy = async (fn: () => Promise<void>) => { setFedBusy(true); try { await fn(); } catch (e) { setFed({ ...refreshFed(), err: String(e) }); } finally { setFedBusy(false); } };

  const doIssueGrant = () => withBusy(async () => {
    const r = await issueLiveGrant({
      capabilities: caps, maxCrossings: maxC, windowMs: 24 * 3600 * 1000, windowMax: winMax,
      expiresInMs: grantDays * 24 * 3600 * 1000, initiatorHuman: ownerA.trim(), responderHuman: ownerB.trim(),
    });
    setFed(r.ok ? refreshFed() : { ...refreshFed(), err: r.refusal ?? "grant refused" });
  });
  const doRevokeGrant = () => withBusy(async () => {
    revokeLiveGrant("initiator", ownerA.trim(), "owner revoked at the console");
    setFed(refreshFed());
  });
  const doRunCrossing = () => withBusy(async () => {
    const r = await runLiveCrossing({ capability: xCap, task: xTask, ownerA: ownerA.trim(), ownerB: ownerB.trim() });
    setFed({ ...refreshFed(), last: r.outcome });
  });
  const doEnableRegulated = () => withBusy(async () => {
    const r = await enableRegulatedBench({
      domains: regDomains.split(",").map((s) => s.trim()).filter(Boolean),
      enabledBy: regBy.trim(), jurisdiction: regJur.trim(), context: regCtx,
      renewBy: Date.now() + regDays * 24 * 3600 * 1000,
    });
    setFed(r.ok ? refreshFed() : { ...refreshFed(), err: r.refusal ?? "activation refused" });
  });

  useEffect(() => { document.documentElement.classList.add("nx"); return () => { document.documentElement.classList.remove("nx"); }; }, []);
  useEffect(() => { streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight }); }, [msgs, busy]);

  const gateFn = (ask: GateAsk): Promise<GateDecision> => {
    const ruled = answerGateWithRules(ask);
    if (ruled) return Promise.resolve(ruled);
    return new Promise<GateDecision>((resolve) => setGateAsk({ ask, resolve }));
  };

  const mood = (): GeneralistMood => (gateAsk ? "gate" : busy ? "thinking" : msgs.length ? "idle" : "idle");

  const newChat = () => {
    chatSessionId.current = `chat-${Date.now().toString(36)}`;
    sessionStart.current = new Date().toISOString();
    setMsgs([]); setCrew([]); setCoord([]); setPendingRehydrate(null); setPanel("chat");
  };

  const continueSession = (id: string) => {
    const s = listSessions().find((x) => x.id === id);
    if (!s) return;
    setPendingRehydrate({ id: s.id, title: s.title });
    setPanel("chat");
    setInput((v) => v || `Picking up where we left off — `);
  };

  const refreshSessions = () => { setSessions(listSessions()); setMktStats(marketStats()); };

  const doRecall = (text: string) => {
    const hits = recall(text, 1);
    if (hits.length === 0) return null;
    const looksReferential = /\b(remember|that day|last time|we discussed|earlier|continue|pick up|history|before)\b/i.test(text) || hits[0].dateMatch;
    return looksReferential && hits[0].score >= 3 ? hits[0] : null;
  };

  const send = async (forced?: string) => {
    const text = (forced ?? input).trim();
    if (!text || busy) return;
    setInput(""); setBusy(true);
    seq.current += 1;
    const userAt = new Date().toISOString();

    /* rehydration: an explicit "continue" chip wins; else a referential
       query ("that day when X…") recalls by keywords + date. The rehydrated
       block is MARKED inside the text — never a silent injection. */
    let sentText = text;
    let rehydratedFrom: string | null = null;
    const hit = doRecall(text);
    const useId = pendingRehydrate ? pendingRehydrate.id : hit ? hit.session.id : null;
    if (useId) {
      const r = rehydrate(useId);
      if (r) {
        sentText = `${r.preamble}\n\n${text}`;
        rehydratedFrom = r.session.title;
      }
    }

    setMsgs((m) => [...m, { id: seq.current, role: "user", text, at: userAt, rehydratedFrom: rehydratedFrom ?? undefined }]);
    try {
      const snap = wireEventSeq();
      const resp = await askVH19(
        { text: sentText, userId: USER },
        {
          provider,
          gate: gateFn,
          onHandoff: (h) => { recordHandoff(h); setHandoffs(listHandoffs()); },
          evidenceFetch: typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined,
        },
      );
      const delta = optimDelta(snap);
      seq.current += 1;
      const vhAt = new Date().toISOString();
      setMsgs((m) => [...m, { id: seq.current, role: "vh" as const, text: resp.reply, at: vhAt, resp, tok: delta.calls > 0 ? delta : undefined }]);
      if (delta.savedTokens > 0) setSavedAcc((v) => v + delta.savedTokens);
      setPendingRehydrate(null);
      setCrew(teammatesFromResponse(resp));
      setCoord(coordinationFeed(resp));
      /* self-set initiative: a run that ended blocked/gated leaves a CAPPED
         verify check-back on the heartbeat (level 2+; refused silently at 0/1) */
      if (resp.outcome === "gated-out") {
        const r = scheduleFollowUp("verify", `re-check: ${text.slice(0, 72)}`, Date.now() + HEARTBEAT_DEFAULT_MS, 1);
        if (r.ok) {
          const cur = loadInitiative();
          initiativeRef.current = cur;
          setInitiative({ ...cur });
          setMsgs((m) => [...m, { id: (seq.current += 1), role: "vh", text: `Initiative: I left a capped check-back on the heartbeat for "${text.slice(0, 60)}" — level ${cur.level >= 2 ? cur.level : cur.level + " (schedules from level 2; this one waits)"}`, at: new Date().toISOString() }]);
        }
      }
    } catch (e) {
      reportFailure(loadInitiative());
      initiativeRef.current = loadInitiative();
      seq.current += 1;
      setMsgs((m) => [...m, { id: seq.current, role: "vh", text: `The run failed before it could answer — ${String(e)}\nInitiative: the failure fed the circuit breaker (3 straight failures park autonomous work for an hour).`, at: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  };

  /* 19.7.0 — the memory-graph ingest rides a post-render effect: every turn
   * the conversation grows, the session is upserted (idempotent by design)
   * and the rail re-reads the graph. Ordering is guaranteed here — inside
   * the setMsgs updater it ran after the rail refresh and the conversations
   * section lagged one turn behind (observed). */
  useEffect(() => {
    if (msgs.length === 0) return;
    const all: MgMessage[] = msgs.map((x) => ({ role: x.role, text: x.text, at: x.at }));
    ingestSession(all, { id: chatSessionId.current, startedAt: sessionStart.current });
    setSessions(listSessions());
  }, [msgs]);

  const installFromCatalog = (id: string) => {
    const c = catalogServers().find((x) => x.id === id);
    if (!c) return;
    setMktErr(null);
    const r = installServer({
      name: c.name, transport: c.transport, command: c.command, args: c.args, url: c.url, envNames: c.envNames, fromCatalogId: c.id, note: c.description,
    });
    if (!r.ok) setMktErr(r.refusal);
    setInstalled(listInstalled()); setMktStats(marketStats());
  };
  const doInstallCustom = () => {
    setMktErr(null);
    const r = installServer({
      name: mktName, transport: mktTransport, command: mktTransport === "stdio" ? mktCommand : undefined,
      args: mktTransport === "stdio" ? mktArgs.split(/\s+/).filter(Boolean) : undefined,
      url: mktTransport === "http" ? mktUrl : undefined,
      envNames: mktEnv.split(",").map((s) => s.trim()).filter(Boolean),
    });
    if (!r.ok) setMktErr(r.refusal); else { setMktName(""); setMktUrl(""); setMktCommand(""); setMktArgs(""); setMktEnv(""); }
    setInstalled(listInstalled()); setMktStats(marketStats());
  };

  function memoryFactsCount(): number {
  try { const st = graphStats(); return st.nodes + st.edges; } catch { return 0; }
}

/* ── 19.7.2.1 [Agent] — the interactive 3D memory graph ───────────────
   Glossy-black spheres with silver-grey speculars over the noir ground;
   drag to rotate (with inertia), wheel/pinch to zoom, idle auto-rotation
   that yields to the hand. Zero dependencies — engine in vh19/graph3d. */
function Graph3DView({ nodes, edges, heightPx }: { nodes: G3Node[]; edges: G3Edge[]; heightPx?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current || nodes.length === 0) return;
    const engine = new Graph3D(ref.current, { nodes, edges, heightPx });
    return () => engine.dispose();
  }, [nodes, edges, heightPx]);
  if (nodes.length === 0) {
    return (
      <div className="nx-graphwrap flex items-center justify-center" style={{ height: heightPx ?? 320 }}>
        <span className="nx-mute text-[12px]">no graph yet — your conversations grow it as you work</span>
      </div>
    );
  }
  return (
    <div className="nx-graphwrap" data-graph3d="true">
      <canvas ref={ref} style={{ width: "100%", height: (heightPx ?? 320) + "px", display: "block", borderRadius: 12, background: "#0b0c10", touchAction: "none", cursor: "grab" }} />
      <div className="mt-1 text-[11px] nx-dim">drag to rotate · scroll to zoom · it keeps turning on its own — rendered live in 3D, zero dependencies</div>
    </div>
  );
}

/* 19.7.1 — the mission strip: the Steward's last run as the center of
     gravity — authority, evidence, cost, in one calm row (review feedback). */
  const lastResp = [...msgs].reverse().find((m) => m.role === "vh" && m.resp)?.resp;
  const lastTok = [...msgs].reverse().find((m) => m.role === "vh" && m.tok)?.tok;
  const missionCrew = (lastResp?.specialistIds ?? []).map((id) => getSpecialist(id)?.name ?? id).slice(0, 4);
  const evidenceCount = (lastResp?.memberRuns ?? []).reduce((acc, r) => acc + r.toolReceipts.length, 0);

  const crewRows = crew.length ? crew : [{
    id: "vh19-chief-steward", name: gName, role: "front door · routing · synthesis", status: "idle" as const,
    queue: [], context: [], workspace: "", traceDigests: [],
  }];

  const gv = panel === "memory" ? graphView(24) : null;
  const gs = panel === "memory" ? graphStats() : null;

  return (
    <div className="nx-shell">
      {/* ── left rail ─────────────────────────────────────────────────── */}
      <aside className="nx-sidebar">
        <div className="nx-brandrow">
          <GeneralistFace mood={mood()} size={30} name={gName} />
          <span className="nx-h1 truncate">{gName}</span>
        </div>
        <button className="nx-newchat" onClick={newChat}>＋ New chat</button>

        {sessions.length > 0 && <div className="nx-sec">Conversations</div>}
        {sessions.slice(0, 12).map((s) => (
          <div key={s.id} className="nx-side-item" data-active={pendingRehydrate?.id === s.id} onClick={() => continueSession(s.id)} title={`${s.title} — ${s.messageCount} messages`}>
            <span className="nx-face"><SpecialistFace id={s.id} size={22} /></span>
            <span className="nx-sess">
              <span className="t">{s.title}</span>
              <span className="k">{s.startedAt.slice(0, 10)} · {s.keywords.slice(0, 3).join(" · ")}</span>
            </span>
          </div>
        ))}

        <div className="nx-sec">Crew</div>
        <div className="nx-side-item" data-active={panel === "workspace"} onClick={() => setPanel("workspace")}>
          <GeneralistFace name={gName} size={28} animate={false} />
          <div className="min-w-0">
            <div className="text-[13px] text-[color:var(--color-nx-ink)] truncate">Crew workspace</div>
            <div className="text-[11px] nx-mute truncate">up to {CREW_MAX} specialists · one governed crew</div>
          </div>
        </div>
        {crewRows.map((t) => (
          <div key={t.id} className="nx-side-item" data-active={panel === "crew"} onClick={() => setPanel("crew")}>
            {t.id === "vh19-chief-steward"
              ? <GeneralistFace name={gName} size={28} animate={false} />
              : <span className="nx-face"><SpecialistFace id={t.id} size={28} /></span>}
            <div className="min-w-0">
              <div className="text-[13px] text-[color:var(--color-nx-ink)] truncate">{t.name}</div>
              <div className="text-[11px] nx-mute truncate">{t.status}{t.role ? ` · ${t.role}` : ""}</div>
            </div>
          </div>
        ))}

        <div className="mt-auto flex flex-col gap-1">
          <div className="nx-sec">Planes</div>
          <div className="nx-side-item" data-active={panel === "chat"} onClick={() => setPanel("chat")}>Run stream</div>
          <div className="nx-sec nx-sec-infra">Infrastructure</div>
          <div className="nx-side-item nx-infra" data-active={panel === "memory"} onClick={() => { refreshSessions(); setPanel("memory"); }}>Memory graphs</div>
          <div className="nx-side-item nx-infra" data-active={panel === "market"} onClick={() => { setInstalled(listInstalled()); setMktStats(marketStats()); setPanel("market"); }}>MCP market</div>
          <div className="nx-side-item nx-infra" data-active={panel === "ledger"} onClick={() => { setHandoffs(listHandoffs()); setPanel("ledger"); }}>Handoff ledger</div>
          <div className="nx-side-item nx-infra" data-active={panel === "fed"} onClick={() => { setFed(refreshFed()); setPanel("fed"); }}>Federation</div>
          <div className="nx-side-item nx-infra" data-active={panel === "provider"} onClick={() => setPanel("provider")}>Model provider</div>
          <div className="nx-side-item nx-infra" data-active={panel === "settings"} onClick={() => setPanel("settings")}>Settings</div>
          <div className="nx-side-item nx-infra" onClick={() => setRenaming((r) => !r)}>
            Rename Steward
          </div>
          {renaming && (
            <input
              className="nx-input panel-input"
              placeholder={gName}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const v = setGeneralistName((e.target as HTMLInputElement).value);
                setGName(v); setRenaming(false);
              }}
            />
          )}
        </div>
      </aside>

      {/* ── main column ───────────────────────────────────────────────── */}
      <main className="nx-main">
        <header className="nx-topbar">
          <GeneralistFace mood={mood()} size={34} name={gName} />
          <div className="min-w-0">
            <div className="nx-h1 truncate">{gName}</div>
            <div className="text-[11.5px] nx-mute truncate">
              {provider
                ? `model connected · ${provider.kind}${provider.model ? ` · ${provider.model}` : ""}`
                : <>plan-only — nothing executes without a provider · <button className="nx-mute underline decoration-dotted underline-offset-2 cursor-pointer" onClick={() => setPanel("provider")}>connect one</button></>}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {savedAcc > 0 && tokChip({ calls: 0, beforeTokens: 0, afterTokens: 0, savedTokens: savedAcc, savedPct: 0, normalizedChars: 0, collapsedLines: 0, cacheAligned: false, prefixTokens: 0, budgetTrimmed: false, est: true })}
            {busy && pill("thinking")}
            {gateAsk && pill("gated")}
          </div>
        </header>

        {gateAsk && (
          <div className="nx-gate">
            <span className="font-medium text-[color:var(--color-nx-warn)]">HUMAN GATE</span>{" "}
            — {gateAsk.ask.action}: {gateAsk.ask.summary}
            <div className="mt-2 flex gap-2">
              <button className="nx-chip !text-[color:var(--color-nx-ok)]" onClick={() => { gateAsk.resolve({ approved: true }); setGateAsk(null); }}>Approve</button>
              <button className="nx-chip !text-[color:var(--color-nx-err)]" onClick={() => { gateAsk.resolve({ approved: false, reason: "owner denied at the console" }); setGateAsk(null); }}>Deny</button>
            </div>
          </div>
        )}

        {lastResp && panel === "chat" && !gateAsk && (
          <div className="nx-mission" data-state={lastResp.outcome}>
            <div className="nx-mission-hd">
              <span className="nx-face"><GeneralistFace mood={busy ? "thinking" : "idle"} size={22} name={gName} animate={false} /></span>
              <span className="nx-mission-t">current mission</span>
              {pill(lastResp.outcome)}
              {lastResp.executed && pill("done")}
            </div>
            {missionCrew.length > 0 && (
              <div className="nx-mission-crew">{missionCrew.map((n, i) => <span key={i} className="nx-mission-member">{i === 0 ? "├" : i === missionCrew.length - 1 ? "└" : "├"} {n}</span>)}</div>
            )}
            <div className="nx-mission-row">
              <span title={lastResp.authority ? `ECDSA mandate ${String((lastResp.authority as { mandateDigest?: string }).mandateDigest ?? "").slice(0, 24)}…` : "plan-only — nothing executed, stated"}>
                <b>Authority</b> {lastResp.authority ? "✓ mandate signed" : lastResp.executed ? "✓ approved" : "— plan-only"}
              </span>
              <span><b>Evidence</b> {(lastResp.provenanceDigest ?? "").slice(0, 8)}…{evidenceCount > 0 ? ` · ${evidenceCount} receipt${evidenceCount === 1 ? "" : "s"}` : ""}</span>
              <span className="nx-tok" title="estimates, labelled as estimates">Cost ⚡ {lastTok ? `−${lastTok.savedTokens} tok` : `${lastResp.memberRuns?.reduce((a, r) => a + r.providerCalls, 0) ?? 0} call(s)`}</span>
            </div>
          </div>
        )}

        {panel === "chat" && (
          <>
            <div className="nx-stream" ref={streamRef}>
              {msgs.length === 0 && (
                <div className="nx-hero">
                  <div className="halo"><GeneralistFace mood="idle" size={84} name={gName} /></div>
                  <h1>Hey, I'm <em>{gName}</em></h1>
                  <div className="sub">
                    {provider
                      ? "Give me an outcome. I route it to the right specialists, work the tools, and show my evidence — receipts on every step."
                      : "Give me an outcome and I'll plan it with the right specialists. Connect a provider and the same work executes with tools, gates and receipts."}
                  </div>
                  <div className="nx-cards">
                    <div className="nx-card" onClick={() => setInput("Draft the plan for my project: milestones, owners, risks, and what you would verify at each step.")}>
                      <div className="c1">Draft a plan with the crew</div>
                      <div className="c2">Milestones, owners, risks — routed to the right specialists, evidence on every step.</div>
                    </div>
                    <div className="nx-card" onClick={() => void send("What conversations do you remember with me, and what were their key topics?")}>
                      <div className="c1">Ask what I remember</div>
                      <div className="c2">Your chats live here as keyword graphs — recall one by topic or by day.</div>
                    </div>
                    <div className="nx-card" onClick={() => void send("In plain words: what happens when no provider key is configured, what pauses at the human gate, and what do your receipts prove?")}>
                      <div className="c1">Interrogate the honesty contract</div>
                      <div className="c2">What executes, what refuses, what pauses — stated, never hidden.</div>
                    </div>
                    <div className="nx-card" onClick={() => void send("Draft a token-light plan to research, write and review a launch announcement — show the estimated token cost at each step.")}>
                      <div className="c1">Plan a token-light workflow</div>
                      <div className="c2">The wire optimizer rides every call; watch the savings ride every reply.</div>
                    </div>
                  </div>
                </div>
              )}
              {msgs.map((m) => (
                <div key={m.id} className="nx-msgrow" data-who={m.role}>
                  <span className="nx-face" style={{ marginTop: 2 }}>
                    {m.role === "vh"
                      ? <GeneralistFace mood={busy ? "thinking" : "idle"} size={30} name={gName} animate={false} />
                      : <SpecialistFace id={USER} size={30} />}
                  </span>
                  <div className="nx-bubble" data-who={m.role} style={{ maxWidth: "min(780px, 100%)" }}>
                    <div className="nx-msgmeta">
                      <span>{m.role === "vh" ? gName : "you"}</span>
                      <span>{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {m.rehydratedFrom && <span className="nx-tok" title="a marked rehydrated context block from the memory graph was attached to this message">↻ rehydrated “{m.rehydratedFrom.slice(0, 28)}{m.rehydratedFrom.length > 28 ? "…" : ""}”</span>}
                    </div>
                    <div className="nx-msgbody">{m.text}</div>
                    {m.resp && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {pill(m.resp.outcome)}
                        {m.resp.executed && pill("done")}
                        {m.tok && m.tok.calls > 0 && tokChip(m.tok)}
                        <span className="nx-digest">provenance {m.resp.provenanceDigest.slice(0, 12)}…</span>
                        {m.resp.authority && <span className="nx-digest">ECDSA mandate {String((m.resp.authority as { mandateDigest?: string }).mandateDigest ?? "").slice(0, 12)}…</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="nx-msgrow" data-who="vh">
                  <span className="nx-face" style={{ marginTop: 2 }}><GeneralistFace mood="thinking" size={30} name={gName} animate={false} /></span>
                  <div className="nx-bubble nx-typing"><i></i><i></i><i></i></div>
                </div>
              )}
              {coord.length > 0 && panel === "chat" && (
                <div className="flex flex-col gap-1">
                  {coord.slice(-4).map((l, i) => <div key={i} className="text-[11.5px] nx-mute">· {l}</div>)}
                </div>
              )}
            </div>
            <div className="nx-inputbar">
              {pendingRehydrate && (
                <div className="mb-2 flex items-center gap-2 text-[12px] nx-mute">
                  <span className="nx-tok">↻ continuing “{pendingRehydrate.title.slice(0, 34)}{pendingRehydrate.title.length > 34 ? "…" : ""}”</span>
                  <button className="nx-chip" onClick={() => setPendingRehydrate(null)}>detach</button>
                </div>
              )}
              <div className="nx-composer">
                <input
                  className="nx-input"
                  placeholder={msgs.length === 0 ? "What do you want done?" : `Message ${gName}`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
                />
                <button className="nx-send" disabled={busy || !input.trim()} onClick={() => void send()} aria-label="send" title="send (Enter)">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
              <div className="nx-hint">Enter to send · evidence and token estimates ride every reply</div>
            </div>
          </>
        )}

        {panel === "memory" && (
          <div className="nx-stream">
            <div className="nx-panelcard">
              <div className="flex flex-wrap items-center gap-2">
                <span className="nx-h1 text-[14px]">Memory graphs</span>
                {gs && pill(`${gs.sessions} sessions`)}
                {gs && pill(`${gs.nodes} keywords`)}
                {gs && pill(`${gs.edges} links`)}
              </div>
              <div className="mt-1 text-[12.5px] nx-mute">
                Every conversation becomes a graph: keywords as nodes, co-occurrence as edges, sessions as the dated
                transcript. Ask in the run stream — “what happened that day about X” — and the graph rehydrates it,
                marked, into the crew's context. Storage is local-first; clearing it is one click and total.
              </div>
              <div className="mt-3 rounded-[10px] border border-[color:var(--color-nx-line)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="nx-h1 text-[12.5px]">At rest</span>
                  {(() => { const sec = graphSecurityStatus(); return pill(sec.mode === "sealed" ? "encrypted · AES-256-GCM" : sec.mode === "locked" ? "sealed · locked" : "unencrypted"); })()}
                  <button className="nx-chip" data-on={memOn} onClick={() => { setMemoryEnabled(!memOn); setMemOn(!memOn); }}>{memOn ? "memory ON" : "memory OFF"}</button>
                  <button className="nx-chip" onClick={() => setPanel("settings")}>Settings →</button>
                </div>
                <div className="mt-1 text-[11.5px] nx-mute">
                  {graphSecurityStatus().mode === "sealed"
                    ? "The graph seals with AES-256-GCM under your vault passphrase — storage holds ciphertext only."
                    : graphSecurityStatus().mode === "locked"
                      ? "A sealed graph exists but the vault is locked — unlock in Settings to load it."
                      : "No vault yet, so the graph persists unencrypted on this machine. Settings → create the vault to seal it."}
                </div>
              </div>
            </div>

            <Graph3DView
                nodes={(gv?.nodes ?? []).map((n) => ({ id: n.id, label: n.label, weight: n.weight, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }))}
                edges={(gv?.edges ?? []).map((e) => ({ a: e.a, b: e.b, weight: e.weight }))}
                heightPx={340}
              />

            {sessions.length === 0 && (
              <div className="nx-bubble nx-mute">No conversations yet — every chat lands here as a rehydratable graph session.</div>
            )}
            {sessions.map((s) => (
              <div key={s.id} className="nx-bubble">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="nx-h1">{s.title}</span>
                  {pill(`${s.messageCount} msgs`)}
                  <span className="nx-digest">{s.startedAt.slice(0, 10)} → {s.endedAt.slice(0, 10)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">{s.keywords.map((k) => <span key={k} className="nx-chip">{k}</span>)}</div>
                <div className="mt-3 flex gap-2">
                  <button className="nx-chip !text-[color:var(--color-nx-ok)]" onClick={() => continueSession(s.id)}>↻ Continue this conversation</button>
                  <button className="nx-chip !text-[color:var(--color-nx-err)]" onClick={() => { deleteSession(s.id); refreshSessions(); }}>forget</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {panel === "market" && (
          <div className="nx-stream">
            <div className="nx-panelcard">
              <div className="flex flex-wrap items-center gap-2">
                <span className="nx-h1 text-[14px]">MCP market</span>
                {pill(`${mktStats.catalog} curated`)}
                {pill(`${mktStats.installed} installed`)}
                {pill(`${mktStats.enabled} enabled`)}
              </div>
              <div className="mt-1 text-[12.5px] nx-mute">
                Add ANY Model Context Protocol server you want. Install from the curated catalog or register your own
                (command or URL). HTTP URLs pass the same SSRF egress guard as every provider call. Env keys are
                recorded BY NAME only.
              </div>
              <div className="mt-2 rounded-[10px] border border-[color:var(--color-nx-line)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="nx-h1 text-[12.5px]">Runtime</span>
                  {(() => { const rs = mcpRuntimeStats(); return <>
                    {pill(rs.enabled > 0 ? `${rs.enabled} server(s) LIVE in the tool surface` : "no servers live")}
                    {rs.enabled > 0 && pill(`${rs.http} http · ${rs.stdio} stdio`)}
                  </>; })()}
                </div>
                <div className="mt-1 text-[11.5px] nx-mute">
                  Enabled servers ride the governed pipeline as the <code style={{ fontFamily: "var(--font-nx-mono)" }}>mcp.call</code> tool:
                  policy review (the egress guard, again, at runtime) → the agent loop's tool protocol → the human gate (risky tier) → execution → receipt.
                  HTTP servers answer real JSON-RPC; stdio servers execute under the host bridge (desktop shell / tools/mcp.mjs — the export below is its config), never secretly from this page.
                </div>
                {mcpRuntimeServers().length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {mcpRuntimeServers().map((srv: McpToolSurfaceEntry) => <span key={srv.serverId} className="nx-chip" data-on="true">{srv.serverId}</span>)}
                  </div>
                )}
              </div>
            </div>

            <div className="nx-panelcard">
              <div className="nx-h1 text-[13px]">Curated catalog</div>
              <div className="nx-mkt mt-3">
                {catalogServers().map((c) => {
                  const has = installed.some((r) => r.id === c.id);
                  return (
                    <div key={c.id} className="nx-mktcard">
                      <div className="flex items-center gap-2"><span className="nm">{c.name}</span>{pill(c.transport)}</div>
                      <div className="ds">{c.description}</div>
                      <div className="mt">{c.transport === "stdio" ? `${c.command} ${(c.args ?? []).join(" ")}` : c.url}</div>
                      <button className="nx-chip mt-1" data-on={has} disabled={has} onClick={() => installFromCatalog(c.id)}>{has ? "installed ✓" : "install"}</button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="nx-panelcard">
              <div className="nx-h1 text-[13px]">Register your own</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input className="nx-input panel-input" value={mktName} onChange={(e) => setMktName(e.target.value)} placeholder="server name" />
                <select className="nx-input panel-input" value={mktTransport} onChange={(e) => setMktTransport(e.target.value as "stdio" | "http")}>
                  <option value="http">HTTP / streamable URL</option>
                  <option value="stdio">stdio command</option>
                </select>
                {mktTransport === "http"
                  ? <input className="nx-input panel-input" value={mktUrl} onChange={(e) => setMktUrl(e.target.value)} placeholder="https://host/mcp" />
                  : <input className="nx-input panel-input" value={mktCommand} onChange={(e) => setMktCommand(e.target.value)} placeholder="npx / uvx / node …" />}
                {mktTransport === "stdio" && <input className="nx-input panel-input" value={mktArgs} onChange={(e) => setMktArgs(e.target.value)} placeholder="args (space-separated)" />}
                <input className="nx-input panel-input" value={mktEnv} onChange={(e) => setMktEnv(e.target.value)} placeholder="env var NAMES it needs (comma-separated)" />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="nx-chip !text-[color:var(--color-nx-ok)]" onClick={doInstallCustom}>register server</button>
                <button className="nx-chip" onClick={() => setMktExport(JSON.stringify(exportMcpJson(), null, 2))}>export mcpServers JSON</button>
              </div>
              {mktErr && <div className="mt-2 text-[12.5px] text-[color:var(--color-nx-err)]">{mktErr}</div>}
              {mktExport && (
                <pre className="mt-3 rounded-[10px] border border-[color:var(--color-nx-line)] p-3 text-[11px] overflow-auto" style={{ fontFamily: "var(--font-nx-mono)" }}>{mktExport}</pre>
              )}
            </div>

            {installed.length > 0 && (
              <div className="nx-panelcard">
                <div className="nx-h1 text-[13px]">Installed</div>
                <div className="mt-2 flex flex-col gap-2">
                  {installed.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-2">
                      <span className="nx-face"><SpecialistFace id={r.id} size={22} /></span>
                      <span className="text-[13px]">{r.name}</span>
                      {pill(r.transport)}
                      <button className="nx-chip" data-on={r.enabled} onClick={() => { setServerEnabled(r.id, !r.enabled); setInstalled(listInstalled()); setMktStats(marketStats()); }}>{r.enabled ? "enabled" : "disabled"}</button>
                      <span className="nx-digest">{r.transport === "http" ? r.url : `${r.command} ${(r.args ?? []).join(" ")}`}</span>
                      {r.envNames && r.envNames.length > 0 && <span className="nx-digest">env: {r.envNames.join(", ")}</span>}
                      <button className="nx-chip !text-[color:var(--color-nx-err)]" onClick={() => { uninstallServer(r.id); setInstalled(listInstalled()); setMktStats(marketStats()); }}>remove</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {panel === "crew" && (
          <div className="nx-stream">
            {crew.length === 0 ? (
              <div className="nx-bubble nx-mute">No crew yet — send a task and the routed specialists appear here.</div>
            ) : crew.map((t) => (
              <div key={t.id} className="nx-bubble">
                <div className="flex items-center gap-3">
                  {t.id === "vh19-chief-steward"
                    ? <GeneralistFace name={gName} size={34} animate={false} />
                    : <span className="nx-face"><SpecialistFace id={t.id} size={34} /></span>}
                  <div className="nx-h1">{t.name}</div>
                  {pill(t.status)}
                  <span className="nx-mute text-[12px]">{t.role}</span>
                </div>
                {t.queue.length > 0 && <div className="mt-2 text-[12.5px] nx-mute">{t.queue.join(" · ")}</div>}
                <div className="mt-2 flex flex-wrap gap-1">{t.context.map((c) => <span key={c} className="nx-chip">{c}</span>)}</div>
                <div className="mt-2 nx-digest">{t.workspace}</div>
                {t.authorityNote && <div className="mt-1 nx-digest">{t.authorityNote}</div>}
                {t.traceDigests.slice(0, 2).map((d) => <div key={d} className="nx-digest">trace digest {d.slice(0, 12)}…</div>)}
              </div>
            ))}
          </div>
        )}

        {panel === "workspace" && (() => {
          void wsTick; // the ticker re-reads live crew state below
          const ws = wsSessionId ? getCrewSession(wsSessionId) : null;
          return (
          <div className="nx-stream">
            <div className="nx-bubble">
              <div className="flex flex-wrap items-center gap-2">
                <span className="nx-h1 text-[14px]">Crew workspace</span>
                {pill(ws ? ws.status : "idle")}
                <span className="nx-mute text-[12px]">up to {CREW_MAX} specialists · one governed crew</span>
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  className="nx-input panel-input"
                  value={wsTask}
                  onChange={(e) => setWsTask(e.target.value)}
                  placeholder="Give the crew a task — e.g. build an app: frontend, backend, database, security…"
                />
                {/* 19.7.4 review fix — the muster and the run are TWO steps.
                    Manual mode gates every member at muster; the run starts
                    only when the owner presses Run with a crew to field. */}
                {!ws ? (
                  <button
                    className="nx-chip !text-[color:var(--color-nx-ok)]"
                    disabled={wsBusy || !provider || !wsTask.trim()}
                    onClick={() => {
                      if (!provider || !wsTask.trim() || wsBusy) return;
                      const s = createCrewSession(wsTask.trim(), { mode: "manual" });
                      setWsSessionId(s.id);
                      setWsErr(null);
                      setWsTick((n) => n + 1);
                    }}
                  >
                    Muster the crew
                  </button>
                ) : (
                  <>
                    <button
                      className="nx-chip !text-[color:var(--color-nx-ok)]"
                      disabled={wsBusy || !provider || ws.slots.every((x) => x.status !== "queued")}
                      onClick={() => {
                        if (!provider || wsBusy) return;
                        setWsErr(null);
                        setWsBusy(true);
                        void runCrewSession(ws.id, { provider })
                          .catch((e: unknown) => setWsErr(e instanceof Error ? e.message : String(e)))
                          .finally(() => { setWsBusy(false); setWsTick((n) => n + 1); });
                      }}
                    >
                      {wsBusy ? "the crew is working…" : "Run the crew"}
                    </button>
                    <button
                      className="nx-chip"
                      disabled={wsBusy}
                      onClick={() => { setWsSessionId(null); setWsTask(""); setWsTick((n) => n + 1); }}
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
              {!provider && <div className="mt-1 text-[12px] nx-mute">no provider key connected — nothing will execute. Connect one in the provider panel.</div>}
              {ws && ws.status === "awaiting-gate" && (
                <div className="mt-1 text-[12px] nx-mute">manual mode: approve or refuse your crew below — the run never starts itself. Switch mode to open safe members without asking.</div>
              )}
              {wsErr && <div className="mt-1 text-[12px] text-[color:var(--color-nx-err)]">{wsErr}</div>}
              {ws && (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="nx-mute text-[12px]">mode</span>
                    {CREW_MODES.map((m: CrewMode) => (
                      <button
                        key={m}
                        className="nx-chip"
                        data-on={ws.mode.mode === m}
                        onClick={() => {
                          const r = switchMode(ws.id, m);
                          if (!r.ok && r.line) setWsErr(r.line);
                          setWsTick((n) => n + 1);
                        }}
                      >
                        {CREW_MODE_LABELS[m]}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 text-[12px] nx-mute">
                    {ws.feed.events.filter((e) => e.kind === "mode-switched").slice(-1)[0]?.line ?? "switch any time — in-flight acts finish under the mode that admitted them"}
                  </div>
                  <div className="mt-1 nx-digest">{moeV2Line(ws.selection)}</div>
                  <div className="mt-1 nx-digest">{lotusLine(lotusReport())}</div>
                  <div className="mt-1 text-[12.5px] nx-mute">{crewBriefing(ws)}</div>
                </>
              )}
            </div>
            {ws && (
              <div className="nx-bubble">
                <div className="nx-h1 text-[14px]">The roster</div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ws.slots.map((s) => (
                    <div key={s.slotId} className="nx-chip !normal-case !tracking-normal flex flex-col items-start gap-1" style={{ background: "var(--bg-panel)" }}>
                      <div className="flex items-center gap-2">
                        <span className="nx-face"><SpecialistFace id={s.specialistId} size={22} /></span>
                        <span className="text-[12.5px]">{getSpecialist(s.specialistId)?.name ?? s.specialistId}</span>
                        {pill(s.status)}
                      </div>
                      <div className="text-[11px] nx-mute">
                        {s.domain} · attempt {s.attempts}{s.bewPhases ? ` · bew ${s.bewPhases} · ${s.verdict}` : ""}
                      </div>
                      {s.gateAsk && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[11px] nx-mute">{s.gateAsk}</span>
                          <button className="nx-chip !text-[color:var(--color-nx-ok)]" onClick={() => { resolveGate(ws.id, s.slotId, true); setWsTick((n) => n + 1); }}>approve</button>
                          <button className="nx-chip !text-[color:var(--color-nx-err)]" onClick={() => { resolveGate(ws.id, s.slotId, false); setWsTick((n) => n + 1); }}>refuse</button>
                        </div>
                      )}
                      {s.answerPreview && <div className="nx-digest">{s.answerPreview}</div>}
                      {s.memberDigest && <div className="nx-digest">member receipt {s.memberDigest.slice(0, 12)}…</div>}
                      {s.replacedBy && <div className="nx-digest">replaced by {s.replacedBy}</div>}
                      {s.error && <div className="nx-digest">{s.error}</div>}
                    </div>
                  ))}
                </div>
                {ws.sessionReceipt && <div className="mt-2 nx-digest">session receipt {ws.sessionReceipt.slice(0, 16)}…</div>}
              </div>
            )}
            {ws && ws.feed.events.length > 0 && (
              <div className="nx-bubble">
                <div className="nx-h1 text-[14px]">Steward feed</div>
                <div className="mt-2 flex flex-col gap-1">
                  {ws.feed.events.slice(-14).reverse().map((e, i) => (
                    <div key={`${e.at}-${i}`} className="text-[12px] nx-mute"><span className="nx-digest">{e.kind}</span> {e.line}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {panel === "ledger" && (
          <div className="nx-stream">
            {handoffs.length === 0 ? (
              <div className="nx-bubble nx-mute">No handoffs yet — every delegation attempt, including the refusals, lands here.</div>
            ) : handoffs.slice().reverse().map((h) => (
              <div key={h.id} className="nx-bubble">
                <div className="flex items-center gap-2">{pill(h.outcome)}<span className="text-[13px]">→ {h.peer}</span><span className="nx-digest">{h.taskDigest.slice(0, 32)}</span></div>
                <div className="mt-1 text-[12.5px] nx-mute">{h.detail}</div>
                {h.meshJointDigest && <div className="mt-1 nx-digest">co-signed joint receipt {h.meshJointDigest.slice(0, 12)}…</div>}
                {h.meshDetail && <div className="nx-digest">{h.meshDetail}</div>}
              </div>
            ))}
          </div>
        )}

        {panel === "fed" && (
          <div className="nx-stream">
            {/* standing authority status */}
            <div className="nx-bubble">
              <div className="flex flex-wrap items-center gap-2">
                <span className="nx-h1 text-[14px]">Standing authority</span>
                {pill(fed.grant ? "grant live" : "no grant")}
                {fed.activation ? pill("regulated bench enabled") : pill("regulated bench dormant")}
                {fedBusy && pill("working")}
              </div>
              <div className="mt-1 text-[12.5px] nx-mute">
                {fed.notice ?? "No standing grant on this machine. Crossings wait for one — or fall back to a per-crossing human decision. Autonomy never extends by inference."}
              </div>
              {fed.grant && (
                <div className="mt-1 nx-digest">
                  grant {fed.grant.grantId.slice(0, 18)}… · capabilities {fed.grant.capabilities.join(", ")} · expires {new Date(fed.grant.expiresAt).toISOString()}
                </div>
              )}
              {fed.err && <div className="mt-2 text-[12.5px] text-[color:var(--color-nx-err)]">{fed.err}</div>}
            </div>

            {/* issue / revoke the grant */}
            <div className="nx-bubble">
              <div className="nx-h1 text-[14px]">Issue a standing grant</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input className="nx-input panel-input" value={ownerA} onChange={(e) => setOwnerA(e.target.value)} placeholder="Initiator owner" />
                <input className="nx-input panel-input" value={ownerB} onChange={(e) => setOwnerB(e.target.value)} placeholder="Responder owner" />
                <input className="nx-input panel-input" type="number" min={1} value={maxC} onChange={(e) => setMaxC(Math.max(1, Number(e.target.value) || 1))} aria-label="max crossings" title="total crossings allowed" />
                <input className="nx-input panel-input" type="number" min={1} value={winMax} onChange={(e) => setWinMax(Math.max(1, Number(e.target.value) || 1))} aria-label="window max" title="max crossings per 24h window" />
                <input className="nx-input panel-input" type="number" min={1} value={grantDays} onChange={(e) => setGrantDays(Math.max(1, Number(e.target.value) || 1))} aria-label="days" title="days until expiry" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {DELEGATION_CAPABILITIES.map((c) => (
                  <button key={c} className="nx-chip" data-on={caps.includes(c)} onClick={() => setCaps((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))}>{c}</button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="nx-chip !text-[color:var(--color-nx-ok)]" onClick={() => void doIssueGrant()}>Sign &amp; issue with the owner key</button>
                {fed.grant && <button className="nx-chip !text-[color:var(--color-nx-err)]" onClick={() => void doRevokeGrant()}>Revoke now</button>}
              </div>
            </div>

            {/* run a crossing */}
            <div className="nx-bubble">
              <div className="nx-h1 text-[14px]">Run a live crossing</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
                <select className="nx-input panel-input" value={xCap} onChange={(e) => setXCap(e.target.value as DelegationCapability)}>
                  {DELEGATION_CAPABILITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className="nx-input panel-input" value={xTask} onChange={(e) => setXTask(e.target.value)} placeholder="what is being asked, in words" />
              </div>
              <button className="nx-chip mt-2" onClick={() => void doRunCrossing()}>Cross under standing grant</button>
              {fed.last && (
                <div className="mt-3 rounded-[10px] border border-[color:var(--color-nx-line)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {pill(fed.last.status)}
                    <span className="text-[13px]">{fed.last.capability}</span>
                    <span className="text-[12px] nx-mute">{fed.last.reason}</span>
                    <span className="nx-digest">outcome {fed.last.digest.slice(0, 12)}…</span>
                  </div>
                  <div className="mt-1 text-[12.5px] nx-mute">{fed.last.detail}</div>
                  {fed.last.standing && (
                    <div className="mt-1 nx-digest">grant {fed.last.standing.grantDigest.slice(0, 12)}… · {fed.last.standing.notice}</div>
                  )}
                  {fed.last.commonLedger && (
                    <div className={"mt-1 text-[12px] " + (fed.last.commonLedger.record.agreed ? "text-[color:var(--color-nx-ok)]" : "text-[color:var(--color-nx-err)]")}>
                      roots {fed.last.commonLedger.record.agreed
                        ? "agree — both stores hold the same joint row"
                        : `diverge at ${fed.last.commonLedger.record.firstDivergence?.crossingId ?? "an unknown row"}`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* the common ledger */}
            <div className="nx-bubble">
              <div className="nx-h1 text-[14px]">Common ledger — both stores, compared</div>
              {fed.rows.length === 0 ? (
                <div className="mt-1 text-[12.5px] nx-mute">No joint rows yet. Every crossing both owners approved lands here on both sides, with its receipts and its root comparison.</div>
              ) : (
                <div className="mt-2 flex flex-col gap-1">
                  {fed.rows.slice().reverse().map((r) => (
                    <div key={r.crossingId + r.at} className="flex flex-wrap items-center gap-2 text-[12px]">
                      {pill(r.seenBy === "both" ? "both sides" : r.seenBy)}
                      {r.disagrees && pill("disagrees")}
                      <span className="nx-mute">{r.initiator?.capability ?? r.responder?.capability}</span>
                      <span className="nx-mute">{r.initiator?.decision ?? r.responder?.decision}</span>
                      <span className="nx-digest">{(r.initiator?.outcomeDigest ?? r.responder?.outcomeDigest ?? "").slice(0, 16)}…</span>
                      <span className="nx-mute">{new Date(r.at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* regulated activation */}
            <div className="nx-bubble">
              <div className="nx-h1 text-[14px]">Regulated bench activation</div>
              <div className="mt-1 text-[12.5px] nx-mute">
                Registered regulated specialists stay unrouted until this activation exists, signed and complete. A name is not an authorisation.
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input className="nx-input panel-input" value={regDomains} onChange={(e) => setRegDomains(e.target.value)} placeholder={`e.g. ${REGULATED_DOMAIN_SLUGS.slice(0, 2).join(", ")} — comma-separated`} />
                <input className="nx-input panel-input" value={regBy} onChange={(e) => setRegBy(e.target.value)} placeholder="enabled by (named person)" />
                <input className="nx-input panel-input" value={regJur} onChange={(e) => setRegJur(e.target.value)} placeholder="jurisdiction" />
                <select className="nx-input panel-input" value={regCtx} onChange={(e) => setRegCtx(e.target.value as typeof regCtx)}>
                  <option value="advisory">advisory</option>
                  <option value="preparer">preparer</option>
                  <option value="reviewer">reviewer</option>
                  <option value="operator">operator</option>
                </select>
                <input className="nx-input panel-input" type="number" min={1} value={regDays} onChange={(e) => setRegDays(Math.max(1, Number(e.target.value) || 1))} aria-label="renew days" title="days until renewal is due" />
              </div>
              <button className="nx-chip mt-2" onClick={() => void doEnableRegulated()}>Sign &amp; enable activation</button>
            </div>
          </div>
        )}

        {panel === "settings" && (
          <div className="nx-stream">
            {/* appearance */}
            <div className="nx-panelcard">
              <div className="nx-h1 text-[14px]">Appearance</div>
              <div className="mt-2 flex items-center gap-2">
                <button className="nx-chip" data-on={theme === "noir"} onClick={() => setTheme("noir")}>Noir</button>
                <button className="nx-chip" data-on={theme === "cream"} onClick={() => setTheme("cream")}>Cream Gray</button>
              </div>
              <div className="mt-1 text-[11.5px] nx-mute">Two finishes, one layout. Your choice stays on this machine.</div>
            </div>

            {/* autonomy — the initiative engine (19.7.2.1 [Agent]) */}
            <div className="nx-panelcard">
              <div className="flex flex-wrap items-center gap-2">
                <span className="nx-h1 text-[14px]">Autonomy</span>
                {pill(`level ${initiative.level}`)}
                {breakerTripped(initiative) && pill("breaker open · cooling down")}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {([0, 1, 2, 3] as AutonomyLevel[]).map((lv) => (
                  <button key={lv} className="nx-chip" data-on={initiative.level === lv}
                    onClick={() => { const next = setLevel(lv); initiativeRef.current = next; setInitiative({ ...next }); }}>
                    {lv} — {["Manual", "Scheduled", "Self-set", "Adaptive"][lv]}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[12.5px] nx-mute">{AUTONOMY_LEVEL_NAMES[initiative.level]}</div>
              <div className="mt-1 text-[11.5px] nx-dim">
                The crew acts on its own inside this level: a heartbeat every {Math.round(HEARTBEAT_DEFAULT_MS / 60000)} minutes decides, then EXECUTES safe acts through the real engine (routing → MoE → member loops → receipts) — failures feed the breaker, partials get a capped re-check, proposals wait for you. Caps: {LIMITS.maxActsPerHour}/hour, {LIMITS.maxActsPerDay}/day, depth {LIMITS.maxFollowUpDepth}. Risky work always pauses at the human gate. Runs while this window is open — stated plainly, no background magic.
              </div>
              {initiative.acts.length > 0 && (
                <div className="mt-2 nx-digest" style={{ maxHeight: 150, overflowY: "auto" }}>
                  {initiative.acts.slice(0, 12).map((a) => (
                    <div key={a.id} className="mt-1 text-[11.5px]">
                      <span className="nx-chip">{a.kind}</span> {a.subject} — <span className="nx-mute">{a.note}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <button className="nx-chip" onClick={wakeNow}>Run a heartbeat now</button>
              </div>
            </div>

            {/* security: the owner vault + memory */}
            <div className="nx-panelcard">
              <div className="flex flex-wrap items-center gap-2">
                <span className="nx-h1 text-[14px]">Security</span>
                {pill(vault.status === "unlocked" ? "vault unlocked · AES-256-GCM" : vault.status === "sealed-locked" ? "vault sealed · locked" : "no vault yet")}
              </div>
              <div className="mt-1 text-[12.5px] nx-mute">
                {vault.status === "unlocked"
                  ? "Provider keys and the memory graph seal before anything touches storage. The passphrase and its key live in memory this session only."
                  : vault.status === "sealed-locked"
                    ? "Sealed records (provider key, memory graph) stay unreadable until you enter the passphrase. Nothing decrypts at boot."
                    : "Without a vault, keys stay session-only and the memory graph persists unencrypted — stated plainly. Create the vault and both seal automatically."}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="nx-input panel-input !w-auto"
                  style={{ minWidth: 220 }}
                  type="password"
                  value={vaultWord}
                  onChange={(e) => setVaultWord(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") doVaultPassphrase(); }}
                  placeholder={vault.created ? "vault passphrase — unlock" : "new vault passphrase (min 8 chars)"}
                  autoComplete="off"
                />
                <button className="nx-chip !text-[color:var(--color-nx-ok)]" onClick={doVaultPassphrase}>{vault.created ? "Unlock" : "Create vault"}</button>
                {vault.status === "unlocked" && <button className="nx-chip" onClick={doLockVault}>Lock now</button>}
                {vault.created && <span className="nx-digest">PBKDF2-SHA-256 · {vault.iterations?.toLocaleString()} iters</span>}
              </div>
              {vaultErr && <div className="mt-2 text-[12px] text-[color:var(--color-nx-err)]">{vaultErr}</div>}
              {vault.created && <div className="mt-2 text-[11px] nx-mute">There is no recovery: the passphrase is never stored. Losing it means sealed records stay sealed.</div>}
            </div>

            {/* memory */}
            <div className="nx-panelcard">
              <div className="flex flex-wrap items-center gap-2">
                <span className="nx-h1 text-[14px]">Memory</span>
                <button className="nx-chip" data-on={memOn} onClick={() => { setMemoryEnabled(!memOn); setMemOn(!memOn); }}>{memOn ? "ON" : "OFF"}</button>
                {(() => { const sec = graphSecurityStatus(); return pill(sec.mode === "sealed" ? "encrypted at rest" : sec.mode === "locked" ? "sealed · locked" : "unencrypted"); })()}
              </div>
              {memOn && vault.status !== "unlocked" && (
                <div className="mt-2 rounded-[10px] border p-3 text-[12px]" style={{ borderColor: "color-mix(in srgb, var(--color-nx-warn) 45%, transparent)", color: "var(--color-nx-warn)" }}>
                  Memory is ON but not encrypted. Create the vault above and every conversation seals before it touches storage.
                </div>
              )}
              <div className="mt-2 text-[11.5px] nx-mute">
                Conversations become keyword graphs you can re-enter later. OFF stops all ingestion immediately.
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="nx-chip !text-[color:var(--color-nx-err)]" onClick={() => { clearGraph(); refreshSessions(); setMemOn(memoryEnabled()); }}>Clear all memory</button>
                <button className="nx-chip" onClick={() => { refreshSessions(); setPanel("memory"); }}>Open memory graphs →</button>
              </div>
            </div>

            {/* data */}
            <div className="nx-panelcard">
              <div className="nx-h1 text-[14px]">Data</div>
              <div className="mt-1 text-[12.5px] nx-mute">
                Everything lives on this machine: conversations, graphs, keys (sealed when the vault exists). Nothing syncs anywhere.
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {provider && <button className="nx-chip !text-[color:var(--color-nx-err)]" onClick={forgetProvider}>Remove the connected provider</button>}
                <button className="nx-chip nx-infra" onClick={() => setPanel("provider")}>Model provider →</button>
              </div>
            </div>
          </div>
        )}

        {panel === "provider" && (
          <div className="nx-stream">
            <div className="nx-bubble">
              <div className="flex flex-wrap items-center gap-2">
                <span className="nx-h1 text-[14px]">Model provider</span>
                {pill(provider ? "connected" : "not connected")}
              </div>
              <div className="mt-1 text-[12.5px] nx-mute">
                {provider
                  ? `${provider.kind} · ${provider.model || "default model"} · ${provider.baseUrl}`
                  : "No model connected — runs stay plan-only. Connect one below; it is used only when you send a task."}
              </div>
            </div>

            <div className="nx-bubble">
              <div className="nx-h1 text-[14px]">Connect a provider</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  className="nx-input panel-input"
                  value={pKind}
                  onChange={(e) => { const k = e.target.value as ProviderKind; setPKind(k); setPUrl(PROVIDER_DEFAULTS[k]); }}
                >
                  <option value="openai-compatible">OpenAI / compatible</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Google Gemini</option>
                </select>
                <input className="nx-input panel-input" value={pModel} onChange={(e) => setPModel(e.target.value)} placeholder="model — e.g. gpt-4.1, claude-sonnet-4, gemini-2.5-pro" />
                <input className="nx-input panel-input" value={pUrl} onChange={(e) => setPUrl(e.target.value)} placeholder="base URL (override for proxies/gateways/local servers)" />
                <input className="nx-input panel-input" type="password" value={pKey} onChange={(e) => setPKey(e.target.value)} placeholder="API key" autoComplete="off" />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="nx-chip !text-[color:var(--color-nx-ok)]" onClick={saveProviderPersist}>Remember on this machine</button>
                <button className="nx-chip" onClick={saveProviderSession}>Use for this session only</button>
                {provider && <button className="nx-chip !text-[color:var(--color-nx-err)]" onClick={forgetProvider}>Forget</button>}
                <button className="nx-chip" onClick={() => setPanel("settings")}>Encryption &amp; memory → Settings</button>
              </div>
              {providerErr && <div className="mt-2 text-[12.5px] text-[color:var(--color-nx-err)]">{providerErr}</div>}
              {securityNote && <div className="mt-2 text-[12px]" style={{ color: "var(--color-nx-brand)" }}>{securityNote}</div>}

              <div className="mt-2 text-[11.5px] nx-mute">
                Keys are used only for provider calls this console makes — never sent anywhere else; Forget removes them. Provider replies ride the same egress guard and injection scan as every external text.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

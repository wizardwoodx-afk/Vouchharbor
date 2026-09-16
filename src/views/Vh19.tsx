/**
 * VH-19 — the Generalist door (19.4.0 "Broader", chat-first).
 *
 * Users chat, then work: the door is now a proper conversation — your message
 * on one side, VH-19's receipted reply on the other, evidence folded into
 * each reply instead of parked in a ledger beside it. The right rail keeps
 * every capability one desk away and adds the 19.4.0 surfaces:
 *
 *   · the WORKSPACE seam — specialists execute their real tool loop in the
 *     browser (virtual sandbox by default, or a user-picked directory via
 *     File System Access); the run's digest states which seam it rode on;
 *   · APP CONNECTORS — declared, revocable integration policies that teach
 *     specialists through generated skills over the existing gated
 *     net.fetch (no sixth tool, no silent egress);
 *   · SKILLS IMPORT — OpenClaw and Hermes agent SKILL.md files parsed by one
 *     faithful importer, provenance-recorded, gating respected honestly.
 *
 * The honesty contract is unchanged: routing shown with reasons; execution
 * never overstated; the human gate a real blocking modal; accept/reject
 * feeding the memory the exam is built from.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { askVH19 } from '../vh19/generalist';
import { advanceBuild, buildSummary, createBuild, listBuilds, runAllOrders, settleBuild, type Build, type RunResult } from '../vh19/shipyard';
import { usageReport } from '../vh19/tokenOptim';
import { catalogStats, listSpecialists, setSpecialistEnabled, disabledSpecialists, effectiveRiskTier, getSpecialist } from '../vh19/registry';
import { patternReport, recordDecision } from '../vh19/memory';
import { autonomyStatus, gradeExam, proposeExam, revokeAutonomy, PASS_THRESHOLD } from '../vh19/exam';
import { approveTeamEvolution, autoProposeIfReady, evolvedConfig, pendingProposal, proposeTeamEvolution, revokeEvolvedConfig, teamIdFor, teamMemoryReport } from '../vh19/teamEvolve';
import { acceptInvitation, allKnownIdentities, createInvitation, ensureIdentity, jwkFingerprint, parseInvitation, serializeInvitation, signApproval, unbindPeer } from '../vh19/collabInvite';
import type { KnownIdentityRow } from '../vh19/collabRegistry';
import type { SignedInvitation } from '../vh19/collabInvite';
import { applySelfChange, loadSelfOverrides, proposeSelfChanges, rejectSelfChange, revertAppliedChange, SELF_EVOLUTION_FLOOR, selfProposals } from '../vh19/selfEvolve';
import type { SelfProposal } from '../vh19/selfEvolve';
import { allowCategoryForSession, answerGateWithRules, listSessionRules, revokeSessionRule } from '../vh19/gateRules';
import { createGoal, executedProgress, goalProgress, goalStatus, loadGoals, nextPendingStep, resumeGoal, settleStep } from '../vh19/goals';
import { listHandoffs, recordHandoff } from '../vh19/handoffs';
import type { HandoffRecord } from '../vh19/handoffs';
import type { Goal, StepOutcome } from '../vh19/goals';
import type { EvolvedTeamConfig, EvolutionProposal, TeamMemoryReport } from '../vh19/teamEvolve';
import { complete } from '../vh19/providers';
import { PROVIDER_DEFAULTS } from '../vh19/providers';
import { APP_CONNECTORS, connectorState, setConnectorConnected } from '../vh19/connectors';
import { importedSkills, importSkillMd, removeImportedSkill, skillEligibility, SAMPLE_OPENCLAW_SKILL, SAMPLE_HERMES_SKILL } from '../vh19/skillsImport';
import { createMemoryWorkspace, openDirectoryWorkspace, fsAccessSupported, type BrowserWorkspace } from '../vh19/browserWorkspace';
import { byoaDelegate, listByoaAgents, registerByoaAgent, removeByoaAgent, setByoaSessionKey, type ByoaAgent } from '../vh19/byoa';
import { applyRsiDraft, rejectRsiDraft, revertRsiMemory, RSI_FLOOR, rsiMemory, rsiState, runRsiCycle } from '../vh19/rsi';
import type { ExamGrade, ExamSession, GateAsk, GateDecision, GeneralistResponse, ProviderConfig, ProviderKind, SpecialistCategory } from '../vh19/types';

const USER = 'local';
const PROVIDER_STORAGE_KEY = 'vh.provider.remembered.v1';

/** Vite injects import.meta.env; probe bundles run without it — read defensively. */
const VITE_ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;
const DEMO_PROVIDER = VITE_ENV.VITE_VH_DEMO_KEY
  ? {
      kind: 'openai-compatible' as ProviderKind,
      baseUrl: VITE_ENV.VITE_VH_DEMO_BASE ?? 'https://tokenharbor.ai/v1',
      model: VITE_ENV.VITE_VH_DEMO_MODEL ?? 'deepseek-v4.1-flash:free',
      apiKey: VITE_ENV.VITE_VH_DEMO_KEY,
    }
  : null;

interface ChatMsg {
  ts?: string;
  id: number;
  role: 'user' | 'vh19';
  text: string;
  resp?: GeneralistResponse;
  scenario?: string;
  feedback?: 'accept' | 'reject';
}

/** Outcome pills — the door's verdict vocabulary, exactly as the engine reports it. */
const OUTCOME_PILL: Record<GeneralistResponse['outcome'], { label: string; cls: string }> = {
  answered: { label: 'Executed · answered', cls: 'px-pill-ok' },
  planned: { label: 'Planned · not executed', cls: 'px-pill-idle' },
  refused: { label: 'Refused', cls: 'px-pill-err' },
  'gated-out': { label: 'Gated · not executed', cls: 'px-pill-warn' },
  error: { label: 'Error · not executed', cls: 'px-pill-err' },
  'peer-delegated': { label: 'Delegated · executed', cls: 'px-pill-accent' },
};

const KINDS: ProviderKind[] = ['openai-compatible', 'anthropic', 'gemini'];

function loadRememberedProvider(): ProviderConfig | null {
  try {
    const raw = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ProviderConfig;
    return p && p.apiKey && p.baseUrl && p.model ? p : null;
  } catch {
    return null;
  }
}

const nowTime = (): string => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const Vh19: React.FC = () => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderConfig | null>(() => loadRememberedProvider());
  const [remember, setRemember] = useState<boolean>(() => loadRememberedProvider() !== null);
  const [gateAsk, setGateAsk] = useState<{ ask: GateAsk; resolve: (d: GateDecision) => void } | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [rejectFor, setRejectFor] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [exam, setExam] = useState<ExamSession | null>(null);
  const [examError, setExamError] = useState<string | null>(null);
  const [grades, setGrades] = useState<Record<string, ExamGrade>>({});
  const [examResult, setExamResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [autonomy, setAutonomy] = useState(() => autonomyStatus(USER));
  const [patterns, setPatterns] = useState(() => patternReport(USER));
  const [disabled, setDisabled] = useState<string[]>(() => disabledSpecialists());
  const [showBench, setShowBench] = useState(false);
  const [form, setForm] = useState(() => ({
    kind: 'openai-compatible' as ProviderKind,
    baseUrl: DEMO_PROVIDER?.baseUrl ?? PROVIDER_DEFAULTS['openai-compatible'],
    model: DEMO_PROVIDER?.model ?? '',
    apiKey: DEMO_PROVIDER?.apiKey ?? '',
  }));
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [examCategory, setExamCategory] = useState<SpecialistCategory | 'all'>('all');
  const [teamPeer, setTeamPeer] = useState('qwen');
  const [shipBrief, setShipBrief] = useState('');
  const [builds, setBuilds] = useState<Build[]>(() => listBuilds());
  const [tokens, setTokens] = useState(() => usageReport());
  const [teamReport, setTeamReport] = useState<TeamMemoryReport | null>(null);
  const [teamProposal, setTeamProposal] = useState<EvolutionProposal | null>(null);
  const [teamConfig, setTeamConfig] = useState<EvolvedTeamConfig | null>(null);
  const [teamNote, setTeamNote] = useState<string | null>(null);
  const [inviteOut, setInviteOut] = useState<string | null>(null);
  const [inviteScope, setInviteScope] = useState('one shared mission, safe-tier ceiling');
  const [inviteCeiling, setInviteCeiling] = useState<'safe' | 'risky' | 'critical'>('safe');
  const [inviteHours, setInviteHours] = useState(24);
  const [passphrase, setPassphrase] = useState('');
  const [idMsg, setIdMsg] = useState<string | null>(null);
  const [unlockedNow, setUnlockedNow] = useState(false);
  const [peers, setPeers] = useState<KnownIdentityRow[]>(() => allKnownIdentities());
  const [handoffs, setHandoffs] = useState<HandoffRecord[]>(() => listHandoffs());
  const [received, setReceived] = useState('');
  const [parsed, setParsed] = useState<SignedInvitation | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [approvalOut, setApprovalOut] = useState<string | null>(null);
  const [selfList, setSelfList] = useState<SelfProposal[]>(() => selfProposals());
  const [goals, setGoals] = useState<Goal[]>(() => loadGoals());
  const [goalText, setGoalText] = useState('');
  const [sessionRules, setSessionRules] = useState<string[]>(() => listSessionRules());
  const [selfNote, setSelfNote] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  /* 19.4.0 — the workspace seam, on by default (browser sandbox). */
  const [ws, setWs] = useState<BrowserWorkspace | null>(() => createMemoryWorkspace());
  const [connectorsTick, setConnectorsTick] = useState(0);
  const [skillsTick, setSkillsTick] = useState(0);
  const [skillPaste, setSkillPaste] = useState('');
  const [skillNote, setSkillNote] = useState<string | null>(null);
  /* 19.4.1 — BYOA: brought agents join under VH governance. */
  const [byoaAgents, setByoaAgents] = useState<ByoaAgent[]>(() => listByoaAgents());
  const [byoaTarget, setByoaTarget] = useState<string>('bench');
  const [byoaForm, setByoaForm] = useState({ name: '', kind: 'openai-compatible' as 'openai-compatible' | 'a2a-http', endpoint: '', model: '', ceiling: 'safe' as 'safe' | 'risky', caps: '', key: '' });
  /* 19.4.1 — RSI: bounded, verifier-anchored self-improvement. */
  const [rsiTick, setRsiTick] = useState(0);
  const [rsiNote, setRsiNote] = useState<string | null>(null);
  const [rsiBusy, setRsiBusy] = useState(false);
  const seq = useRef(0);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  const localMember = 'member-a';
  const teamMembers = [localMember, teamPeer.trim() || 'peer'].map((m) => m.toLowerCase());
  const teamId = teamIdFor(teamMembers);

  const refreshTeam = (id: string = teamId) => {
    setTeamReport(teamMemoryReport(id));
    setTeamProposal(pendingProposal(id));
    setTeamConfig(evolvedConfig(id));
    void autoProposeIfReady(id, teamMembers).then(() => setTeamProposal(pendingProposal(id)));
  };

  const stats = useMemo(() => catalogStats(), []);
  const bench = useMemo(() => listSpecialists(), []);
  const enabledCount = bench.length - disabled.length;

  const refresh = () => {
    setPatterns(patternReport(USER));
    setAutonomy(autonomyStatus(USER));
    setDisabled(disabledSpecialists());
    setTokens(usageReport());
  };

  /** The engine seam, one place: provider, gate, handoffs, the 19.3.0
      evidence fetch, and — 19.4.0 — the workspace root + fs adapter, so the
      shipped app runs the REAL tool loop instead of falling back toolless. */
  const gateFn = (ask: GateAsk) => {
    const ruled = answerGateWithRules(ask);
    if (ruled) return Promise.resolve(ruled);
    return new Promise<GateDecision>((resolve) => { setDenyReason(''); setGateAsk({ ask, resolve }); });
  };

  /** The selected BYOA agent (19.4.1), if the user routed to one. */
  const byoaSelected = byoaAgents.find((a) => a.id === byoaTarget) ?? null;

  const runDeps = () => ({
    provider,
    gate: gateFn,
    onHandoff: (h: { peer: string; task: string; outcome: 'delegated' | 'refused'; detail: string; receiptDigest?: string }) => { recordHandoff(h); setHandoffs(listHandoffs()); },
    evidenceFetch: typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined,
    workspaceRoot: ws?.root,
    fsImpl: ws?.fs,
    /* BYOA: the Generalist hands work to a brought agent through the same
       peer seam, same ledger, same gate — external is hostile-adjacent. */
    peerDelegate: byoaSelected
      ? byoaDelegate(byoaSelected, { gate: gateFn, fetchImpl: typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined })
      : undefined,
  });

  const shipRun = async (text: string): Promise<RunResult> => {
    const resp = await askVH19({ text, userId: USER, team: { id: teamId, members: teamMembers } }, runDeps());
    return { executed: resp.executed, outcome: resp.outcome, note: resp.note ?? resp.reply.slice(0, 120), provenanceDigest: resp.provenanceDigest };
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setErrorNote(null);
    const scenario = text;
    seq.current += 1;
    const userMsg: ChatMsg = { id: seq.current, role: 'user', text, ts: nowTime() };
    setMessages((m) => [...m, userMsg]);
    try {
      const resp = await askVH19({ text, userId: USER, team: { id: teamId, members: teamMembers }, ...(byoaSelected ? { peer: byoaSelected.id } : {}) }, runDeps());
      seq.current += 1;
      setMessages((m) => [...m, { id: seq.current, role: 'vh19', text: resp.reply, resp, scenario, ts: nowTime() }]);
      refreshTeam();
      refresh();
    } catch (err) {
      seq.current += 1;
      const msg = err instanceof Error ? err.message : String(err);
      setErrorNote(`The door hit an unexpected error and nothing was recorded as executed: ${msg}`);
      setMessages((m) => [...m, { id: seq.current, role: 'vh19', text: `Something went wrong inside the pipeline: ${msg}\n\nNothing here overstates itself — this run produced no receipt.`, scenario, ts: nowTime() }]);
    } finally {
      setBusy(false);
    }
  };

  const giveFeedback = (msg: ChatMsg, kind: 'accept' | 'reject', reason?: string) => {
    if (!msg.resp) return;
    recordDecision({
      userId: USER,
      scenario: msg.scenario ?? msg.text,
      action: msg.text.slice(0, 300),
      kind,
      reason,
      specialistId: msg.resp.specialistIds[0],
      category: undefined,
    });
    setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, feedback: kind } : x)));
    refresh();
  };

  const connectProvider = (cfg: ProviderConfig, persist: boolean) => {
    setProvider(cfg);
    setTestResult(null);
    try {
      if (persist) localStorage.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(cfg));
      else localStorage.removeItem(PROVIDER_STORAGE_KEY);
    } catch { /* storage unavailable — session-only, and the card says so */ }
  };

  const disconnectProvider = () => {
    setProvider(null);
    try { localStorage.removeItem(PROVIDER_STORAGE_KEY); } catch { /* nothing to clear */ }
  };

  const testConnection = async () => {
    if (!provider) return;
    setTesting(true);
    setTestResult(null);
    const res = await complete(provider, 'You are a connectivity probe. Reply with exactly one word: ready', 'ping', { timeoutMs: 20_000 });
    setTesting(false);
    setTestResult(res.ok
      ? { ok: true, text: `Connected — ${provider.kind} · ${res.model} answered "${res.text.trim().slice(0, 40)}" in ${res.latencyMs}ms.` }
      : { ok: false, text: `The provider answered with an error: ${res.kind} — ${res.error}` });
  };

  const startExam = () => {
    setExamResult(null);
    setGrades({});
    const r = proposeExam(USER, 10, undefined, examCategory === 'all' ? undefined : examCategory);
    if (!r.ok) { setExam(null); setExamError(r.error); return; }
    setExamError(null);
    setExam(r.session);
  };

  const submitExam = () => {
    if (!exam) return;
    const list = exam.questions.map((q) => grades[q.id]).filter(Boolean);
    const r = gradeExam(exam.id, list);
    if (!r.ok) { setExamError(r.error); return; }
    setExamError(null);
    setExamResult({ score: r.score, passed: r.passed });
    setExam(null);
    refresh();
  };

  const desk = (key: string) => open[key] === true;
  const toggleDesk = (key: string) => setOpen((o) => ({ ...o, [key]: o[key] !== true }));

  /** Desk bodies ALWAYS render (hidden via CSS when closed) — the door's
      surfaces are structurally present, not loaded on demand. */
  const deskBody = (key: string, node: React.ReactNode) => (
    <div className={desk(key) ? 'px-desk-body px-fade-in' : 'px-desk-body px-hidden'}>{node}</div>
  );

  const imported = importedSkills();
  const connStates = APP_CONNECTORS.map((c) => ({ c, st: connectorState(c.id) }));
  void connectorsTick;
  void skillsTick;
  void rsiTick;

  return (
    <div className="px-door">
      <div className="px-door-inner">
      <header className="px-top">
        <div className="px-brand">
          <span className="px-brand-mark" aria-hidden="true" />
          <span className="px-brand-name">VH-19</span>
          <span className="px-brand-sub">the receipt OS for AI agents</span>
        </div>
        <div className="px-top-kpis">
          <div className="px-kpi"><span className="px-kpi-value">{enabledCount}<small>/{stats.count}</small></span><span className="px-kpi-label">bench enabled</span></div>
          <div className="px-kpi"><span className="px-kpi-value">{stats.categories}</span><span className="px-kpi-label">categories</span></div>
          <div className="px-kpi"><span className="px-kpi-value">{patterns.total}</span><span className="px-kpi-label">decisions learned</span></div>
          <div className="px-kpi"><span className="px-kpi-value" style={{ color: autonomy.granted ? 'var(--px-accent)' : undefined }}>{autonomy.granted ? 'Earned' : 'Learning'}</span><span className="px-kpi-label">autonomy</span></div>
        </div>
      </header>
      <div className="px-hero">
        <h1 className="px-door-title">One agent at the door. {stats.count} specialists underneath, every action receipted.</h1>
        <p className="px-door-sub">Chat with VH-19. It routes to the bench, executes real tools in your workspace, pauses at the human gate for risky work, and says in words when it did not execute.</p>
      </div>

      <div className="px-grid">
        {/* ══ the conversation ══ */}
        <section className="px-chat" aria-label="Conversation with VH-19">
          <div className="px-thread">
            {messages.length === 0 && (
              <div className="px-thread-empty">
                <div className="px-thread-empty-title">Ask VH-19 anything.</div>
                <div className="px-thread-empty-sub">
                  Replies show which specialists routed and why, every tool receipt, the Captain's synthesis, and live-data stamps —
                  and say plainly when nothing executed.
                </div>
                {DEMO_PROVIDER && !provider && <div className="px-warn-text" style={{ fontSize: 12, marginTop: 8 }}>A demo provider is available — connect it in the Provider desk to run for real.</div>}
                {!ws && <div className="px-muted" style={{ fontSize: 12, marginTop: 8 }}>No workspace attached — specialists will run toolless and say so.</div>}
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'px-msg px-msg-user px-rise' : 'px-msg px-msg-agent px-rise'}>
                {m.role === 'user' ? (
                  <div className="px-bubble-user">{m.text}<span className="px-msg-time">{m.ts}</span></div>
                ) : (
                  <div className="px-bubble-agent">
                    <div className="px-msg-meta">
                      <span className="px-chip">VH-19</span>
                      <span className="px-msg-time">{m.ts}</span>
                      {m.resp && <span className={`px-pill ${OUTCOME_PILL[m.resp.outcome].cls}`}>{OUTCOME_PILL[m.resp.outcome].label}</span>}
                      {m.resp?.workspace && <span className="px-chip" title={`execution workspace root ${m.resp.workspace.root}`}>workspace · {m.resp.workspace.kind}</span>}
                      {!m.resp?.workspace && m.resp && <span className="px-chip" title="no workspace attached — the toolless path, stated">workspace · none (toolless)</span>}
                    </div>

                    {m.resp?.captain && (
                      <div className="px-note-line">
                        <span className={`px-pill ${m.resp.captain.status === 'completed' ? 'px-pill-ok' : m.resp.captain.status === 'blocked' ? 'px-pill-err' : 'px-pill-warn'}`}>{m.resp.captain.status}</span>
                        <span><b>{m.resp.captain.captainName}</b> → {m.resp.captain.summary}</span>
                      </div>
                    )}

                    {m.resp?.synthesis && (
                      <div className="px-synthesis">
                        <div className="px-synthesis-head">
                          <span className="px-synthesis-title">Captain synthesis · {m.resp.synthesis.captainName}</span>
                          <span className="px-chip px-chip-mono" title="the synthesis receipt — its own digest, never a member's">synthesis {m.resp.synthesis.digest?.slice(0, 12)}…</span>
                          {m.resp.synthesis.divergences.singleSourced.length > 0 && (
                            <span className="px-chip" title={m.resp.synthesis.divergences.singleSourced.map((d) => `${d.atom} ← ${d.backedBy.join(', ')}`).join(' · ')}>
                              {m.resp.synthesis.divergences.singleSourced.length} single-sourced claim(s)
                            </span>
                          )}
                        </div>
                        <div className="px-member-body">{m.resp.synthesis.text}</div>
                      </div>
                    )}

                    <div className="px-msg-body">{m.text}</div>

                    {m.resp && m.resp.routed.selected.length > 0 && (
                      <div className="px-route-row">
                        {m.resp.routed.selected.map((c) => (
                          <span key={c.id} className="px-chip" title={c.reasons.join(' · ')}>{c.id} · {c.score}</span>
                        ))}
                        <span className="px-muted">routed by {m.resp.routed.routedBy}{m.resp.routed.fallbackReason ? ` · fallback: ${m.resp.routed.fallbackReason}` : ''}</span>
                      </div>
                    )}

                    {m.resp && (m.resp.memberRuns?.length ?? 0) > 0 && (
                      <details className="px-evidence">
                        <summary>Receipts — {m.resp.memberRuns!.length} member run(s), each its own agent loop</summary>
                        {m.resp.memberRuns!.map((run) => (
                          <div key={run.specialistId} className="px-member">
                            <div className="px-member-head">
                              <span className="px-chip">{getSpecialist(run.specialistId)?.name ?? run.specialistId}</span>
                              <span className="px-chip px-chip-mono">{run.providerCalls} provider call(s) · {run.latencyMs}ms</span>
                              {run.truncated && <span className="px-pill px-pill-warn">step limit reached</span>}
                              {m.resp!.captain?.members.find((x) => x.specialistId === run.specialistId)?.memberDigest && (
                                <span className="px-entry-digest">receipt {m.resp!.captain!.members.find((x) => x.specialistId === run.specialistId)!.memberDigest!.slice(0, 12)}…</span>
                              )}
                            </div>
                            {run.toolReceipts.length > 0 && (
                              <div className="px-tools">
                                {run.toolReceipts.map((t, ti) => (
                                  <span key={ti} className={`px-pill ${t.outcome === 'ok' ? 'px-pill-ok' : t.outcome === 'gated-out' ? 'px-pill-warn' : 'px-pill-err'}`} title={`${t.inputPreview}\n→ ${t.outputPreview}`}>
                                    {t.tool} · {t.outcome}
                                  </span>
                                ))}
                              </div>
                            )}
                            {run.tools.length > 0 && run.toolReceipts.length === 0 && (
                              <div className="px-muted">toolset {run.tools.join(' · ')} — no calls were requested this run</div>
                            )}
                          </div>
                        ))}
                      </details>
                    )}

                    {m.resp?.liveData && (
                      <div className="px-note-line">
                        <span className={`px-pill ${m.resp.liveData.verified ? 'px-pill-ok' : 'px-pill-warn'}`}>
                          {m.resp.liveData.verified ? `Live-data verified · ${m.resp.liveData.verifiedBy ?? 'disclosure'}` : 'Live-data unverified'}
                        </span>
                        <span className="px-muted">{m.resp.liveData.note}</span>
                        {(m.resp.liveData.retrieval ?? []).map((r, ri) => (
                          <span key={ri} className={`px-chip px-chip-mono ${r.status === 'retrieved' ? '' : 'px-warn-text'}`} title={r.detail ?? ''}>
                            {new URL(r.url).host} · {r.status} · {r.claimHits} hit(s) · {r.fetchedAt.slice(11, 19)}
                          </span>
                        ))}
                      </div>
                    )}

                    {m.resp?.failure && (
                      <div className="px-note-line">
                        <span className={`px-pill ${m.resp.failure.severity === 'error' ? 'px-pill-err' : 'px-pill-idle'}`}>{m.resp.failure.klass}</span>
                        <span className="px-muted">{m.resp.failure.meaning} <em>{m.resp.failure.advice}</em></span>
                      </div>
                    )}

                    <div className="px-msg-foot">
                      {m.resp && <span className="px-entry-digest" title={m.resp.note ?? ''}>proof-digest {m.resp.provenanceDigest.slice(0, 12)}…</span>}
                      {m.resp && (m.resp.outcome === 'answered' || m.resp.outcome === 'planned') && !m.feedback && (
                        <span className="px-learn">
                          <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => giveFeedback(m, 'accept')}>Accept</button>
                          <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { setRejectFor(m.id); setRejectReason(''); }}>Reject</button>
                          {rejectFor === m.id && (
                            <>
                              <input className="px-input px-input-inline" placeholder="why? (this is the learning payload)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                              <button className="px-btn px-btn-primary px-btn-sm" onClick={() => { giveFeedback(m, 'reject', rejectReason || undefined); setRejectFor(null); }}>Record</button>
                            </>
                          )}
                        </span>
                      )}
                      {m.feedback && <span className="px-learned">learned: {m.feedback === 'accept' ? 'accepted' : 'rejected'} — folded into memory</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="px-msg px-msg-agent px-rise">
                <div className="px-bubble-agent px-typing"><span /><span /><span /></div>
              </div>
            )}
            {errorNote && <div className="px-msg px-msg-agent"><div className="px-bubble-agent"><span className="px-pill px-pill-err">pipeline</span> <span className="px-muted">{errorNote}</span></div></div>}
            <div ref={threadEndRef} />
          </div>

          <div className="px-composer">
            <select className="px-input px-route-select" value={byoaTarget} onChange={(e) => setByoaTarget(e.target.value)} title="who executes: the bench, or a brought agent (BYOA)">
              <option value="bench">the bench</option>
              {byoaAgents.map((a) => <option key={a.id} value={a.id}>@{a.name} · BYOA</option>)}
            </select>
            <textarea
              className="px-input px-composer-input"
              rows={1}
              placeholder={provider ? 'Message VH-19…' : 'Message VH-19… (no provider connected — answers will be plans, not executions)'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
            />
            <button className="px-btn px-btn-primary px-send" onClick={() => void send()} disabled={busy || !input.trim()}>{busy ? 'Working…' : 'Send'}</button>
          </div>
        </section>

        {/* ══ the side rail ══ */}
        <aside className="px-stack">
          {/* Workspace — the 19.4.0 seam */}
          <div className="px-card px-card-pad">
            <div className="px-card-title">Workspace {ws ? <span className="px-pill px-pill-ok">{ws.kind}</span> : <span className="px-pill px-pill-idle">detached</span>}</div>
            <div className="px-muted" style={{ marginTop: 6 }}>
              {ws
                ? `${ws.label}. Specialists run their real fs tools here; every call is gated and receipted.`
                : 'Detached — specialists run toolless and state it. The 19.2.0 path, honestly labeled.'}
            </div>
            <div className="px-row" style={{ marginTop: 8 }}>
              <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => setWs(createMemoryWorkspace())}>Use sandbox</button>
              <button className="px-btn px-btn-ghost px-btn-sm" disabled={!fsAccessSupported()} title={fsAccessSupported() ? 'Pick a real directory' : 'This browser lacks the File System Access API'} onClick={() => { void openDirectoryWorkspace().then((w) => { if (w) setWs(w); }); }}>Open folder</button>
              {ws && <button className="px-btn px-btn-danger px-btn-sm" onClick={() => setWs(null)}>Detach</button>}
            </div>
          </div>

          {/* Provider */}
          <div className="px-card px-card-pad">
            <div className="px-card-title">
              Provider
              {provider
                ? <span className="px-pill px-pill-ok">connected</span>
                : DEMO_PROVIDER ? <span className="px-pill px-pill-accent">demo available</span> : <span className="px-pill px-pill-idle">not connected</span>}
            </div>
            {provider ? (
              <div className="px-stack" style={{ marginTop: 10 }}>
                <div className="px-quiet-card">
                  <div className="px-quiet-title">{provider.kind} · {provider.model}</div>
                  <div className="px-quiet-sub px-mono" style={{ fontSize: 10.5 }}>{provider.baseUrl}</div>
                </div>
                {testResult && <div className={`px-muted ${testResult.ok ? 'px-ok-text' : 'px-err-text'}`}>{testResult.text}</div>}
                <div className="px-row">
                  <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => void testConnection()} disabled={testing}>{testing ? 'Testing…' : 'Test connection'}</button>
                  <button className="px-btn px-btn-danger px-btn-sm" onClick={disconnectProvider}>Disconnect</button>
                </div>
              </div>
            ) : (
              <div className="px-stack" style={{ marginTop: 10 }}>
                {DEMO_PROVIDER && (
                  <div className="px-quiet-card">
                    <div className="px-quiet-title">Demo provider detected</div>
                    <div className="px-quiet-sub">{DEMO_PROVIDER.model} @ {DEMO_PROVIDER.baseUrl} — the key is pre-filled below. Connect, then Test.</div>
                  </div>
                )}
                <div>
                  <label className="px-field-label">Kind</label>
                  <select className="px-input" value={form.kind} onChange={(e) => { const kind = e.target.value as ProviderKind; setForm((f) => ({ ...f, kind, baseUrl: PROVIDER_DEFAULTS[kind] })); }}>
                    {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="px-field-label">Base URL</label>
                  <input className="px-input" placeholder="https://api.openai.com/v1" value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} />
                </div>
                <div>
                  <label className="px-field-label">Model</label>
                  <input className="px-input" placeholder="e.g. gpt-4.1" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
                </div>
                <div>
                  <label className="px-field-label">API key</label>
                  <input className="px-input" type="password" placeholder="sk-…" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} />
                </div>
                <label className="px-row" style={{ fontSize: 12, color: 'var(--px-ink-2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  Remember on this device. Off = keys are held in memory only, this session.
                </label>
                <button className="px-btn px-btn-primary px-btn-block" disabled={!form.model.trim() || !form.apiKey.trim()}
                  onClick={() => connectProvider({ kind: form.kind, baseUrl: form.baseUrl.replace(/\/+$/, ''), apiKey: form.apiKey.trim(), model: form.model.trim() }, remember)}>
                  Connect
                </button>
                <div className="px-muted">
                  Keys never touch disk unless you choose Remember. Durable config lives in env:
                  VH_OPENAI_API_KEY / VH_ANTHROPIC_API_KEY / VH_GEMINI_API_KEY (VH_*_BASE_URL to override bases).
                </div>
              </div>
            )}
          </div>

          {/* Autonomy earned banner */}
          {autonomy.granted && (
            <div className="px-card px-card-pad">
              <div className="px-row">
                <span className="px-pill px-pill-ok">autonomy earned</span>
                <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { revokeAutonomy(USER); refresh(); }}>Revoke</button>
              </div>
              <div className="px-muted" style={{ marginTop: 8 }}>
                Gate-free on safe-tier work · score {autonomy.score != null ? `${Math.round(autonomy.score * 100)}%` : '—'} · monitor + override always on. Risky and critical work still pauses at the gate.
              </div>
            </div>
          )}

          {/* Desks */}
          <div className="px-card">
            {/* App connectors */}
            <div className="px-desk" data-open={desk('connectors')}>
              <button className="px-desk-head" onClick={() => { toggleDesk('connectors'); setConnectorsTick((t) => t + 1); }}>
                App connectors · declared, gated, revocable <span className="px-desk-caret">▸</span>
              </button>
              {deskBody('connectors', (
                <>
                  <div className="px-muted">These are governed connector DECLARATIONS, not OAuth integrations: connecting one binds a generated playbook to its bench categories, riding only the existing SSRF-guarded net.fetch — every call still risky-tier, still gated, still receipted. No sixth tool, no silent egress. Native API execution arrives only with its own receipts, gates and probes.</div>
                  {connStates.map(({ c, st }) => (
                    <div key={c.id} className="px-quiet-card">
                      <div className="px-row">
                        <span className="px-quiet-title" style={{ flex: 1 }}>{c.name} <span className="px-muted" style={{ fontWeight: 400 }}>· {c.vendor}</span></span>
                        {st.connected ? <span className="px-pill px-pill-ok">connected</span> : <span className="px-pill px-pill-idle">off</span>}
                      </div>
                      <div className="px-quiet-sub">{c.purpose}</div>
                      <div className="px-muted">scopes: {c.scopes.join(' · ')} · egress prefix {connectorState(c.id).base ?? c.baseUrl}</div>
                      <div className="px-row" style={{ marginTop: 6 }}>
                        <button className={`px-btn px-btn-sm ${st.connected ? 'px-btn-danger' : 'px-btn-primary'}`} onClick={() => { setConnectorConnected(c.id, !st.connected); setConnectorsTick((t) => t + 1); }}>
                          {st.connected ? 'Disconnect' : 'Connect'}
                        </button>
                        <span className="px-muted">binds: {c.binds.join(', ')}</span>
                      </div>
                    </div>
                  ))}
                </>
              ))}
            </div>

            {/* BYOA */}
            <div className="px-desk" data-open={desk('byoa')}>
              <button className="px-desk-head" onClick={() => { toggleDesk('byoa'); setByoaAgents(listByoaAgents()); }}>
                BYOA · bring your own agent <span className="px-desk-caret">▸</span>
              </button>
              {deskBody('byoa', (
                <>
                  <div className="px-muted">Any external agent — yours, a colleague's, another vendor's — joins the mission UNDER VH governance: declared endpoint and capabilities, a risk ceiling it never exceeds, delegation through the Generalist's peer seam, every handoff paused at the human gate and stamped in the ledger. Keys live in memory for this session only.</div>
                  <div className="px-quiet-card">
                    <div className="px-quiet-title">Register a brought agent</div>
                    <div className="px-stack" style={{ marginTop: 6 }}>
                      <input className="px-input" placeholder="name (e.g. my-hermes)" value={byoaForm.name} onChange={(e) => setByoaForm((f) => ({ ...f, name: e.target.value }))} />
                      <div className="px-row">
                        <select className="px-input" style={{ flex: 1 }} value={byoaForm.kind} onChange={(e) => setByoaForm((f) => ({ ...f, kind: e.target.value as 'openai-compatible' | 'a2a-http' }))}>
                          <option value="openai-compatible">OpenAI-compatible endpoint</option>
                          <option value="a2a-http">A2A JSON-RPC endpoint</option>
                        </select>
                        <select className="px-input" style={{ flex: 1 }} value={byoaForm.ceiling} onChange={(e) => setByoaForm((f) => ({ ...f, ceiling: e.target.value as 'safe' | 'risky' }))}>
                          <option value="safe">safe ceiling</option>
                          <option value="risky">risky ceiling</option>
                        </select>
                      </div>
                      <input className="px-input" placeholder="endpoint URL" value={byoaForm.endpoint} onChange={(e) => setByoaForm((f) => ({ ...f, endpoint: e.target.value }))} />
                      <div className="px-row">
                        <input className="px-input" style={{ flex: 1 }} placeholder="model (optional)" value={byoaForm.model} onChange={(e) => setByoaForm((f) => ({ ...f, model: e.target.value }))} />
                        <input className="px-input" style={{ flex: 1 }} placeholder="capabilities, comma-separated" value={byoaForm.caps} onChange={(e) => setByoaForm((f) => ({ ...f, caps: e.target.value }))} />
                      </div>
                      <button className="px-btn px-btn-primary px-btn-sm" disabled={!byoaForm.name.trim() || !/^https?:\/\//.test(byoaForm.endpoint)} onClick={() => {
                        const a = registerByoaAgent({ name: byoaForm.name.trim(), kind: byoaForm.kind, endpoint: byoaForm.endpoint.replace(/\/+$/, ''), model: byoaForm.model.trim() || undefined, ceiling: byoaForm.ceiling, capabilities: byoaForm.caps.split(',').map((x) => x.trim()).filter(Boolean) });
                        if (byoaForm.key) setByoaSessionKey(a.id, byoaForm.key);
                        setByoaForm((f) => ({ ...f, name: '', endpoint: '', model: '', caps: '', key: '' }));
                        setByoaAgents(listByoaAgents());
                      }}>Register</button>
                    </div>
                  </div>
                  {byoaAgents.length === 0 && <div className="px-muted">No brought agents yet. Register one, then route to it from the composer's selector.</div>}
                  {byoaAgents.map((a) => (
                    <div key={a.id} className="px-quiet-card">
                      <div className="px-row">
                        <span className="px-quiet-title" style={{ flex: 1 }}>{a.name} <span className="px-chip">{a.kind}</span></span>
                        <span className={`px-pill ${a.ceiling === 'safe' ? 'px-pill-ok' : 'px-pill-warn'}`}>{a.ceiling} ceiling</span>
                      </div>
                      <div className="px-quiet-sub px-mono" style={{ fontSize: 10.5 }}>{a.endpoint}</div>
                      <div className="px-muted">{a.capabilities.length > 0 ? `capabilities: ${a.capabilities.join(' · ')}` : 'no declared capabilities'}</div>
                      <div className="px-row" style={{ marginTop: 6 }}>
                        <input className="px-input" type="password" placeholder="session key (memory only)" style={{ flex: 1 }} onChange={(e) => setByoaSessionKey(a.id, e.target.value)} />
                        <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { setByoaTarget(a.id); }}>Route to it</button>
                        <button className="px-btn px-btn-danger px-btn-sm" onClick={() => { removeByoaAgent(a.id); setByoaAgents(listByoaAgents()); if (byoaTarget === a.id) setByoaTarget('bench'); }}>Remove</button>
                      </div>
                    </div>
                  ))}
                  <div className="px-muted" style={{ fontStyle: 'italic' }}>Inbound works the same way in reverse: issue a signed invitation here (Collaboration desk) and the external agent calls the Generalist through the host runtime's A2A endpoint — receipts both ways.</div>
                </>
              ))}
            </div>

            {/* RSI */}
            <div className="px-desk" data-open={desk('rsi')}>
              <button className="px-desk-head" onClick={() => { toggleDesk('rsi'); setRsiTick((t) => t + 1); }}>
                RSI · recursive self-improvement <span className="px-desk-caret">▸</span>
              </button>
              {deskBody('rsi', (
                <>
                  <div className="px-muted">Bounded, verifier-anchored RSI after the 2026 literature: a CURRICULUM scanned deterministically from the agent's own evidence ledger (rejections, gate denials, refused handoffs); an ACTOR that drafts frozen SKILL playbooks (one receipted provider call when a provider is wired, the raw correction otherwise); a VERIFIER hierarchy where human approval and the autonomy exam outrank everything and intrinsic self-assessment is never a verifier. Memory is frozen, digest-stamped, composed into prompts — no parameter updates — and reverts exactly.</div>
                  <div className="px-quiet-card">
                    <div className="px-quiet-title">Floor — the loop may never touch</div>
                    <div className="px-muted">{RSI_FLOOR.join(' · ')}</div>
                  </div>
                  <div className="px-row">
                    <button className="px-btn px-btn-primary px-btn-sm" disabled={rsiBusy} onClick={async () => {
                      setRsiBusy(true);
                      try {
                        const st = await runRsiCycle(USER, { provider, fetchImpl: typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined });
                        setRsiNote(st.drafts.filter((d) => d.state === 'pending').length > 0 ? `cycle complete — ${st.topics.length} topic(s) from the ledger, ${st.drafts.filter((d) => d.state === 'pending').length} pending draft(s). Nothing applies without your approval.` : 'cycle complete — the ledger produced no new topics; nothing was invented.');
                      } finally {
                        setRsiBusy(false);
                        setRsiTick((t) => t + 1);
                      }
                    }}>{rsiBusy ? 'Scanning the ledger…' : 'Run improvement cycle'}</button>
                    {rsiNote && <span className="px-muted">{rsiNote}</span>}
                  </div>
                  {rsiState().drafts.filter((d) => d.state === 'pending').map((d) => (
                    <div key={d.id} className="px-quiet-card">
                      <div className="px-row">
                        <span className="px-quiet-title" style={{ flex: 1 }}>{d.name} <span className="px-chip">{d.provenance}</span></span>
                        <span className="px-chip px-chip-mono">frozen {d.digest.slice(0, 12)}…</span>
                      </div>
                      <div className="px-quiet-sub">{d.description}</div>
                      <div className="px-muted" style={{ whiteSpace: 'pre-wrap' }}>{d.body.slice(0, 420)}{d.body.length > 420 ? '…' : ''}</div>
                      <div className="px-muted" style={{ fontStyle: 'italic' }}>{d.verifierNote}</div>
                      <div className="px-row" style={{ marginTop: 6 }}>
                        <button className="px-btn px-btn-primary px-btn-sm" onClick={async () => { const r = await applyRsiDraft(d.id); setRsiNote(r.ok ? 'Applied — frozen into the skill store, bound to the routed specialists, revertible below.' : r.error ?? 'apply failed'); setRsiTick((t) => t + 1); }}>Apply (my decision)</button>
                        <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { rejectRsiDraft(d.id, 'user declined at the verifier'); setRsiTick((t) => t + 1); }}>Reject</button>
                      </div>
                    </div>
                  ))}
                  {rsiMemory().map((d) => (
                    <div key={d.id} className="px-row" style={{ opacity: 0.8 }}>
                      <span className="px-muted" style={{ flex: 1 }}>frozen memory · {d.name} · {d.at.slice(0, 10)}</span>
                      <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { revertRsiMemory(d.id); setRsiTick((t) => t + 1); }}>Revert</button>
                    </div>
                  ))}
                </>
              ))}
            </div>

            {/* Skills import */}
            <div className="px-desk" data-open={desk('skills')}>
              <button className="px-desk-head" onClick={() => { toggleDesk('skills'); setSkillsTick((t) => t + 1); }}>
                Skills · import from OpenClaw &amp; Hermes <span className="px-desk-caret">▸</span>
              </button>
              {deskBody('skills', (
                <>
                  <div className="px-muted">SKILL.md ecosystem import (not a runtime merge): one faithful parser for the OpenClaw and Hermes skill FORMAT. Imported skills are playbooks with provenance — they compose into routed specialists' prompts and grant no tools. Gating metadata is respected: a skill needing binaries or env vars is ineligible on surfaces that cannot verify them, and says so.</div>
                  <div className="px-row">
                    <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { void importSkillMd(SAMPLE_OPENCLAW_SKILL, 'openclaw').then(() => { setSkillsTick((t) => t + 1); setSkillNote('OpenClaw sample imported (todoist-tasks). It needs TODOIST_API_KEY + curl, so browser surfaces mark it ineligible — honestly.'); }); }}>Import OpenClaw sample</button>
                    <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { void importSkillMd(SAMPLE_HERMES_SKILL, 'hermes').then(() => { setSkillsTick((t) => t + 1); setSkillNote('Hermes sample imported (arxiv) — bound to research, eligible everywhere.'); }); }}>Import Hermes sample</button>
                  </div>
                  <textarea className="px-input px-mono" style={{ fontSize: 10.5, marginTop: 8 }} rows={4} placeholder={'paste a SKILL.md (OpenClaw or Hermes frontmatter + body)…'} value={skillPaste} onChange={(e) => setSkillPaste(e.target.value)} />
                  <div className="px-row" style={{ marginTop: 6 }}>
                    <button className="px-btn px-btn-primary px-btn-sm" disabled={!skillPaste.trim()} onClick={() => { void importSkillMd(skillPaste, 'pasted').then(() => { setSkillPaste(''); setSkillsTick((t) => t + 1); setSkillNote('Imported with provenance "pasted".'); }).catch((e) => setSkillNote(String(e))); }}>Import SKILL.md</button>
                    {skillNote && <span className="px-muted">{skillNote}</span>}
                  </div>
                  {imported.length === 0 && <div className="px-muted" style={{ marginTop: 6 }}>Nothing imported yet.</div>}
                  {imported.map((s) => {
                    const el = skillEligibility(s);
                    return (
                      <div key={s.name} className="px-quiet-card">
                        <div className="px-row">
                          <span className="px-quiet-title" style={{ flex: 1 }}>{s.name} <span className="px-chip">{s.source}</span>{s.category && <span className="px-chip">→ {s.category}</span>}</span>
                          {el.eligible ? <span className="px-pill px-pill-ok">eligible</span> : <span className="px-pill px-pill-warn">ineligible here</span>}
                        </div>
                        <div className="px-quiet-sub">{s.description}</div>
                        <div className="px-muted">{el.reasons.join(' · ')} · digest {s.digest.slice(0, 12)}…</div>
                        <div className="px-row" style={{ marginTop: 6 }}>
                          <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { removeImportedSkill(s.name); setSkillsTick((t) => t + 1); }}>Remove</button>
                        </div>
                      </div>
                    );
                  })}
                </>
              ))}
            </div>

            {/* Assignments / goal mode */}
            <div className="px-desk" data-open={desk('goals')}>
              <button className="px-desk-head" onClick={() => { toggleDesk('goals'); setGoals(loadGoals()); setSessionRules(listSessionRules()); }}>
                Assignments · goal mode <span className="px-desk-caret">▸</span>
              </button>
              {deskBody('goals', (
                <>
                  <div className="px-row">
                    <input className="px-input" style={{ flex: 1 }} placeholder="hand VH a goal — it decomposes and checkpoints every step" value={goalText} onChange={(e) => setGoalText(e.target.value)} />
                    <button className="px-btn px-btn-primary px-btn-sm" onClick={() => { if (goalText.trim()) { createGoal(USER, goalText.trim()); setGoalText(''); setGoals(loadGoals()); } }}>Assign</button>
                  </div>
                  {sessionRules.length > 0 && (
                    <div className="px-muted">session auto-review rules (forgotten on restart): {sessionRules.map((c) => (
                      <span key={c} className="px-chip" style={{ marginRight: 4 }}>{c} <button className="px-btn px-btn-ghost px-btn-sm" style={{ padding: 0, marginLeft: 4, border: 'none' }} onClick={() => { revokeSessionRule(c); setSessionRules(listSessionRules()); }}>×</button></span>
                    ))}</div>
                  )}
                  {goals.slice(-4).reverse().map((g) => (
                    <div key={g.id} className="px-quiet-card">
                      <div className="px-row">
                        <span className="px-quiet-title" style={{ flex: 1 }}>{g.text}</span>
                        <span className={`px-pill ${goalStatus(g) === 'DONE' ? 'px-pill-ok' : goalStatus(g) === 'IN-PROGRESS' ? 'px-pill-accent' : 'px-pill-warn'}`}>{goalStatus(g)}</span>
                        <span className="px-chip">{executedProgress(g)}% executed</span>
                        <span className="px-chip" title="settled = decided either way; executed = actually ran">{goalProgress(g)}% settled</span>
                      </div>
                      {g.steps.map((s) => (
                        <div key={s.id} className="px-muted" style={{ marginTop: 3 }}>· [{s.status}] {s.title}{s.note ? ` — ${s.note}` : ''}</div>
                      ))}
                      <div className="px-row" style={{ marginTop: 8 }}>
                        {g.state !== 'done' && g.state !== 'settled' && <button className="px-btn px-btn-primary px-btn-sm" disabled={busy} onClick={async () => {
                          const step = nextPendingStep(g); if (!step) return;
                          setBusy(true);
                          try {
                            const resp = await askVH19({ text: `${g.text} — step: ${step.title}`, userId: USER, team: { id: teamId, members: teamMembers } }, runDeps());
                            const outcome: StepOutcome =
                              resp.outcome === 'answered' || resp.outcome === 'peer-delegated'
                                ? { status: 'done', receiptDigest: resp.provenanceDigest, note: resp.reply.slice(0, 120) }
                                : resp.outcome === 'planned'
                                  ? { status: 'planned', note: 'no provider key — delivered as a plan, honestly' }
                                  : resp.outcome === 'gated-out'
                                    ? { status: 'refused', note: 'denied at the human gate' }
                                    : { status: 'refused', note: resp.outcome };
                            settleStep(g.id, step.id, outcome);
                          } finally {
                            setGoals(loadGoals());
                            setBusy(false);
                            refresh();
                          }
                        }}>Run next step</button>}
                        {g.state === 'paused' && <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { resumeGoal(g.id); setGoals(loadGoals()); }}>Resume</button>}
                      </div>
                    </div>
                  ))}
                </>
              ))}
            </div>

            {/* Autonomy exam */}
            <div className="px-desk" data-open={desk('exam')}>
              <button className="px-desk-head" onClick={() => toggleDesk('exam')}>
                Autonomy exam · ≥{Math.round(PASS_THRESHOLD * 100)}% <span className="px-desk-caret">▸</span>
              </button>
              {deskBody('exam', (
                <>
                  <select className="px-input" value={examCategory} onChange={(e) => setExamCategory(e.target.value as SpecialistCategory | 'all')}>
                    <option value="all">overall (all categories)</option>
                    {Array.from(new Set(bench.map((b) => b.category))).sort().map((c) => <option key={c} value={c}>{c} only</option>)}
                  </select>
                  {exam ? (
                    <div className="px-stack" style={{ maxHeight: 380, overflowY: 'auto' }}>
                      {exam.questions.map((q, i) => (
                        <div key={q.id} className="px-quiet-card">
                          <div className="px-quiet-title">{i + 1}. {q.scenario}</div>
                          <div className="px-quiet-sub" style={{ whiteSpace: 'pre-wrap' }}>Would do: {q.proposedAction}</div>
                          <div className="px-muted" style={{ fontStyle: 'italic' }}>Why: {q.explanation}</div>
                          <div className="px-row" style={{ marginTop: 6 }}>
                            <button className={`px-btn px-btn-sm ${grades[q.id]?.verdict === 'correct' ? 'px-btn-primary' : 'px-btn-ghost'}`}
                              onClick={() => setGrades((g) => ({ ...g, [q.id]: { questionId: q.id, verdict: 'correct' } }))}>Correct</button>
                            <button className={`px-btn px-btn-sm ${grades[q.id]?.verdict === 'wrong' ? 'px-btn-primary' : 'px-btn-ghost'}`}
                              onClick={() => setGrades((g) => ({ ...g, [q.id]: { questionId: q.id, verdict: 'wrong', correction: g[q.id]?.correction } }))}>Wrong</button>
                          </div>
                          {grades[q.id]?.verdict === 'wrong' && (
                            <input className="px-input" style={{ marginTop: 6 }} placeholder="correction — the agent learns this" value={grades[q.id]?.correction ?? ''}
                              onChange={(e) => setGrades((g) => ({ ...g, [q.id]: { ...g[q.id], correction: e.target.value } }))} />
                          )}
                        </div>
                      ))}
                      <button className="px-btn px-btn-primary px-btn-sm" onClick={submitExam} disabled={exam.questions.some((q) => !grades[q.id])}>Submit grades</button>
                    </div>
                  ) : examResult ? (
                    <>
                      <div className="px-row"><span className={`px-pill ${examResult.passed ? 'px-pill-ok' : 'px-pill-warn'}`}>last exam · {Math.round(examResult.score * 100)}% · {examResult.passed ? 'passed' : 'not passed'}</span></div>
                      <div className="px-muted">{examResult.passed ? 'Autonomy earned — monitor + override permanently on.' : 'Below the bar. Wrong answers became corrections in memory; keep working and re-exam.'}</div>
                      <button className="px-btn px-btn-ghost px-btn-sm" onClick={startExam}>New exam</button>
                    </>
                  ) : (
                    <>
                      <div className="px-muted">Questions are generated ONLY from your real accept/reject history — never invented. You grade; ≥{Math.round(PASS_THRESHOLD * 100)}% earns autonomy.</div>
                      <div className="px-muted" style={{ fontStyle: 'italic' }}>Autonomy never removes the human override — monitor + revoke stay on permanently.</div>
                      {examError && <div className="px-muted px-warn-text">{examError}</div>}
                      <button className="px-btn px-btn-primary px-btn-sm" onClick={startExam}>Propose exam</button>
                    </>
                  )}
                </>
              ))}
            </div>

            {/* Team-Evolve */}
            <div className="px-desk" data-open={desk('team')}>
              <button className="px-desk-head" onClick={() => { toggleDesk('team'); refreshTeam(); setHandoffs(listHandoffs()); }}>
                Team-Evolve · shared team learning <span className="px-desk-caret">▸</span>
              </button>
              {deskBody('team', (
                <>
                  <div className="px-quiet-card">
                    <div className="px-quiet-title">Handoff ledger — every delegation attempt, including the refusals</div>
                    {handoffs.length === 0 && <div className="px-muted">No handoffs yet. Ask VH-19 to delegate to a peer and the attempt — or the honest refusal — is stamped here.</div>}
                    {handoffs.slice(-6).reverse().map((h) => (
                      <div key={h.id} style={{ marginTop: 6 }}>
                        <div className="px-row">
                          <span className={`px-pill ${h.outcome === 'delegated' ? 'px-pill-ok' : 'px-pill-err'}`}>{h.outcome}</span>
                          <span className="px-muted">→ {h.peer} · {h.taskDigest.slice(0, 48)}</span>
                          {h.receiptDigest && <span className="px-entry-digest">peer-receipt {h.receiptDigest.slice(0, 12)}…</span>}
                        </div>
                        <div className="px-muted">{h.detail}</div>
                      </div>
                    ))}
                  </div>
                  <div className="px-row">
                    <input className="px-input" style={{ flex: 1 }} placeholder="peer member id (e.g. qwen)" value={teamPeer} onChange={(e) => setTeamPeer(e.target.value)} onBlur={() => refreshTeam()} />
                    <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => refreshTeam()}>Load</button>
                  </div>
                  <div className="px-muted">
                    team <span className="px-mono">{teamId}</span>
                    {teamReport ? ` · ${teamReport.runs} runs · ${teamReport.verified} verified · ${Math.round(teamReport.successRate * 100)}% success` : ' · no recorded runs yet'}
                  </div>
                  {teamConfig ? (
                    <>
                      <div className="px-muted">Evolved config v{teamConfig.version}: {teamConfig.specialists.join(', ')} · adopted with {teamConfig.approvals.length}/{teamMembers.length} member approvals · digest {teamConfig.digest.slice(0, 12)}…</div>
                      <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { revokeEvolvedConfig(teamId); refreshTeam(); }}>Revoke config</button>
                    </>
                  ) : teamProposal ? (
                    <>
                      <div className="px-muted">Proposal: {teamProposal.recommendedSpecialists.join(', ')} — {teamProposal.rationale.join(' ')}</div>
                      <button className="px-btn px-btn-primary px-btn-sm" onClick={async () => {
                        const approvals = [{ memberId: localMember, approved: true, at: new Date().toISOString() }];
                        const r = await approveTeamEvolution(teamId, teamProposal.id, approvals);
                        setTeamNote(r.ok ? 'Your approval is recorded. Adoption needs EVERY member to approve — peer approvals arrive via the A2A runtime.' : r.error);
                        refreshTeam();
                      }}>Approve as {localMember}</button>
                    </>
                  ) : (
                    <button className="px-btn px-btn-ghost px-btn-sm" onClick={async () => {
                      const r = await proposeTeamEvolution(teamId, teamMembers);
                      setTeamNote(r.ok ? null : r.error);
                      refreshTeam();
                    }}>Propose evolution</button>
                  )}
                  {teamNote && <div className="px-muted px-warn-text">{teamNote}</div>}
                  <div className="px-muted" style={{ fontStyle: 'italic' }}>
                    {patterns.accepts} personal accepts · {patterns.rejects} rejects feed your private ledger; the team ledger above records joint runs only. Peer delegation runs on the host runtime (npm run host) — receipts, not promises.
                  </div>
                </>
              ))}
            </div>

            {/* Collaboration invitations */}
            <div className="px-desk" data-open={desk('collab')}>
              <button className="px-desk-head" onClick={() => { toggleDesk('collab'); setPeers(allKnownIdentities()); }}>
                Collaboration invitations · signed &amp; identity-bound <span className="px-desk-caret">▸</span>
              </button>
              {deskBody('collab', (
                <>
                  <div className="px-muted">
                    Your signing key is encrypted at rest under a passphrase (AES-GCM · PBKDF2 150k) and lives decrypted in memory only for this session. Approvals verify against BOUND identities — never against a key carried inside the approval. First contact is trust-on-first-use and says so.
                  </div>
                  <div className="px-row">
                    <input className="px-input" type="password" style={{ flex: 1 }} placeholder="identity passphrase (min 8 chars)" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
                    <button className="px-btn px-btn-primary px-btn-sm" onClick={async () => {
                      const r = await ensureIdentity(localMember, passphrase);
                      if (r.ok) { setUnlockedNow(true); setIdMsg(null); setPeers(allKnownIdentities()); }
                      else { setUnlockedNow(false); setIdMsg(r.error); }
                    }}>{unlockedNow ? 'Re-unlock' : 'Create / unlock identity'}</button>
                    {unlockedNow && <span className="px-chip">unlocked · session-only</span>}
                  </div>
                  {idMsg && <div className="px-muted px-warn-text">{idMsg}</div>}
                  <div className="px-quiet-card">
                    <div className="px-quiet-title">Invite {teamPeer || 'a peer'} to collaborate</div>
                    <div className="px-stack" style={{ marginTop: 6 }}>
                      <input className="px-input" value={inviteScope} onChange={(e) => setInviteScope(e.target.value)} placeholder="scope" />
                      <div className="px-row">
                        <select className="px-input" style={{ flex: 1 }} value={inviteCeiling} onChange={(e) => setInviteCeiling(e.target.value as 'safe' | 'risky' | 'critical')}>
                          <option value="safe">safe ceiling</option><option value="risky">risky ceiling</option><option value="critical">critical ceiling</option>
                        </select>
                        <input className="px-input" type="number" style={{ width: 76 }} value={inviteHours} onChange={(e) => setInviteHours(Number(e.target.value))} />
                      </div>
                      <button className="px-btn px-btn-primary px-btn-sm" onClick={async () => {
                        const inv = await createInvitation({ from: localMember, to: teamPeer.trim() || 'peer', scope: inviteScope, riskCeiling: inviteCeiling, durationH: inviteHours, capabilities: [] });
                        if ('digest' in inv) setInviteOut(serializeInvitation(inv));
                        else setIdMsg(inv.error);
                      }}>Create signed invite</button>
                    </div>
                    {inviteOut && (<>
                      <div className="px-muted" style={{ marginTop: 8 }}>Send this token over any channel. When {teamPeer || 'the peer'} approves, their signed approval arrives; bind their key from it.</div>
                      <textarea className="px-input px-mono" style={{ fontSize: 10.5 }} readOnly value={inviteOut} rows={3} onFocus={(e) => e.currentTarget.select()} />
                    </>)}
                    {peers.length > 0 && (<>
                      <div className="px-quiet-title" style={{ marginTop: 10 }}>Bound identities</div>
                      {peers.map((p) => (
                        <div key={p.memberId} className="px-row" style={{ marginTop: 4 }}>
                          <span className="px-muted" style={{ flex: 1 }}><b>{p.memberId}</b> · {jwkFingerprint(p.publicJwk)} · via {p.source}</span>
                          {p.source !== 'a2a-card' && <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { unbindPeer(p.memberId); setPeers(allKnownIdentities()); }}>Unbind</button>}
                        </div>
                      ))}
                    </>)}
                  </div>
                  <div className="px-quiet-card">
                    <div className="px-quiet-title">Received invite</div>
                    <textarea className="px-input px-mono" style={{ fontSize: 10.5, marginTop: 6 }} rows={3} placeholder="paste an invite token" value={received} onChange={(e) => setReceived(e.target.value)} />
                    <div className="px-row" style={{ marginTop: 6 }}>
                      <button className="px-btn px-btn-ghost px-btn-sm" onClick={async () => {
                        const r = await parseInvitation(received);
                        if (!r.ok) { setParsed(null); setParseErr(r.error); return; }
                        setParseErr(null); setParsed(r.invite); setApprovalOut(null);
                      }}>Verify</button>
                      {parsed && (<>
                        <button className="px-btn px-btn-primary px-btn-sm" onClick={async () => {
                          const r = await acceptInvitation(parsed, localMember, true);
                          if ('approval' in r) { setApprovalOut(JSON.stringify(r.approval)); setPeers(allKnownIdentities()); setIdMsg(null); }
                          else setIdMsg(r.error);
                        }}>Approve + bind issuer (sign)</button>
                        <button className="px-btn px-btn-ghost px-btn-sm" onClick={async () => {
                          const a = await signApproval(parsed.digest, localMember, false);
                          if (a && !('ok' in a)) setApprovalOut(JSON.stringify(a));
                          else if (a && 'ok' in a && a.ok === false) setIdMsg(a.error);
                        }}>Reject (sign)</button>
                      </>)}
                    </div>
                    {parseErr && <div className="px-muted px-warn-text">{parseErr}</div>}
                    {parsed && (<>
                      <div className="px-muted" style={{ marginTop: 6 }}>✓ signature verified · from <b>{parsed.payload.from}</b> · scope: {parsed.payload.scope} · ceiling: {parsed.payload.riskCeiling} · {parsed.payload.durationH}h · trust-on-first-use key, bound on approval</div>
                      {approvalOut && <textarea className="px-input px-mono" style={{ fontSize: 10.5 }} readOnly rows={2} value={approvalOut} onFocus={(e) => e.currentTarget.select()} />}
                    </>)}
                  </div>
                </>
              ))}
            </div>

            {/* Self-evolution */}
            <div className="px-desk" data-open={desk('self')}>
              <button className="px-desk-head" onClick={() => { toggleDesk('self'); setSelfList(selfProposals()); }}>
                Self-evolution · tighten-only, human-gated <span className="px-desk-caret">▸</span>
              </button>
              {deskBody('self', (
                <>
                  <div className="px-muted">Floor — never modifiable: {SELF_EVOLUTION_FLOOR.join(' · ')}. Proposals come from YOUR ledger; applying them is always your decision; every change reverts exactly.</div>
                  <button className="px-btn px-btn-ghost px-btn-sm" onClick={async () => { await proposeSelfChanges(USER); setSelfList(selfProposals()); }}>Propose from my ledger</button>
                  {selfNote && <div className="px-muted px-warn-text">{selfNote}</div>}
                  {selfList.filter((p) => p.state === 'pending').map((p) => (
                    <div key={p.id} className="px-quiet-card">
                      <div className="px-quiet-title">{p.kind} → {p.target} = {String(p.to)}</div>
                      <div className="px-quiet-sub">{p.rationale}</div>
                      <div className="px-row" style={{ marginTop: 6 }}>
                        <button className="px-btn px-btn-primary px-btn-sm" onClick={() => { const r = applySelfChange(p.id); setSelfNote(r.ok ? null : r.error); setSelfList(selfProposals()); }}>Apply</button>
                        <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { rejectSelfChange(p.id, 'user declined'); setSelfList(selfProposals()); }}>Reject</button>
                      </div>
                    </div>
                  ))}
                  {loadSelfOverrides().history.slice(-4).reverse().map((h) => (
                    <div key={h.id} className="px-row" style={{ opacity: 0.75 }}>
                      <span className="px-muted" style={{ flex: 1 }}>{h.kind} · {h.target} (applied {h.at.slice(0, 10)})</span>
                      <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { revertAppliedChange(h.id); setSelfList(selfProposals()); }}>Revert</button>
                    </div>
                  ))}
                </>
              ))}
            </div>

            {/* Bench */}
            <div className="px-desk" data-open={desk('bench')}>
              <button className="px-desk-head" onClick={() => { toggleDesk('bench'); setShowBench((v) => !v || true); refresh(); }}>
                Specialist bench · {enabledCount}/{bench.length} <span className="px-desk-caret">▸</span>
              </button>
              {deskBody('bench', (
                <>
                  <div className="px-muted">the router only fields enabled specialists — a disabled specialist is never routed to, never silently substituted. Composition, verifiable from catalogStats(): 460 seed specialists + 160 broader (19.4.0; product, business, legal, comms as first-class categories) = {stats.count}.</div>
                  {showBench ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
                      {bench.map((s) => {
                        const on = !disabled.includes(s.id);
                        return (
                          <div key={s.id} className="px-row" style={{ opacity: on ? 1 : 0.5 }}>
                            <span className="px-muted" style={{ flex: 1 }}><b style={{ color: 'var(--px-ink)' }}>{s.name}</b> · {s.category} · {effectiveRiskTier(s)}</span>
                            <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => { setSpecialistEnabled(s.id, !on); refresh(); }}>{on ? 'Disable' : 'Enable'}</button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <button className="px-btn px-btn-ghost px-btn-sm" onClick={() => setShowBench(true)}>Load the bench ({bench.length} specialists)</button>
                  )}
                </>
              ))}
            </div>

            {/* Shipyard */}
            <div className="px-desk" data-open={desk('shipyard')}>
              <button className="px-desk-head" onClick={() => { toggleDesk('shipyard'); setBuilds(listBuilds()); setTokens(usageReport()); }}>
                The Shipyard — team workspace <span className="px-desk-caret">▸</span>
              </button>
              {deskBody('shipyard', (
                <>
                  <div className="px-muted">One brief becomes work orders — one per needed domain, each led by its Captain. Orders execute through the real pipeline; nothing counts as done until it ran.</div>
                  <div className="px-row">
                    <input className="px-input" style={{ flex: 1 }} placeholder="e.g. build me a recipe app with secure auth, tests and CI" value={shipBrief} onChange={(e) => setShipBrief(e.target.value)} />
                    <button className="px-btn px-btn-primary px-btn-sm" onClick={() => { if (shipBrief.trim()) { createBuild(shipBrief.trim()); setShipBrief(''); setBuilds(listBuilds()); } }}>Start build</button>
                  </div>
                  {builds.slice(-3).reverse().map((b) => (
                    <div key={b.id} className="px-quiet-card">
                      <div className="px-row">
                        <span className="px-quiet-title" style={{ flex: 1 }}>{b.brief}</span>
                        <span className={`px-pill ${b.status === 'settled' ? 'px-pill-ok' : b.status === 'paused' ? 'px-pill-err' : 'px-pill-warn'}`}>{b.status}</span>
                      </div>
                      {b.orders.map((o) => (
                        <div key={o.id} className="px-muted" style={{ marginTop: 3 }}>· [{o.status}] {o.domain} — {o.captainName}{o.note ? ` — ${o.note.slice(0, 80)}` : ''}</div>
                      ))}
                      <div className="px-muted" style={{ marginTop: 5, opacity: 0.8 }}>{buildSummary(b)}</div>
                      <div className="px-row" style={{ marginTop: 8 }}>
                        <button className="px-btn px-btn-primary px-btn-sm" disabled={busy || b.status === 'settled'} onClick={async () => { setBusy(true); try { await advanceBuild(b.id, shipRun); } finally { setBuilds(listBuilds()); setBusy(false); refresh(); } }}>Run next</button>
                        <button className="px-btn px-btn-ghost px-btn-sm" disabled={busy || b.status === 'settled'} onClick={async () => { setBusy(true); try { await runAllOrders(b.id, shipRun); } finally { setBuilds(listBuilds()); setBusy(false); refresh(); } }}>Run all</button>
                        <button className="px-btn px-btn-ghost px-btn-sm" disabled={busy || b.status === 'settled'} onClick={async () => { setBusy(true); try { await settleBuild(b.id); } finally { setBuilds(listBuilds()); setBusy(false); refresh(); } }}>Settle</button>
                      </div>
                    </div>
                  ))}
                  <div className="px-muted">prompt-budget optimizer · token estimates (≈4 chars/token — an estimate, not a tokenizer): {tokens.calls} provider calls · {tokens.promptTokens} prompt / {tokens.replyTokens} reply tokens · {tokens.optimizedCalls} prompts trimmed · ~{tokens.savedTokens} tokens saved</div>
                </>
              ))}
            </div>
          </div>
        </aside>
      </div>

      </div>

      {/* ══ the human gate — a real modal; the run is waiting on it ══ */}
      {gateAsk && (
        <div className="px-modal-backdrop" role="dialog" aria-modal="true">
          <div className="px-card px-modal">
            <div className="px-row">
              <span className="px-pill px-pill-warn">human gate · {gateAsk.ask.riskTier} work paused</span>
            </div>
            <div className="px-modal-title">{gateAsk.ask.action}</div>
            {gateAsk.ask.summary && <div className="px-muted">{gateAsk.ask.summary}</div>}
            <input className="px-input" style={{ marginTop: 12 }} placeholder="reason if denying" value={denyReason} onChange={(e) => setDenyReason(e.target.value)} />
            {gateAsk.ask.riskTier === 'risky' && (
              <button className="px-btn px-btn-ghost px-btn-sm" style={{ marginTop: 10 }} onClick={() => {
                const cats = Array.from(new Set(gateAsk.ask.specialistIds.map((id) => getSpecialist(id)?.category).filter(Boolean))) as string[];
                cats.forEach(allowCategoryForSession);
                setSessionRules(listSessionRules());
                gateAsk.resolve(answerGateWithRules(gateAsk.ask) ?? { approved: true });
                setGateAsk(null);
              }}>Allow {Array.from(new Set(gateAsk.ask.specialistIds.map((id) => getSpecialist(id)?.category).filter(Boolean))).join(', ')} for this session</button>
            )}
            <div className="px-modal-actions">
              <button className="px-btn px-btn-ghost" onClick={() => { gateAsk.resolve({ approved: false, reason: denyReason || 'denied at the gate' }); setGateAsk(null); }}>Deny</button>
              <button className="px-btn px-btn-primary" onClick={() => { gateAsk.resolve({ approved: true }); setGateAsk(null); }}>Approve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * VH-19 — the Generalist door (18.0.1).
 *
 * The face the 18.0.0 engine was missing: the user talks to VH-19 HERE, and
 * every claim on screen is backed by the engine's honesty contract —
 * routing decisions shown with their reasons, execution status never
 * overstated (answered / planned / refused / gated-out / error /
 * peer-delegated), the human gate a real modal that blocks the run, and
 * accept/reject feeding the same memory the exam is built from.
 *
 * Session-scoped provider config lives in memory only and says so; durable
 * keys belong in the env (names shown) or the Providers door's keychain.
 */
import React, { useMemo, useRef, useState } from 'react';
import { askVH19 } from '../vh19/generalist';
import { catalogStats, listSpecialists, setSpecialistEnabled, disabledSpecialists } from '../vh19/registry';
import { patternReport, recordDecision } from '../vh19/memory';
import { autonomyStatus, gradeExam, proposeExam, revokeAutonomy, PASS_THRESHOLD } from '../vh19/exam';
import { approveTeamEvolution, autoProposeIfReady, evolvedConfig, pendingProposal, proposeTeamEvolution, revokeEvolvedConfig, teamIdFor, teamMemoryReport } from '../vh19/teamEvolve';
import { acceptInvitation, allKnownIdentities, createInvitation, ensureIdentity, jwkFingerprint, parseInvitation, serializeInvitation, signApproval, unbindPeer } from '../vh19/collabInvite';
import type { KnownIdentityRow } from '../vh19/collabRegistry';
import type { SignedInvitation } from '../vh19/collabInvite';
import { applySelfChange, loadSelfOverrides, proposeSelfChanges, rejectSelfChange, revertAppliedChange, SELF_EVOLUTION_FLOOR, selfProposals } from '../vh19/selfEvolve';
import type { SelfProposal } from '../vh19/selfEvolve';
import { effectiveRiskTier, getSpecialist } from '../vh19/registry';
import { allowCategoryForSession, answerGateWithRules, listSessionRules, revokeSessionRule } from '../vh19/gateRules';
import { createGoal, executedProgress, goalProgress, goalStatus, loadGoals, nextPendingStep, resumeGoal, settleStep } from '../vh19/goals';
import { listHandoffs, recordHandoff } from '../vh19/handoffs';
import type { HandoffRecord } from '../vh19/handoffs';
import type { Goal, StepOutcome } from '../vh19/goals';
import type { EvolvedTeamConfig, EvolutionProposal, TeamMemoryReport } from '../vh19/teamEvolve';
import { PROVIDER_DEFAULTS } from '../vh19/providers';
import type { ExamGrade, ExamSession, GateAsk, GateDecision, GeneralistResponse, ProviderConfig, ProviderKind, SpecialistCategory } from '../vh19/types';

const USER = 'local';

interface ChatMsg {
  ts?: string;
  id: number;
  role: 'user' | 'vh19';
  text: string;
  resp?: GeneralistResponse;
  scenario?: string;
  feedback?: 'accept' | 'reject';
}

const OUTCOME_LABEL: Record<GeneralistResponse['outcome'], string> = {
  answered: 'ANSWERED · executed',
  planned: 'PLANNED · not executed',
  refused: 'REFUSED',
  'gated-out': 'GATED OUT · not executed',
  error: 'ERROR · not executed',
  'peer-delegated': 'DELEGATED · executed',
};

const KINDS: ProviderKind[] = ['openai-compatible', 'anthropic', 'gemini'];

export const Vh19: React.FC = () => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<ProviderConfig | null>(null);
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
  const [form, setForm] = useState({ kind: 'openai-compatible' as ProviderKind, baseUrl: PROVIDER_DEFAULTS['openai-compatible'], model: '', apiKey: '' });
  const [examCategory, setExamCategory] = useState<SpecialistCategory | 'all'>('all');
  const [teamPeer, setTeamPeer] = useState('qwen');
  const [teamReport, setTeamReport] = useState<TeamMemoryReport | null>(null);
  const [teamProposal, setTeamProposal] = useState<EvolutionProposal | null>(null);
  const [teamConfig, setTeamConfig] = useState<EvolvedTeamConfig | null>(null);
  const [teamNote, setTeamNote] = useState<string | null>(null);
  const [showCollab, setShowCollab] = useState(false);
  const [showSelf, setShowSelf] = useState(false);
  const [inviteOut, setInviteOut] = useState<string | null>(null);
  const [inviteScope, setInviteScope] = useState('one shared mission, safe-tier ceiling');
  const [inviteCeiling, setInviteCeiling] = useState<'safe' | 'risky' | 'critical'>('safe');
  const [inviteHours, setInviteHours] = useState(24);
  const [passphrase, setPassphrase] = useState('');
  const [idMsg, setIdMsg] = useState<string | null>(null);
  const [unlockedNow, setUnlockedNow] = useState(false);
  const [peers, setPeers] = useState<KnownIdentityRow[]>([]);
  const [handoffs, setHandoffs] = useState<HandoffRecord[]>([]);
  const [received, setReceived] = useState('');
  const [parsed, setParsed] = useState<SignedInvitation | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [approvalOut, setApprovalOut] = useState<string | null>(null);
  const [selfList, setSelfList] = useState<SelfProposal[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalText, setGoalText] = useState('');
  const [sessionRules, setSessionRules] = useState<string[]>([]);
  const [selfNote, setSelfNote] = useState<string | null>(null);
  const seq = useRef(0);

  const refreshSelf = () => { setSelfList(selfProposals()); };

  const localMember = 'member-a';
  const teamMembers = [localMember, teamPeer.trim() || 'peer'].map((m) => m.toLowerCase());
  const teamId = teamIdFor(teamMembers);

  const refreshTeam = (id: string = teamId) => {
    setTeamReport(teamMemoryReport(id));
    setTeamProposal(pendingProposal(id));
    setTeamConfig(evolvedConfig(id));
    // the team self-evolves: mint a proposal automatically once the ledger clears the bar
    void autoProposeIfReady(id, teamMembers).then(() => setTeamProposal(pendingProposal(id)));
  };

  const stats = useMemo(() => catalogStats(), []);
  const bench = useMemo(() => listSpecialists(), []);
  const enabledCount = bench.length - disabled.length;

  const refresh = () => {
    setPatterns(patternReport(USER));
    setAutonomy(autonomyStatus(USER));
    setDisabled(disabledSpecialists());
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    const scenario = text;
    seq.current += 1;
    const userMsg: ChatMsg = { id: seq.current, role: 'user', text, ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages((m) => [...m, userMsg]);
    const resp = await askVH19({ text, userId: USER, team: { id: teamId, members: teamMembers } }, {
      provider,
      gate: (ask) => {
        const ruled = answerGateWithRules(ask);
        if (ruled) return Promise.resolve(ruled); // a human-standing rule answers; logged in gateRules
        return new Promise<GateDecision>((resolve) => { setDenyReason(''); setGateAsk({ ask, resolve }); });
      },
      onHandoff: (h) => recordHandoff(h),
    });
    seq.current += 1;
    setMessages((m) => [...m, { id: seq.current, role: 'vh19', text: resp.reply, resp, scenario, ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    refreshTeam();
    setBusy(false);
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

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="eyebrow mb-16">VH-19 · Generalist · the receipt log</div>
          <h1 className="display-title">One agent. The whole harbor behind it.</h1>
          <div className={`tide-bar mb-16 ${gateAsk ? 'gated' : busy ? 'busy' : ''}`} />
          <p className="view-sub">
            Talk to VH-19 — it routes to the specialist bench, pauses at the human gate for risky work,
            executes only what is real, and learns from every accept and reject. Nothing here overstates itself.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowBench((v) => !v)}>
            Bench · {enabledCount}/{bench.length} enabled
          </button>
        </div>
      </div>

      <div className="grid-4 mb-24">
        <div className="card"><div className="kpi"><div className="kpi-label">Specialist bench</div><div className="kpi-value accent">{enabledCount}<span style={{ fontSize: 14, opacity: 0.6 }}>/{stats.count}</span></div></div></div>
        <div className="card"><div className="kpi"><div className="kpi-label">Acceptance</div><div className="kpi-value">{patterns.total ? `${Math.round(patterns.acceptanceRate * 100)}%` : '—'}</div></div></div>
        <div className="card"><div className="kpi"><div className="kpi-label">Decisions learned</div><div className="kpi-value">{patterns.total}</div></div></div>
        <div className="card"><div className="kpi"><div className="kpi-label">Autonomy</div><div className="kpi-value" style={{ color: autonomy.granted ? 'var(--accent)' : undefined }}>{autonomy.granted ? 'EARNED' : 'LEARNING'}</div></div></div>
      </div>

      {autonomy.granted && (
        <div className="card mb-24" style={{ borderColor: 'var(--accent)' }}>
          <div className="row" style={{ padding: '10px 12px' }}>
            <span className="chip chip-ok"><span className="chip-dot" />autonomy earned</span>
            <div className="row-main">
              <div className="row-title">Gate-free on safe-tier work · score {autonomy.score != null ? `${Math.round(autonomy.score * 100)}%` : '—'} · monitor + override always on</div>
              <div className="row-sub">Risky and critical work still pauses at the gate. Revoking is instant and needs no exam.</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { revokeAutonomy(USER); refresh(); }}>Revoke</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16, alignItems: 'start' }}>
        {/* ── the conversation ── */}
        <div className="card" style={{ padding: 14, minHeight: 420 }}>
          <div className="eyebrow mb-16">The log — every entry a receipt</div>
          {messages.length === 0 && (
            <div className="view-sub" style={{ padding: '40px 8px', textAlign: 'center' }}>
              Ask VH-19 anything. It will show you which specialists it routed to and why —
              and it will tell you plainly when it did NOT execute.
            </div>
          )}
          <div>
            {messages.map((m, i) => (
              <div key={m.id} className={`log-entry ${m.role === 'user' ? 'user-entry' : ''}`} style={{ animationDelay: `${Math.min(i * 40, 240)}ms`, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div className="entry-no">Nº {String(i + 1).padStart(3, '0')}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`entry-time`}>{m.ts ?? ''}</span>
                  <span className={`chip ${m.role === 'user' ? '' : 'chip-ok'}`}>{m.role === 'user' ? 'you' : 'VH-19'}</span>
                  {m.resp && <span className="stamp" title={m.resp.note ?? ''} style={{ color: m.resp.outcome === 'answered' || m.resp.outcome === 'peer-delegated' ? 'var(--success)' : m.resp.outcome === 'planned' ? 'var(--aged)' : 'var(--warn)' }}>{OUTCOME_LABEL[m.resp.outcome]}</span>}
                  {m.resp && <span className="row-sub" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>proof-digest {m.resp.provenanceDigest.slice(0, 12)}…</span>}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                {m.resp && m.resp.routed.selected.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {m.resp.routed.selected.map((c) => (
                      <span key={c.id} className="chip" title={c.reasons.join(' · ')}>{c.id} · {c.score}</span>
                    ))}
                    <span className="row-sub" style={{ fontSize: 11 }}>routed by {m.resp.routed.routedBy}{m.resp.routed.fallbackReason ? ` · fallback: ${m.resp.routed.fallbackReason}` : ''}</span>
                  </div>
                )}
                {m.role === 'vh19' && m.resp && (m.resp.outcome === 'answered' || m.resp.outcome === 'planned') && !m.feedback && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => giveFeedback(m, 'accept')}>✓ Accept</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setRejectFor(m.id); setRejectReason(''); }}>✗ Reject</button>
                    {rejectFor === m.id && (
                      <>
                        <input className="input" placeholder="why? (this is the learning payload)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} style={{ flex: 1 }} />
                        <button className="btn btn-primary btn-sm" onClick={() => { giveFeedback(m, 'reject', rejectReason || undefined); setRejectFor(null); }}>Record</button>
                      </>
                    )}
                  </div>
                )}
                {m.feedback && <div className="row-sub" style={{ fontSize: 11 }}>learned: {m.feedback}ed</div>}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input className="input" placeholder={provider ? 'Ask VH-19…' : 'Ask VH-19… (no provider connected — answers will be plans, not executions)'} value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={() => void send()} disabled={busy}>{busy ? 'Working…' : 'Send'}</button>
          </div>
        </div>

        {/* ── the side desk ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="eyebrow mb-16">Provider</div>
            {provider ? (
              <>
                <div className="row-sub mb-16">Connected: {provider.kind} · {provider.model} · in memory only (this session)</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setProvider(null)}>Disconnect</button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} className="mb-16">
                  <select className="input" value={form.kind} onChange={(e) => { const kind = e.target.value as ProviderKind; setForm((f) => ({ ...f, kind, baseUrl: PROVIDER_DEFAULTS[kind] })); }}>
                    {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <input className="input" placeholder="base URL" value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} />
                  <input className="input" placeholder="model (e.g. gpt-4.1)" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
                  <input className="input" type="password" placeholder="API key — held in memory only" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} />
                  <button className="btn btn-primary btn-sm" disabled={!form.model || !form.apiKey}
                    onClick={() => setProvider({ kind: form.kind, baseUrl: form.baseUrl.replace(/\/+$/, ''), apiKey: form.apiKey.trim(), model: form.model.trim() })}>
                    Connect
                  </button>
                </div>
                <div className="row-sub" style={{ fontSize: 11 }}>
                  Keys are never written to disk from this panel. For durable config use env:
                  VH_OPENAI_API_KEY / VH_ANTHROPIC_API_KEY / VH_GEMINI_API_KEY (base URLs overridable via VH_*_BASE_URL).
                </div>
              </>
            )}
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div className="eyebrow mb-16">Autonomy exam · ≥{Math.round(PASS_THRESHOLD * 100)}%</div>
            <select className="input mb-16" value={examCategory} onChange={(e) => setExamCategory(e.target.value as SpecialistCategory | 'all')}>
              <option value="all">overall (all categories)</option>
              {Array.from(new Set(bench.map((b) => b.category))).sort().map((c) => <option key={c} value={c}>{c} only</option>)}
            </select>
            {exam ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                {exam.questions.map((q, i) => (
                  <div key={q.id} style={{ padding: 10, background: 'var(--bg)' }}>
                    <div className="row-title" style={{ fontSize: 12 }}>{i + 1}. {q.scenario}</div>
                    <div className="row-sub" style={{ whiteSpace: 'pre-wrap' }}>Would do: {q.proposedAction}</div>
                    <div className="row-sub" style={{ fontSize: 11, fontStyle: 'italic' }}>Why: {q.explanation}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button className={`btn btn-ghost btn-sm ${grades[q.id]?.verdict === 'correct' ? 'btn-primary' : ''}`}
                        onClick={() => setGrades((g) => ({ ...g, [q.id]: { questionId: q.id, verdict: 'correct' } }))}>Correct</button>
                      <button className={`btn btn-ghost btn-sm ${grades[q.id]?.verdict === 'wrong' ? 'btn-primary' : ''}`}
                        onClick={() => setGrades((g) => ({ ...g, [q.id]: { questionId: q.id, verdict: 'wrong', correction: g[q.id]?.correction } }))}>Wrong</button>
                    </div>
                    {grades[q.id]?.verdict === 'wrong' && (
                      <input className="input" style={{ marginTop: 6 }} placeholder="correction — the agent learns this" value={grades[q.id]?.correction ?? ''}
                        onChange={(e) => setGrades((g) => ({ ...g, [q.id]: { ...g[q.id], correction: e.target.value } }))} />
                    )}
                  </div>
                ))}
                <button className="btn btn-primary btn-sm" onClick={submitExam}
                  disabled={exam.questions.some((q) => !grades[q.id])}>Submit grades</button>
              </div>
            ) : examResult ? (
              <>
                <div className="kpi"><div className="kpi-label">Last exam</div><div className="kpi-value" style={{ color: examResult.passed ? 'var(--accent)' : 'var(--warn)' }}>{Math.round(examResult.score * 100)}% · {examResult.passed ? 'PASSED' : 'NOT PASSED'}</div></div>
                <div className="row-sub mt-16">{examResult.passed ? 'Autonomy earned — monitor + override permanently on.' : 'Below the bar. Wrong answers became corrections in memory; keep working and re-exam.'}</div>
                <button className="btn btn-ghost btn-sm mt-16" onClick={startExam}>New exam</button>
              </>
            ) : (
              <>
                <div className="row-sub mb-16">Questions are generated ONLY from your real accept/reject history — never invented. You grade; ≥{Math.round(PASS_THRESHOLD * 100)}% earns autonomy.</div>
                <div className="row-sub mb-16" style={{ fontSize: 11, fontStyle: 'italic' }}>Autonomy never removes the human override — monitor + revoke stay on permanently.</div>
                {examError && <div className="row-sub mb-16" style={{ color: 'var(--warn)' }}>{examError}</div>}
                <button className="btn btn-primary btn-sm" onClick={startExam}>Propose exam</button>
              </>
            )}
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div className="eyebrow mb-16">Team-Evolve · shared team learning</div>
            <div className="eyebrow mb-16">Handoff ledger — every delegation attempt, including the refusals</div>
            {handoffs.length === 0 && <div className="row-sub mb-16" style={{ fontSize: 11 }}>No handoffs yet. Ask VH-19 to delegate to a peer and the attempt — or the honest refusal — is stamped here.</div>}
            {handoffs.slice(-6).reverse().map((h) => (
              <div key={h.id} className="row mb-16" style={{ padding: '8px 10px', background: 'var(--bg)' }}>
                <div className="row-title" style={{ fontSize: 11 }}>
                  <span className="stamp" style={{ color: h.outcome === 'delegated' ? 'var(--success)' : 'var(--err)' }}>{h.outcome}</span>{' '}
                  → {h.peer} · {h.taskDigest.slice(0, 48)}
                  {h.receiptDigest && <span className="row-sub" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}> peer-receipt {h.receiptDigest.slice(0, 12)}…</span>}
                </div>
                <div className="row-sub" style={{ fontSize: 10 }}>{h.detail}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6 }} className="mb-16">
              <input className="input" placeholder="peer member id (e.g. qwen)" value={teamPeer} onChange={(e) => setTeamPeer(e.target.value)} onBlur={() => refreshTeam()} />
              <button className="btn btn-ghost btn-sm" onClick={() => refreshTeam()}>Load</button>
            </div>
            <div className="row-sub mb-16" style={{ fontSize: 11 }}>
              team <span style={{ fontFamily: 'var(--font-mono)' }}>{teamId}</span>
              {teamReport ? ` · ${teamReport.runs} runs · ${teamReport.verified} verified · ${Math.round(teamReport.successRate * 100)}% success` : ' · no recorded runs yet'}
            </div>
            {teamConfig ? (
              <>
                <div className="row-sub mb-16">
                  Evolved config v{teamConfig.version}: {teamConfig.specialists.join(', ')} · adopted with {teamConfig.approvals.length}/{teamMembers.length} member approvals · digest {teamConfig.digest.slice(0, 12)}…
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => { revokeEvolvedConfig(teamId); refreshTeam(); }}>Revoke config</button>
              </>
            ) : teamProposal ? (
              <>
                <div className="row-sub mb-16">Proposal: {teamProposal.recommendedSpecialists.join(', ')}</div>
                <div className="row-sub mb-16" style={{ fontSize: 11 }}>{teamProposal.rationale.join(' ')}</div>
                <button className="btn btn-primary btn-sm" onClick={async () => {
                  const approvals = [{ memberId: localMember, approved: true, at: new Date().toISOString() }];
                  const r = await approveTeamEvolution(teamId, teamProposal.id, approvals);
                  setTeamNote(r.ok ? 'Your approval is recorded. Adoption needs EVERY member to approve — peer approvals arrive via the A2A runtime.' : r.error);
                  refreshTeam();
                }}>Approve as {localMember}</button>
              </>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                const r = await proposeTeamEvolution(teamId, teamMembers);
                setTeamNote(r.ok ? null : r.error);
                refreshTeam();
              }}>Propose evolution</button>
            )}
            {teamNote && <div className="row-sub mt-16" style={{ fontSize: 11, color: 'var(--warn)' }}>{teamNote}</div>}
            <div className="row-sub mt-16" style={{ fontSize: 11, fontStyle: 'italic' }}>
              {patterns.accepts} personal accepts · {patterns.rejects} rejects feed your private ledger; the team ledger above records joint runs only. Peer delegation runs on the host runtime (npm run host) — receipts, not promises.
            </div>
          </div>
        </div>
      </div>

      {/* ── collaboration invitations — hardened (18.3.0) ── */}
      <div className="card mt-16" style={{ padding: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { setShowCollab((v) => !v); setPeers(allKnownIdentities()); setHandoffs(listHandoffs()); }}>{showCollab ? '▾' : '▸'} Collaboration invitations · signed &amp; identity-bound</button>
        {showCollab && (
          <div style={{ marginTop: 12 }}>
            <div className="row-sub mb-16" style={{ fontSize: 11 }}>
              Your signing key is encrypted at rest under a passphrase (AES-GCM · PBKDF2 150k) and lives decrypted in memory only for this session. Approvals verify against BOUND identities — never against a key carried inside the approval. First contact is trust-on-first-use and says so.
            </div>
            <div className="eyebrow mb-16">Handoff ledger — every delegation attempt, including the refusals</div>
            {handoffs.length === 0 && <div className="row-sub mb-16" style={{ fontSize: 11 }}>No handoffs yet. Ask VH-19 to delegate to a peer and the attempt — or the honest refusal — is stamped here.</div>}
            {handoffs.slice(-6).reverse().map((h) => (
              <div key={h.id} className="row mb-16" style={{ padding: '8px 10px', background: 'var(--bg)' }}>
                <div className="row-title" style={{ fontSize: 11 }}>
                  <span className="stamp" style={{ color: h.outcome === 'delegated' ? 'var(--success)' : 'var(--err)' }}>{h.outcome}</span>{' '}
                  → {h.peer} · {h.taskDigest.slice(0, 48)}
                  {h.receiptDigest && <span className="row-sub" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}> peer-receipt {h.receiptDigest.slice(0, 12)}…</span>}
                </div>
                <div className="row-sub" style={{ fontSize: 10 }}>{h.detail}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6 }} className="mb-16">
              <input className="input" type="password" placeholder="identity passphrase (min 8 chars)" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} style={{ maxWidth: 260 }} />
              <button className="btn btn-primary btn-sm" onClick={async () => {
                const r = await ensureIdentity(localMember, passphrase);
                if (r.ok) { setUnlockedNow(true); setIdMsg(null); setPeers(allKnownIdentities()); }
                else { setUnlockedNow(false); setIdMsg(r.error); }
              }}>{unlockedNow ? 'Re-unlock' : 'Create / unlock identity'}</button>
              {unlockedNow && <span className="chip">unlocked · session-only</span>}
            </div>
            {idMsg && <div className="row-sub mb-16" style={{ fontSize: 11, color: 'var(--warn)' }}>{idMsg}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div className="eyebrow mb-16">Invite {teamPeer || 'a peer'} to collaborate</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} className="mb-16">
                  <input className="input" value={inviteScope} onChange={(e) => setInviteScope(e.target.value)} placeholder="scope" />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select className="input" value={inviteCeiling} onChange={(e) => setInviteCeiling(e.target.value as 'safe' | 'risky' | 'critical')}>
                      <option value="safe">safe ceiling</option><option value="risky">risky ceiling</option><option value="critical">critical ceiling</option>
                    </select>
                    <input className="input" type="number" value={inviteHours} onChange={(e) => setInviteHours(Number(e.target.value))} style={{ width: 70 }} />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={async () => {
                    const inv = await createInvitation({ from: localMember, to: teamPeer.trim() || 'peer', scope: inviteScope, riskCeiling: inviteCeiling, durationH: inviteHours, capabilities: [] });
                    if ('digest' in inv) setInviteOut(serializeInvitation(inv));
                    else setIdMsg(inv.error);
                  }}>Create signed invite</button>
                </div>
                {inviteOut && (<>
                  <div className="row-sub mb-16" style={{ fontSize: 11 }}>Send this token over any channel. When {teamPeer || 'the peer'} approves, their signed approval arrives; bind their key from it (or let invite acceptance bind the issuer).</div>
                  <textarea className="input" readOnly value={inviteOut} rows={3} onFocus={(e) => e.currentTarget.select()} />
                </>)}
                {peers.length > 0 && (<div className="mt-16">
                  <div className="eyebrow mb-16">Bound identities</div>
                  {peers.map((p) => (
                    <div key={p.memberId} className="row" style={{ padding: '6px 10px', marginBottom: 4 }}>
                      <div className="row-sub" style={{ fontSize: 11 }}><b>{p.memberId}</b> · {jwkFingerprint(p.publicJwk)} · via {p.source}</div>
                      {p.source !== 'a2a-card' && <button className="btn btn-ghost btn-sm" onClick={() => { unbindPeer(p.memberId); setPeers(allKnownIdentities()); }}>Unbind</button>}
                    </div>
                  ))}
                </div>)}
              </div>
              <div>
                <div className="eyebrow mb-16">Received invite</div>
                <textarea className="input mb-16" rows={3} placeholder="paste an invite token" value={received} onChange={(e) => setReceived(e.target.value)} />
                <div className="eyebrow mb-16">Handoff ledger — every delegation attempt, including the refusals</div>
            {handoffs.length === 0 && <div className="row-sub mb-16" style={{ fontSize: 11 }}>No handoffs yet. Ask VH-19 to delegate to a peer and the attempt — or the honest refusal — is stamped here.</div>}
            {handoffs.slice(-6).reverse().map((h) => (
              <div key={h.id} className="row mb-16" style={{ padding: '8px 10px', background: 'var(--bg)' }}>
                <div className="row-title" style={{ fontSize: 11 }}>
                  <span className="stamp" style={{ color: h.outcome === 'delegated' ? 'var(--success)' : 'var(--err)' }}>{h.outcome}</span>{' '}
                  → {h.peer} · {h.taskDigest.slice(0, 48)}
                  {h.receiptDigest && <span className="row-sub" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}> peer-receipt {h.receiptDigest.slice(0, 12)}…</span>}
                </div>
                <div className="row-sub" style={{ fontSize: 10 }}>{h.detail}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6 }} className="mb-16">
                  <button className="btn btn-ghost btn-sm" onClick={async () => {
                    const r = await parseInvitation(received);
                    if (!r.ok) { setParsed(null); setParseErr(r.error); return; }
                    setParseErr(null); setParsed(r.invite); setApprovalOut(null);
                  }}>Verify</button>
                  {parsed && (<>
                    <button className="btn btn-primary btn-sm" onClick={async () => {
                      const r = await acceptInvitation(parsed, localMember, true);
                      if ('approval' in r) { setApprovalOut(JSON.stringify(r.approval)); setPeers(allKnownIdentities()); setIdMsg(null); }
                      else setIdMsg(r.error);
                    }}>Approve + bind issuer (sign)</button>
                    <button className="btn btn-ghost btn-sm" onClick={async () => {
                      const a = await signApproval(parsed.digest, localMember, false);
                      if (a && !('ok' in a)) setApprovalOut(JSON.stringify(a));
                      else if (a && 'ok' in a && a.ok === false) setIdMsg(a.error);
                    }}>Reject (sign)</button>
                  </>)}
                </div>
                {parseErr && <div className="row-sub" style={{ color: 'var(--warn)', fontSize: 11 }}>{parseErr}</div>}
                {parsed && (<>
                  <div className="row-sub" style={{ fontSize: 11 }}>✓ signature verified · from <b>{parsed.payload.from}</b> · scope: {parsed.payload.scope} · ceiling: {parsed.payload.riskCeiling} · {parsed.payload.durationH}h · trust-on-first-use key, bound on approval</div>
                  {approvalOut && <textarea className="input" readOnly rows={2} value={approvalOut} style={{ marginTop: 6 }} onFocus={(e) => e.currentTarget.select()} />}
                </>)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── recursive self-evolution (18.2.0) ── */}
      <div className="card mt-16" style={{ padding: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { setShowSelf((v) => !v); refreshSelf(); }}>{showSelf ? '▾' : '▸'} Self-evolution · tighten-only, human-gated</button>
        {showSelf && (
          <div style={{ marginTop: 12 }}>
            <div className="row-sub mb-16" style={{ fontSize: 11 }}>
              Floor — never modifiable: {SELF_EVOLUTION_FLOOR.join(' · ')}. Proposals come from YOUR ledger; applying them is always your decision; every change reverts exactly.
            </div>
            <button className="btn btn-ghost btn-sm mb-16" onClick={async () => { await proposeSelfChanges(USER); refreshSelf(); }}>Propose from my ledger</button>
            {selfNote && <div className="row-sub mb-16" style={{ fontSize: 11, color: 'var(--warn)' }}>{selfNote}</div>}
            {selfList.filter((p) => p.state === 'pending').map((p) => (
              <div key={p.id} className="row" style={{ padding: '8px 10px', background: 'var(--bg)', marginBottom: 6 }}>
                <div className="row-main">
                  <div className="row-title" style={{ fontSize: 12 }}>{p.kind} → {p.target} = {String(p.to)}</div>
                  <div className="row-sub" style={{ fontSize: 11 }}>{p.rationale}</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { const r = applySelfChange(p.id); setSelfNote(r.ok ? null : r.error); refreshSelf(); }}>Apply</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { rejectSelfChange(p.id, 'user declined'); refreshSelf(); }}>Reject</button>
              </div>
            ))}
            {loadSelfOverrides().history.slice(-4).reverse().map((h) => (
              <div key={h.id} className="row" style={{ padding: '6px 10px', opacity: 0.75, marginBottom: 4 }}>
                <div className="row-sub" style={{ fontSize: 11 }}>{h.kind} · {h.target} (applied {h.at.slice(0, 10)})</div>
                <button className="btn btn-ghost btn-sm" onClick={() => { revertAppliedChange(h.id); refreshSelf(); }}>Revert</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── assignments — goal mode (18.5.0) ── */}
      <div className="card mt-16" style={{ padding: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { setGoals(loadGoals()); setSessionRules(listSessionRules()); }}>↻ Assignments · goal mode</button>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6 }} className="mb-16">
            <input className="input" placeholder="hand VH a goal — it decomposes with its own router and checkpoints every step" value={goalText} onChange={(e) => setGoalText(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={() => { if (goalText.trim()) { createGoal(USER, goalText.trim()); setGoalText(''); setGoals(loadGoals()); } }}>Assign</button>
          </div>
          {sessionRules.length > 0 && (
            <div className="row-sub mb-16" style={{ fontSize: 11 }}>session auto-review rules (forgotten on restart): {sessionRules.map((c) => (
              <span key={c} className="chip" style={{ marginRight: 4 }}>{c} <button className="btn btn-ghost btn-sm" style={{ padding: 0, marginLeft: 4 }} onClick={() => { revokeSessionRule(c); setSessionRules(listSessionRules()); }}>×</button></span>
            ))}</div>
          )}
          {goals.slice(-4).reverse().map((g) => (
            <div key={g.id} className="row" style={{ padding: '10px 12px', background: 'var(--bg)', marginBottom: 8, display: 'block' }}>
              <div className="row-title" style={{ fontSize: 12 }}>{g.text}{' '}
                <span className="stamp" style={{ color: goalStatus(g) === 'DONE' ? 'var(--success)' : goalStatus(g) === 'IN-PROGRESS' ? 'var(--aged)' : 'var(--warn)' }}>{goalStatus(g)}</span>{' '}
                <span className="chip">{executedProgress(g)}% executed</span>{' '}
                <span className="chip" title="settled = decided either way; executed = actually ran">{goalProgress(g)}% settled</span>
              </div>
              {g.steps.map((s) => (
                <div key={s.id} className="row-sub" style={{ fontSize: 11, marginTop: 3 }}>· [{s.status}] {s.title}{s.note ? ` — ${s.note}` : ''}</div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {g.state !== 'done' && g.state !== 'settled' && <button className="btn btn-primary btn-sm" disabled={busy} onClick={async () => {
                  const step = nextPendingStep(g); if (!step) return;
                  setBusy(true);
                  const resp = await askVH19({ text: `${g.text} — step: ${step.title}`, userId: USER, team: { id: teamId, members: teamMembers } }, {
                    provider,
                    gate: (ask) => {
                      const ruled = answerGateWithRules(ask);
                      if (ruled) return Promise.resolve(ruled);
                      return new Promise<GateDecision>((resolve) => { setDenyReason(''); setGateAsk({ ask, resolve }); });
                    },
                    onHandoff: (h) => recordHandoff(h),
                  });
                  const outcome: StepOutcome =
                    resp.outcome === 'answered' || resp.outcome === 'peer-delegated'
                      ? { status: 'done', receiptDigest: resp.provenanceDigest, note: resp.reply.slice(0, 120) }
                      : resp.outcome === 'planned'
                        ? { status: 'planned', note: 'no provider key — delivered as a plan, honestly' }
                        : resp.outcome === 'gated-out'
                          ? { status: 'refused', note: 'denied at the human gate' }
                          : { status: 'refused', note: resp.outcome };
                  settleStep(g.id, step.id, outcome);
                  setGoals(loadGoals());
                  setBusy(false);
                }}>Run next step</button>}
                {g.state === 'paused' && <button className="btn btn-ghost btn-sm" onClick={() => { resumeGoal(g.id); setGoals(loadGoals()); }}>Resume</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── bench management ── */}
      {showBench && (
        <div className="card mt-16" style={{ padding: 14 }}>
          <div className="eyebrow mb-16">Specialist bench · {enabledCount}/{bench.length} enabled · the router only fields enabled specialists</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
            {bench.map((s) => {
              const on = !disabled.includes(s.id);
              return (
                <div key={s.id} className="row" style={{ padding: '8px 10px', background: 'var(--bg)', opacity: on ? 1 : 0.55 }}>
                  <div className="row-main">
                    <div className="row-title" style={{ fontSize: 12 }}>{s.name}</div>
                    <div className="row-sub" style={{ fontSize: 11 }}>{s.category} · {effectiveRiskTier(s)}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setSpecialistEnabled(s.id, !on); refresh(); }}>{on ? 'Disable' : 'Enable'}</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── the human gate: a real modal, the run is waiting on it ── */}
      {gateAsk && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: 520, padding: 18 }}>
            <div className="eyebrow mb-16" style={{ color: 'var(--warn)' }}>⟁ Human gate · {gateAsk.ask.riskTier} work is paused</div>
            <div className="row-title mb-16">{gateAsk.ask.action}</div>
            {gateAsk.ask.summary && <div className="row-sub mb-16">{gateAsk.ask.summary}</div>}
            <input className="input mb-16" placeholder="reason if denying" value={denyReason} onChange={(e) => setDenyReason(e.target.value)} />
            {gateAsk.ask.riskTier === 'risky' && (
              <button className="btn btn-ghost btn-sm mb-16" onClick={() => {
                const cats = Array.from(new Set(gateAsk.ask.specialistIds.map((id) => getSpecialist(id)?.category).filter(Boolean))) as string[];
                cats.forEach(allowCategoryForSession);
                setSessionRules(listSessionRules());
                gateAsk.resolve(answerGateWithRules(gateAsk.ask) ?? { approved: true });
                setGateAsk(null);
              }}>Allow {Array.from(new Set(gateAsk.ask.specialistIds.map((id) => getSpecialist(id)?.category).filter(Boolean))).join(', ')} for this session</button>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { gateAsk.resolve({ approved: false, reason: denyReason || 'denied at the gate' }); setGateAsk(null); }}>Deny</button>
              <button className="btn btn-primary btn-sm" onClick={() => { gateAsk.resolve({ approved: true }); setGateAsk(null); }}>Approve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

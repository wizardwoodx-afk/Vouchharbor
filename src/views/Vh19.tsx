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
import { PROVIDER_DEFAULTS } from '../vh19/providers';
import type { ExamGrade, ExamSession, GateAsk, GateDecision, GeneralistResponse, ProviderConfig, ProviderKind } from '../vh19/types';

const USER = 'local';

interface ChatMsg {
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
  const seq = useRef(0);

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
    const userMsg: ChatMsg = { id: seq.current, role: 'user', text };
    setMessages((m) => [...m, userMsg]);
    const resp = await askVH19({ text, userId: USER }, {
      provider,
      gate: (ask) => new Promise<GateDecision>((resolve) => { setDenyReason(''); setGateAsk({ ask, resolve }); }),
    });
    seq.current += 1;
    setMessages((m) => [...m, { id: seq.current, role: 'vh19', text: resp.reply, resp, scenario }]);
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
    const r = proposeExam(USER, 10);
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
          <div className="eyebrow mb-16">VH-19 · Generalist</div>
          <h1 className="view-title">One agent. The whole harbor behind it.</h1>
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
          <div className="eyebrow mb-16">Conversation</div>
          {messages.length === 0 && (
            <div className="view-sub" style={{ padding: '40px 8px', textAlign: 'center' }}>
              Ask VH-19 anything. It will show you which specialists it routed to and why —
              and it will tell you plainly when it did NOT execute.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m) => (
              <div key={m.id} className="row" style={{ padding: '10px 12px', background: 'var(--bg)', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`chip ${m.role === 'user' ? '' : 'chip-ok'}`}>{m.role === 'user' ? 'you' : 'VH-19'}</span>
                  {m.resp && <span className="chip" title={m.resp.note ?? ''}>{OUTCOME_LABEL[m.resp.outcome]}</span>}
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
            <div className="eyebrow mb-16">Team memory · Team-Evolve</div>
            <div className="row-sub mb-16">
              {patterns.accepts} accepted · {patterns.rejects} rejected · {patterns.corrections} corrections.
              These shape every future briefing; the bench you keep enabled plus this ledger is the evolving team.
            </div>
            {patterns.recentRejections.slice(-3).reverse().map((r) => (
              <div key={r.id} className="row-sub" style={{ fontSize: 11, marginBottom: 4 }}>✗ {r.scenario.slice(0, 60)}{r.reason ? ` — ${r.reason.slice(0, 60)}` : ''}</div>
            ))}
            <div className="row-sub" style={{ fontSize: 11, fontStyle: 'italic' }}>Cross-user (A2A) team evolution runs on the host runtime (npm run host) — receipts, not promises.</div>
          </div>
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
                    <div className="row-sub" style={{ fontSize: 11 }}>{s.category} · {s.riskTier}</div>
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

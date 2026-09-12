import React from 'react';
import { useHarbor } from '../app/harbor';
import type { VouchTraceStep } from '../vouch/engine/vouch';

const STATUS_LABEL: Record<string, string> = {
  routing: 'ROUTE', planning: 'PLOT', sailing: 'SAIL', gate: 'GATE',
  verify: 'VERIFY', sealed: 'SEAL', failed: 'FAILED', denied: 'DENIED',
};

const RELATIVE = (ts: number): string => {
  const d = Math.max(0, Date.now() - ts);
  if (d < 60_000) return `${Math.max(1, Math.floor(d / 1000))}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
};

export const Harbor: React.FC = () => {
  const { state, actions } = useHarbor();
  const { totals, voyages, activeThread, receipts } = state;

  // Last messages from the active thread (the Helm conversation)
  const recent = [...activeThread.messages].slice(-6).reverse();
  const pending = totals.pendingApprovalsList;

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="eyebrow mb-16">Harbor</div>
          <h1 className="view-title">The water is live.</h1>
          <p className="view-sub">Every voyage sails through the governed Helm — real engine, real receipts, no mock.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => actions.newThread()}>+ Signal a thread</button>
          <button className="btn btn-primary btn-sm" onClick={actions.launchVoyage}>Launch voyage</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-4 mb-24">
        <div className="card"><div className="kpi"><div className="kpi-label">Sealed voyages</div><div className="kpi-value accent">{totals.sealedVoyages}</div></div></div>
        <div className="card"><div className="kpi"><div className="kpi-label">Hands on deck</div><div className="kpi-value">{totals.handsOnDeck}</div></div></div>
        <div className="card"><div className="kpi"><div className="kpi-label">Signed acts</div><div className="kpi-value">{totals.signedActs}</div></div></div>
        <div className="card"><div className="kpi"><div className="kpi-label">Safe harbor</div><div className="kpi-value accent">{totals.assuranceScore}</div></div></div>
      </div>

      {/* Pending approvals (human gate) */}
      {pending.length > 0 && (
        <div className="card mb-24" style={{ borderColor: 'var(--warn)', boxShadow: '0 0 0 1px var(--warn-soft)' }}>
          <div className="eyebrow mb-16" style={{ color: 'var(--warn)' }}>⟁ Gate · human decision required</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(a => (
              <div key={a.id} className="row" style={{ padding: '12px 12px', background: 'var(--bg)' }}>
                <span className="chip chip-warn"><span className="chip-dot"/>awaiting</span>
                <div className="row-main">
                  <div className="row-title" style={{ fontFamily: 'var(--font-mono)' }}>{a.action}</div>
                  <div className="row-sub" style={{ whiteSpace: 'pre-wrap' }}>{a.detail}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => actions.approve(a.id, false)}>Deny</button>
                <button className="btn btn-primary btn-sm" onClick={() => actions.approve(a.id, true)}>Make it so</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voyage chain — the 8 phases per recent voyage */}
      <div className="card mb-24">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div className="eyebrow">Voyage chain</div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-md)', fontWeight: 600, marginTop: 4 }}>The wake</h3>
          </div>
          <span className="chip chip-done"><span className="chip-dot"/>live engine · {totals.brain}</span>
        </div>
        {voyages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚓</div>
            <div>No voyages yet — type a command into the Helm below to set sail.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {voyages.slice(0, 10).map(v => {
              const steps = ['ROUTE','RECALL','PLOT','WEATHER','GATE','SAIL','VERIFY','SEAL'];
              const stepForStatus = (): number => {
                switch (v.status) {
                  case 'routing': return 0;
                  case 'planning': return 2;
                  case 'sailing': return 5;
                  case 'gate': return 4;
                  case 'verify': return 6;
                  case 'sealed': return 7;
                  case 'failed': return 6;
                  case 'denied': return 4;
                  default: return 7;
                }
              };
              const current = stepForStatus();
              return (
                <div key={v.id} className="row" style={{ padding: '12px 12px', flexWrap: 'wrap', gap: 8 }}>
                  <span className={`chip ${v.status === 'sealed' ? 'chip-done' : v.status === 'failed' ? 'chip-err' : v.status === 'denied' ? 'chip-idle' : 'chip-run'}`}>
                    <span className="chip-dot"/>{STATUS_LABEL[v.status] ?? v.status}
                  </span>
                  <div className="row-main" style={{ minWidth: 240 }}>
                    <div className="row-title">{v.objective}</div>
                    <div className="row-sub">
                      {v.teamName} · {v.engine} · {v.signed ? '✓ sealed' : 'in motion'} · {RELATIVE(v.startedAt)}
                      {v.optimalSteps !== undefined && v.driftNodes && v.driftNodes.length > 0 && (
                        <> · <span style={{ color: 'var(--warn)' }}>hindsight: {v.driftNodes.join(', ')}</span></>
                      )}
                    </div>
                  </div>
                  <div className="voyage-phases">
                    {steps.map((s, i) => (
                      <span key={s} className={`phase-dot ${i <= current ? (v.status === 'failed' && i === current ? 'err' : v.status === 'denied' && i === current ? 'denied' : 'done') : 'idle'}`}>{s}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* The Helm conversation */}
      <div className="grid-2">
        <div className="card">
          <div className="eyebrow mb-16">Log · {activeThread.title}</div>
          {recent.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 'var(--fs-sm)', padding: '20px 0', textAlign: 'center' }}>
              The Helm is quiet. Address it below.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {recent.map(m => (
                <div key={m.id} className={m.role === 'user' ? 'log-line user' : 'log-line vouch'}>
                  <div className="log-who">{m.role === 'user' ? 'Helm' : 'Vouch'}</div>
                  <div className="log-text">
                    {m.text || (m.streaming ? <em>thinking…</em> : '')}
                    {m.trace.some(t => t.kind === 'receipt') && (
                      <div className="log-receipt">
                        ⚓ receipt minted · <span className="mono">{(m.trace.find((t): t is Extract<VouchTraceStep, { kind: 'receipt' }> => t.kind === 'receipt'))?.receiptId.slice(0, 18) ?? '…'}…</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="eyebrow mb-16">Weather glass</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 2 }}>
              <div>win rate            <span style={{ color: 'var(--accent)' }}>{totals.winRate}%</span></div>
              <div>sealed receipts     <span style={{ color: 'var(--accent)' }}>{receipts.length}</span></div>
              <div>skills learned      <span>{state.session.skills.length}</span></div>
              <div>facts remembered    <span>{state.session.facts.length}</span></div>
              <div>brain               <span>{totals.brain}</span></div>
              <div>mode                <span>{totals.mode}</span></div>
            </div>
          </div>
          <div className="card">
            <div className="eyebrow mb-16">Hands on deck</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {state.seats.map(s => (
                <span key={s.id} className="chip chip-done"><span className="chip-dot"/>{s.name}</span>
              ))}
            </div>
            <div className="hr"/>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              Crew {totals.configuredCrews === 0 ? 'is mustered on this machine' : `"${totals.activeCrew?.name}" is on watch`}. Real harnesses answer when their CLI is installed; unreadable CLIs are reported, never faked.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

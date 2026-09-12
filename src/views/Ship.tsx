import React from 'react';
import { useHarbor } from '../app/harbor';

export const Ship: React.FC = () => {
  const { state, actions } = useHarbor();
  const seats = state.seats;
  const crew = state.totals.configuredCrews > 0 ? state.totals.activeCrew : null;
  const skills = state.session.skills;
  const wins = state.voyages.filter(v => v.status === 'sealed').length;
  const runs = state.voyages.length;
  const winRate = runs > 0 ? Math.round((wins / runs) * 100) : 0;

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="eyebrow mb-16">Ship</div>
          <h1 className="view-title">Your seats. One team.</h1>
          <p className="view-sub">Every hand runs on a real harness, carries an attenuated authority envelope, and writes to an isolated worktree.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={actions.rerate}>Re-rate</button>
          <button className="btn btn-primary btn-sm" onClick={actions.musterHand}>+ Muster a hand</button>
        </div>
      </div>

      <div className="grid-2 mb-24">
        <div className="card">
          <div className="kpi"><div className="kpi-label">Hands on deck</div><div className="kpi-value">{seats.length}</div></div>
        </div>
        <div className="card">
          <div className="kpi"><div className="kpi-label">Safe passage</div><div className="kpi-value accent">{winRate}%</div></div>
        </div>
      </div>

      <div className="card mb-24" style={{ padding: 0 }}>
        <div style={{ padding: '22px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-lg)', fontWeight: 600 }}>This ship's complement</h3>
          <span className="chip chip-done"><span className="chip-dot"/>{crew ? crew.name : 'shore watch'}</span>
        </div>
        <div style={{ padding: '8px 0' }}>
          {seats.map((s, i) => (
            <div key={s.id} className="row" style={{ padding: '14px 22px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-elev)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 12, flexShrink: 0 }}>{i+1}</div>
              <div className="row-main">
                <div className="row-title">{s.name} <span className="mono dim" style={{ fontSize: 11 }}>· {s.harness}</span></div>
                <div className="row-sub">{s.role} · {s.status === 'idle' ? 'idle at mooring' : s.status}</div>
              </div>
              <span className={`chip ${s.status === 'idle' ? 'chip-idle' : 'chip-run'}`}><span className="chip-dot"/>{s.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="eyebrow mb-16">Ship's articles</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 2 }}>
            <div>crew               <span className="accent">{crew?.name ?? 'shore watch (default)'}</span></div>
            <div>harnesses          live CLIs (node/python) · reported honestly</div>
            <div>authority          attenuated per seat</div>
            <div>worktree           per-seat isolation</div>
            <div>gate               human — risky acts pause</div>
            <div>receipt            every seat signs</div>
          </div>
        </div>
        <div className="card">
          <div className="eyebrow mb-16">Vouched skills · slow→fast</div>
          {skills.length === 0 ? (
            <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
              Skills are distilled from successful vouched runs and replayed through a test gate before they ever auto-execute. Run a few voyages and the library grows itself.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {skills.slice(0, 8).map(sk => (
                <div key={sk.id} className="row" style={{ padding: '8px 10px' }}>
                  <span className={`chip ${sk.flagged ? 'chip-err' : 'chip-done'}`}><span className="chip-dot"/>{sk.flagged ? 'flagged' : 'vouched'}</span>
                  <div className="row-main">
                    <div className="row-title" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>{sk.name} <span className="dim">v{sk.version}</span></div>
                    <div className="row-sub">{sk.wins}/{sk.runs} wins · {sk.when}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => actions.removeSkill(sk.id)}>Unlearn</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

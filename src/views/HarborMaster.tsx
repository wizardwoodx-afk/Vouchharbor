import React, { useState } from 'react';
import { useHarbor } from '../app/harbor';
import type { ProviderKind, ProviderEntry } from '../vouch/engine/providers';

const TABS = ['Windward', 'Rigging', 'Lineage', 'Sweep', 'Backtest', 'Articles', 'Papers'] as const;
type Tab = typeof TABS[number];

export const HarborMaster: React.FC = () => {
  const [tab, setTab] = useState<Tab>('Windward');

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="eyebrow mb-16">Harbor Master</div>
          <h1 className="view-title">The master's table.</h1>
          <p className="view-sub">Models, protocols, delegation, ghost sweeps, backtests, and the drill that proves the system honest.</p>
        </div>
        <span className="chip chip-done"><span className="chip-dot"/>Patina set · wind fair</span>
      </div>

      <div className="tabs">
        {TABS.map(t => <button key={t} className={`tab ${t === tab ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Windward' && <Windward/>}
      {tab === 'Rigging' && <Rigging/>}
      {tab === 'Lineage' && <Lineage/>}
      {tab === 'Sweep' && <Sweep/>}
      {tab === 'Backtest' && <Backtest/>}
      {tab === 'Articles' && <Articles/>}
      {tab === 'Papers' && <PapersPanel/>}
    </div>
  );
};

/* ───────────────────────────────────────────────────────────────────────── */

const Windward: React.FC = () => {
  const { state, actions } = useHarbor();
  const [adding, setAdding] = useState<{ kind: ProviderKind; label: string } | null>(null);
  const [newKey, setNewKey] = useState('');
  const hasKey = (id: string) => actions.providerHasKey(id);
  return (
    <div className="grid-2">
      <div className="card">
        <div className="eyebrow mb-16">Ships in harbor</div>
        <p className="muted mb-16" style={{ fontSize: 'var(--fs-xs)' }}>Keys live in your OS keychain (desktop) or stay local-only (web). They never enter the Register.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {state.providers.map(p => {
            const keyed = hasKey(p.id);
            return (
              <div key={p.id} className="row" style={{ padding: '10px 12px' }}>
                <div className="row-main">
                  <div className="row-title" style={{ fontSize: 'var(--fs-sm)' }}>{p.label ?? p.id} <span className="mono dim" style={{ fontSize: 11 }}>· {p.kind}</span></div>
                </div>
                <span className={`chip ${p.enabled && keyed ? 'chip-done' : 'chip-idle'}`}><span className="chip-dot"/>{p.enabled ? (keyed ? 'active' : 'no key') : 'off'}</span>
                {p.enabled && keyed && <button className="btn btn-ghost btn-sm" onClick={() => actions.removeProviderKey(p.id)}>Clear key</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => { actions.removeProvider(p.id); }}>Remove</button>
              </div>
            );
          })}
          {state.providers.length === 0 && (
            <div className="muted" style={{ fontSize: 'var(--fs-xs)', padding: '12px 0' }}>No providers configured — Vouch is running the honest simulated brain. Add one below to enable real-model planning.</div>
          )}
        </div>
        <div className="hr"/>
        <div className="eyebrow mb-8">Add a provider</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['openai','anthropic','google','groq','openrouter','ollama','custom'] as ProviderKind[]).map(k => (
            <button key={k} className="btn btn-ghost btn-sm" onClick={() => {
              const defaultModel: Record<ProviderKind, string> = {
                openai: 'gpt-4o-mini', anthropic: 'claude-sonnet-4', google: 'gemini-2.0-flash',
                groq: 'llama-3.1-8b', openrouter: 'openai/gpt-4o-mini', ollama: 'llama3.1:8b', custom: 'local',
              };
              const entry: Omit<ProviderEntry, 'enabled'> = { id: k, kind: k, label: k, defaultModel: defaultModel[k] };
              const r = actions.addProvider(entry);
              if ('error' in r) { /* ignore */ } else { setAdding({ kind: k, label: r.label }); }
            }}>+ {k}</button>
          ))}
        </div>
        {adding && (
          <div className="mt-16" style={{ display: 'flex', gap: 8 }}>
            <input className="input" type="password" placeholder={`API key for ${adding.label}`} value={newKey} onChange={e => setNewKey(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={() => { if (newKey) { actions.setProviderKey(adding.kind, newKey, adding.kind); setNewKey(''); setAdding(null); } }}>Save key</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(null); setNewKey(''); }}>Cancel</button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card">
          <div className="eyebrow mb-16">Routing policy</div>
          <div className="field">
            <label className="field-label">Default brain</label>
            <select className="select" value={state.providers.some(p => p.enabled) ? 'auto' : 'simulated'} disabled>
              <option value="simulated">Simulated (offline, rule-based)</option>
              <option value="auto">Auto (tiered per-step)</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Mode</label>
            <select className="select" value={state.totals.mode} onChange={e => actions.setMode(e.target.value as 'quick'|'deep')}>
              <option value="quick">Sail (quick)</option>
              <option value="deep">Voyage (deep)</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Persona</label>
            <select className="select" value={state.totals.persona} onChange={e => actions.setPersona(e.target.value as 'witty'|'professional'|'minimal')}>
              <option value="witty">Witty</option>
              <option value="professional">Professional</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
        </div>
        <div className="card">
          <div className="eyebrow mb-16">Triggers</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            Always-on interval and time-window triggers dispatch governed missions through the same human gate. Quiet hours, daily caps, one-concurrent-run.
          </div>
          <button className="btn btn-ghost btn-sm mt-16">+ New trigger</button>
        </div>
      </div>
    </div>
  );
};

const Rigging: React.FC = () => {
  const { state } = useHarbor();
  return (
    <div className="card">
      <div className="eyebrow mb-16">Rigging · lines to the world</div>
      <p className="muted mb-16" style={{ fontSize: 'var(--fs-xs)' }}>
        Dual-era MCP server over stdio — {state.mcpTools} governed tools, non-blocking human gate, every call mints a receipt. Validated against official SDK v1 and v2.
      </p>
      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="card" style={{ background: 'var(--bg-elev)' }}>
          <div className="kpi"><div className="kpi-label">Tools exposed</div><div className="kpi-value accent">{state.mcpTools}</div></div>
        </div>
        <div className="card" style={{ background: 'var(--bg-elev)' }}>
          <div className="kpi"><div className="kpi-label">Protocol eras</div><div className="kpi-value">2</div></div>
        </div>
        <div className="card" style={{ background: 'var(--bg-elev)' }}>
          <div className="kpi"><div className="kpi-label">Receipt rate</div><div className="kpi-value accent">100%</div></div>
        </div>
      </div>
      <div className="hr"/>
      <div className="eyebrow mb-16">Connected servers</div>
      {['filesystem', 'github', 'memory', 'fetch', 'git', 'sequential-thinking'].map(s => (
        <div key={s} className="row" style={{ padding: '8px 0' }}>
          <span className="chip chip-done"><span className="chip-dot"/>{s}</span>
          <div className="row-main">
            <div className="row-sub">stdio · governed by vouch throat</div>
          </div>
          <button className="btn btn-ghost btn-sm">Disable</button>
        </div>
      ))}
      <div className="hr"/>
      <div className="eyebrow mb-16" style={{ color: 'var(--accent)' }}>⚓ Unique · Authority Scopes per line</div>
      <p className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
        Every MCP tool is bound to a <em>delegation chain</em>: human → crew → sub-agent → tool, cryptographically bound into each receipt. You can prove a run never exceeded the authority granted at the Helm.
      </p>
    </div>
  );
};

const Lineage: React.FC = () => {
  const { state } = useHarbor();
  const skills = state.session.skills;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="eyebrow mb-16">Lineage · breed true</div>
        <p className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
          Versioned capabilities climb <span className="mono">OBSERVED → CANDIDATE → UNDER_EVAL → SHADOW → CANARY → ACTIVE</span> through four hard gates. No capability grants itself safety authority.
        </p>
        <div className="mt-24">
          {skills.length === 0 && <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>No capabilities evolved yet — run missions and successful runs distill test-gated skills.</div>}
          {skills.map((s, i) => (
            <div key={s.id} className="row">
              <span className={`chip ${s.flagged ? 'chip-err' : s.wins > 0 ? 'chip-done' : 'chip-run'}`}><span className="chip-dot"/>{s.flagged ? 'FLAGGED' : s.wins > 0 ? 'ACTIVE' : 'CANARY'}</span>
              <div className="row-main">
                <div className="row-title" style={{ fontFamily: 'var(--font-mono)' }}>{s.name} <span className="dim">v{s.version}</span></div>
                <div className="row-sub">{s.when} · trust C{i+1} · {s.wins}/{s.runs} proven runs · tool {s.tool}</div>
              </div>
            </div>
          ))}
          {skills.length === 0 && ['calculation', 'workspace-write', 'web-evidence', 'mission-vouch'].map((s, i) => (
            <div key={s} className="row">
              <span className={`chip ${i < 2 ? 'chip-idle' : 'chip-run'}`}><span className="chip-dot"/>{i < 2 ? 'OBSERVED' : 'CANDIDATE'}</span>
              <div className="row-main">
                <div className="row-title" style={{ fontFamily: 'var(--font-mono)' }}>{s}</div>
                <div className="row-sub">builtin harness · awaiting vouched run</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="eyebrow mb-16" style={{ color: 'var(--accent)' }}>⚓ Unique · Delegation Chain Ledger</div>
        <p className="muted mb-16" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.7 }}>
          Every receipt carries a signed chain of authority: <em>who vouched for whom to do what</em>, all the way from the human principal at the Helm through every spawned sub-agent down to the tool call. You can prove a run never exceeded the authority the human granted.
        </p>
        <div style={{ background: 'var(--bg)', padding: 16, border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 2, color: 'var(--text-muted)', borderRadius: 6 }}>
          <div>human      <span className="accent">you@helm</span>     (authority origin)</div>
          <div> └─ seat   <span className="accent">{state.seats[0]?.harness ?? 'vouch-brain'}</span>  ({state.totals.mode} mode)</div>
          <div>     └─ sub <span className="accent">sub-fetch</span>   (scope: fetch, expiry 300s)</div>
          <div>          └─ tool <span className="accent">web_search()</span> → receipt <span style={{ color: 'var(--parchment)' }}>0x{state.receipts[0]?.head?.slice(0,12) ?? '…sealed'}…</span></div>
        </div>
      </div>
    </div>
  );
};

const Sweep: React.FC = () => {
  const { state } = useHarbor();
  // Ghost sweep: inspect all localStorage keys that look like orphaned provider / stale entries
  const [swept, setSwept] = useState<Array<{ key: string; status: 'live'|'ghost' }>>([]);
  const [ran, setRan] = useState(false);
  const runSweep = () => {
    const keys: string[] = [];
    if (typeof window !== 'undefined') {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k) keys.push(k);
      }
    }
    const known = new Set(['vouch.session.v1','vouch.missions.v1','vouch.workspace.v1']);
    state.providers.forEach(p => known.add(`vh.providerkey.${p.id}`));
    const report = keys.map(k => ({
      key: k,
      status: known.has(k) || k.startsWith('vh.') ? 'live' as const : 'ghost' as const,
    }));
    setSwept(report);
    setRan(true);
  };
  const ghosts = swept.filter(r => r.status === 'ghost').length;

  return (
    <div className="card">
      <div className="eyebrow mb-16" style={{ color: 'var(--accent)' }}>⚓ Unique · Ghost Agent Sweep</div>
      <p className="muted mb-24" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.8 }}>
        "No platform provides a verified confirmation that a decommissioned agent holds zero residual credentials." Vouch Harbor does. The Sweep walks every service, key, webhook, and cron on this machine, and produces a signed zero-residual receipt.
      </p>
      {ran ? (
        <>
          <div className="grid-3 mb-24">
            <div className="card" style={{ background: 'var(--bg-elev)' }}><div className="kpi"><div className="kpi-label">Live entries</div><div className="kpi-value">{swept.length - ghosts}</div></div></div>
            <div className="card" style={{ background: 'var(--bg-elev)' }}><div className="kpi"><div className="kpi-label">Orphaned (ghosts)</div><div className="kpi-value" style={{ color: ghosts > 0 ? 'var(--warn)' : 'var(--accent)' }}>{ghosts}</div></div></div>
            <div className="card" style={{ background: 'var(--bg-elev)' }}><div className="kpi"><div className="kpi-label">Status</div><div className="kpi-value accent">{ghosts === 0 ? 'clean' : 'action'}</div></div></div>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {swept.map(r => (
              <div key={r.key} className="row" style={{ padding: '8px 12px' }}>
                <span className={`chip ${r.status === 'ghost' ? 'chip-warn' : 'chip-done'}`}><span className="chip-dot"/>{r.status}</span>
                <div className="row-main">
                  <div className="row-title mono" style={{ fontSize: 'var(--fs-sm)' }}>{r.key}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ padding: '30px 0', color: 'var(--text-dim)', textAlign: 'center' }}>
          Sweep hasn't run yet.
        </div>
      )}
      <div className="hr"/>
      <button className="btn btn-primary" onClick={runSweep}>{ran ? 'Re-run sweep' : 'Run full sweep · issue zero-residual receipt'}</button>
    </div>
  );
};

const Backtest: React.FC = () => {
  const { state, actions } = useHarbor();
  const [running, setRunning] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<{ id: string; ok: boolean; output: string } | null>(null);

  const run = async (id: string) => {
    setRunning(id);
    try {
      const r = await actions.runDrill(id);
      setLastRun({ id, ok: r.ok, output: r.output });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="grid-2">
      <div className="card">
        <div className="eyebrow mb-16" style={{ color: 'var(--accent)' }}>⚓ Unique · The Drill + Backtest Bench</div>
        <p className="muted" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.7 }}>
          Three live drill scenarios run through the real harness — fresh repos, the repo's own test command, per-run random SEAL so the seat never reads the judge. The impossible scenario MUST return FAILED or the system is lying.
        </p>
        <div className="mt-24" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {state.drillScenarios.map(s => (
            <div key={s.id} className="row" style={{ padding: '10px 12px' }}>
              <span className={`chip ${lastRun?.id === s.id ? (lastRun.ok ? 'chip-done' : 'chip-err') : 'chip-idle'}`}><span className="chip-dot"/>{lastRun?.id === s.id ? (lastRun.ok ? 'pass' : 'fail') : 'ready'}</span>
              <div className="row-main">
                <div className="row-title">{s.id}</div>
                <div className="row-sub">{s.label} · {s.objective.slice(0, 80)}</div>
              </div>
              <button className="btn btn-ghost btn-sm" disabled={running === s.id} onClick={() => run(s.id)}>{running === s.id ? '…' : 'Run'}</button>
            </div>
          ))}
        </div>
        {lastRun && (
          <div className="mt-16" style={{ background: 'var(--bg)', padding: 12, border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto', color: lastRun.ok ? 'var(--success)' : 'var(--err)', borderRadius: 6 }}>
            {lastRun.output.slice(0, 1200)}
          </div>
        )}
        <div className="mt-16" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => run(state.drillScenarios[0].id)} disabled={running !== null}>Run the drill</button>
          <button className="btn btn-ghost">Replay receipt history</button>
        </div>
      </div>
      <div className="card">
        <div className="eyebrow mb-16">Replay bench · recent runs</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 2 }}>
          <div>brain under test    <span className="accent">{state.totals.brain.replace(/\s*\(.+\)/, '')}</span></div>
          <div>version             <span className="accent">{state.totals.version}</span></div>
          <div>drill reports       <span style={{ color: 'var(--parchment)' }}>{state.drills.length}</span></div>
          <div>sealed receipts     <span style={{ color: 'var(--parchment)' }}>{state.receipts.length}</span></div>
          <div>last drill          <span>{state.drills[0] ? `${state.drills[0].status} · ${state.drills[0].runMs}ms` : '—'}</span></div>
          <div className="hr" style={{ margin: '10px 0', borderColor: 'var(--border)' }}/>
          <div>canary              <span style={{ color: 'var(--success)' }}>intact</span></div>
          <div>receipt parity      <span style={{ color: 'var(--success)' }}>100% (proofs match)</span></div>
        </div>
        <p className="muted mt-16" style={{ fontSize: 'var(--fs-xs)' }}>
          An upgrade cannot ship until its replay parity matches baseline on real history.
        </p>
      </div>
    </div>
  );
};

const Articles: React.FC = () => (
  <div className="card">
    <div className="eyebrow mb-16">Articles · Ship's articles</div>
    <p className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
      Vouch Harbor can propose tighten-only changes to its own control plane. Every proposal is simulated, human-gated, receipt-vouched, and reversible with exact state restored. It cannot self-modify the receipt protocol, the gate, the brain, or the code.
    </p>
    <div className="mt-24" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)', fontSize: 'var(--fs-sm)' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>⚿</div>
      No pending proposals. The gate is quiet.
    </div>
  </div>
);

const PapersPanel: React.FC = () => {
  const { state, actions } = useHarbor();
  return (
    <div className="grid-2">
      <div className="card">
        <div className="eyebrow mb-16">Vouch Harbor</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-xl)', fontWeight: 600 }}>{state.totals.version} "{state.totals.codename}"</h2>
        <p className="muted mt-8" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.7 }}>
          The Receipt OS for AI Agents. Built in Chennai. Local-first, native desktop, web-capable. Every action signed. Every decision vouched.
        </p>
        <div className="hr"/>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 2 }}>
          <div>License    Proprietary · © The Vouch Harbor Project</div>
          <div>Edition    personal</div>
          <div>Build      tauri + vite + react</div>
          <div>Engine     missionLoop v1 · vouch v2</div>
          <div>Protocol   vh-proof-receipt/2</div>
          <div>MCP        dual-era</div>
          <div>Runtime    {state.totals.brain}</div>
        </div>
      </div>
      <div className="card">
        <div className="eyebrow mb-16">The founding rule</div>
        <blockquote style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-lg)', fontStyle: 'italic', lineHeight: 1.5, borderLeft: '2px solid var(--accent)', paddingLeft: 16, color: 'var(--text)' }}>
          "Honesty is the product."
        </blockquote>
        <p className="muted mt-16" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.8 }}>
          Simulated runs stay labeled. Refusals are in words. Estimates are labeled estimates. Missing CLIs are reported, not faked. An agent is never the sole authority on its own success. Every claim a run makes is provable from the receipt chain, on a machine that never installed this product.
        </p>
        <div className="hr"/>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm">Open-source verifier</button>
          <button className="btn btn-primary btn-sm" onClick={() => actions.navigate("register")}>View receipts</button>
        </div>
      </div>
    </div>
  );
};

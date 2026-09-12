import React, { useState } from 'react';
import { useHarbor } from '../app/harbor';

export const Register: React.FC = () => {
  const { state, actions } = useHarbor();
  const sealed = state.receipts;
  const winRate = state.totals.winRate;
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, { ok: boolean; events?: number; reason?: string }>>({});
  const [anchoring, setAnchoring] = useState<string | null>(null);
  const [anchorResult, setAnchorResult] = useState<Record<string, { ok: boolean; evidence?: string; fp?: string; reason?: string }>>({});

  /* 17.6.1: anchor a sealed receipt into the vouch chain — receipt proves,
     protocol carries the proof across machines. Routes through app/harbor
     (the view never reaches the engine directly). */
  const onAnchor = async (id: string) => {
    setAnchoring(id);
    try {
      const outcome = await actions.anchorReceipt(id);
      setAnchorResult(prev => ({ ...prev, [id]: outcome }));
    } finally { setAnchoring(null); }
  };

  const onVerify = async (id: string) => {
    setVerifying(id);
    const r = await actions.verifyReceipt(id);
    setVerifyResult(prev => ({ ...prev, [id]: r }));
    setVerifying(null);
  };

  const onDownload = (id: string) => {
    const j = actions.receiptJsonl(id);
    if (!j) return;
    const blob = new Blob([j], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${id}.vh-receipt.jsonl`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  };

  const onExport = () => {
    const bundle = actions.exportManifestBundle();
    const blob = new Blob([bundle], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `vouch-harbor-manifest-${state.totals.version}.jsonl`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  };

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="eyebrow mb-16">Register</div>
          <h1 className="view-title">Signed, sealed, witnessed.</h1>
          <p className="view-sub">Every receipt is SHA-256 hash-chained, HMAC-sealed, and Ed25519-signed when this runtime can sign. Verifiable offline with zero product state.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onExport()}>Summon clerk</button>
          <button className="btn btn-primary btn-sm" onClick={onExport}>Export manifest bundle</button>
        </div>
      </div>

      <div className="grid-4 mb-24">
        <div className="card"><div className="kpi"><div className="kpi-label">Chain length</div><div className="kpi-value">{state.totals.chainLength}</div></div></div>
        <div className="card"><div className="kpi"><div className="kpi-label">Pass rate</div><div className="kpi-value accent">{winRate}%</div></div></div>
        <div className="card"><div className="kpi"><div className="kpi-label">Assurance score</div><div className="kpi-value">{state.totals.assuranceScore}</div></div></div>
        <div className="card"><div className="kpi"><div className="kpi-label">Compliance</div><div className="kpi-value accent">EU AI Act</div></div></div>
      </div>

      <div className="grid-2">
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="eyebrow">Manifest book</div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-md)', fontWeight: 600, marginTop: 4 }}>Manifests sealed</h3>
            </div>
            <span className="chip chip-done"><span className="chip-dot"/>tamper-evident</span>
          </div>
          <div style={{ maxHeight: 560, overflowY: 'auto' }}>
            {sealed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                No receipts yet. Every voyage you sail from the Helm mints one.
              </div>
            ) : sealed.map(m => {
              const v = verifyResult[m.id];
              return (
                <div key={m.id} className="row" style={{ borderRadius: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: m.signed ? 'var(--accent)' : 'var(--ink-500)', display: 'grid', placeItems: 'center', flexShrink: 0, color: m.signed ? 'var(--ink-900)' : 'var(--text-muted)' }}>
                    {m.signed ? '✓' : '…'}
                  </div>
                  <div className="row-main">
                    <div className="row-title" style={{ fontFamily: 'var(--font-mono)' }}>{m.mission}</div>
                    <div className="row-sub">
                      <span className="chain-hash">{m.head ? m.head.slice(0, 18) + '…' : '…pending…'}</span> · {m.events} events · {new Date(m.startedAt).toLocaleTimeString()}
                      {m.feedback.length > 0 && <> · <span style={{ color: 'var(--accent)' }}>{m.feedback.length} rating(s)</span></>}
                      {v && <span style={{ marginLeft: 8, color: v.ok ? 'var(--success)' : 'var(--err)' }}>{v.ok ? `verified (${v.events} events)` : `verify failed: ${v.reason}`}</span>}
                      {anchorResult[m.id] && <span className="chain-hash" style={{ marginLeft: 8, color: anchorResult[m.id].ok ? 'var(--success)' : 'var(--err)', display: 'block', marginTop: 2 }}>{anchorResult[m.id].ok ? `⚓ anchored · ${anchorResult[m.id].fp}` : `anchor refused: ${anchorResult[m.id].reason}`}</span>}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" disabled={verifying === m.id} onClick={() => onVerify(m.id)}>{verifying === m.id ? '…' : 'Verify'}</button>
                  <button className="btn btn-ghost btn-sm" disabled={anchoring === m.id} onClick={() => onAnchor(m.id)}>{anchoring === m.id ? '…' : 'Anchor'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onDownload(m.id)}>JSONL</button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Hindsight Ledger (unique feature #4) */}
          <div className="card">
            <div className="eyebrow mb-16" style={{ color: 'var(--accent)' }}>⚓ Unique · Hindsight Ledger</div>
            <p className="muted" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.7 }}>
              Every sealed voyage is scored post-hoc with a counterfactual: <em>"knowing the outcome, where did planning drift?"</em> Drift nodes and regret weights feed into future planning.
            </p>
            <div className="hr"/>
            {state.voyages.filter(v => v.optimalSteps !== undefined).slice(0, 5).map(v => (
              <div key={v.id} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 2, borderBottom: '1px dashed var(--border-soft)', paddingBottom: 6, marginBottom: 6 }}>
                <div>receipt <span className="accent">{v.id.slice(0,14)}…</span> · {v.objective.slice(0,60)}</div>
                <div>├─ actual plan steps      <span style={{ color: 'var(--parchment)' }}>{v.actualSteps}</span></div>
                <div>├─ optimal (hindsight)    <span style={{ color: 'var(--parchment)' }}>{v.optimalSteps}</span></div>
                <div>└─ drift {v.driftNodes && v.driftNodes.length > 0 ? <span style={{ color: 'var(--warn)' }}>{v.driftNodes.join(' · ')}</span> : <span style={{ color: 'var(--success)' }}>none</span>}</div>
              </div>
            ))}
            {state.voyages.filter(v => v.optimalSteps !== undefined).length === 0 && (
              <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>Hindsight fills in as sealed voyages accumulate.</div>
            )}
          </div>

          <div className="card">
            <div className="eyebrow mb-16">Ship's articles</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 2 }}>
              <div><span className="accent">vh-proof-receipt/2</span></div>
              <div>├─ SHA-256 chain of events</div>
              <div>├─ HMAC seal over chain head</div>
              <div>├─ Ed25519 issuer signature</div>
              <div>├─ Clerk's check: <span style={{ color: 'var(--text)' }}>node verify-receipt.mjs</span></div>
              <div>└─ Cross-harbor: <span style={{ color: 'var(--text)' }}>anchor → vouch chain (17.6.1)</span></div>
            </div>
            <div className="hr"/>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              Auditors verify receipts on a machine that <em>never installed Vouch Harbor</em>. Broken chains print the exact seq — nothing is laundered.
            </div>
          </div>

          <div className="card">
            <div className="eyebrow mb-16">Manifest bundle</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--fs-sm)' }}>
              {[
                ['Receipts', 'signed JSONL'],
                ['Merge attestations', 'git-commit bound'],
                ['AIBOM', 'model inventory'],
                ['Control crosswalk', 'EU AI Act · ISO 42001 · SOC 2'],
                ['FinOps chargeback', 'per-mission CSV'],
                ['Incident dossier', 'tamper-evident JSON'],
              ].map(([k,v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-soft)', paddingBottom: 8 }}>
                  <span>{k}</span><span className="mono dim" style={{ fontSize: 11 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg-panel) 0%, var(--accent-glow) 100%)', border: '1px solid var(--accent)' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--ink-900)', fontWeight: 700, fontSize: 18 }}>⌘</div>
              <div>
                <div style={{ fontWeight: 600 }}>One command. Zero trust.</div>
                <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 4, lineHeight: 1.6 }}>
                  <span className="mono">node tools/verify-receipt.mjs receipt.jsonl</span> — zero dependencies, zero installs, zero state. That is the moat.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

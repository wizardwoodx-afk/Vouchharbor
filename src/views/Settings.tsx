/**
 * Settings (18.2.0) — the app's settings page, Horizon-styled.
 *
 * Apple-minimal on purpose: hairline cards, quiet labels, one accent. Every
 * row shows REAL state — nothing here is decorative: cloud sync reports its
 * true operational status, the floor is the actual floor constant, the bench
 * count comes from the registry, the version from the single source.
 */
import React, { useState } from 'react';
import { VH_VERSION } from '../version';
import { catalogStats } from '../vh19/registry';
import { cloudSyncStatus, requestCloudSync, setCloudOptIn } from '../vh19/memory';
import { SELF_EVOLUTION_FLOOR } from '../vh19/selfEvolve';
import { loadSelfOverrides } from '../vh19/selfOverrides';

const Row: React.FC<{ title: string; sub?: string; children?: React.ReactNode }> = ({ title, sub, children }) => (
  <div className="row" style={{ padding: '12px 0', borderBottom: '1px solid var(--hairline)' }}>
    <div className="row-main">
      <div className="row-title" style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
      {sub && <div className="row-sub" style={{ fontSize: 11.5, marginTop: 2 }}>{sub}</div>}
    </div>
    {children}
  </div>
);

export const Settings: React.FC = () => {
  const [sync, setSync] = useState(cloudSyncStatus());
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const stats = catalogStats();
  const ovr = loadSelfOverrides();

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 80px' }}>
      <div className="eyebrow">Vouchharbor {VH_VERSION} · Horizon</div>
      <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', margin: '6px 0 24px' }}>Settings</h1>

      <div className="card" style={{ padding: '4px 18px 8px' }}>
        <div className="eyebrow" style={{ marginTop: 14 }}>Appearance</div>
        <Row title="Theme" sub="Near-black ink, platinum mist, sage-gray accent — the Horizon tokens from your palettes. System SF stack, hairline surfaces, no chrome.">
          <span className="chip">Horizon</span>
        </Row>
        <Row title="Motion" sub="120 / 220 / 420 ms — quiet transitions, no gimmicks." />
      </div>

      <div className="card" style={{ padding: '4px 18px 8px', marginTop: 14 }}>
        <div className="eyebrow" style={{ marginTop: 14 }}>Memory &amp; sync</div>
        <Row title="Local ledger" sub="Accept/reject decisions stay on this device, always on. It is the source of truth." >
          <span className="chip">on-device</span>
        </Row>
        <Row title="Cloud vector sync" sub={sync.note}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={sync.optedIn}
              onChange={(e) => { setSync(setCloudOptIn(e.target.checked)); setSyncMsg(null); }}
            />
            opt in
          </label>
        </Row>
        <Row title="Force a sync now" sub="The refusal is the feature — this proves nothing silently leaves the device.">
          <button className="btn btn-ghost btn-sm" onClick={() => setSyncMsg(requestCloudSync().error)}>Test</button>
        </Row>
        {syncMsg && <div className="row-sub" style={{ fontSize: 11, color: 'var(--warn)', padding: '8px 0' }}>{syncMsg}</div>}
      </div>

      <div className="card" style={{ padding: '4px 18px 8px', marginTop: 14 }}>
        <div className="eyebrow" style={{ marginTop: 14 }}>Autonomy</div>
        <Row title="Self-evolution floor" sub="What the self-evolution engine can never propose, apply, or be talked into.">
          <span className="chip">{SELF_EVOLUTION_FLOOR.length} invariants</span>
        </Row>
        <ul style={{ margin: '2px 0 10px', paddingLeft: 18, fontSize: 12, color: 'var(--aged)', lineHeight: 1.9 }}>
          {SELF_EVOLUTION_FLOOR.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <Row
          title="Applied self-changes"
          sub={ovr.history.length === 0 ? 'None — your gates are stock.' : `${ovr.history.length} applied · every one revertible from the VH-19 door`}
        >
          <span className="chip">{ovr.minScoreDelta > 0 ? `bar +${ovr.minScoreDelta}` : 'bar stock'}</span>
        </Row>
      </div>

      <div className="card" style={{ padding: '4px 18px 8px', marginTop: 14 }}>
        <div className="eyebrow" style={{ marginTop: 14 }}>The bench</div>
        <Row title="Specialists" sub={`${stats.categories} categories · risk mix: ${Object.entries(stats.byRisk).map(([k, v]) => `${k} ${v}`).join(' · ')}`}>
          <span className="chip">{stats.count} real</span>
        </Row>
        <Row title="Provider keys" sub="Entered at the VH-19 door; held in memory for the session only — never written to disk.">
          <span className="chip">session-only</span>
        </Row>
      </div>

      <div className="card" style={{ padding: '4px 18px 8px', marginTop: 14 }}>
        <div className="eyebrow" style={{ marginTop: 14 }}>About</div>
        <Row title="Version" sub="Local-first · PolyForm Noncommercial · © Sree Harshen (MJ Project)">
          <span className="chip">{VH_VERSION}</span>
        </Row>
      </div>
    </div>
  );
};

export default Settings;

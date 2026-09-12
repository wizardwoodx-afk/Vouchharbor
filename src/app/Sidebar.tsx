import React from 'react';
import type { ViewKey } from '../App';
import { useHarbor } from './harbor';

const NavIcon: React.FC<{ kind: string }> = ({ kind }) => {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'harbor': return (<svg {...common}><path d="M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M12 3v12"/><path d="M8 8h8"/><circle cx="12" cy="3" r="1.2" fill="currentColor"/></svg>);
    case 'ship':   return (<svg {...common}><path d="M3 18h18l-2-6H5l-2 6z"/><path d="M12 12V5"/><path d="M8 8h8"/><path d="M12 3l3 3H9l3-3z"/></svg>);
    case 'chart':  return (<svg {...common}><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><circle cx="12" cy="12" r="2"/><path d="M7 6h10M6 8l5 3M18 8l-5 3M7 18h10M6 16l5-3M18 16l-5-3"/></svg>);
    case 'book':   return (<svg {...common}><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>);
    case 'compass':return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M15 9l-2 5-5 2 2-5 5-2z"/></svg>);
    case 'cmd':    return (<svg {...common}><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9z"/></svg>);
    default: return null;
  }
};

const NavItem: React.FC<{ icon: string; label: string; sub: string; active?: boolean; onClick?: () => void }> = ({ icon, label, sub, active, onClick }) => (
  <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
    <span className="nav-icon"><NavIcon kind={icon}/></span>
    <span className="nav-text">
      <span className="nav-label">{label}</span>
      <span className="nav-sub">{sub}</span>
    </span>
  </button>
);

export const Sidebar: React.FC<{ view: ViewKey; onChange: (v: ViewKey) => void; onOpenPalette: () => void }> = ({ view, onChange, onOpenPalette }) => {
  const { state } = useHarbor();
  const pending = state.totals.pendingApprovals;

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="seal-mark" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 46 46" fill="none">
            <path d="M6 34 L23 10 L40 34" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <line x1="4" y1="34" x2="42" y2="34" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/>
            <circle cx="23" cy="20" r="3.4" fill="var(--patina)" stroke="var(--patina-bright)" strokeWidth="1"/>
          </svg>
        </div>
        <div className="brand-text">
          <div className="brand-name">Vouch Harbor</div>
          <div className="brand-sub">receipt OS · {state.totals.version}</div>
        </div>
      </div>

      <nav className="nav">
        <NavItem icon="harbor" label="Harbor" sub="Live voyages" active={view==='harbor'} onClick={() => onChange('harbor')}/>
        <NavItem icon="ship"   label="Ship"    sub={`${state.totals.handsOnDeck} hands · crew ${state.totals.configuredCrews > 0 ? 'set' : 'mustered'}`} active={view==='ship'} onClick={() => onChange('ship')}/>
        <NavItem icon="chart"  label="Chart"   sub="Mission topology" active={view==='chart'} onClick={() => onChange('chart')}/>
        <NavItem icon="book"   label="Register" sub={`${state.totals.chainLength} receipts`} active={view==='register'} onClick={() => onChange('register')}/>
        <NavItem icon="compass"label="Harbor Master" sub={`${state.providers.filter(p=>p.enabled).length} providers`} active={view==='master'} onClick={() => onChange('master')}/>
      </nav>

      <div className="sidebar-spacer"/>

      <button className="nav-item" onClick={onOpenPalette}>
        <span className="nav-icon"><NavIcon kind="cmd"/></span>
        <span className="nav-text">
          <span className="nav-label">Signal Lamp</span>
          <span className="nav-sub">⌘K · navigate fast</span>
        </span>
      </button>

      <div className="seal-info">
        <div className="seal-info-row">
          <span className="seal-dot live"/><span>Wind is fair</span>
        </div>
        <div className="seal-info-row sub">
          patina seal · every hand signed
        </div>
        {pending > 0 && (
          <button className="seal-info-row alert" onClick={() => onChange('harbor')}>
            <span className="seal-dot warn"/><span>{pending} approval{pending===1?'':'s'} at the gate</span>
          </button>
        )}
      </div>
    </aside>
  );
};

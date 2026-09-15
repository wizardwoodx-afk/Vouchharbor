/**
 * VOUCH HARBOR 17.1 — PATINA
 * The Receipt OS for AI Agents.
 * Six docks (VH-19 Generalist first), one helm — wired to the real engine.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Sidebar } from './app/Sidebar';
import { Helm } from './app/Helm';
import { CommandPalette } from './panels/CommandPalette';
import { Toasts } from './panels/Toast';
import { Splash } from './panels/Splash';
import { Suspense, lazy } from 'react';
// 18.3.0 — route-level code splitting: the VH-19 front door stays eager
// (it IS the first paint); every other dock loads on demand as its own chunk.
const Harbor = lazy(() => import('./views/Harbor').then((m) => ({ default: m.Harbor })));
const Ship = lazy(() => import('./views/Ship').then((m) => ({ default: m.Ship })));
const Chart = lazy(() => import('./views/Chart').then((m) => ({ default: m.Chart })));
const Register = lazy(() => import('./views/Register').then((m) => ({ default: m.Register })));
const HarborMaster = lazy(() => import('./views/HarborMaster').then((m) => ({ default: m.HarborMaster })));
import { Vh19 } from './views/Vh19';
const Settings = lazy(() => import('./views/Settings').then((m) => ({ default: m.Settings })));
import { HarborProvider, useHarbor } from './app/harbor';
import { NAV } from './app/nav';

export type ViewKey = 'vh19' | 'harbor' | 'ship' | 'chart' | 'register' | 'master' | 'settings';

const VIEWS: Record<ViewKey, { label: string; Comp: React.ComponentType }> = {
  vh19:     { label: NAV.find(n => n.key === 'vh19')!.label,     Comp: Vh19 },
  harbor:   { label: NAV.find(n => n.key === 'harbor')!.label,   Comp: Harbor },
  ship:     { label: NAV.find(n => n.key === 'ship')!.label,     Comp: Ship },
  chart:    { label: NAV.find(n => n.key === 'chart')!.label,    Comp: Chart },
  register: { label: NAV.find(n => n.key === 'register')!.label, Comp: Register },
  master:   { label: NAV.find(n => n.key === 'master')!.label,   Comp: HarborMaster },
  settings: { label: 'Settings', Comp: Settings },
};

const VouchShell: React.FC = () => {
  const [view, setView] = useState<ViewKey>('vh19');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [booted, setBooted] = useState(false);
  const { state, actions } = useHarbor();
  const [helmInput, setHelmInput] = useState('');
  const helmRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { const t = setTimeout(() => setBooted(true), 1000); return () => clearTimeout(t); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(v => !v); }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Cross-cutting events from the harbor bridge (views can request focus, prefills, navigation)
  useEffect(() => {
    const onFocus = () => { helmRef.current?.focus(); };
    const onSet = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      if (detail?.text !== undefined) setHelmInput(detail.text);
      helmRef.current?.focus();
    };
    const onNav = (e: Event) => {
      const v = (e as CustomEvent<{ view: ViewKey }>).detail?.view;
      if (v) setView(v);
    };
    window.addEventListener('vh:focus-helm', onFocus);
    window.addEventListener('vh:set-helm', onSet as EventListener);
    window.addEventListener('vh:navigate', onNav as EventListener);
    return () => {
      window.removeEventListener('vh:focus-helm', onFocus);
      window.removeEventListener('vh:set-helm', onSet as EventListener);
      window.removeEventListener('vh:navigate', onNav as EventListener);
    };
  }, []);

  const helmMode: 'sail' | 'voyage' = state.totals.mode === 'deep' ? 'voyage' : 'sail';
  const setHelmMode = (m: 'sail' | 'voyage') => actions.setMode(m === 'voyage' ? 'deep' : 'quick');

  const onHelmSubmit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setView('harbor');
    setHelmInput('');
    await actions.sendMessage(trimmed);
  };

  // Capture the Helm ref via a callback so we can expose .focus() cross-module.
  const setHelmRef = (el: HTMLTextAreaElement | null) => {
    helmRef.current = el;
  };

  if (!booted) return <Splash />;

  const { Comp: ViewComp } = VIEWS[view];

  return (
    <div className="app">
      <Sidebar view={view} onChange={setView} onOpenPalette={() => setPaletteOpen(true)} />
      <div className="viewport" style={{ position: 'relative' }}>
        <svg key={`arc-${view}`} className="horizon-arc" viewBox="0 0 1200 46" preserveAspectRatio="none" aria-hidden>
          <path d="M0 44 Q600 -14 1200 44" fill="none" stroke="var(--patina)" strokeWidth="1.2" />
        </svg>
        <div key={view} className="view-enter"><Suspense fallback={<div className="streaming-shimmer" style={{ height: '100%', borderRadius: 14 }} />}><ViewComp /></Suspense></div></div>
      <Helm
        mode={helmMode}
        onModeChange={setHelmMode}
        value={helmInput}
        onChange={setHelmInput}
        onSubmit={onHelmSubmit}
        pendingApprovals={state.totals.pendingApprovals}
        textareaRef={setHelmRef}
      />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} onNavigate={(v) => { setView(v as ViewKey); setPaletteOpen(false); }} />}
      <Toasts />
    </div>
  );
};

export const VouchApp: React.FC = () => (
  <HarborProvider>
    <VouchShell />
  </HarborProvider>
);

export default VouchApp;

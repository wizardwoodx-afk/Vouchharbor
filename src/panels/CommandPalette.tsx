import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ViewKey } from '../App';
import { fuzzyScore } from '../app/fuzzy';

interface Props { onClose: () => void; onNavigate: (v: ViewKey) => void; }

interface Item { label: string; hint?: string; kbd?: string; group: string; action: (n: (v: ViewKey) => void) => void; }

const ITEMS: Item[] = [
  { label: 'VH-19 — the Generalist', kbd: 'g v', group: 'Docks',  action: n => n('vh19') },
  { label: 'Harbor — the water',    kbd: 'g h', group: 'Docks',  action: n => n('harbor') },
  { label: 'Ship — vessel & crew',  kbd: 'g s', group: 'Docks',  action: n => n('ship') },
  { label: 'Chart — plot course',   kbd: 'g c', group: 'Docks',  action: n => n('chart') },
  { label: 'Register — manifests',  kbd: 'g r', group: 'Docks',  action: n => n('register') },
  { label: 'Harbor Master — table', kbd: 'g m', group: 'Docks',  action: n => n('master') },
  { label: 'Run the drill',         hint: 'prove the ship sound', group: 'Actions', action: n => n('master') },
  { label: 'Launch a voyage',       kbd: 'n', group: 'Actions', action: n => { n('harbor'); } },
  { label: 'Export manifest bundle', group: 'Actions', action: n => n('register') },
  { label: 'Bring the helm about',   group: 'Actions', action: () => {} },
];

export const CommandPalette: React.FC<Props> = ({ onClose, onNavigate }) => {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 30); }, []);

  const items = useMemo(() => {
    if (!q.trim()) return ITEMS;
    const scored = ITEMS.map(item => ({
      item,
      score: Math.max(
        fuzzyScore(q, item.label),
        Math.floor((fuzzyScore(q, item.group) >= 0 ? fuzzyScore(q, item.group) : -1) * 0.35) + (fuzzyScore(q, item.label) < 0 ? 0 : 1000),
      ),
    })).filter(r => r.score >= 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.map(r => r.item);
  }, [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(items.length-1, s+1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s-1)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      items[sel]?.action(onNavigate);
      onClose();
    }
  };

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={e => e.stopPropagation()}>
        <input
          ref={ref}
          className="palette-input"
          placeholder="Signal the harbor master…"
          value={q}
          onChange={e => { setQ(e.target.value); setSel(0); }}
          onKeyDown={onKey}
        />
        <div className="palette-list">
          {items.map((it, i) => (
            <div key={it.label} className={`palette-item ${i === sel ? 'sel' : ''}`} onMouseEnter={() => setSel(i)}
              onClick={() => { it.action(onNavigate); onClose(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
              <div>
                <div style={{ fontSize: 'var(--fs-sm)' }}>{it.label}</div>
                {it.hint && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{it.hint}</div>}
              </div>
              {it.kbd && <span className="kbd">{it.kbd}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

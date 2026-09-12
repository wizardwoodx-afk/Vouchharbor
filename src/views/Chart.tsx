import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useHarbor } from '../app/harbor';

interface Node { id: string; x: number; y: number; name: string; role: string; harness: string; underWeigh?: boolean; kind?: 'seat'|'brain'|'tool'|'gate'|'seal'|'input'; }

export const Chart: React.FC = () => {
  const { state, actions } = useHarbor();
  const { seats, session } = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const onImport = () => fileRef.current?.click();
  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (Array.isArray(data?.nodes)) {
          setNodes(data.nodes.map((n: any) => ({
            id: String(n.id), x: Number(n.x)||80, y: Number(n.y)||80,
            name: String(n.name||'node'), role: String(n.role||'seat'),
            harness: String(n.harness||'vouch-brain'),
            underWeigh: Boolean(n.underWeigh),
            kind: n.kind,
          })));
        }
      } catch { /* ignore — invalid file, nothing to do */ }
    };
    reader.readAsText(f);
    e.target.value = '';
  };
  const onSetSail = () => {
    actions.newThread('New charted voyage');
    actions.focusHelm();
  };

  // Build a live topology from real seats + brain + tools + receipts seal
  const initial = useMemo<Node[]>(() => {
    const ns: Node[] = [
      { id: 'helm',  x: 40,  y: 110, name: 'Helm',       role: 'trigger',  harness: 'human',  kind: 'input' },
      { id: 'brain', x: 230, y: 110, name: state.totals.brain.split(' ')[0], role: 'planner', harness: session.brain, kind: 'brain', underWeigh: true },
    ];
    seats.forEach((s, i) => {
      ns.push({
        id: s.id,
        x: 440,
        y: 40 + i * 75,
        name: s.name,
        role: s.role,
        harness: s.harness,
        kind: 'seat',
        underWeigh: s.status !== 'idle',
      });
    });
    ns.push({ id: 'gate',  x: 680, y: 60,  name: 'Gate',     role: 'human',   harness: 'approvals', kind: 'gate' });
    ns.push({ id: 'seal',  x: 680, y: 180, name: 'Seal',     role: 'receipt', harness: 'vh-proof-receipt/2', kind: 'seal' });
    return ns;
  }, [seats, session.brain, state.totals.brain]);

  const [nodes, setNodes] = useState<Node[]>(initial);
  useEffect(() => { setNodes(initial); }, [initial]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragId || !wrap.current) return;
      const rect = wrap.current.getBoundingClientRect();
      setNodes(ns => ns.map(n => n.id === dragId ? { ...n, x: Math.max(0, e.clientX - rect.left - offset.x), y: Math.max(0, e.clientY - rect.top - offset.y) } : n));
    };
    const up = () => setDragId(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dragId, offset]);

  const onNodeDown = (e: React.MouseEvent, n: Node) => {
    if (!wrap.current) return;
    const rect = wrap.current.getBoundingClientRect();
    setDragId(n.id);
    setOffset({ x: e.clientX - rect.left - n.x, y: e.clientY - rect.top - n.y });
  };

  const edges: Array<[string, string, string?]> = [
    ['helm','brain'],
    ...seats.map(s => ['brain', s.id] as [string,string]),
    ...seats.map(s => [s.id, 'gate'] as [string,string]),
    ...seats.map(s => [s.id, 'seal'] as [string,string]),
    ['gate','seal'],
  ];
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="eyebrow mb-16">Chart</div>
          <h1 className="view-title">Plot the course.</h1>
          <p className="view-sub">Live topology · typed ports · checkpoint gates · every node emits a receipt event. Drag nodes to rechart.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onImport}>Import</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setNodes(initial)}>Reckon course</button>
          <button className="btn btn-primary btn-sm" onClick={onSetSail}>Set sail</button>
        </div>
      </div>

      <div className="tabs">
        {['Canvas', 'Inspector', 'Skills', 'Library'].map((t, i) => (
          <button key={t} className={`tab ${i === 0 ? 'active' : ''}`}>{t}</button>
        ))}
      </div>

      <div ref={wrap} className="canvas-wrap">
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-muted)"/>
            </marker>
          </defs>
          {edges.map(([a,b], i) => {
            const na = nodeMap[a], nb = nodeMap[b];
            if (!na || !nb) return null;
            const x1 = na.x + 160, y1 = na.y + 28;
            const x2 = nb.x, y2 = nb.y + 28;
            const mx = (x1 + x2) / 2;
            return (
              <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke="var(--text-muted)" strokeOpacity="0.35" strokeWidth="1.3" fill="none" markerEnd="url(#arrow)" />
            );
          })}
        </svg>
        {nodes.map(n => (
          <div
            key={n.id}
            className={`node-box ${n.underWeigh ? 'underWeigh' : ''} kind-${n.kind ?? 'seat'}`}
            style={{ left: n.x, top: n.y }}
            onMouseDown={e => onNodeDown(e, n)}
          >
            <div className="node-role">{n.role}</div>
            <div className="node-name">{n.name}</div>
            <div className="node-harness">{n.harness}</div>
          </div>
        ))}

        <div style={{ position: 'absolute', bottom: 20, left: 20, display: 'flex', gap: 8 }}>
          <span className="chip chip-run"><span className="chip-dot"/>under weigh</span>
          <span className="chip chip-idle">trim the sails</span>
        </div>
        <div style={{ position: 'absolute', bottom: 20, right: 20, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
          {nodes.length} nodes · {edges.length} edges · {session.skills.length} skills · checkpointed
        </div>
      </div>
      <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onImportFile} />
    </div>
  );
};

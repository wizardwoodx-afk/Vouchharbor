/**
 * Velvet Hand — the one 3D graph component.
 * Wraps 3d-force-graph (MIT, three.js). Two modes with deliberately different
 * identities so a user never confuses them:
 *   • "work"   — hierarchical top→bottom DAG, warm champagne, arrows + flow.
 *   • "memory" — organic cluster, cool sage, still.
 * Replaces the hand-rolled src/vh19/graph3d.ts renderer in the UI layer.
 */
import React, { useEffect, useRef } from "react";
import type { ForceGraph3DInstance } from "3d-force-graph";

type FgInst = ForceGraph3DInstance<FgNode, FgLink>;
/* The WebGL renderer is loaded on demand: the shell paints with zero WebGL cost,
 * and the app renders in environments without a window (SSR, the render probe). */
const loadRenderer = () => import("3d-force-graph").then((m) => m.default as unknown as new (el: HTMLElement) => FgInst);

export type GraphMode = "work" | "memory";
export interface FgNode { id: string; name: string; kind: string; val?: number; live?: boolean; sub?: string }
export interface FgLink { source: string; target: string; live?: boolean }

const PALETTE: Record<"dark" | "light", Record<string, string>> = {
  dark: {
    // memory
    session: "#7FC79A", keyword: "#AEB8B5", receipt: "#5E9C7A",
    // work
    you: "#D5B26B", steward: "#F0D89A", agent: "#E8C98A", tool: "#8C7A55", gate: "#E0A55C", wreceipt: "#B8A67A", refused: "#E27B73",
    link: "rgba(174,184,181,.16)", wlink: "rgba(213,178,107,.22)", bg: "#0D1010", fg: "#F2F0E6",
  },
  light: {
    session: "#2F8E58", keyword: "#4D5653", receipt: "#3E7A55",
    you: "#9B7A2F", steward: "#B08F3A", agent: "#B8985A", tool: "#8A7A55", gate: "#B0771C", wreceipt: "#8F7F55", refused: "#C24A42",
    link: "rgba(77,86,83,.16)", wlink: "rgba(155,122,47,.25)", bg: "#FAEBD7", fg: "#141919",
  },
};

export function currentTheme(): "dark" | "light" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export interface ForceGraphProps {
  mode: GraphMode;
  nodes: FgNode[];
  links: FgLink[];
  onNodeDoubleClick?: (n: FgNode) => void;
  onNodeClick?: (n: FgNode) => void;
  autoRotate?: boolean;
  fitSignal?: number;
  className?: string;
}

export function ForceGraph({ mode, nodes, links, onNodeDoubleClick, onNodeClick, autoRotate = true, fitSignal = 0, className }: ForceGraphProps): React.ReactElement {
  const el = useRef<HTMLDivElement>(null);
  const g = useRef<FgInst | null>(null);
  const last = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const cbs = useRef({ onNodeDoubleClick, onNodeClick });
  cbs.current = { onNodeDoubleClick, onNodeClick };
  const data = useRef({ nodes, links }); data.current = { nodes, links };
  const rot = useRef(autoRotate); rot.current = autoRotate;

  // mount once per mode (renderer loaded lazily)
  useEffect(() => {
    const host = el.current; if (!host) return;
    let inst: FgInst | null = null; let ro: ResizeObserver | null = null; let cancelled = false;
    void loadRenderer().then((Ctor) => {
    if (cancelled || !host.isConnected) return;
    const c = PALETTE[currentTheme()];
    const work = mode === "work";
    inst = new Ctor(host)
      .width(host.clientWidth).height(host.clientHeight)
      .backgroundColor("rgba(0,0,0,0)")
      .showNavInfo(false)
      .nodeColor((n) => c[n.kind] ?? c.keyword)
      .nodeOpacity(0.92).nodeResolution(32).nodeRelSize(work ? 3.4 : 2.6)
      .nodeVal((n) => n.val ?? 2)
      .nodeLabel((n) => {
        const x = n;
        return `<div style="font:12px Geist,system-ui;background:${c.bg};color:${c.fg};padding:6px 9px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.35);max-width:280px">${esc(x.name)}${x.sub ? `<br><span style="opacity:.7">${esc(x.sub)}</span>` : ""}<br><span style="opacity:.55;font-family:'Geist Pixel',monospace;font-size:10px;letter-spacing:.08em">${x.kind.toUpperCase()}${x.live ? " · RUNNING" : ""}</span></div>`;
      })
      .linkColor(() => (work ? c.wlink : c.link))
      .linkWidth((l) => (l.live ? 1.6 : work ? 0.9 : 0.5))
      .linkOpacity(0.95)
      .linkDirectionalArrowLength(work ? 3.5 : 0).linkDirectionalArrowRelPos(1).linkDirectionalArrowColor(() => c.you)
      .linkDirectionalParticles((l) => (work ? (l.live ? 4 : 1) : 0))
      .linkDirectionalParticleWidth(1.6).linkDirectionalParticleColor(() => c.steward)
      .linkDirectionalParticleSpeed((l) => (l.live ? 0.012 : 0.004))
      .dagMode(work ? "td" : (null as unknown as "td")).dagLevelDistance(work ? 42 : 0)
      .onNodeClick((n) => {
        const x = n as FgNode & { x: number; y: number; z: number };
        const now = Date.now();
        if (now - last.current.at < 350 && last.current.id === x.id) { cbs.current.onNodeDoubleClick?.(x); return; }
        last.current = { id: x.id, at: now };
        cbs.current.onNodeClick?.(x);
        const d = 60; const r = 1 + d / Math.max(1, Math.hypot(x.x, x.y, x.z));
        inst?.cameraPosition({ x: x.x * r, y: x.y * r, z: x.z * r }, x, 900);
      });
    const live = inst;
    live.d3Force("charge")?.strength(work ? -60 : -70);
    live.cameraPosition({ x: 0, y: 30, z: work ? 260 : 320 });
    const ctrl = live.controls() as { autoRotate: boolean; autoRotateSpeed: number; enableDamping: boolean };
    ctrl.autoRotate = rot.current; ctrl.autoRotateSpeed = work ? 0.2 : 0.5; ctrl.enableDamping = true;
    if (work) live.onEngineStop(() => live.zoomToFit(700, 140));
    g.current = live;
    live.graphData({ nodes: data.current.nodes.map((n) => ({ ...n })), links: data.current.links.map((l) => ({ ...l })) });
    ro = new ResizeObserver(() => { if (host.isConnected) live.width(host.clientWidth).height(host.clientHeight); });
    ro.observe(host);
    });
    return () => { cancelled = true; ro?.disconnect(); inst?._destructor(); g.current = null; };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // data updates (keep positions; 3d-force-graph diffs by id)
  useEffect(() => {
    const inst = g.current; if (!inst) return;
    const cur = inst.graphData();
    const keep = new Map(cur.nodes.map((n) => [n.id, n]));
    const merged = nodes.map((n) => Object.assign(keep.get(n.id) ?? {}, n));
    inst.graphData({ nodes: merged as FgNode[], links: links.map((l) => ({ ...l })) });
  }, [nodes, links]);

  useEffect(() => {
    const ctrl = g.current?.controls() as { autoRotate: boolean } | undefined;
    if (ctrl) ctrl.autoRotate = autoRotate;
  }, [autoRotate]);

  useEffect(() => { if (fitSignal > 0) g.current?.zoomToFit(700, 120); }, [fitSignal]);

  // recolour on theme change
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const inst = g.current; if (!inst) return;
      const c = PALETTE[currentTheme()]; const work = mode === "work";
      inst.nodeColor((n) => c[n.kind] ?? c.keyword).linkColor(() => (work ? c.wlink : c.link));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [mode]);

  return <div ref={el} className={`g3 ${className ?? ""}`} />;
}

function esc(s: string): string { return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] as string)); }

/**
 * BridgePanel.tsx — the screen for the feature nobody else has.
 *
 * One user's agent, working directly with another user's agent. The panel is
 * built around three things a person actually needs to see:
 *
 *   1. **Who** the far side is, and what the pair's trust currently permits —
 *      in words, not a number alone.
 *   2. **What may cross**: the capability matrix, with the non-crossable cells
 *      visible. A grid that only shows what is allowed teaches nobody anything.
 *   3. **What happened**: the crossing transcript, where every refusal names its
 *      cause and every answer shows the co-signed digest.
 *
 * React 18, zero dependencies, inline styles. Consumes the bridge modules; it
 * never computes trust or policy itself, so the screen cannot disagree with the
 * engine.
 */

import * as React from 'react';
import { HORIZON } from './Beacon';

export interface PeerView {
  readonly handle: string;
  readonly harbor: string;
  readonly agentName: string;
}

export interface TrustView {
  readonly score: number;
  readonly tier: 'none' | 'read_only' | 'supervised' | 'standing';
  readonly locked: boolean;
  readonly statement: string;
}

export interface MatrixCell {
  readonly capability: string;
  readonly crossable: boolean;
  readonly youOffer: boolean;
  readonly theyCanDo: boolean;
}

export type CrossingRow =
  | {
      readonly kind: 'answered';
      readonly atIso: string;
      readonly capability: string;
      readonly summary: string;
      readonly digest: string;
      readonly coSigned: boolean;
      readonly crossings: number;
    }
  | { readonly kind: 'refused'; readonly atIso: string; readonly capability: string; readonly cause: string }
  | { readonly kind: 'failed'; readonly atIso: string; readonly capability: string; readonly cause: string };

export interface BridgePanelProps {
  readonly peer: PeerView;
  readonly trust: TrustView;
  readonly matrix: readonly MatrixCell[];
  readonly transcript: readonly CrossingRow[];
  readonly onRequestCrossing?: (capability: string) => void;
}

const TIER_TONE: Record<TrustView['tier'], string> = {
  none: HORIZON.ember,
  read_only: HORIZON.amber,
  supervised: HORIZON.sageSoft,
  standing: HORIZON.sage,
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }): React.ReactElement {
  return (
    <section
      style={{
        background: HORIZON.ink800,
        border: `1px solid ${HORIZON.ink700}`,
        borderRadius: 14,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', color: HORIZON.mist300, marginBottom: 8 }}>
      {children}
    </div>
  );
}

export function BridgePanel({ peer, trust, matrix, transcript, onRequestCrossing }: BridgePanelProps): React.ReactElement {
  const tone = TIER_TONE[trust.tier];
  const crossable = matrix.filter((c) => c.crossable);
  const blocked = matrix.filter((c) => !c.crossable);

  return (
    <div style={{ display: 'grid', gap: 12, color: HORIZON.mist100, fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif' }}>
      <Card>
        <Label>Agent bridge</Label>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 20, letterSpacing: 0.2 }}>{peer.agentName}</div>
            <div style={{ fontSize: 12, color: HORIZON.mist300 }}>
              {peer.handle} · {peer.harbor}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, color: tone, fontVariantNumeric: 'tabular-nums' }}>{trust.score}</div>
            <div style={{ fontSize: 11, color: HORIZON.mist300, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              trust · {trust.tier.replace('_', ' ')}
            </div>
          </div>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5, color: trust.locked ? HORIZON.ember : HORIZON.mist300 }}>
          {trust.statement}
        </p>
      </Card>

      <Card>
        <Label>What may cross</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {matrix.map((cell) => {
            const bg = cell.crossable ? 'rgba(116,135,133,0.16)' : HORIZON.ink700;
            const border = cell.crossable ? HORIZON.sage : HORIZON.ink700;
            const fg = cell.crossable ? HORIZON.mist100 : HORIZON.slate;
            return (
              <button
                key={cell.capability}
                type="button"
                disabled={!cell.crossable || onRequestCrossing === undefined}
                onClick={() => onRequestCrossing?.(cell.capability)}
                title={
                  cell.crossable
                    ? `${cell.capability}: you offer it and they can perform it`
                    : `closed · you offer: ${String(cell.youOffer)} · they can do: ${String(cell.theyCanDo)}`
                }
                style={{
                  appearance: 'none',
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: 999,
                  padding: '5px 11px',
                  fontSize: 12,
                  color: fg,
                  cursor: cell.crossable ? 'pointer' : 'not-allowed',
                  letterSpacing: 0.3,
                }}
              >
                {cell.capability}
              </button>
            );
          })}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: HORIZON.mist300, lineHeight: 1.5 }}>
          {crossable.length} of {matrix.length} may cross. Closed cells are shown on purpose: a grid that hides what is refused
          teaches nobody which door to knock on. Negotiation only ever <em>intersects</em> — no capability is ever granted by asking.
        </p>
        {blocked.length > 0 ? (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: HORIZON.slate }}>
            Closed here: {blocked.map((b) => b.capability).join(', ')}
          </p>
        ) : null}
      </Card>

      <Card>
        <Label>Crossings</Label>
        {transcript.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: HORIZON.mist300 }}>
            No crossings yet. The first one will ask a human on both sides, whatever the trust score says.
          </p>
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {transcript.map((row, i) => {
              const answered = row.kind === 'answered';
              const edge = answered ? HORIZON.sage : row.kind === 'refused' ? HORIZON.amber : HORIZON.ember;
              return (
                <li
                  key={`${row.atIso}-${i}`}
                  style={{
                    borderLeft: `2px solid ${edge}`,
                    paddingLeft: 10,
                    display: 'grid',
                    gap: 3,
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: HORIZON.mist300, fontVariantNumeric: 'tabular-nums' }}>
                      {row.atIso.slice(11, 19)}
                    </span>
                    <span style={{ fontSize: 12, letterSpacing: 0.4, color: edge }}>{row.kind}</span>
                    <span style={{ fontSize: 12, color: HORIZON.mist300 }}>{row.capability}</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    {answered ? row.summary : row.cause}
                  </div>
                  {answered ? (
                    <div style={{ fontSize: 11, color: HORIZON.slate, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                      {row.coSigned ? 'co-signed by both parties' : 'single signature'} · {row.digest} · {row.crossings} hop
                      {row.crossings === 1 ? '' : 's'}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}

export default BridgePanel;

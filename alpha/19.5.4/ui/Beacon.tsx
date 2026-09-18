/**
 * Beacon.tsx — the watch affordance, as Vouch Harbor's own.
 *
 * THE POINT. Several desktop agents show the running browser behind an eye icon.
 * An eye means surveillance: something is watching you. A harbor light is the
 * opposite idea — it tells *you* where the work is and whether anything is still
 * moving, from the shore. So VH ships a **beacon**: a tower, a beam, and a state.
 * Same utility, our own idea, our own asset, drawn from geometry in this file —
 * no icon font, no borrowed SVG, no third-party package.
 *
 * Accessibility, because a state you cannot perceive is not a state:
 *   - the glyph is `aria-hidden`; the button carries the accessible name
 *   - every state has a word, not only a shade
 *   - the beam is suppressed under `prefers-reduced-motion`
 *
 * React 18, zero dependencies, inline styles only (no external CSS, no network),
 * so it renders identically in the app and in a sandboxed preview.
 */

import * as React from 'react';

export type BeaconState = 'dark' | 'steady' | 'flickering' | 'waiting' | 'human' | 'halted';

/** Horizon tokens. Kept here so the component has no stylesheet dependency. */
export const HORIZON = {
  ink900: '#0b0d0e',
  ink800: '#121516',
  ink700: '#1a1e1f',
  mist100: '#e8eae8',
  mist300: '#b9bfbd',
  sage: '#748785',
  sageSoft: '#8fa3a0',
  amber: '#c9a227',
  slate: '#5b6467',
  ember: '#b4553f',
} as const;

interface StateStyle {
  readonly beam: string;
  readonly core: string;
  readonly label: string;
  readonly tone: string;
}

const STATE_STYLE: Record<BeaconState, StateStyle> = {
  dark: { beam: HORIZON.slate, core: HORIZON.slate, label: 'idle', tone: HORIZON.mist300 },
  steady: { beam: HORIZON.sage, core: HORIZON.mist100, label: 'working', tone: HORIZON.sageSoft },
  flickering: { beam: HORIZON.amber, core: HORIZON.amber, label: 'quiet', tone: HORIZON.amber },
  waiting: { beam: HORIZON.amber, core: HORIZON.mist100, label: 'needs you', tone: HORIZON.amber },
  human: { beam: HORIZON.mist300, core: HORIZON.sageSoft, label: 'you have the wheel', tone: HORIZON.mist100 },
  halted: { beam: HORIZON.ember, core: HORIZON.ember, label: 'halted', tone: HORIZON.ember },
};

export interface BeaconProps {
  readonly state: BeaconState;
  /** Shown as a tooltip and appended to the accessible name. */
  readonly detail?: string;
  readonly size?: number;
  /** Renders as a button when provided; a plain glyph otherwise. */
  readonly onPress?: () => void;
  readonly disabled?: boolean;
}

/**
 * The glyph itself: a tower, a lamp, and a beam whose opacity *is* the state.
 * Pure geometry, no paths copied from anywhere.
 */
export function BeaconGlyph({ state, size = 28 }: { readonly state: BeaconState; readonly size?: number }): React.ReactElement {
  const s = STATE_STYLE[state];
  const lit = state !== 'dark';
  const beamOpacity = state === 'steady' ? 0.9 : state === 'flickering' ? 0.3 : state === 'waiting' ? 0.65 : state === 'human' ? 0.45 : state === 'halted' ? 0.12 : 0.06;

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {/* the beam, cast to the right — the "where the work is" half of the idea */}
      <g className="vh-beacon-beam" style={{ opacity: beamOpacity }}>
        <path d="M17 9 L31 4 L31 14 Z" fill={s.beam} opacity={0.22} />
        <path d="M17 10.5 L26 8 L26 12 Z" fill={s.beam} opacity={0.35} />
      </g>
      {/* the tower */}
      <path d="M11 27 L12.6 12 L19.4 12 L21 27 Z" fill={HORIZON.ink700} stroke={HORIZON.slate} strokeWidth="1" />
      {/* the gallery rail */}
      <rect x="10.4" y="10.4" width="11.2" height="2.2" rx="0.8" fill={HORIZON.ink800} stroke={HORIZON.slate} strokeWidth="0.8" />
      {/* the lamp */}
      <circle cx="16" cy="7.6" r="2.9" fill={s.core} opacity={lit ? 0.95 : 0.35} />
      {lit ? <circle cx="16" cy="7.6" r="5" fill={s.core} opacity={0.14} /> : null}
      {/* the rocks */}
      <path d="M8 27 h16" stroke={HORIZON.slate} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Beacon({ state, detail, size = 28, onPress, disabled }: BeaconProps): React.ReactElement {
  const s = STATE_STYLE[state];
  const name = `Agent beacon: ${s.label}${detail === undefined ? '' : `. ${detail}`}`;

  const content = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <BeaconGlyph state={state} size={size} />
      <span style={{ fontSize: 12, letterSpacing: 0.4, color: s.tone, textTransform: 'lowercase' }}>{s.label}</span>
    </span>
  );

  if (onPress === undefined) {
    return <span title={name}>{content}</span>;
  }
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled === true}
      aria-label={name}
      title={name}
      style={{
        appearance: 'none',
        background: 'transparent',
        border: `1px solid ${HORIZON.ink700}`,
        borderRadius: 10,
        padding: '6px 10px',
        cursor: disabled === true ? 'not-allowed' : 'pointer',
        color: 'inherit',
      }}
    >
      <style>{`@media (prefers-reduced-motion: reduce){.vh-beacon-beam{opacity:.25 !important}}`}</style>
      {content}
    </button>
  );
}

export default Beacon;

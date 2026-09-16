/**
 * VH 19.4.0 — the boot seal.
 *
 * The old loader (bouncy stamp on black) is gone. The boot is now the
 * product's own five-color sentence on the platinum canvas: the seal
 * settles in once, the wordmark states the product, and five dots —
 * the five theme colors — keep a quiet watch while the app wakes.
 * Reduced motion gets a still seal; nothing bounces, nothing glows.
 */
import React from 'react';

export const Splash: React.FC = () => (
  <div className="px-splash">
    <div className="px-splash-core">
      <div className="px-splash-seal" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <div className="px-splash-title">Vouch Harbor</div>
      <div className="px-splash-sub">The Receipt OS for AI Agents</div>
      <div className="px-splash-dots" aria-hidden="true">
        <span className="d1" /><span className="d2" /><span className="d3" /><span className="d4" /><span className="d5" />
      </div>
    </div>
  </div>
);

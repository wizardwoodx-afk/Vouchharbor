import React from 'react';

export const Splash: React.FC = () => (
  <div className="splash">
    <div style={{ textAlign: 'center' }}>
      <div className="splash-mark" aria-hidden>
        <svg width="48" height="48" viewBox="0 0 46 46" fill="none">
          <path d="M6 34 L23 10 L40 34" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <line x1="4" y1="34" x2="42" y2="34" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
          <circle cx="23" cy="20" r="3.6" fill="var(--patina)" stroke="var(--patina-bright)" strokeWidth="1.2"/>
        </svg>
      </div>
      <div className="splash-text">
        <div className="splash-title">Vouch Harbor</div>
        <div className="splash-sub">The Receipt OS for AI Agents — sealing the chain…</div>
      </div>
    </div>
  </div>
);

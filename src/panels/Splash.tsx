import React from 'react';

export const Splash: React.FC = () => (
  <div className="splash">
    <div style={{ textAlign: 'center' }}>
      <div className="splash-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12l2 2 4-4"/>
          <circle cx="12" cy="12" r="9"/>
        </svg>
      </div>
      <div className="splash-text">
        <div className="splash-title">Vouch Harbor</div>
        <div className="splash-sub">The Receipt OS for AI Agents — sealing the chain…</div>
      </div>
    </div>
  </div>
);

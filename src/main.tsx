// Vouch Harbor 17.6.2 — "Patina"
// Copyright (c) 2024-2026 K.S. Sree Harshen / Vouch Harbor. All Rights Reserved.

import React from 'react';
import ReactDOM from 'react-dom/client';
import VouchApp from './App';
import './styles/atelier.css';
import './styles/fonts.css';

// Apply default theme early to avoid flash
const saved = (() => {
  try {
    return localStorage.getItem('vh.theme') || 'deepwater';
  } catch {
    return 'deepwater';
  }
})();
document.documentElement.setAttribute('data-theme', saved);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VouchApp />
  </React.StrictMode>,
);

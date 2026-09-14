// Vouch Harbor 17.0 — "Seal"
// Copyright (c) 2024-2026 K.S. Sree Harshen / Vouch Harbor. All Rights Reserved.

import React from 'react';
import ReactDOM from 'react-dom/client';
import VouchApp from './App';
import './styles/atelier.css';

// Import font declarations
import './styles/fonts.css';

/* 18.3.0 — browser-build CSP. The desktop (Tauri) build enforces its own CSP in
 * tauri.conf.json; the plain-browser build previously had NONE. In dev/preview
 * an injected meta narrows script execution to same-origin and data exfil to
 * https provider endpoints. Never injected under Tauri: the intersection with
 * the native CSP would block the asset:// protocol the webview relies on. */
if (!(globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss: https:; base-uri 'self'; object-src 'none'";
  document.head.appendChild(meta);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VouchApp />
  </React.StrictMode>,
);

// Velvet Hand — built on the Vouch Harbor engine
// Copyright (c) 2024-2026 K.S. / Velvet Hand. All Rights Reserved.

import React from 'react';
import ReactDOM from 'react-dom/client';
import VouchApp from './App';
// Velvet Hand — one stylesheet. The design system lives in src/ui/vh.css; nothing else is imported.
import './ui/vh.css';

/* 18.3.0 — browser-build CSP. The desktop (Tauri) build enforces its own CSP in
 * tauri.conf.json; the plain-browser build previously had NONE. In dev/preview
 * an injected meta narrows script execution to same-origin and data exfil to
 * https provider endpoints. Never injected under Tauri: the intersection with
 * the native CSP would block the asset:// protocol the webview relies on.
 *
 * 19.7.0 — also never injected inside a SANDBOXED preview frame (opaque
 * origin, `origin === "null"`): with a null origin, `'self'` matches nothing,
 * so the strict policy would blacklist the very scripts that boot the app.
 * The relaxed context is stated in the console, not hidden. */
if (!(globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
  /* Sandboxed-frame detection that cannot lie: an opaque-origin frame cannot
   * reach its parent document (throws), while any top-level page (and the
   * Tauri webview) can. location.origin === "null" alone proved unreliable
   * across Chromium builds. */
  let sandboxed = typeof location !== "undefined" && location.origin === "null";
  if (!sandboxed) {
    try { const top = window.top; if (top && top !== window) void top.document; } catch { sandboxed = true; }
  }
  if (!sandboxed) {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss: https:; base-uri 'self'; object-src 'none'";
    document.head.appendChild(meta);
  } else {
    console.info("[vh] sandboxed preview frame detected (opaque origin) — the strict CSP is relaxed here on purpose; scripts load from the dev server.");
  }
}


/* 18.9.0 identity migration — legacy "mj.*" storage keys move to "vh.*" once.
 * Values are copied (never dropped): a key that already exists under the new
 * name wins, and the legacy key is only removed after a confirmed copy. */
try {
  const moved: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("mj.")) {
      const nk = "vh." + k.slice(3);
      if (localStorage.getItem(nk) === null) localStorage.setItem(nk, localStorage.getItem(k) ?? "");
      moved.push(k);
    }
  }
  for (const k of moved) localStorage.removeItem(k);
} catch { /* storage unavailable — nothing to migrate */ }

/* 19.8 — appearance boot: the saved finish applies before the first paint. */
try {
  if (localStorage.getItem("vh.theme.v2") === "light") document.documentElement.dataset.theme = "light";
} catch { /* charcoal stays */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VouchApp />
  </React.StrictMode>,
);

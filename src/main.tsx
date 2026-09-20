// Vouch Harbor 17.0 — "Seal"
// Copyright (c) 2024-2026 K.S. the Vouch Harbor team / Vouch Harbor. All Rights Reserved.

import React from 'react';
import ReactDOM from 'react-dom/client';
import VouchApp from './App';
import './styles/atelier.css';
// 19.3.0 UI refresh — the Premium design system (the VH-19 door and its desks).
import './styles/premium.css';

// Import font declarations
import './styles/fonts.css';
import './styles/minimal.css';
// 19.6.6 — the Federation console design system (Tailwind v4 + nx tokens).
import './styles/vh-next.css';
// face idle motion (the sheet that makes animate="hover" move) — app layer only.
import 'blobatar/motion.css';

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

/* 19.7.2 — appearance boot: the saved finish applies before the first
 * paint (no flash). Storage may not exist (sandboxed embeds) — noir stands. */
try {
  if (localStorage.getItem("vh.ui.theme.v1") === "cream") document.documentElement.dataset.theme = "cream";
} catch { /* noir stays */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VouchApp />
  </React.StrictMode>,
);

/* 19.7.0 — once the console has actually mounted, retire the boot splash's
 * light canvas: the boot script paints <html> light for the splash's sake,
 * and the console is dark. Left in place it leaked a light page background
 * behind the dark UI (observed). Two frames out is enough for the first
 * React commit to have painted. */
requestAnimationFrame(() => requestAnimationFrame(() => {
  document.documentElement.style.background = "";
}));


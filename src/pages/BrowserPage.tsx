import { useState } from "react";
import { ipc, useTauri } from "../ipc/client";
import { toast } from "../panels/Toast";
import { ReceiptedBrowser, fetchModeDeps, type ActionResult, type BrowserAction, type BrowserDeps } from "../browser/receipted";

/**
 * VH 16.10.0 — the RECEIPTED browser. Accessibility-tree-first (fetch + HTML
 * parse) for navigation/extract in ANY edition; interactive actions ride the
 * native computer-use boundary on desktop and refuse in words on the web.
 * Every action — executed OR refused — appends to a hash-chained action
 * receipt you can export: the only browser agent that proves what it clicked
 * (and what it refused to fake).
 */
export function BrowserPage() {
  const native = useTauri();
  const [url, setUrl] = useState("https://example.com");
  const [session, setSession] = useState<string>("");
  const [log, setLog] = useState("No actions yet. Every action (and every honest refusal) lands in the receipt below.");
  const [receipt, setReceipt] = useState<{ text: string; hash: string } | null>(null);
  const [browser] = useState(() => new ReceiptedBrowser(native ? nativeDeps() : fetchModeDeps()));

  const run = async (a: BrowserAction) => {
    const r = await browser.run(a);
    setLog(`[${r.ok ? "ok" : "refused"}] ${a.kind} → ${r.detail}`);
    if (!r.ok && native) toast(r.detail.slice(0, 90), "err");
    setReceipt({ text: browser.receipt(), hash: browser.lastHash });
  };

  return (
    <div className="panel-page">
      <h2>Browser</h2>
      <p className="sub">
        Receipted browser use — goto/extract run for real in ANY edition (accessibility-first fetch mode); on the
        desktop, click/type/extract ride the native browser boundary too. Wherever a seat is missing, the action refuses in words
        elsewhere. Every action mints a hash-chained receipt entry.
      </p>
      <div className="row">
        <input className="grow" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="primary" onClick={() => void run({ kind: "goto", url })}>Go (receipted)</button>
        <button onClick={() => void run({ kind: "extract", url, selectorHint: "h1" })}>Extract h1</button>
        <button onClick={() => void run({ kind: "click", target: "button.primary" })}>Click (native seat)</button>
        {native && session && <button onClick={async () => { await ipc.browserSessionClose(session); setSession(""); toast("Closed"); }}>Close session</button>}
      </div>
      <div className="card" style={{ marginTop: 16, minHeight: 160 }}>
        <div className="muted">{native ? `Native desktop · session ${session || "—"}` : "Web edition — fetch mode (labeled); interactive actions refuse honestly"}</div>
        <pre className="mono" style={{ whiteSpace: "pre-wrap" }}>{log}</pre>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Action receipt (hash-chained) {receipt && <span className="pill">head {receipt.hash.slice(0, 12)}…</span>}</div>
        <pre className="mono" style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>{receipt?.text ?? "empty — run an action"}</pre>
        {receipt && <button onClick={() => { const blob = new Blob([receipt.text], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "vh-browser-actions.jsonl"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); }}>Export action receipt</button>}
      </div>
    </div>
  );
}

/** Desktop deps: the existing governed browser boundary (browser_act — the
 * SAME surface the browser seat already exposes: goto/click/type/extract),
 * every result — executed or refused — wrapped as a receipt entry (16.10.1:
 * click/type/extract ride the real boundary now; the copy never promised a
 * refusal-only desktop). */
function nativeDeps(): BrowserDeps {
  const viaAct = async (args: Record<string, unknown>, kind: string): Promise<ActionResult> => {
    try {
      const r = (await ipc.browserAct(args)) as { ok?: boolean; notAttached?: boolean; reason?: string; detail?: string; text?: string; title?: string };
      if (r.notAttached) return { ok: false, detail: r.reason ?? "no browser attached — refused in words.", title: kind };
      if (r.ok === false) return { ok: false, detail: r.reason ?? r.detail ?? "the browser boundary reported failure — reported, not masked.", title: kind };
      return { ok: true, detail: r.detail ?? r.text ?? `${kind} executed via the native browser boundary.`, title: r.title ?? kind };
    } catch (e) {
      return { ok: false, detail: `${kind} refused: ${(e as Error).message.slice(0, 160)} — the receipt records it honestly.`, title: kind };
    }
  };
  return {
    perform: async (a) => {
      if (a.kind === "goto") {
        const created = (await ipc.browserSessionCreate()) as { sessionId: string | null; reason?: string };
        if (!created.sessionId) return { ok: false, detail: created.reason ?? "no browser attached in this build — refused in words.", title: "goto" };
        const r = (await ipc.browserNavigate(created.sessionId, a.url)) as { ok?: boolean; notAttached?: boolean; reason?: string };
        if (r.ok === false || r.notAttached) return { ok: false, detail: r.reason ?? "navigation did not happen.", title: "goto" };
        return { ok: true, detail: `${a.url} navigated (native Chromium, session ${created.sessionId.slice(0, 8)}…)`, title: "goto" };
      }
      if (a.kind === "click") return viaAct({ action: "click", selector: a.target }, "click");
      if (a.kind === "type") return viaAct({ action: "type", selector: a.target, value: a.text }, "type");
      return viaAct({ action: "extract", selector: a.selectorHint, url: a.url }, "extract"); // exhaustive: only extract remains
    },
  };
}

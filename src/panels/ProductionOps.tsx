/**
 * VH 16.10.0 — the PRODUCTION OPS panel: manage & monitor surfaces for the
 * six production features. Every card rides its real engine (providers,
 * triggers, skillStore, discipline, durable) — the composition is
 * deliberately thin and honest; the web/desktop capability split is stated
 * in each card, never hidden.
 */
import { useEffect, useRef, useState } from "react";
import {
  listProviders, addProvider, updateProvider, removeProvider, setProviderKey,
  providerKeyStatus, pingProvider, modelPrefs, setModelPrefs, usageSummary,
  type ProviderEntry, type ProviderKind, type ModelTier, type UsageSummary,
} from "../vouch/engine/providers";
import { TriggerEngine, type TriggerSpec } from "../mission/triggers";
import { dispatchMission } from "../vouch/engine/vouch";
import { importedGenomeRegistry } from "../vouch/engine/skillStore";
import { importFromCatalog, type SkillCatalog } from "../vouch/engine/skillStore";
import { ConstraintLedger } from "../mission/discipline";
import { downloadText } from "../app/desktop";

/* ── 1. MODEL PROVIDERS — work · manage · monitor ────────────────────────── */

export function ProvidersCard() {
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [prefs, setPrefs] = useState(modelPrefs());
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<{ id: string; kind: ProviderKind; label: string; baseUrl: string; defaultModel: string }>(
    { id: "", kind: "openai", label: "", baseUrl: "", defaultModel: "" },
  );
  const [keyDraft, setKeyDraft] = useState<{ id: string; key: string }>({ id: "", key: "" });

  const refresh = () => { setProviders(listProviders()); setPrefs(modelPrefs()); setSummary(usageSummary()); };
  useEffect(refresh, []);

  const add = () => {
    const r = addProvider({ id: draft.id.trim(), kind: draft.kind, label: draft.label.trim() || draft.id.trim(), baseUrl: draft.baseUrl.trim() || undefined, defaultModel: draft.defaultModel.trim() });
    if ("error" in r) { setNote(r.error); return; }
    setNote(`added "${r.label}" — now set its API key (BYOK; it never enters the registry).`);
    setDraft({ id: "", kind: "openai", label: "", baseUrl: "", defaultModel: "" });
    refresh();
  };
  const ping = async (id: string) => {
    setNote(`pinging ${id}…`);
    const r = await pingProvider(id);
    setNote(r.detail);
    refresh();
  };
  const route = (tier: ModelTier, providerId: string, model: string) => {
    const next = { ...prefs, [tier]: { providerId, model } };
    setModelPrefs(next); setPrefs(next);
  };

  return (
    <div className="card">
      <div className="card-title">Model providers — the universal brain (ChatGPT · Claude · Gemini · Groq · OpenRouter · Ollama · custom) <span className="pill">16.10</span></div>
      <p className="muted">
        Bring your own key — it is stored in the local secret store, never in the registry, never in code.
        Routing: a <b>cheap</b> model for routine steps, a <b>big</b> one for hard steps. Desktop runs every provider
        through the governed Rust boundary; the web edition runs Ollama for real and refuses cloud calls in words
        (a browser must not hold cloud keys).
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0" }}>
        <button className={prefs.enabled ? "primary" : ""} onClick={() => { setModelPrefs({ ...prefs, enabled: !prefs.enabled }); refresh(); }}>
          {prefs.enabled ? "Routing: ON" : "Routing: OFF"}
        </button>
        <span className="muted">
          cheap → {prefs.cheap ? `${prefs.cheap.providerId}:${prefs.cheap.model}` : "not set"} · big → {prefs.big ? `${prefs.big.providerId}:${prefs.big.model}` : "not set"}
        </span>
      </div>
      <table>
        <thead><tr><th>Provider</th><th>Kind</th><th>Model</th><th>Key</th><th></th></tr></thead>
        <tbody>
          {providers.map((p) => (
            <tr key={p.id}>
              <td><b>{p.label}</b>{p.enabled ? "" : " (disabled)"}</td>
              <td className="muted">{p.kind}{p.baseUrl ? ` · ${p.baseUrl}` : ""}</td>
              <td>{p.defaultModel}</td>
              <td>{providerKeyStatus(p.id, p.kind) === "set" ? "🔑 set" : providerKeyStatus(p.id, p.kind) === "not-needed" ? "local" : "—"}</td>
              <td style={{ display: "flex", gap: 6 }}>
                <button onClick={() => void ping(p.id)}>Ping</button>
                <button onClick={() => { updateProvider(p.id, { enabled: !p.enabled }); refresh(); }}>{p.enabled ? "Disable" : "Enable"}</button>
                <button className="danger" onClick={() => { removeProvider(p.id); refresh(); }}>Remove</button>
              </td>
            </tr>
          ))}
          {providers.length === 0 && <tr><td colSpan={5} className="muted">No providers yet — add one below.</td></tr>}
        </tbody>
      </table>
      <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        <input placeholder="id (openai-main)" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} style={{ width: 130 }} />
        <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as ProviderKind })}>
          {["openai", "anthropic", "google", "groq", "openrouter", "ollama", "custom"].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input placeholder="label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} style={{ width: 120 }} />
        <input placeholder="base url (custom/openrouter…)" value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} style={{ width: 200 }} />
        <input placeholder="default model" value={draft.defaultModel} onChange={(e) => setDraft({ ...draft, defaultModel: e.target.value })} style={{ width: 160 }} />
        <button className="primary" onClick={add}>Add provider</button>
      </div>
      <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        <select value={keyDraft.id} onChange={(e) => setKeyDraft({ id: e.target.value, key: "" })} style={{ width: 150 }}>
          <option value="">set API key for…</option>
          {providers.filter((p) => p.kind !== "ollama").map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <input placeholder="API key (stored in the secret store)" type="password" value={keyDraft.key} onChange={(e) => setKeyDraft({ ...keyDraft, key: e.target.value })} style={{ width: 260 }} />
        <button onClick={() => { const r = setProviderKey(keyDraft.id, keyDraft.key, providers.find((x) => x.id === keyDraft.id)?.kind); setNote(r.ok ? `key set for ${keyDraft.id} ✓` : r.refused ?? ""); setKeyDraft({ id: "", key: "" }); refresh(); }}>Save key</button>
      </div>
      <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        <span className="muted">route cheap:</span>
        <select onChange={(e) => route("cheap", e.target.value, providers.find((p) => p.id === e.target.value)?.defaultModel ?? "")} value={prefs.cheap?.providerId ?? ""} style={{ width: 140 }}>
          <option value="">—</option>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <span className="muted">big:</span>
        <select onChange={(e) => route("big", e.target.value, providers.find((p) => p.id === e.target.value)?.defaultModel ?? "")} value={prefs.big?.providerId ?? ""} style={{ width: 140 }}>
          <option value="">—</option>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      {summary && summary.total > 0 && (
        <div className="muted" style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 11 }}>
          MONITOR — {summary.total} calls · ok {Math.round(summary.okRate * 100)}% · avg {summary.avgLatencyMs ?? "—"}ms · p95 {summary.p95LatencyMs ?? "—"}ms · tokens {summary.tokensIn}/{summary.tokensOut}
          {summary.estCostUsd != null ? ` · est. $${summary.estCostUsd.toFixed(4)} (estimate)` : ""}
          {summary.perProvider.map((p) => ` · ${p.provider}: ${p.ok}/${p.calls}`).join("")}
          {summary.recentRefusals.length > 0 && <div style={{ marginTop: 4 }}>last refusal: {summary.recentRefusals[summary.recentRefusals.length - 1]?.slice(0, 140)}</div>}
        </div>
      )}
      {note && <div className="muted" style={{ marginTop: 6 }}>{note}</div>}
    </div>
  );
}

/* ── 2. TRIGGERS — always-on, gated ───────────────────────────────────────── */

/** Persisted trigger registry (in-app lifetime, stated): survives reloads,
 * never pretends to survive the window closing — that seat is the native build's. */
const TRIG_KEY = "vh.triggers";
function loadSpecs(): TriggerSpec[] {
  try { return JSON.parse(localStorage.getItem(TRIG_KEY) ?? "[]") as TriggerSpec[]; } catch { return []; }
}
function saveSpecs(specs: TriggerSpec[]): void {
  try { localStorage.setItem(TRIG_KEY, JSON.stringify(specs)); } catch { /* session-only host */ }
}

export function TriggersCard() {
  const [log, setLog] = useState<string[]>([]);
  const [objective, setObjective] = useState("Morning standup: summarize the workspace state and open questions.");
  const [everyMin, setEveryMin] = useState(60);
  const [specs, setSpecs] = useState<TriggerSpec[]>(() => loadSpecs());
  const [armed, setArmed] = useState(false);
  const engineRef = useRef<TriggerEngine | null>(null);
  if (!engineRef.current) {
    // 16.10.1 — THE REAL DISPATCH: a trigger rides dispatchMission, the SAME
    // governed merge-seam path as chat (intent, risk classification, the human
    // gate, the signed receipt). There is no side door and no "queued…" stub.
    engineRef.current = new TriggerEngine({
      dispatch: async (obj, triggerId) => {
        try {
          const r = await dispatchMission(obj);
          return { ok: true, detail: `trigger "${triggerId}" → ${r.slice(0, 180)}` };
        } catch (e) {
          return { ok: false, detail: `trigger "${triggerId}" dispatch refused in words: ${(e as Error).message}` };
        }
      },
    });
  }
  const engine = engineRef.current;
  const fire = async (t: TriggerSpec) => {
    const r = await engine.evaluate(t);
    setLog((l) => [`${new Date().toLocaleTimeString()} — ${r.detail}`, ...l].slice(0, 6));
  };
  // THE TICKER: while armed (and while Vouch Harbor is open) saved triggers
  // are evaluated on a real interval and fire REAL governed missions.
  useEffect(() => {
    if (!armed) return;
    const iv = setInterval(() => { for (const t of loadSpecs()) void fire(t); }, 30_000);
    return () => clearInterval(iv);
  }, [armed]);
  const save = () => {
    const t: TriggerSpec = { id: `every-${everyMin}m`, everyMs: everyMin * 60_000, objective, maxPerDay: 6, quietHours: { from: 23, to: 6 } };
    const next = [...specs.filter((x) => x.id !== t.id), t];
    setSpecs(next); saveSpecs(next);
    setLog((l) => [`saved "${t.id}" (${next.length} registered)`, ...l].slice(0, 6));
  };
  return (
    <div className="card">
      <div className="card-title">Always-on while Vouch Harbor is open — triggers wake real missions without you (and pause at your gate) <span className="pill">16.10</span></div>
      <p className="muted">
        ALWAYS-ON WHILE THE APP RUNS — stated plainly: armed triggers tick every 30s while Vouch Harbor is open
        and the registry survives a reload; an OS-level daemon that survives the window closing is the native-build
        seat, named here and not claimed. Triggers dispatch REAL governed missions through
        <span className="mono"> dispatchMission</span> — the same pipeline as chat: risk classification, the human
        gate, a signed receipt. Quiet hours, daily caps and one-concurrent-run are mechanical.
      </p>
      <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        <input value={objective} onChange={(e) => setObjective(e.target.value)} style={{ flex: 1, minWidth: 260 }} />
        <input type="number" min={1} value={everyMin} onChange={(e) => setEveryMin(Math.max(1, Number(e.target.value)))} style={{ width: 70 }} />
        <span className="muted">min</span>
        <button onClick={save}>Save as always-on</button>
        <button className="primary" onClick={() => void fire({ id: `every-${everyMin}m`, everyMs: everyMin * 60_000, objective, maxPerDay: 6, quietHours: { from: 23, to: 6 } })}>Run trigger now</button>
        <button onClick={() => { setArmed(!armed); setLog((l) => [`${new Date().toLocaleTimeString()} — ${!armed ? "ARMED: saved triggers tick every 30s while this window is open" : "disarmed — nothing fires until you arm again"}`, ...l].slice(0, 6)); }}>
          {armed ? "◼ Armed (tap to disarm)" : "▶ Arm always-on"}
        </button>
      </div>
      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>registered: {specs.length === 0 ? "none yet" : specs.map((t) => t.id).join(", ")}</div>
      {log.map((l, i) => <div key={i} className="muted mono" style={{ fontSize: 11, marginTop: 4 }}>{l}</div>)}
    </div>
  );
}

/* ── 3. SKILL STORE — imported skills re-prove themselves ─────────────────── */

export function SkillStoreCard() {
  const [text, setText] = useState("");
  const [issuerKey, setIssuerKey] = useState("");
  const [note, setNote] = useState("");
  const [imported, setImported] = useState(() => importedGenomeRegistry().genomes.size);
  const doImport = async () => {
    try {
      const catalog = JSON.parse(text) as SkillCatalog;
      const skillId = catalog.skills?.[0]?.id ?? "";
      // 16.10.1: the issuer public key is supplied OUT-OF-BAND (paste it from
      // the channel that gave you the catalog) — a self-reported key is refused,
      // and that refusal is the security model working.
      const r = await importFromCatalog(catalog, skillId, issuerKey.trim() || undefined);
      if (r.ok) { setNote(r.note); setImported(importedGenomeRegistry().genomes.size); } else setNote(r.refused);
    } catch (e) {
      setNote(`not a valid catalog: ${String((e as Error).message).slice(0, 120)}`);
    }
  };
  return (
    <div className="card">
      <div className="card-title">Skill store — an imported skill must RE-PROVE itself on this machine <span className="pill">16.10</span></div>
      <p className="muted">
        Paste a signed catalog (<span className="mono">vh-skill-catalog/1</span>): versioned skills with real provenance
        (mission + verified seats). The signature and digest are verified, then the skill lands UNDER_EVALUATION —
        shadow first, small trial, auto-rollback. It is never imported straight to ACTIVE; trust is re-earned here.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder='{"format":"vh-skill-catalog/1",…}' style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 11 }} />
      <input value={issuerKey} onChange={(e) => setIssuerKey(e.target.value)} placeholder="Issuer public key (hex, out-of-band — required for signed catalogs)" style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 6 }} />
      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>imported capabilities in the genome: {imported} (UNDER_EVALUATION — each re-proves itself here before shadow, canary, active)</div>
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        <button className="primary" onClick={() => void doImport()} disabled={!text.trim()}>Import skill</button>
        <button onClick={() => { const demo = { format: "vh-skill-catalog/1", issuedAt: new Date().toISOString(), skills: [{ id: "demo-clamp", title: "Implement clamp helper", objective: "add the missing clamp", when: "like: clamp the bounds", steps: ["write clamp", "run tests"] }], digest: "unsigned-demo", signature: null }; setText(JSON.stringify(demo, null, 2)); setNote("demo filled — import will REFUSE it (unsigned): that refusal is the feature."); }}>Fill unsigned demo</button>
      </div>
      {note && <div className="muted" style={{ marginTop: 6 }}>{note}</div>}
    </div>
  );
}

/* ── 4. NEVER-GIVE-UP — constraints, ask-don't-guess, proof-before-done ───── */

export function DisciplineCard() {
  const [ledger] = useState(() => new ConstraintLedger());
  const [constraints, setConstraints] = useState(ledger.all());
  const [draft, setDraft] = useState("");
  const [verdict, setVerdict] = useState("");
  return (
    <div className="card">
      <div className="card-title">Never-give-up loop — constraints re-checked every step; proof before done; ask, don't guess <span className="pill">16.10</span></div>
      <p className="muted">Your standing constraints are re-read after every mission step; a violating step is refused in words. A mission cannot claim completion without verification evidence — and "I don't know" is a real action that asks you, not a guess.</p>
      {constraints.map((c) => <div key={c.id} className="muted" style={{ fontSize: 12 }}>• [{c.id}] {c.text}</div>)}
      {constraints.length === 0 && <div className="muted" style={{ fontSize: 12 }}>No standing constraints yet.</div>}
      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. never touch files outside the workspace" style={{ flex: 1 }} />
        <button onClick={() => { if (draft.trim()) { ledger.add(draft.trim()); setConstraints(ledger.all()); setDraft(""); } }}>Add constraint</button>
        <button onClick={() => setVerdict(JSON.stringify(ledger.checkStep("final summary: all tests pass, workspace untouched"), null, 1))}>Test a step summary</button>
      </div>
      {verdict && <pre className="mono muted" style={{ fontSize: 11, marginTop: 6 }}>{verdict}</pre>}
    </div>
  );
}

/* ── 5. DURABLE MISSIONS — survive a crash ────────────────────────────────── */

export function DurableCard() {
  const [note, setNote] = useState("");
  return (
    <div className="card">
      <div className="card-title">Durable missions — save after every step, resume where it stopped, never do a risky thing twice <span className="pill">16.10</span></div>
      <p className="muted">
        The runtime's own <span className="mono">persist()/restore()</span> (state v6, fails loudly on half-state) is now
        wired to a digest-stamped local envelope, and the Done ledger marks each action <b>only after verified
        completion</b> — a half-finished step cannot fire twice. Desktop persists to disk; the web edition keeps the
        same envelope locally (labeled).
      </p>
      <div className="row" style={{ gap: 6 }}>
        <button onClick={() => { downloadText("vh-durable-envelope-spec.json", JSON.stringify({ format: "vh-durable-mission/1", note: "digest-stamped envelope of MissionRuntime.persist() v6 — written each step, verified on resume" }, null, 2)); setNote("envelope spec exported — the format is the contract."); }}>Export envelope spec</button>
      </div>
      {note && <div className="muted" style={{ marginTop: 6 }}>{note}</div>}
    </div>
  );
}

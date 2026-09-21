import React, { useState } from "react";
import { useVh } from "../store";
import { PROVIDER_DEFAULTS } from "../../vh19/providers";
import { AUTONOMY_LEVEL_NAMES, HEARTBEAT_DEFAULT_MS, type AutonomyLevel } from "../../vh19/initiative";
import type { ProviderKind } from "../../vh19/types";
import { mcpRuntimeServers } from "../../vh19/mcpRuntime";
import { VH_VERSION, VH_CODENAME } from "../../version";
import {
  issueLiveGrant, revokeLiveGrant, runLiveCrossing, liveGrant, liveUsage, liveLedgerView,
  loadRegulatedActivation, enableRegulatedBench, DELEGATION_CAPABILITIES, REGULATED_DOMAIN_SLUGS,
} from "../../vh19/federation/live";
import { standingNotice } from "../../vh19/federation/standing";
import { ledgerRowSentence } from "../../vh19/federation/ledger";
import { pairKey } from "../../vh19/vouchMesh";
import type { DelegationCapability } from "../../vh19/reach/delegationGrant";

type Sect = "provider" | "vault" | "autonomy" | "federation" | "appearance" | "about";
const SECTS: Array<[Sect, string]> = [["provider", "Provider"], ["vault", "Vault"], ["autonomy", "Autonomy"], ["federation", "Federation"], ["appearance", "Appearance"], ["about", "About"]];
const KINDS: Array<[ProviderKind, string]> = [["openai-compatible", "OpenAI-compatible"], ["anthropic", "Anthropic"], ["gemini", "Gemini"]];
const MODEL_HINT: Record<ProviderKind, string> = { "openai-compatible": "gpt-4o-mini", anthropic: "claude-3-5-haiku-latest", gemini: "gemini-2.0-flash" };

export function Settings(): React.ReactElement {
  const [sect, setSect] = useState<Sect>("provider");
  return (
    <>
      <header className="top"><h2>Settings</h2></header>
      <div className="scroll"><div className="settings">
        <nav className="snav">{SECTS.map(([k, l]) => <button key={k} aria-current={sect === k ? "page" : undefined} onClick={() => setSect(k)}>{l}</button>)}</nav>
        <div className="sbody">
          {sect === "provider" && <Provider />}
          {sect === "vault" && <Vault />}
          {sect === "autonomy" && <Autonomy />}
          {sect === "federation" && <Federation />}
          {sect === "appearance" && <Appearance />}
          {sect === "about" && <About />}
        </div>
      </div></div>
    </>
  );
}

function Provider() {
  const { provider, setProvider, forgetProvider, securityNote, vault } = useVh();
  const [kind, setKind] = useState<ProviderKind>(provider?.kind ?? "openai-compatible");
  const [baseUrl, setBase] = useState(provider?.baseUrl ?? PROVIDER_DEFAULTS["openai-compatible"]);
  const [model, setModel] = useState(provider?.model ?? "");
  const [key, setKey] = useState("");
  const [persist, setPersist] = useState(vault.status === "unlocked");
  const [note, setNote] = useState<string | null>(securityNote);
  const pick = (k: ProviderKind) => { setKind(k); setBase(PROVIDER_DEFAULTS[k]); };
  const save = async () => { const r = await setProvider({ kind, baseUrl: baseUrl.trim(), apiKey: key.trim(), model: model.trim() || MODEL_HINT[kind] }, persist); setNote(r.note); setKey(""); };
  return (
    <section className="sgroup">
      <h3>Provider</h3><p className="lead">Without a provider the Steward plans but never executes. With one, every step is gated and receipted. Keys never leave this device.</p>
      {provider && <div className="row"><span className="led ok" /><b>{KINDS.find((k) => k[0] === provider.kind)?.[1]}</b><span className="faint mono">{provider.model}</span><button className="btn sm ghost danger" style={{ marginLeft: "auto" }} onClick={forgetProvider}>Remove key</button></div>}
      <div className="seg">{KINDS.map(([k, l]) => <button key={k} aria-pressed={kind === k} onClick={() => pick(k)}>{l}</button>)}</div>
      <label className="field"><span>Base URL</span><input className="input" value={baseUrl} onChange={(e) => setBase(e.target.value)} /></label>
      <label className="field"><span>Model</span><input className="input" placeholder={MODEL_HINT[kind]} value={model} onChange={(e) => setModel(e.target.value)} /></label>
      <label className="field"><span>API key</span><input className="input" type="password" autoComplete="off" placeholder={provider ? "•••••••• (leave blank to keep)" : "paste your key"} value={key} onChange={(e) => setKey(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} /><span>Remember on this device <small>{vault.status === "unlocked" ? "sealed in the vault, AES-256-GCM" : "requires an unlocked vault — otherwise the key lives in memory for this session only"}</small></span></label>
      <div className="acts"><button className="btn primary" disabled={!key.trim() && !provider} onClick={() => void save()}>{provider ? "Update" : "Connect"}</button>{note && <span className="hint">{note}</span>}</div>
    </section>
  );
}

function Vault() {
  const { vault, createVault, unlockVault, lock } = useVh();
  const [pass, setPass] = useState(""); const [note, setNote] = useState<string | null>(null);
  const act = async () => { const r = vault.status === "no-passphrase" ? await createVault(pass) : await unlockVault(pass); setNote(r.note); if (r.ok) setPass(""); };
  return (
    <section className="sgroup">
      <h3>Vault</h3><p className="lead">One passphrase seals your provider key and memory at rest. There is no recovery — length is the only strength no one can take from you.</p>
      <div className="row"><span className={`led ${vault.status === "unlocked" ? "ok" : vault.status === "sealed-locked" ? "warn" : ""}`} /><b>{vault.status === "unlocked" ? "Unlocked" : vault.status === "sealed-locked" ? "Locked" : "Not created"}</b>{vault.kdf && <span className="faint mono">{vault.kdf} · {vault.iterations?.toLocaleString()} rounds</span>}{vault.status === "unlocked" && <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={lock}>Lock now</button>}</div>
      {vault.status !== "unlocked" && <>
        <label className="field"><span>Passphrase</span><input className="input" type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void act(); }} /></label>
        <div className="acts"><button className="btn primary" disabled={pass.length < 8} onClick={() => void act()}>{vault.status === "no-passphrase" ? "Create vault" : "Unlock"}</button><span className="hint">{note ?? "at least 8 characters"}</span></div>
      </>}
      {vault.status === "unlocked" && note && <span className="hint">{note}</span>}
    </section>
  );
}

function Autonomy() {
  const { initiative, setAutonomy, wakeNow, stewardName, renameSteward } = useVh();
  const [name, setName] = useState(stewardName);
  const mcp = mcpRuntimeServers();
  return (
    <>
      <section className="sgroup">
        <h3>Autonomy</h3><p className="lead">How much your Steward may do without being asked. Above Off, a heartbeat every {Math.round(HEARTBEAT_DEFAULT_MS / 60000)} minutes decides, then executes safe acts through the real engine — every act receipted, every risky one stopped at the gate.</p>
        <div className="radios">{([0, 1, 2, 3] as AutonomyLevel[]).map((l) => <label key={l} className="check"><input type="radio" name="auto" checked={initiative.level === l} onChange={() => setAutonomy(l)} /><span>{AUTONOMY_LEVEL_NAMES[l].split(" — ")[0]}<small>{AUTONOMY_LEVEL_NAMES[l].split(" — ")[1]}</small></span></label>)}</div>
        <div className="row"><span className="faint">Scheduled follow-ups</span><b>{initiative.followUps.length}</b><span className="faint" style={{ marginLeft: 16 }}>Breaker</span><b>{initiative.breakerUntil && initiative.breakerUntil > Date.now() ? "tripped" : "closed"}</b>{initiative.level > 0 && <button className="btn ghost" style={{ marginLeft: "auto" }} onClick={() => void wakeNow()}>Run a heartbeat now</button>}</div>
      </section>
      <section className="sgroup">
        <h3>Steward</h3><p className="lead">The name your Steward answers to.</p>
        <div className="acts"><input className="input" style={{ maxWidth: 260 }} value={name} onChange={(e) => setName(e.target.value)} /><button className="btn" disabled={!name.trim() || name === stewardName} onClick={() => renameSteward(name.trim())}>Rename</button></div>
      </section>
      <section className="sgroup">
        <h3>Tools</h3><p className="lead">{mcp.length ? `${mcp.length} governed MCP tool${mcp.length === 1 ? "" : "s"} available to the crew.` : "No external MCP tools enabled — the crew uses its built-in, receipted tools."}</p>
      </section>
    </>
  );
}

/* Federation — two owners, one standing grant, receipted crossings, a common
 * ledger derived from both stores. The live seam (vh19/federation/live) does
 * the signing and refusing; this section only shows it and asks. */
function Federation() {
  const [ownerA, setOwnerA] = useState("you");
  const [ownerB, setOwnerB] = useState("peer");
  const [cap, setCap] = useState<DelegationCapability>(DELEGATION_CAPABILITIES[0]);
  const [task, setTask] = useState("Ship the release notes draft");
  const [days, setDays] = useState(30);
  const [regDomain, setRegDomain] = useState(REGULATED_DOMAIN_SLUGS[0] ?? "");
  const [regBy, setRegBy] = useState("");
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const pair = pairKey(ownerA.trim(), ownerB.trim());
  const grant = liveGrant(); const usage = liveUsage(grant);
  const rows = liveLedgerView(pair);
  const activation = loadRegulatedActivation();
  void tick;
  const run = async (fn: () => Promise<string | null>) => { setBusy(true); try { setNote(await fn()); } catch (e) { setNote(String(e)); } finally { setBusy(false); setTick((n) => n + 1); } };
  return (
    <>
      <section className="sgroup">
        <h3>Standing grant</h3>
        <p className="lead">Two named humans, an enumerated capability list, a crossing budget and an expiry. Nothing crosses without one.</p>
        <div className="acts">
          <input className="input" style={{ maxWidth: 140 }} value={ownerA} onChange={(e) => setOwnerA(e.target.value)} placeholder="you" />
          <input className="input" style={{ maxWidth: 140 }} value={ownerB} onChange={(e) => setOwnerB(e.target.value)} placeholder="peer" />
          <input className="input" style={{ maxWidth: 90 }} type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} title="days" />
          {!grant
            ? <button className="btn" disabled={busy || !ownerA.trim() || !ownerB.trim()} onClick={() => void run(async () => { const r = await issueLiveGrant({ capabilities: [cap], maxCrossings: 5, windowMs: 24 * 3600 * 1000, windowMax: 2, expiresInMs: days * 24 * 3600 * 1000, initiatorHuman: ownerA.trim(), responderHuman: ownerB.trim() }); return r.ok ? "grant issued — both sides signed" : (r.refusal ?? "grant refused"); })}>Issue grant</button>
            : <button className="btn ghost" disabled={busy} onClick={() => void run(async () => { revokeLiveGrant("initiator", ownerA.trim(), "owner revoked in Settings"); return "grant revoked"; })}>Revoke</button>}
        </div>
        {grant && usage && <p className="lead" style={{ marginTop: 10 }}>{standingNotice(grant, usage.initiator)}</p>}
      </section>
      <section className="sgroup">
        <h3>Crossing</h3>
        <p className="lead">One task rides one capability across the pair. Refusals are written in words and receipted like successes.</p>
        <div className="acts">
          <select className="input" value={cap} onChange={(e) => setCap(e.target.value as DelegationCapability)}>{DELEGATION_CAPABILITIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <input className="input" style={{ flex: 1, minWidth: 200 }} value={task} onChange={(e) => setTask(e.target.value)} />
          <button className="btn" disabled={busy || !task.trim()} onClick={() => void run(async () => { const r = await runLiveCrossing({ capability: cap, task: task.trim(), ownerA: ownerA.trim(), ownerB: ownerB.trim() }); return `${r.outcome.status}: ${r.outcome.detail}`; })}>Run crossing</button>
        </div>
      </section>
      <section className="sgroup">
        <h3>Common ledger</h3>
        <p className="lead">Both stores, compared — derived from the two sets, never stored, so it is byte-identical on either side.</p>
        {rows.length === 0 ? <p className="lead faint">No crossings for {pair} yet.</p> : <ul className="rails">{rows.slice(-8).reverse().map((r) => <li key={r.crossingId}><span>{ledgerRowSentence(r)}</span><small>{r.disagrees ? "disagrees" : r.seenBy}</small></li>)}</ul>}
      </section>
      <section className="sgroup">
        <h3>Regulated bench</h3>
        <p className="lead">Regulated specialists route only under a signed activation — a named person, a jurisdiction, a context, a renew-by date.</p>
        <div className="acts">
          <select className="input" value={regDomain} onChange={(e) => setRegDomain(e.target.value)}>{REGULATED_DOMAIN_SLUGS.map((d) => <option key={d} value={d}>{d}</option>)}</select>
          <input className="input" style={{ maxWidth: 180 }} value={regBy} onChange={(e) => setRegBy(e.target.value)} placeholder="enabled by (your name)" />
          <button className="btn" disabled={busy || !regBy.trim()} onClick={() => void run(async () => { const r = await enableRegulatedBench({ domains: [regDomain], enabledBy: regBy.trim(), jurisdiction: "IN", context: "preparer", renewBy: Date.now() + 90 * 24 * 3600 * 1000 }); return r.ok ? "regulated bench enabled — signed" : (r.refusal ?? "activation refused"); })}>Enable</button>
        </div>
        {activation && <p className="lead" style={{ marginTop: 10 }}>Active: {activation.domains.join(", ")} · by {activation.enabledBy} · {activation.jurisdiction} · {activation.context}</p>}
      </section>
      {note && <p className="lead" style={{ color: "var(--accent)" }}>{note}</p>}
    </>
  );
}

function Appearance() {
  const { theme, setTheme, ownerHandle } = useVh();
  const [h, setH] = useState(ownerHandle);
  return (
    <section className="sgroup">
      <h3>Appearance</h3><p className="lead">Two finishes. Both keep the same contrast and the same accent.</p>
      <div className="themes">
        <button aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}><span className="sw dark" /><b>Charcoal</b><small>dark</small></button>
        <button aria-pressed={theme === "light"} onClick={() => setTheme("light")}><span className="sw light" /><b>Bone</b><small>light</small></button>
      </div>
      <h3 style={{ marginTop: 28 }}>You</h3>
      <div className="acts"><input className="input" style={{ maxWidth: 260 }} value={h} onChange={(e) => setH(e.target.value)} placeholder="your handle" /><button className="btn" disabled={!h.trim() || h === ownerHandle} onClick={() => { try { localStorage.setItem("vh.owner.handle", h.trim()); } catch { /* */ } useVh.setState({ ownerHandle: h.trim() }); }}>Save</button></div>
    </section>
  );
}

/* The guardrail manifest — what Vouch Harbor physically cannot do. Each line is a
 * check enforced in CODE and pinned by a probe suite (see probe/guardrailAlign);
 * it is the one place the product states its own limits to the owner. */
const GUARDRAILS: Array<[string, string]> = [
  ["No root authority without a HUMAN principal", "custody"],
  ["No delegation that grows scope or outlives its parent", "custody"],
  ["No spend beyond the signed cap — seats reserve before dispatch", "budget gate"],
  ["No house rules written by an agent — propose only", "ledger"],
  ["No skill or strategy installed without measured adoption or human approval", "ledger"],
  ["No merge when the verifier gate fails — the checker is never the author", "merge gate"],
  ["No learning persisted from simulated runs — measured facts only", "reflection"],
  ["No invented prices — token-only harnesses stay dollar-UNKNOWN", "cost honesty"],
  ["No artifact leaves this machine without a signed egress authority + receipt", "egress gate"],
  ["Capability requests return answers only — raw rows never leave this machine", "capability gate"],
  ["Aggregates pass the Privacy Guard — minimum cohort, hard query budget, bounded precision", "privacy guard"],
  ["The privacy budget is durable and per-requester — a restart resets nothing", "durable budget"],
  ["The two-machine proof: the coordinator sees identity, request, authorization and receipt — never rows", "two-node proof"],
];

function About() {
  return (
    <>
      <section className="sgroup">
        <h3>About</h3>
        <div className="klist about">
          <div><span>Version</span><span className="mono">{VH_VERSION} · {VH_CODENAME}</span></div>
          <div><span>Where it runs</span><span>On this device · no telemetry</span></div>
          <div><span>Honesty contract</span><span>Executes only with a provider · pauses at the gate · refuses in words · receipts everything</span></div>
          <div><span>Egress</span><span>Nothing leaves without a signed authority (requestEgress) and a receipt</span></div>
        </div>
      </section>
      <section className="sgroup">
        <h3>Guardrail manifest</h3>
        <p className="lead">What Vouch Harbor physically cannot do. Enforced in code, not in prompts — each line is a check that runs and is pinned by a test.</p>
        <ul className="rails">{GUARDRAILS.map(([t, tag]) => <li key={t}><span>{t}</span><small>{tag}</small></li>)}</ul>
      </section>
    </>
  );
}

/**
 * VH-19.6.6 — THE FEDERATION CONSOLE.
 *
 * The 19.6.6 redesign: one dark console, one crew rail, VH evidence on every bubble.
 * Left rail = the crew (the Generalist's one face + every specialist's
 * deterministic mark) and the planes; main column = the run stream with the
 * honesty chips riding every bubble; the gate is a banner, never a silent
 * skip. The engine is untouched — askVH19 and the receipts do the talking;
 * this view only renders what actually happened.
 */
import React, { useEffect, useRef, useState } from "react";
import { askVH19 } from "../vh19/generalist";
import type { GeneralistResponse } from "../vh19/types";
import { teammatesFromResponse, coordinationFeed, playgroundMission, type TeammateRow } from "../vh19/teammates";
import { GeneralistFace, SpecialistFace, generalistName, setGeneralistName, type GeneralistMood } from "../vh19/face";
import { answerGateWithRules } from "../vh19/gateRules";
import { recordHandoff, listHandoffs, type HandoffRecord } from "../vh19/handoffs";
import type { GateAsk, GateDecision, ProviderConfig, ProviderKind } from "../vh19/types";
import { PROVIDER_DEFAULTS } from "../vh19/providers";
import {
  issueLiveGrant, revokeLiveGrant, runLiveCrossing, liveGrant, liveUsage,
  liveLedgerView, loadRegulatedActivation, enableRegulatedBench, DELEGATION_CAPABILITIES,
  REGULATED_DOMAIN_SLUGS,
} from "../vh19/federation/live";
import { standingNotice, type StandingGrant } from "../vh19/federation/standing";
import { pairKey } from "../vh19/vouchMesh";
import type { PairLedgerRow } from "../vh19/federation/ledger";
import type { SignedRegulatedActivation } from "../vh19/federation/regulatedPolicy";
import type { CrossingOutcome } from "../vh19/federation/bridge";
import type { DelegationCapability } from "../vh19/reach/delegationGrant";

const USER = "vh-owner";
const PROVIDER_STORAGE_KEY = "vh.provider.remembered.v1";

const loadRememberedProvider = (): ProviderConfig | null => {
  try {
    const raw = globalThis.localStorage?.getItem(PROVIDER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProviderConfig) : null;
  } catch {
    return null;
  }
};

interface Msg { id: number; role: "user" | "vh"; text: string; resp?: GeneralistResponse }

const pill = (s: string) => <span className="nx-pill" data-s={s}>{s}</span>;

export function NextConsole(): React.ReactElement {
  const [panel, setPanel] = useState<"chat" | "crew" | "ledger" | "fed" | "provider">("chat");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [crew, setCrew] = useState<TeammateRow[]>([]);
  const [coord, setCoord] = useState<string[]>([]);
  const [handoffs, setHandoffs] = useState<HandoffRecord[]>(() => listHandoffs());
  const [gateAsk, setGateAsk] = useState<{ ask: GateAsk; resolve: (d: GateDecision) => void } | null>(null);
  const [gName, setGName] = useState(generalistName());
  const [renaming, setRenaming] = useState(false);
  const [provider, setProvider] = useState<ProviderConfig | null>(() => loadRememberedProvider());
  const seq = useRef(0);
  const streamRef = useRef<HTMLDivElement>(null);

  /* ── federation panel state — the live seam renders what is actually stored ── */
  const [ownerA, setOwnerA] = useState("Owner A");
  const [ownerB, setOwnerB] = useState("Owner B");

  /* ── provider onboarding — first-time users connect a model right here ── */
  const [pKind, setPKind] = useState<ProviderKind>(provider?.kind ?? "openai-compatible");
  const [pUrl, setPUrl] = useState(provider?.baseUrl ?? PROVIDER_DEFAULTS["openai-compatible"]);
  const [pKey, setPKey] = useState(provider?.apiKey ?? "");
  const [pModel, setPModel] = useState(provider?.model ?? "");

  const rememberProvider = (cfg: ProviderConfig) => {
    try { globalThis.localStorage?.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(cfg)); } catch { /* stated below */ }
    setProvider(cfg);
  };
  const forgetProvider = () => {
    try { globalThis.localStorage?.removeItem(PROVIDER_STORAGE_KEY); } catch { /* nothing to forget */ }
    setProvider(null); setPKey(""); setPModel("");
  };
  const saveProvider = () => {
    if (!pKey.trim()) { setProviderErr("a provider without an API key connects nothing — name the key"); return; }
    rememberProvider({ kind: pKind, baseUrl: pUrl.trim() || PROVIDER_DEFAULTS[pKind], apiKey: pKey.trim(), model: pModel.trim() });
    setProviderErr(null);
  };
  interface FedState {
    grant: StandingGrant | null;
    notice: string | null;
    rows: PairLedgerRow[];
    activation: SignedRegulatedActivation | null;
    last: CrossingOutcome | null;
    err: string | null;
  }
  const refreshFed = (): FedState => {
    const g = liveGrant();
    const u = liveUsage(g);
    return {
      grant: g,
      notice: g && u ? standingNotice(g, u.initiator) : null,
      rows: liveLedgerView(pairKey(ownerA, ownerB)),
      activation: loadRegulatedActivation(),
      last: null,
      err: null,
    };
  };
  const [providerErr, setProviderErr] = useState<string | null>(null);
  const [fed, setFed] = useState<FedState>(refreshFed);
  const [fedBusy, setFedBusy] = useState(false);
  const [caps, setCaps] = useState<DelegationCapability[]>(["repo.write", "data.aggregate"]);
  const [maxC, setMaxC] = useState(5);
  const [winMax, setWinMax] = useState(2);
  const [grantDays, setGrantDays] = useState(30);
  const [xCap, setXCap] = useState<DelegationCapability>("repo.write");
  const [xTask, setXTask] = useState("Ship the 19.6.6 release notes draft");
  const [regDomains, setRegDomains] = useState(REGULATED_DOMAIN_SLUGS[0] ?? "");
  const [regBy, setRegBy] = useState("K. S. Sree Harshen");
  const [regJur, setRegJur] = useState("IN");
  const [regCtx, setRegCtx] = useState<"advisory" | "preparer" | "reviewer" | "operator">("preparer");
  const [regDays, setRegDays] = useState(90);

  const withBusy = async (fn: () => Promise<void>) => { setFedBusy(true); try { await fn(); } catch (e) { setFed({ ...refreshFed(), err: String(e) }); } finally { setFedBusy(false); } };

  const doIssueGrant = () => withBusy(async () => {
    const r = await issueLiveGrant({
      capabilities: caps, maxCrossings: maxC, windowMs: 24 * 3600 * 1000, windowMax: winMax,
      expiresInMs: grantDays * 24 * 3600 * 1000, initiatorHuman: ownerA.trim(), responderHuman: ownerB.trim(),
    });
    setFed(r.ok ? refreshFed() : { ...refreshFed(), err: r.refusal ?? "grant refused" });
  });
  const doRevokeGrant = () => withBusy(async () => {
    revokeLiveGrant("initiator", ownerA.trim(), "owner revoked at the console");
    setFed(refreshFed());
  });
  const doRunCrossing = () => withBusy(async () => {
    const r = await runLiveCrossing({ capability: xCap, task: xTask, ownerA: ownerA.trim(), ownerB: ownerB.trim() });
    setFed({ ...refreshFed(), last: r.outcome });
  });
  const doEnableRegulated = () => withBusy(async () => {
    const r = await enableRegulatedBench({
      domains: regDomains.split(",").map((s) => s.trim()).filter(Boolean),
      enabledBy: regBy.trim(), jurisdiction: regJur.trim(), context: regCtx,
      renewBy: Date.now() + regDays * 24 * 3600 * 1000,
    });
    setFed(r.ok ? refreshFed() : { ...refreshFed(), err: r.refusal ?? "activation refused" });
  });

  useEffect(() => { document.documentElement.classList.add("nx"); return () => { document.documentElement.classList.remove("nx"); }; }, []);
  useEffect(() => { streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight }); }, [msgs, busy]);

  const gateFn = (ask: GateAsk): Promise<GateDecision> => {
    const ruled = answerGateWithRules(ask);
    if (ruled) return Promise.resolve(ruled);
    return new Promise<GateDecision>((resolve) => setGateAsk({ ask, resolve }));
  };

  const mood = (): GeneralistMood => (gateAsk ? "gate" : busy ? "thinking" : msgs.length ? "idle" : "idle");

  const send = async (forced?: string) => {
    const text = (forced ?? input).trim();
    if (!text || busy) return;
    setInput(""); setBusy(true);
    seq.current += 1;
    setMsgs((m) => [...m, { id: seq.current, role: "user", text }]);
    try {
      const resp = await askVH19(
        { text, userId: USER },
        {
          provider,
          gate: gateFn,
          onHandoff: (h) => { recordHandoff(h); setHandoffs(listHandoffs()); },
          evidenceFetch: typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : undefined,
        },
      );
      seq.current += 1;
      setMsgs((m) => [...m, { id: seq.current, role: "vh", text: resp.reply, resp }]);
      setCrew(teammatesFromResponse(resp));
      setCoord(coordinationFeed(resp));
    } catch (e) {
      seq.current += 1;
      setMsgs((m) => [...m, { id: seq.current, role: "vh", text: `The run failed before it could answer — ${String(e)}` }]);
    } finally {
      setBusy(false);
    }
  };

  const crewRows = crew.length ? crew : [{
    id: "vh19-chief-steward", name: gName, role: "front door · routing · synthesis", status: "idle" as const,
    queue: [], context: [], workspace: "", traceDigests: [],
  }];

  return (
    <div className="nx-shell">
      {/* ── left rail ─────────────────────────────────────────────────── */}
      <aside className="nx-sidebar">
        <div className="flex items-center gap-2 px-1 pb-1">
          <GeneralistFace mood={mood()} size={30} name={gName} />
          <span className="nx-h1 truncate">{gName}</span>
        </div>
        <button className="nx-side-item" onClick={() => void send(playgroundMission().task)}>
          <span className="text-base leading-none">+</span> New task <span className="nx-mute text-[11px] ml-auto">labelled demo</span>
        </button>
        <div className="mt-2 px-1 nx-mute text-[11px] uppercase tracking-wide">Crew</div>
        {crewRows.map((t) => (
          <div key={t.id} className="nx-side-item" data-active={panel === "crew"} onClick={() => setPanel("crew")}>
            {t.id === "vh19-chief-steward"
              ? <GeneralistFace name={gName} size={28} animate={false} />
              : <span className="nx-face"><SpecialistFace id={t.id} size={28} /></span>}
            <div className="min-w-0">
              <div className="text-[13px] text-[color:var(--color-nx-ink)] truncate">{t.name}</div>
              <div className="text-[11px] nx-mute truncate">{t.status}{t.role ? ` · ${t.role}` : ""}</div>
            </div>
          </div>
        ))}
        <div className="mt-auto flex flex-col gap-1">
          <div className="nx-side-item" data-active={panel === "chat"} onClick={() => setPanel("chat")}>Run stream</div>
          <div className="nx-side-item" data-active={panel === "ledger"} onClick={() => { setHandoffs(listHandoffs()); setPanel("ledger"); }}>Handoff ledger</div>
          <div className="nx-side-item" data-active={panel === "fed"} onClick={() => { setFed(refreshFed()); setPanel("fed"); }}>Federation</div>
          <div className="nx-side-item" data-active={panel === "provider"} onClick={() => setPanel("provider")}>Model provider</div>
          <div className="nx-side-item" onClick={() => setRenaming((r) => !r)}>
            Rename Generalist
          </div>
          {renaming && (
            <input
              className="nx-input !py-2 !px-3 text-[13px]"
              placeholder={gName}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const v = setGeneralistName((e.target as HTMLInputElement).value);
                setGName(v); setRenaming(false);
              }}
            />
          )}
        </div>
      </aside>

      {/* ── main column ───────────────────────────────────────────────── */}
      <main className="flex flex-col min-w-0">
        <header className="nx-topbar">
          <GeneralistFace mood={mood()} size={34} name={gName} />
          <div className="min-w-0">
            <div className="nx-h1 truncate">{gName}</div>
            <div className="text-[11.5px] nx-mute truncate">
              {provider
                ? `model connected · ${provider.kind}${provider.model ? ` · ${provider.model}` : ""}`
                : <>plan-only mode, stated, never hidden — <button className="nx-mute underline decoration-dotted underline-offset-2 cursor-pointer" onClick={() => setPanel("provider")}>connect a provider</button></>}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {busy && pill("thinking")}
            {gateAsk && pill("gated")}
          </div>
        </header>

        {gateAsk && (
          <div className="mx-4 mt-3 rounded-[12px] border border-[color:var(--color-nx-warn)] bg-[color:var(--color-nx-panel)] p-3 text-[13px]">
            <span className="font-medium text-[color:var(--color-nx-warn)]">HUMAN GATE</span>{" "}
            — {gateAsk.ask.action}: {gateAsk.ask.summary}
            <div className="mt-2 flex gap-2">
              <button className="nx-chip !text-[color:var(--color-nx-ok)]" onClick={() => { gateAsk.resolve({ approved: true }); setGateAsk(null); }}>Approve</button>
              <button className="nx-chip !text-[color:var(--color-nx-err)]" onClick={() => { gateAsk.resolve({ approved: false, reason: "owner denied at the console" }); setGateAsk(null); }}>Deny</button>
            </div>
          </div>
        )}

        {panel === "chat" && (
          <>
            <div className="nx-stream" ref={streamRef}>
              {msgs.length === 0 && (
                <div className="nx-bubble nx-mute">
                  Ask {gName} anything. Every run shows who was messaged, what each teammate carried,
                  and the verified trace digests of the decisions — nothing rendered that did not happen.
                </div>
              )}
              {msgs.map((m) => (
                <div key={m.id} className="nx-bubble" data-who={m.role}>
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  {m.resp && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {pill(m.resp.outcome)}
                      {m.resp.executed && pill("done")}
                      <span className="nx-digest">provenance {m.resp.provenanceDigest.slice(0, 12)}…</span>
                      {m.resp.authority && <span className="nx-digest">ECDSA mandate {String((m.resp.authority as { mandateDigest?: string }).mandateDigest ?? "").slice(0, 12)}…</span>}
                    </div>
                  )}
                </div>
              ))}
              {coord.length > 0 && panel === "chat" && (
                <div className="flex flex-col gap-1">
                  {coord.slice(-4).map((l, i) => <div key={i} className="text-[11.5px] nx-mute">· {l}</div>)}
                </div>
              )}
            </div>
            <div className="nx-inputbar">
              <input
                className="nx-input"
                placeholder={`Message ${gName}`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
              />
            </div>
          </>
        )}

        {panel === "crew" && (
          <div className="nx-stream">
            {crew.length === 0 ? (
              <div className="nx-bubble nx-mute">No crew yet — send a task or run the labelled demo.</div>
            ) : crew.map((t) => (
              <div key={t.id} className="nx-bubble">
                <div className="flex items-center gap-3">
                  {t.id === "vh19-chief-steward"
                    ? <GeneralistFace name={gName} size={34} animate={false} />
                    : <span className="nx-face"><SpecialistFace id={t.id} size={34} /></span>}
                  <div className="nx-h1">{t.name}</div>
                  {pill(t.status)}
                  <span className="nx-mute text-[12px]">{t.role}</span>
                </div>
                {t.queue.length > 0 && <div className="mt-2 text-[12.5px] nx-mute">{t.queue.join(" · ")}</div>}
                <div className="mt-2 flex flex-wrap gap-1">{t.context.map((c) => <span key={c} className="nx-chip">{c}</span>)}</div>
                <div className="mt-2 nx-digest">{t.workspace}</div>
                {t.authorityNote && <div className="mt-1 nx-digest">{t.authorityNote}</div>}
                {t.traceDigests.slice(0, 2).map((d) => <div key={d} className="nx-digest">trace digest {d.slice(0, 12)}…</div>)}
              </div>
            ))}
          </div>
        )}

        {panel === "ledger" && (
          <div className="nx-stream">
            {handoffs.length === 0 ? (
              <div className="nx-bubble nx-mute">No handoffs yet — every delegation attempt, including the refusals, lands here.</div>
            ) : handoffs.slice().reverse().map((h) => (
              <div key={h.id} className="nx-bubble">
                <div className="flex items-center gap-2">{pill(h.outcome)}<span className="text-[13px]">→ {h.peer}</span><span className="nx-digest">{h.taskDigest.slice(0, 32)}</span></div>
                <div className="mt-1 text-[12.5px] nx-mute">{h.detail}</div>
                {h.meshJointDigest && <div className="mt-1 nx-digest">co-signed joint receipt {h.meshJointDigest.slice(0, 12)}…</div>}
                {h.meshDetail && <div className="nx-digest">{h.meshDetail}</div>}
              </div>
            ))}
          </div>
        )}

        {panel === "fed" && (
          <div className="nx-stream">
            {/* standing authority status */}
            <div className="nx-bubble">
              <div className="flex flex-wrap items-center gap-2">
                <span className="nx-h1 text-[14px]">Standing authority</span>
                {pill(fed.grant ? "grant live" : "no grant")}
                {fed.activation ? pill("regulated bench enabled") : pill("regulated bench dormant")}
                {fedBusy && pill("working")}
              </div>
              <div className="mt-1 text-[12.5px] nx-mute">
                {fed.notice ?? "No standing grant on this machine. Crossings wait for one — or fall back to a per-crossing human decision. Autonomy never extends by inference."}
              </div>
              {fed.grant && (
                <div className="mt-1 nx-digest">
                  grant {fed.grant.grantId.slice(0, 18)}… · capabilities {fed.grant.capabilities.join(", ")} · expires {new Date(fed.grant.expiresAt).toISOString()}
                </div>
              )}
              {fed.err && <div className="mt-2 text-[12.5px] text-[color:var(--color-nx-err)]">{fed.err}</div>}
            </div>

            {/* issue / revoke the grant */}
            <div className="nx-bubble">
              <div className="nx-h1 text-[14px]">Issue a standing grant</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input className="nx-input !px-3 !py-2 text-[13px]" value={ownerA} onChange={(e) => setOwnerA(e.target.value)} placeholder="Initiator owner" />
                <input className="nx-input !px-3 !py-2 text-[13px]" value={ownerB} onChange={(e) => setOwnerB(e.target.value)} placeholder="Responder owner" />
                <input className="nx-input !px-3 !py-2 text-[13px]" type="number" min={1} value={maxC} onChange={(e) => setMaxC(Math.max(1, Number(e.target.value) || 1))} aria-label="max crossings" title="total crossings allowed" />
                <input className="nx-input !px-3 !py-2 text-[13px]" type="number" min={1} value={winMax} onChange={(e) => setWinMax(Math.max(1, Number(e.target.value) || 1))} aria-label="window max" title="max crossings per 24h window" />
                <input className="nx-input !px-3 !py-2 text-[13px]" type="number" min={1} value={grantDays} onChange={(e) => setGrantDays(Math.max(1, Number(e.target.value) || 1))} aria-label="days" title="days until expiry" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {DELEGATION_CAPABILITIES.map((c) => (
                  <button key={c} className="nx-chip" data-on={caps.includes(c)} onClick={() => setCaps((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))}>{c}</button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="nx-chip !text-[color:var(--color-nx-ok)]" onClick={() => void doIssueGrant()}>Sign &amp; issue with the owner key</button>
                {fed.grant && <button className="nx-chip !text-[color:var(--color-nx-err)]" onClick={() => void doRevokeGrant()}>Revoke now</button>}
              </div>
            </div>

            {/* run a crossing */}
            <div className="nx-bubble">
              <div className="nx-h1 text-[14px]">Run a live crossing</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
                <select className="nx-input !px-3 !py-2 text-[13px]" value={xCap} onChange={(e) => setXCap(e.target.value as DelegationCapability)}>
                  {DELEGATION_CAPABILITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input className="nx-input !px-3 !py-2 text-[13px]" value={xTask} onChange={(e) => setXTask(e.target.value)} placeholder="what is being asked, in words" />
              </div>
              <button className="nx-chip mt-2" onClick={() => void doRunCrossing()}>Cross under standing grant</button>
              {fed.last && (
                <div className="mt-3 rounded-[10px] border border-[color:var(--color-nx-line)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {pill(fed.last.status)}
                    <span className="text-[13px]">{fed.last.capability}</span>
                    <span className="text-[12px] nx-mute">{fed.last.reason}</span>
                    <span className="nx-digest">outcome {fed.last.digest.slice(0, 12)}…</span>
                  </div>
                  <div className="mt-1 text-[12.5px] nx-mute">{fed.last.detail}</div>
                  {fed.last.standing && (
                    <div className="mt-1 nx-digest">grant {fed.last.standing.grantDigest.slice(0, 12)}… · {fed.last.standing.notice}</div>
                  )}
                  {fed.last.commonLedger && (
                    <div className={"mt-1 text-[12px] " + (fed.last.commonLedger.record.agreed ? "text-[color:var(--color-nx-ok)]" : "text-[color:var(--color-nx-err)]")}>
                      roots {fed.last.commonLedger.record.agreed
                        ? "agree — both stores hold the same joint row"
                        : `diverge at ${fed.last.commonLedger.record.firstDivergence?.crossingId ?? "an unknown row"}`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* the common ledger */}
            <div className="nx-bubble">
              <div className="nx-h1 text-[14px]">Common ledger — both stores, compared</div>
              {fed.rows.length === 0 ? (
                <div className="mt-1 text-[12.5px] nx-mute">No joint rows yet. Every crossing both owners approved lands here on both sides, with its receipts and its root comparison.</div>
              ) : (
                <div className="mt-2 flex flex-col gap-1">
                  {fed.rows.slice().reverse().map((r) => (
                    <div key={r.crossingId + r.at} className="flex flex-wrap items-center gap-2 text-[12px]">
                      {pill(r.seenBy === "both" ? "both sides" : r.seenBy)}
                      {r.disagrees && pill("disagrees")}
                      <span className="nx-mute">{r.initiator?.capability ?? r.responder?.capability}</span>
                      <span className="nx-mute">{r.initiator?.decision ?? r.responder?.decision}</span>
                      <span className="nx-digest">{(r.initiator?.outcomeDigest ?? r.responder?.outcomeDigest ?? "").slice(0, 16)}…</span>
                      <span className="nx-mute">{new Date(r.at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* regulated activation */}
            <div className="nx-bubble">
              <div className="nx-h1 text-[14px]">Regulated bench activation</div>
              <div className="mt-1 text-[12.5px] nx-mute">
                Registered regulated specialists stay unrouted until this activation exists, signed and complete. A name is not an authorisation.
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input className="nx-input !px-3 !py-2 text-[13px]" value={regDomains} onChange={(e) => setRegDomains(e.target.value)} placeholder={`e.g. ${REGULATED_DOMAIN_SLUGS.slice(0, 2).join(", ")} — comma-separated`} />
                <input className="nx-input !px-3 !py-2 text-[13px]" value={regBy} onChange={(e) => setRegBy(e.target.value)} placeholder="enabled by (named person)" />
                <input className="nx-input !px-3 !py-2 text-[13px]" value={regJur} onChange={(e) => setRegJur(e.target.value)} placeholder="jurisdiction" />
                <select className="nx-input !px-3 !py-2 text-[13px]" value={regCtx} onChange={(e) => setRegCtx(e.target.value as typeof regCtx)}>
                  <option value="advisory">advisory</option>
                  <option value="preparer">preparer</option>
                  <option value="reviewer">reviewer</option>
                  <option value="operator">operator</option>
                </select>
                <input className="nx-input !px-3 !py-2 text-[13px]" type="number" min={1} value={regDays} onChange={(e) => setRegDays(Math.max(1, Number(e.target.value) || 1))} aria-label="renew days" title="days until renewal is due" />
              </div>
              <button className="nx-chip mt-2" onClick={() => void doEnableRegulated()}>Sign &amp; enable activation</button>
            </div>
          </div>
        )}

        {panel === "provider" && (
          <div className="nx-stream">
            <div className="nx-bubble">
              <div className="flex flex-wrap items-center gap-2">
                <span className="nx-h1 text-[14px]">Model provider</span>
                {pill(provider ? "connected" : "not connected")}
              </div>
              <div className="mt-1 text-[12.5px] nx-mute">
                {provider
                  ? `${provider.kind} · ${provider.model || "default model"} · ${provider.baseUrl}`
                  : "No model connected — runs stay plan-only, stated, never hidden. Connect one below; it is used only when you send a task."}
              </div>
            </div>

            <div className="nx-bubble">
              <div className="nx-h1 text-[14px]">Connect a provider</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  className="nx-input !px-3 !py-2 text-[13px]"
                  value={pKind}
                  onChange={(e) => { const k = e.target.value as ProviderKind; setPKind(k); setPUrl(PROVIDER_DEFAULTS[k]); }}
                >
                  <option value="openai-compatible">OpenAI / compatible</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Google Gemini</option>
                </select>
                <input className="nx-input !px-3 !py-2 text-[13px]" value={pModel} onChange={(e) => setPModel(e.target.value)} placeholder="model — e.g. gpt-4.1, claude-sonnet-4, gemini-2.5-pro" />
                <input className="nx-input !px-3 !py-2 text-[13px]" value={pUrl} onChange={(e) => setPUrl(e.target.value)} placeholder="base URL (override for proxies/gateways/local servers)" />
                <input className="nx-input !px-3 !py-2 text-[13px]" type="password" value={pKey} onChange={(e) => setPKey(e.target.value)} placeholder="API key" autoComplete="off" />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="nx-chip !text-[color:var(--color-nx-ok)]" onClick={saveProvider}>Remember on this machine</button>
                {provider && <button className="nx-chip !text-[color:var(--color-nx-err)]" onClick={forgetProvider}>Forget</button>}
              </div>
              {providerErr && <div className="mt-2 text-[12.5px] text-[color:var(--color-nx-err)]">{providerErr}</div>}
              <div className="mt-2 text-[11.5px] nx-mute">
                The key is stored locally in this browser profile under one named record and is used only for provider calls this console makes —
                it is never sent anywhere else, and Forget removes it. Provider replies still ride the same egress guard and injection scan as every external text.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

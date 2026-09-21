import React, { useState } from "react";
import { useVh } from "../store";
import { Composer } from "./Composer";

const STARTS = [
  "Draft a plan with milestones, owners and risks",
  "Recall what we discussed, by topic or by day",
  "Show the honesty contract — what executes, refuses, pauses",
  "Run a token-light workflow with savings shown per reply",
];

export function Steward(): React.ReactElement {
  const { provider, go, send, busy } = useVh();
  const [draft, setDraft] = useState("");
  return (
    <>
      <header className="top"><h2>Steward</h2><div className="right">
        {provider ? <span className="pill ok">connected</span> : <><span className="pill warn">plan only</span><button className="btn sm" onClick={() => go("settings")}>Connect provider</button></>}
      </div></header>
      <div className="scroll"><section className="hero">
        <h1>How can I help you <em>today</em>?</h1>
        <p>Every step comes back with a receipt you can verify.</p>
        <Composer value={draft} onChange={setDraft} onSend={() => { void send(draft); setDraft(""); }} busy={busy} placeholder="Describe the outcome you want…" />
        <div className="starts">
          {STARTS.map((s, i) => <button key={s} onClick={() => setDraft(s)}><span className="n">{i + 1}.</span><b>{s}</b><i className="ic ic-chev" /></button>)}
        </div>
        {!provider && <div className="contract"><div><b>Nothing executes yet.</b> <span>Connect a provider to turn plans into gated, receipted work.</span></div><button className="btn primary sm" onClick={() => go("settings")}>Connect</button></div>}
      </section></div>
    </>
  );
}

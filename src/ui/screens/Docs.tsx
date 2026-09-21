/**
 * Velvet Hand — the Docs door (19.7.13).
 *
 * WHY THIS DOOR EXISTS: the engine has always been able to distill a document
 * into an approved knowledge skill (`mission/knowledgeSkills.ts` —
 * propose → human decision → installed skills), but no surface reached it. The
 * capability was real and unreachable, which is the same as absent. This is the
 * door.
 *
 * WHAT IT WILL NOT DO, by design and enforced upstream:
 *   • it does not summarize. `proposeKnowledgeSkill` refuses a document with no
 *     extractable STRUCTURE (headings, decision rules, frameworks, chapter
 *     hints) and says so in words. A raw blob is refused, not quietly accepted.
 *   • it does not install anything. A proposal waits for the human; approval is
 *     one decision per proposal, recorded with who and when.
 *   • it does not hide where the content went. Every proposal carries
 *     `dataHandling` — "local" when nothing left the machine, "provider" when an
 *     LLM pass sent it to the selected harness — and the door prints it verbatim.
 */

import React, { useRef, useState } from "react";
import { useVh } from "../store";

const MAX_FILE = 2_000_000; // reading cap; the engine caps at 400k chars of content

export function Docs(): React.ReactElement {
  const st = useVh();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const rows = st.knowledge.slice().sort((a, b) => (a.provenance.distilledAt < b.provenance.distilledAt ? 1 : -1));
  const proposed = rows.filter((r) => r.status === "proposed");
  const approved = rows.filter((r) => r.status === "approved");

  async function propose(): Promise<void> {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await st.addDocument(content, name);
      if (r.ok) {
        setText("");
        setName("");
        setNote({ kind: "ok", text: `Proposed as ${r.note}. Nothing is installed until you decide — find it below.` });
      } else {
        setNote({ kind: "warn", text: r.note });
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadFile(f: File | null): Promise<void> {
    if (!f) return;
    if (f.size > MAX_FILE) {
      setNote({ kind: "warn", text: `${f.name} is ${(f.size / 1e6).toFixed(1)} MB — larger than the ${(MAX_FILE / 1e6).toFixed(0)} MB reading cap. Distill a chapter, not a library.` });
      return;
    }
    try {
      const body = await f.text();
      setText(body);
      if (!name.trim()) setName(f.name.replace(/\.(md|markdown|txt|text)$/i, ""));
      setNote({ kind: "ok", text: `Loaded ${f.name} (${body.length.toLocaleString()} characters). Nothing has left this machine.` });
    } catch (e) {
      setNote({ kind: "warn", text: `could not read ${f.name}: ${String(e)}` });
    }
  }

  function decide(id: string, ok: boolean): void {
    const r = st.decideDocument(id, ok, "");
    setNote(r.ok
      ? { kind: "ok", text: ok ? `Approved — the knowledge is now an installed skill (${r.note}).` : `Dismissed (${r.note}). One decision per proposal, recorded.` }
      : { kind: "warn", text: r.note });
  }

  const fmt = (iso: string) => { try { const d = new Date(iso); return `${d.toLocaleDateString([], { month: "short", day: "2-digit" })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`; } catch { return "—"; } };

  return (
    <>
      <header className="top"><h2>Docs</h2><span className="sub">{rows.length ? `${rows.length} proposal${rows.length === 1 ? "" : "s"}` : "teach it from your own documents"}</span></header>
      <div className="scroll"><div className="page narrow">
        <div className="kpis">
          <div><b>{proposed.length}</b><span>Waiting on you</span></div>
          <div><b>{approved.length}</b><span>Approved</span></div>
          <div><b>{rows.filter((r) => r.dataHandling === "local").length}</b><span>Stayed on this machine</span></div>
          <div><b>{rows.filter((r) => r.status === "discarded").length}</b><span>Dismissed</span></div>
        </div>

        <div className="card">
          <div className="field"><label className="lbl" htmlFor="doc-name">Source name</label>
            <input id="doc-name" className="input" placeholder="e.g. Incident review handbook — chapter 3" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field"><label className="lbl" htmlFor="doc-body">Document</label>
            <textarea id="doc-body" className="input" rows={9} placeholder="Paste the document. Headings, numbered procedure and rules distill well; a wall of prose without structure is refused — truthfully, in words."
              value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="row">
            <button className="btn" onClick={() => void propose()} disabled={busy || text.trim().length < 60}>
              {busy ? "Distilling…" : "Propose knowledge"}
            </button>
            <button className="btn sm" onClick={() => file.current?.click()}>Load a file</button>
            <input ref={file} type="file" accept=".md,.markdown,.txt,.text,text/*" style={{ display: "none" }}
              onChange={(e) => { void loadFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <span className="hint">{text.trim().length < 60 ? `${text.trim().length}/60 characters minimum` : `${text.trim().length.toLocaleString()} characters ready`}</span>
          </div>
          {note && <div className={`note ${note.kind === "warn" ? "warn" : ""}`}>{note.text}</div>}
        </div>

        {rows.length === 0 ? (
          <div className="empty"><h3>No documents yet</h3><p>Add one above. The Steward distills its <b>structure</b> — procedure, decision rules, failure modes — into a knowledge proposal, then asks you before anything is installed.</p></div>
        ) : (
          <div className="ledger">
            <div className="lh"><span>When</span><span>Document</span><span>Handling</span><span>Status</span><span /></div>
            {rows.map((r) => (
              <React.Fragment key={r.id}>
                <button className={`lr ${open === r.id ? "open" : ""}`} onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <span className="mono">{fmt(r.provenance.distilledAt)}</span>
                  <span className="t"><b>{r.title}</b><small>{r.provenance.sourceName || "pasted document"}</small></span>
                  <span className="mono">{r.dataHandling === "local" ? "on this machine" : "provider"}</span>
                  <span className={`pill ${r.status}`}>{r.status === "proposed" ? "waiting" : r.status}</span>
                  <span className={`dot ${r.status === "approved" ? "ok" : r.status === "proposed" ? "pending" : "refused"}`} />
                </button>
                {open === r.id && (
                  <div className="ld">
                    <p><b>{r.summary}</b></p>
                    {r.procedure && <p className="hint">Procedure — {r.procedure}</p>}
                    {r.knownFailureModes && <p className="hint">Known failure modes — {r.knownFailureModes}</p>}
                    <p className="hint">
                      {r.dataHandling === "local"
                        ? "Handling: the content never left this machine."
                        : `Handling: the content was sent to ${r.providerInfo?.vendor ?? "a model provider"} (${r.providerInfo?.endpointClass ?? "endpoint unknown"}).`}
                      {" "}Claims: knowledge is approved human knowledge — it is never counted as a measured effect.
                    </p>
                    <div className="acts">
                      {r.status === "proposed" ? (
                        <>
                          <button className="btn sm" onClick={() => decide(r.id, true)}>Approve</button>
                          <button className="btn sm" onClick={() => decide(r.id, false)}>Dismiss</button>
                        </>
                      ) : (
                        <span className="hint">
                          {r.status === "approved"
                            ? `Approved by ${r.decidedBy ?? "owner"} — installed as a knowledge skill.`
                            : `Dismissed by ${r.decidedBy ?? "owner"}${r.decidedAt ? ` · ${fmt(r.decidedAt)}` : ""}.`}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div></div>
    </>
  );
}

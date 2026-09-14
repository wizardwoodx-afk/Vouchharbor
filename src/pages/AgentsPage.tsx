import React, { useMemo, useState } from "react";
import {
  approveCollaboration,
  planCollaborativeTask,
  createCollaborationInvite,
  evolveTeamMemory,
  generateCalibrationExam,
  loadAgenticProductState,
  productSummary,
  recordCalibrationExam,
  recordUserSignal,
  revokeAutonomy,
  routeSpecialists,
  setLocalUser,
  type ExamScenario,
  type SpecialistContract,
} from "../mission/agenticProduct";

const card: React.CSSProperties = { background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: 18 };
const button: React.CSSProperties = { border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.05)", color: "inherit", borderRadius: 9, padding: "8px 11px", cursor: "pointer" };

export const AgentsPage: React.FC = () => {
  const [state, setState] = useState(loadAgenticProductState());
  const [tab, setTab] = useState<"overview" | "collab" | "specialists" | "exam">("overview");
  const [task, setTask] = useState("Review a security-sensitive deployment and verify the implementation before release");
  const [inviteTo, setInviteTo] = useState("user.qwen");
  const [title, setTitle] = useState("Shared product build");
  const [summary, setSummary] = useState("Work together on the VH product with governed autonomy and shared team learning.");
  const [category, setCategory] = useState("security");
  const [scenarios, setScenarios] = useState<ExamScenario[]>([]);
  const [approverId, setApproverId] = useState("user.qwen");
  const [plans, setPlans] = useState<Record<string, { humanGate: string; autonomy: string; specialists: string[] }>>({});
  const [answers, setAnswers] = useState<Record<string, { label: "correct" | "wrong"; reason?: string }>>({});
  const summaryStats = productSummary();
  const matches = useMemo(() => routeSpecialists(task), [task, state.schemaVersion, state.specialists.length]);

  const refresh = () => setState(loadAgenticProductState());

  const createInvite = () => { createCollaborationInvite(inviteTo, title, summary); refresh(); };
  const submitExam = () => {
    if (!scenarios.length) return;
    const result = recordCalibrationExam(state.localUserId, category, scenarios.map(s => ({ scenarioId: s.id, ...(answers[s.id] ?? { label: "wrong" }) })));
    alert(`Calibration score: ${result.score.toFixed(0)}% — ${result.passed ? "autonomy eligible" : "remain supervised"}`);
    refresh();
  };

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: "0 auto", color: "#eee" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, opacity: .6 }}>VH-19 GENERALIST · AGENTIC MOE</div>
        <h1 style={{ margin: "6px 0 4px", fontSize: 32 }}>Agents & Collaboration</h1>
        <div style={{ opacity: .7 }}>One generalist interface; 500+ governed specialists underneath; human-controlled promotion to autonomy.</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {["overview", "collab", "specialists", "exam"].map(x => <button key={x} style={{ ...button, opacity: tab === x ? 1 : .6 }} onClick={() => setTab(x as typeof tab)}>{x[0].toUpperCase()+x.slice(1)}</button>)}
      </div>

      {tab === "overview" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
          {[["Generalist", state.generalistVersion], ["Specialists", summaryStats.specialists.toString()], ["Team memory", summaryStats.teamMemoryEntries.toString()], ["Autonomous grants", summaryStats.autonomyGranted.toString()]].map(([k,v]) => <div key={k} style={card}><div style={{fontSize:12,opacity:.55}}>{k}</div><div style={{fontSize:24,fontWeight:700,marginTop:6}}>{v}</div></div>)}
        </div>
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{fontSize:12,opacity:.55,marginBottom:7}}>GENERALIST ROUTING</div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <input value={task} onChange={e=>setTask(e.target.value)} style={{flex:1,minWidth:300,padding:10,borderRadius:9,border:"1px solid rgba(255,255,255,.12)",background:"#111",color:"inherit"}} />
          </div>
          <div style={{marginTop:12,display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>
            {matches.map(x=><div key={x.id} style={{padding:10,border:"1px solid rgba(255,255,255,.08)",borderRadius:10}}><b>{x.name}</b><div style={{fontSize:12,opacity:.65}}>{x.risk} · {x.framework} · security {Math.round(x.securityScore*100)}%</div></div>)}
          </div>
        </div>
        <div style={{ ...card }}>
          <div style={{fontSize:12,opacity:.55}}>LOCAL PRINCIPAL</div>
          <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
            <input value={state.localDisplayName} onChange={e=>setLocalUser(e.target.value, state.localUserId) || refresh()} style={{padding:9,borderRadius:8,border:"1px solid rgba(255,255,255,.12)",background:"#111",color:"inherit"}} />
            <span style={{opacity:.55,paddingTop:8}}>{state.localUserId}</span>
          </div>
        </div>
      </>}

      {tab === "collab" && <>
        <div style={{ ...card, marginBottom: 16 }}>
          <h3 style={{marginTop:0}}>Invite another user's agent</h3>
          <div style={{display:"grid",gap:8}}>
            <input value={inviteTo} onChange={e=>setInviteTo(e.target.value)} placeholder="User 2 ID" style={{padding:9,borderRadius:8,border:"1px solid rgba(255,255,255,.12)",background:"#111",color:"inherit"}} />
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Task title" style={{padding:9,borderRadius:8,border:"1px solid rgba(255,255,255,.12)",background:"#111",color:"inherit"}} />
            <textarea value={summary} onChange={e=>setSummary(e.target.value)} rows={3} style={{padding:9,borderRadius:8,border:"1px solid rgba(255,255,255,.12)",background:"#111",color:"inherit"}} />
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button style={button} onClick={createInvite}>Create approval link/code</button><input value={approverId} onChange={e=>setApproverId(e.target.value)} placeholder="User 2 approval identity" style={{flex:1,minWidth:220,padding:9,borderRadius:8,border:"1px solid rgba(255,255,255,.12)",background:"#111",color:"inherit"}} /></div>
          </div>
        </div>
        {state.collaborations.map(c=><div key={c.id} style={{...card,marginBottom:10}}><b>{c.taskTitle}</b><div style={{opacity:.65,fontSize:13,margin:"5px 0"}}>{c.fromDisplayName} → {c.toUserId} · {c.status} · code <code>{c.inviteCode}</code></div><div>{c.taskSummary}</div>{c.status === "pending" && <div style={{display:"flex",gap:8,marginTop:10}}><button style={button} onClick={()=>{approveCollaboration(c.id,approverId,true);refresh()}}>Approve</button><button style={button} onClick={()=>{approveCollaboration(c.id,approverId,false);refresh()}}>Deny</button></div>}{c.status === "approved" && <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap"}}><button style={button} onClick={()=>{evolveTeamMemory(c.id, "shared", "The two principals accepted the shared task boundary and retain only task-relevant patterns.", "success", ["mutual approval","bounded authority"], .92);refresh()}}>Record Team-Evolve learning</button><button style={button} onClick={()=>{try{const p=planCollaborativeTask(c.id,c.taskSummary);setPlans({...plans,[c.id]:{humanGate:p.humanGate,autonomy:p.autonomy,specialists:p.specialists.map(s=>s.name)}})}catch(e){alert((e as Error).message)}}}>Plan governed run</button>{plans[c.id]&&<span style={{padding:8,opacity:.75}}>gate: {plans[c.id].humanGate} · mode: {plans[c.id].autonomy} · {plans[c.id].specialists.slice(0,3).join(", ")}</span>}</div>}</div>)}
      </>}

      {tab === "specialists" && <div style={{ ...card }}><div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><div><h3 style={{margin:0}}>Specialist catalog</h3><div style={{opacity:.65,fontSize:13}}>VH-owned contract; OSS frameworks are implementation substrates, not trust boundaries.</div></div><div style={{opacity:.65}}>{state.specialists.length} loaded</div></div><div style={{maxHeight:560,overflow:"auto"}}>{state.specialists.slice(0,80).map(s=><div key={s.id} style={{display:"grid",gridTemplateColumns:"1.8fr 1fr 1fr 1fr",gap:10,padding:"10px 0",borderTop:"1px solid rgba(255,255,255,.06)",fontSize:13}}><div><b>{s.name}</b><div style={{opacity:.55}}>{s.id}</div></div><div>{s.framework}</div><div>{s.risk}</div><div>bench {Math.round(s.benchmarkScore*100)} · sec {Math.round(s.securityScore*100)}</div></div>)}</div></div>}

      {tab === "exam" && <div style={{ ...card }}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:12}}><select value={category} onChange={e=>setCategory(e.target.value)} style={{padding:9,borderRadius:8,background:"#111",color:"inherit"}}><option>security</option><option>code</option><option>research</option><option>product</option><option>testing</option></select><button style={button} onClick={()=>setScenarios(generateCalibrationExam(state.localUserId, category, 5))}>Generate exam</button><button style={{...button,opacity:scenarios.length?1:.4}} onClick={submitExam} disabled={!scenarios.length}>Submit calibration</button></div>
        {scenarios.map((s,i)=><div key={s.id} style={{padding:"14px 0",borderTop:"1px solid rgba(255,255,255,.06)"}}><div style={{fontSize:12,opacity:.55}}>SCENARIO {i+1} · {s.risk}</div><div style={{margin:"6px 0"}}>{s.situation}</div><div style={{padding:10,borderRadius:8,background:"rgba(255,255,255,.03)"}}><b>Agent answer:</b> {s.proposedAnswer}</div><div style={{display:"flex",gap:8,marginTop:8}}><button style={{...button,background:answers[s.id]?.label==="correct"?"rgba(34,197,94,.15)":undefined}} onClick={()=>setAnswers({...answers,[s.id]:{label:"correct"}})}>✓ Correct</button><button style={{...button,background:answers[s.id]?.label==="wrong"?"rgba(239,68,68,.15)":undefined}} onClick={()=>setAnswers({...answers,[s.id]:{label:"wrong"}})}>✗ Wrong</button>{answers[s.id]?.label==="wrong" && <input placeholder="Why?" onChange={e=>setAnswers({...answers,[s.id]:{label:"wrong",reason:e.target.value}})} style={{flex:1,padding:8,borderRadius:8,border:"1px solid rgba(255,255,255,.12)",background:"#111",color:"inherit"}} />}</div></div>)}
        {state.autonomy.filter(x=>x.userId===state.localUserId).map(a=><div key={a.id} style={{marginTop:12,padding:12,borderRadius:10,border:"1px solid rgba(255,255,255,.08)"}}><b>{a.category}</b> — {a.state} · latest score {a.score.toFixed(0)}% · evidence {a.evidenceCount} <button style={{...button,float:"right"}} onClick={()=>{revokeAutonomy(a.userId,a.category);refresh()}}>Revoke autonomy</button></div>)}
      </div>}
    </div>
  );
};

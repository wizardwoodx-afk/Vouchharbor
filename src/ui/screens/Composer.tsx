import React from "react";
import { useVh } from "../store";

export function Composer({ value, onChange, onSend, busy, placeholder, small }: { value: string; onChange: (v: string) => void; onSend: () => void; busy: boolean; placeholder: string; small?: boolean }): React.ReactElement {
  const { memOn, stewardName } = useVh();
  return (
    <div className="composer">
      <textarea
        value={value} placeholder={placeholder} rows={small ? 2 : 3}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (value.trim() && !busy) onSend(); } }}
      />
      <div className="bar">
        <span className="chip"><i className="ic ic-steward" />{stewardName}</span>
        <span className="chip">{memOn ? "Memory on" : "Memory off"}</span>
        <button className="send" aria-label="Send" disabled={busy || !value.trim()} onClick={onSend}><i className="ic ic-arrow" /></button>
      </div>
    </div>
  );
}

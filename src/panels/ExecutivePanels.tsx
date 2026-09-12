/**
 * VH 16.9.1 — the three UNIFYING planes (the VC-focused product story).
 *
 * The 16.x line grew deep machinery across many doors. These three panels do
 * NOT add engines — they unify existing ones into the three questions an
 * executive, an auditor and an investor actually ask:
 *
 *   1. TrustCenterPanel       (Proof door)  "Can I trust it — and can you prove it?"
 *      unifies: receipt vault + Ed25519 issuer + control crosswalk + assurance.
 *      One click exports the Trust Pack an enterprise buyer or VC diligence
 *      team reads first.
 *
 *   2. AssuranceScorecardPanel (Audit door) "How good is the evidence, really?"
 *      unifies: the 0–100 Assurance Score + its band, from measured runs only.
 *
 *   3. CostPerOutcomePanel     (Audit door) "What does a verified outcome cost?"
 *      unifies: budget ledger + measured chargeback — `unmeasured` stays
 *      `unmeasured`, simulated seats are never charged.
 *
 * Ethos contract: the WEB edition renders on labeled demo state (this repo's
 * own rule: Web = labeled demo, Desktop = real execution). Every demo input is
 * badged as such, inline, next to the numbers it produces. Nothing faked.
 */
import { useEffect, useState } from "react";
import { downloadText } from "../app/desktop";
import { globalReceiptVault, type VaultRecord } from "../mission/receiptVault";
import { EVIDENCE_CONTROL_MAPPINGS } from "../mission/evidencePack";
import { scoreAssurance, type AssuranceScore } from "../mission/assuranceScore";
import { rowFor, type ChargebackRow, type FinOpsMissionInput } from "../mission/finOps";
import { VH_VERSION } from "../version";

function DemoBadge() {
  return (
    <span className="pill" title="This web edition renders on labeled demo state. The desktop edition computes the same panels from live local records.">
      labeled demo · web edition
    </span>
  );
}

/* ── 1. TRUST CENTER ──────────────────────────────────────────────────────── */

function demoAssuranceInput() {
  return {
    measuredRuns: 34,
    simulatedRuns: 12,
    crossVendorVerifiedRuns: 21,
    sameVendorVerifiedRuns: 9,
    arenaPassRuns: 30,
    budgetAdherences: [0.98, 1.0, 0.91, null, 1.0, 0.87, 1.0, 1.0],
    egressViolations: 0,
    feedbackRatings: [5, 4, 5, 3, 5, 4, 5, 4, 5, 4, 5, 5],
  };
}

export function TrustCenterPanel() {
  const [records, setRecords] = useState<VaultRecord[]>([]);
  useEffect(() => {
    setRecords(globalReceiptVault.list());
  }, []);
  const input = demoAssuranceInput();
  const score: AssuranceScore = scoreAssurance(input);
  const gatePass = records.filter((r) => r.gateStatus === "PASS").length;

  const exportTrustPack = () => {
    const lines = [
      `# Vouch Harbor ${VH_VERSION} — Trust Pack`,
      ``,
      `Generated ${new Date().toISOString()} · web edition, labeled demo state.`,
      ``,
      `## Assurance`,
      `- Assurance score: ${score.score ?? "unevaluated"}${score.band ? ` (band ${score.band})` : ""}`,
      `- Evidence coverage: ${score.evidenceCoverage ?? "n/a"}`,
      `- Receipts in vault: ${records.length} · adversarial-gate PASS: ${gatePass}`,
      ``,
      `## Control crosswalk (EU AI Act · ISO 42001 · SOC 2)`,
      ...EVIDENCE_CONTROL_MAPPINGS.map(
        (m) => `- **${m.control}** — asks: ${m.whatItAsksFor}\n  - provides: ${m.whatVhProvides}\n  - artifact: ${m.artifact}`,
      ),
      ``,
      `## Verification (zero product state)`,
      `\`node tools/verify-receipt.mjs receipt.jsonl\` — chain, seal and Ed25519 signature,`,
      `on any machine, with no install. Broken chains print the exact seq.`,
      ``,
      `*An environment limitation is labeled; a claim without an artifact is not made.*`,
    ];
    downloadText("vouch-trust-pack.md", lines.join("\n"));
  };

  return (
    <div className="card">
      <div className="card-title">
        Trust Center — the one page a buyer or investor reads first <DemoBadge />
      </div>
      <p className="muted">
        Unifies the proof machinery into one diligence surface: the live receipt vault, the
        issuer posture, the assurance score and the regulatory crosswalk — exportable as a
        single Trust Pack.
      </p>
      <div className="stat" style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "10px 0" }}>
        <div><div className="n" style={{ fontSize: 26 }}>{score.score ?? "—"}</div><div className="muted">assurance / 100{score.band ? ` · band ${score.band}` : ""}</div></div>
        <div><div className="n" style={{ fontSize: 26 }}>{records.length}</div><div className="muted">receipts in vault</div></div>
        <div><div className="n" style={{ fontSize: 26 }}>{gatePass}</div><div className="muted">adversarial-gate PASS</div></div>
        <div><div className="n" style={{ fontSize: 26 }}>{EVIDENCE_CONTROL_MAPPINGS.length}</div><div className="muted">mapped controls</div></div>
      </div>
      <table>
        <thead>
          <tr><th>Control</th><th>What it asks for</th><th>What Vouch Harbor provides</th><th>Artifact</th></tr>
        </thead>
        <tbody>
          {EVIDENCE_CONTROL_MAPPINGS.map((m) => (
            <tr key={m.control}>
              <td><b>{m.control}</b></td>
              <td className="muted">{m.whatItAsksFor}</td>
              <td>{m.whatVhProvides}</td>
              <td className="muted">{m.artifact}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10 }}>
        <button className="primary" onClick={exportTrustPack}>Export Trust Pack (.md)</button>
      </div>
    </div>
  );
}

/* ── 2. ASSURANCE SCORECARD ──────────────────────────────────────────────── */

export function AssuranceScorecardPanel() {
  const input = demoAssuranceInput();
  const score = scoreAssurance(input);
  const bandColor = score.band === "A" ? "var(--ok)" : score.band === "B" ? "var(--accent)" : "var(--danger)";
  return (
    <div className="card">
      <div className="card-title">
        Assurance Scorecard — how good is the evidence, really <DemoBadge />
      </div>
      <p className="muted">
        One number per team, derived only from measured runs: verification mix, adversarial
        arena, budget discipline, egress integrity, human feedback. Refuses to exist without
        measured runs — an unevaluated team says so.
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, margin: "12px 0" }}>
        <span style={{ fontSize: 44, fontVariantNumeric: "tabular-nums", color: bandColor }}>{score.score ?? "—"}</span>
        <span className="pill" style={{ borderColor: bandColor, color: bandColor }}>band {score.band ?? "—"}</span>
        <span className="muted">evidence coverage {score.evidenceCoverage != null ? Math.round(score.evidenceCoverage * 100) + "%" : "n/a"}</span>
      </div>
      <p className="muted">
        Dilution is honest by construction: {input.simulatedRuns} labeled-simulation runs dilute
        coverage and add zero points; {input.crossVendorVerifiedRuns} runs were verified by a
        different vendor's harness than the writer's.
      </p>
    </div>
  );
}

/* ── 3. COST-PER-OUTCOME ─────────────────────────────────────────────────── */

const DEMO_MISSIONS: FinOpsMissionInput[] = [
  { missionId: "msn-301", teamId: "crew-guard", teamName: "Guard Crew", finishedAt: "2026-09-10T09:12:00Z", measuredSeatUsd: [0.42, 0.18, 0.09], tokensOnlySeats: 1, simulatedSeats: 0, budgetUsd: 1.0 },
  { missionId: "msn-302", teamId: "crew-maths", teamName: "Maths Crew", finishedAt: "2026-09-10T09:40:00Z", measuredSeatUsd: [0.31, 0.27], tokensOnlySeats: 0, simulatedSeats: 1, budgetUsd: 0.8 },
  { missionId: "msn-303", teamId: "crew-docs", teamName: "Docs Crew", finishedAt: "2026-09-10T10:05:00Z", measuredSeatUsd: [], tokensOnlySeats: 3, simulatedSeats: 0, budgetUsd: 0.5 },
  { missionId: "msn-304", teamId: "crew-audit", teamName: "Audit Crew", finishedAt: "2026-09-10T10:31:00Z", measuredSeatUsd: [0.66, 0.21, 0.12], tokensOnlySeats: 0, simulatedSeats: 0, budgetUsd: null },
];

export function CostPerOutcomePanel() {
  const rows: ChargebackRow[] = DEMO_MISSIONS.map(rowFor);
  const measured = rows.filter((r) => r.measuredUsd != null);
  const totalUsd = measured.reduce((a, r) => a + (r.measuredUsd ?? 0), 0);
  const exportCsv = () => {
    const head = "missionId,teamId,teamName,measuredUsd,tokensOnlySeats,simulatedSeats,budgetUsd,adherence,overrunUsd";
    const body = rows
      .map((r) =>
        [r.missionId, r.teamId, JSON.stringify(r.teamName), r.measuredUsd ?? "unmeasured", r.tokensOnlySeats, r.simulatedSeats, r.budgetUsd ?? "uncapped", r.adherence ?? "unmeasurable", r.overrunUsd].join(","),
      )
      .join("\n");
    downloadText("vouch-cost-per-outcome.csv", `${head}\n${body}\n`);
  };
  return (
    <div className="card">
      <div className="card-title">
        Cost per Outcome — what a verified outcome costs <DemoBadge />
      </div>
      <p className="muted">
        Measured chargeback from the budget ledger's real settlements: seats that reported only
        tokens stay <span className="pill">unmeasured</span> — never priced; simulated seats are
        counted, never charged. Cost predictability is the quiet blocker; this is the answer.
      </p>
      <div className="stat" style={{ display: "flex", gap: 18, margin: "10px 0" }}>
        <div><div className="n" style={{ fontSize: 26 }}>${totalUsd.toFixed(2)}</div><div className="muted">measured spend · {rows.length} missions</div></div>
        <div><div className="n" style={{ fontSize: 26 }}>{measured.length ? `$${(totalUsd / measured.length).toFixed(2)}` : "—"}</div><div className="muted">avg measured cost / verified mission</div></div>
      </div>
      <table>
        <thead>
          <tr><th>Mission</th><th>Team</th><th>Measured</th><th>Budget</th><th>Adherence</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.missionId}>
              <td>{r.missionId}</td>
              <td>{r.teamName}</td>
              <td>{r.measuredUsd != null ? `$${r.measuredUsd.toFixed(2)}` : <span className="pill">unmeasured</span>}</td>
              <td>{r.budgetUsd != null ? `$${r.budgetUsd.toFixed(2)}` : <span className="muted">uncapped</span>}</td>
              <td>{r.adherence != null ? `${Math.round(r.adherence * 100)}%` : <span className="muted">unmeasurable</span>}{r.overrunUsd > 0 ? ` · +$${r.overrunUsd.toFixed(2)} over` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10 }}>
        <button className="primary" onClick={exportCsv}>Export chargeback CSV</button>
      </div>
    </div>
  );
}

# Vouch Harbor — Pre-Seed Application

**Vouch Harbor Labs** · v19.4.4 "Broader" · September 2026
*(Every capability claim below is verifiable in this repository — commands in §10. Founder-specific fields are marked TODO(founder) and deliberately left unfilled rather than invented.)*

---

## 1. One line

**Vouch Harbor is the accountable agent OS: it runs fleets of AI agents on your own machine and turns every mission into signed, independently verifiable evidence — the assurance runtime for the age of agent audits.**

## 2. Problem

Agents are now doing real work — code, research, operations — but nobody can
answer three questions an enterprise must answer before trusting them:

1. **What did the agent actually do?** (execution evidence, not chat logs)
2. **Who approved what, and when?** (human authority over risky actions)
3. **Can we prove it afterwards?** (audit-grade receipts, replayable)

The consumer agent wave (GROKBOT, MUSE and peers) optimizes for capability
inside walled gardens. The enterprise blocker is not capability — it is
**assurance**. Meanwhile, every serious recursive-self-improvement system in
the research literature is bounded by a fixed evaluation signal and human
oversight; no shipping product treats that boundary as a *product feature*.

## 3. Solution

One product, one engine, six doors (Teammate · Mission Loop · Workflows ·
Proof · Audit · System) plus the VH-19 front door:

- **620 registered specialists** (460 seed-batch + 160 broader-batch,
  composition computed from the registry at runtime and pinned by probes),
  organized as a routed MoE under one Generalist; a Captain layer
  synthesizes multi-member runs.
- **Real execution, not personas**: workspace-wired specialists run a gated
  act/observe tool loop in the browser (File System Access API) or the
  native shell; every tool call is risk-tiered, human-gated, receipted.
- **Governance as product**: the human gate with risk tiers receipts
  approvals **and** refusals; the 90% autonomy bar is earned by exam and
  revocable; override is permanent.
- **RSIRALS v5.0 (proprietary)**: trust-rooted recursive self-improvement —
  three planes (frozen governance plane with no agent write path; trust
  plane; agent plane), five-source evidence curriculum, human-gated apply,
  frozen digest-stamped memory, receipt-bound sealed promotion, canary with
  automatic rollback, evolution archive, longitudinal drift monitor.
- **BYOA — bring your own agent**: external agents join under a trust
  intersection (endpoint policy ∩ risk ceiling ∩ non-authoritative declared
  capabilities ∩ identity), gated and ledgered like everything else.
- **Local-first assurance**: keys in memory only, one SSRF/egress-guarded
  network policy, offline verification pack — the audit story works with
  the network unplugged.

## 4. Why now

- Enterprise agent adoption is gated on auditability (agent audits are now
  a named category; see the 2026 RSI survey's "governance-grade measurement"
  gap).
- The self-improvement literature converged on bounded, verifier-anchored
  loops — the product pattern is settled; nobody ships it as governance.
- Consumer agents proved the UX (chatbox-first, skills, connectors,
  approvals). VH ships the same surface area plus the assurance layer they
  structurally cannot.

## 5. Traction & evidence of capability (honest state)

Pre-seed, pre-revenue. What exists today is **verifiable engineering depth**,
not metrics we do not have:

- 120 probe suites / 119 offline bundles green on every release, plus
  protocol selftest 171/171 — verification is the product culture.
- A release-verification record ships in every archive; every number in it
  is reproducible by command (§10).
- 31+ releases of continuous, receipted iteration on one engine.
- Pilot/LOI pipeline: TODO(founder)

## 6. Competition

| They offer | Vouch Harbor ships instead |
|---|---|
| GROKBOT / MUSE: first-party bots, taught tasks, cloud computer, approval pauses | BYOA under a trust intersection; receipts for approvals and refusals; on-device execution |
| Agent orchestration frameworks (LangGraph, AutoGen, CrewAI) | The assurance runtime around any fleet: gates, receipts, exams, audits, verifiable releases |
| RSI research systems (AlphaEvolve, Darwin Gödel Machine, Gödel Agent, RSIAgent) | RSIRALS v5.0 as governance product: frozen governance plane, sealed promotion, canary rollback — bounded RSI you can deploy |

Positioning line: **They watch the screen; we sign the work.**

## 7. Moat

1. **The assurance stack is compounding**: gates, receipts, exams, probes,
   floors and the RSIRALS planes are 31+ releases deep and probe-pinned —
   not replicable by bolting "approvals" onto an orchestrator.
2. **Proprietary RSI architecture**: RSIRALS v5.0's three-plane separation
   (∂T/∂A = 0) with sealed, receipt-bound promotion is our design, shipped
   and pinned.
3. **Honesty as a trust asset**: claims-vs-code audits are welcomed and
   survived; the release record is reproducible. In assurance, credibility
   is the product.

## 8. Business model

- **Desktop/enterprise license** for the native assurance runtime (per-seat
  or per-fleet), priced against audit cost, not model tokens.
- **Assurance cloud (opt-in)**: receipt storage, cross-team audit rooms,
  signed attestations — the natural upsell once fleets run.
- Pricing details: TODO(founder)

## 9. Team

TODO(founder) — founders, relevant history, why this team. *(Left blank on
purpose: a pre-seed application deserves real names, not generated ones.)*

## 10. Verification appendix (reproduce every claim)

```bash
npm install
npx tsc --noEmit                     # 0 errors
npm test                             # 120/120 probe suites
node verify/run.mjs                  # 119/119 offline bundles
node protocol/test/selftest.js       # 171/171 (after cd protocol && npm i)
sh VERIFY.sh                         # zero-dependency bare-machine gate
```

Specialist count: `catalogStats()` → `{ count: 620, byProvenance: { seed: 460, broader: 160 } }`.
Key documents: RELEASE-VERIFICATION.md · VH-19.4-UPGRADE.md · docs/RSIRALS.md · docs/RSI-FRAMEWORK.md · docs/VOUCH-HARBOR-ONEPAGER.md.

## 11. Ask

TODO(founder) — round size, use of funds (recommended buckets: desktop
assurance runtime hardening + pilots; RSIRALS workload validation drill;
first enterprise design partners), milestones for the next 18 months.

---

*Honesty clause: this application states only what the repository
demonstrates. No traction, revenue or team claims are made anywhere in this
document that are not marked TODO(founder) for the founders to supply.*

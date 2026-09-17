# VH 19.5 — Adaptation Plan: Computer-Use (OpenBot patterns) + Generalist Avatar (OneWorks)

*Status: PLAN — 19.4.5 remains the frozen pre-seed baseline. Nothing here ships until the benchmark + pre-seed cycle closes and the reviewer signs off on scope.*
*Directive: adapt proven OSS capabilities into the VH ecosystem our way — local-first, gated, receipted, 5-color. We adopt patterns, never dependencies that break local-first.*

---

## Part A — Computer-Use capability (adapted from OpenBot, MIT © CopilotKit)

### What OpenBot proves (and we adopt)
1. **A computer per agent** — each Bot gets an isolated workspace: own container, own browser profile, own files.
2. **One gateway for every action** — browser, file, shell and MCP actions all pass one policy point that decides, records, then acts (or refuses and names the rule).
3. **Take-the-wheel** — when the agent hits a login wall / 2FA, control hands to the human, recorded as handover events; while the human drives, agent actions are refused, not queued.
4. **Bring-any-agent** — any AG-UI endpoint becomes a Bot, validated like any other target.

### What we change / refuse
| OpenBot | VH 19.5 |
|---|---|
| Requires CopilotKit Intelligence (external SaaS) for threads/memory | **Refused.** VH memory + ledger stay local; no external runtime dependency |
| PostgreSQL for policy/audit | **Refused.** Gate decisions + receipts flow into the existing hash-chained ledger — offline-verifiable, signed |
| Audit rows = evidence | **Upgraded.** OpenBot's audit is a DB table; VH receipts are signed, hash-chained, and verifiable on a machine that never saw the app |
| Docker hard-requirement | **Optional adapter.** Container runtime when present; graceful fallback to sandboxed-process + virtual-FS mode (the browser-FS path we already ship) |
| Policy rules in YAML | Kept as importable, but the **frozen governance plane decides** — policy cannot grant what the governance plane forbids |

### Architecture (new module `src/vh19/computer.ts`)
```
ComputerRuntime
 ├─ adapters: native-shell (existing) · sandboxed-process · container (Docker/Podman, opt-in)
 ├─ BrowserProfile: one profile per mission (own logins, own cookies) — never shared across missions
 ├─ ActionGateway: ALL pc.* actions route through executeTool() → existing gate tiers → existing receipts
 └─ Handover: computer.help_requested → control_taken → control_released events on the ledger
```
New tools (all gated, all receipted — same `executeTool` path, same digests):
- `pc.exec` — run a command in the mission workspace (risk tier: **risky**, gate required; deny-list for `rm -rf /`, `sudo`, force-push — those are **critical**)
- `pc.browser.open` / `pc.browser.act` / `pc.browser.screenshot` — SSRF-guarded like `net.fetch`; login walls escalate to handover
- `pc.file.*` — maps onto existing `fs.*` (no new surface)

### BYOA convergence
OpenBot's "any AG-UI endpoint is a Bot" = our BYOA, formalized:
- Add **AG-UI protocol adapter** to BYOA (`byoa.ts`): external AG-UI agents register under the existing trust intersection (TLS-by-default, rate ceiling, injection-scanned replies, delegation receipts).
- Identity digest + delegation receipt unchanged — an AG-UI agent is still a BYOA citizen, not a special class.

### Probe pins (before merge)
- `pc.exec` without a gate → `gated-out`, never executed
- deny-listed command → refused even with an approving gate config (governance plane wins)
- handover events present in the ledger; agent actions refused while human drives
- container adapter absent → clean fallback, receipts identical in shape
- AG-UI BYOA: SSRF refused · plain-http refused · injection flagged · delegation receipted (mirrors the 19.4.5 battery)

---

## Part B — The Generalist Avatar (adapted from OneWorks Avatar, MIT)

### Why it fits
OneWorks Avatar is a **procedural geometric SVG avatar engine** — no network, no heavy 3D runtime, exports SVG/PNG/GIF, already ships an agent-skill integration. It gives the Generalist a *face* without breaking local-first or the 5-color discipline.

### Design rules (non-negotiable)
1. **Reskinned to the VH light system.** Geometry in Gunmetal `#2D3142` / Brooklyn `#586A66` / Simple Plum `#827278` on Platinum `#D8D5DB`. No neon, no "AI gimmick colors" — the avatar looks carved, not cartoonish.
2. **Apple-level minimal.** One avatar, subtle motion. It lives in the chatbox header and the gate sheet — never in front of the work.
3. **Respects `prefers-reduced-motion`.** Static seal mark when motion is reduced.

### Engine-state mapping (the avatar is honest — it shows engine state, never decorates it)
| Engine state | Avatar behavior |
|---|---|
| Idle | Resting geometric seal, slow breath |
| Routing / specialist selection | Facets rotate, seeking |
| Tool loop executing | Steady work pulse, tool glyph beside it |
| **Gate awaiting approval** | Avatar turns to the user, holds the action seal — the ask is visual, not buried in text |
| Receipt sealed | Seal stamps — same stamp as the receipt digest UI |
| Refusal / gated-out | Avatar steps back; refusal receipt shown plainly |
| Canary rollback | Facets revert animation (visualizes REVERT exactly) |

### Implementation phases
1. **19.5.0 — The Face**: procedural SVG avatar component (`src/vh19/avatar.tsx` + geometry set), 6 states above, 5-color reskin, reduced-motion mode. Probe pins: state mapping, color tokens, motion preference.
2. **19.5.1 — Gated shell**: `pc.exec` + deny-list + gate tiers + receipts (Part A, no container yet).
3. **19.6.0 — The Computer**: container adapter + browser profiles + handover + AG-UI BYOA adapter.

### License & honesty
- Both sources are **MIT** — adaptation is permitted; ship a `NOTICE` entry crediting CopilotKit/OpenBot and OneWorks Avatar.
- No CopilotKit branding anywhere in VH. We never claim to be a fork; the deck language is "adapted and hardened."
- OpenBot's audit claims stay theirs; our receipts remain our own, stronger, artifact — the comparison table says so with citations.

---

## Sequencing guard
1. **Finish first**: VH-Bench live results → pre-seed deck v3 → CV/Q&A/data-room. (Current round.)
2. Reviewer sees this plan + the benchmark table before any 19.5 code.
3. `TOOLS.length === 5` pins and door-probe counts will change deliberately — every pin gets updated in the same commit that adds a tool, never silently.
4. The frozen 19.4.5 zip is never rebuilt; 19.5 ships as its own artifact with its own verification record.

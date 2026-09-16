# Vouch Harbor 19.4.3 "Broader" — release verification record

Every number below was produced by running the named command in **this archive**,
on node v20.20.2, Linux x64. Re-run them yourself; do not take this file's word
for it. On a machine WITHOUT node_modules and without network,
`sh VERIFY.sh` runs the one truly zero-dependency gate: the bundled
offline pack (the runner reports its own suite count). The protocol selftest needs `cd protocol && npm install`.

## The 19.4.3 record — RSIRALS v5.0 ships proprietary + credential hygiene

19.4.3 ships RSIRALS v5.0 (Trust-Rooted Recursive Self-Improvement) as a proprietary Vouch Harbor product: three planes with a frozen, write-path-free governance plane; the nine-stage lifecycle with canary auto-rollback and an evolution archive; a control-plane firewall; counterfactual attribution with honest θ-arm (weight training stays out-of-band; accept/reject pairs export for DPO); and end-to-end evidentiary promotion — settlement numbers are read from exam receipts, never supplied. The 19.4.2 reviewer's P0 is fixed: the populated `.env.local` no longer ships (removed; `.env.example` placeholders only; packaging excludes `.env.*`; the exposed key must be rotated with the provider). Gates: tsc 0 · door probe 58/58 · fleet 120/120 · offline 119/119.

## The 19.4.2 record — the matured RSI framework, the BYOA trust intersection, a self-proving count

19.4.2 closes the 19.4.1 review's remaining items, built on a survey of
the 2026 RSI landscape (see `docs/RSI-FRAMEWORK.md`). The RSI curriculum
now covers the FULL declared evidence hierarchy — user rejection, gate
denials, execution failures, live-data unverified events, handoff
refusals — wired live from the door, nothing invented. Applied playbooks
enter a promotion ladder as `measuring` and can only be settled by a
MEASURED comparison (candidate beats baseline); losing measurements
retire them and revert the frozen memory exactly — the same discipline
as the mission self-improve loop. BYOA now enforces the trust
intersection (endpoint policy ∩ ceiling ∩ non-authoritative declared
capabilities ∩ identity), checked at registration and at delegation.
The specialist count proves itself: `catalogStats().byProvenance` is
computed from the arrays (460 seed + 160 broader = 620 registered
specialists, both batches fully routable), rendered live in the door,
and pinned by the probe. Gates: tsc 0 · door probe 48/48 · fleet
120/120 · offline 119/119.

## The 19.4.1 record — BYOA, RSI, unified egress

19.4.1 closes the pre-freeze review and adds two capabilities. **BYOA — bring
your own agent**: external agents register (endpoint kind, capabilities, risk
ceiling), join the Generalist through the existing peer seam, and every
delegation pauses at the human gate and lands in the handoff ledger — the
multi-agent story, under governance instead of in a walled garden. **RSI —
recursive self-improvement, the bounded kind**: a deterministic curriculum over
the agent's own evidence ledger, an actor that drafts frozen SKILL playbooks
(one receipted provider call when wired, the raw correction otherwise), a
verifier hierarchy where human approval and the autonomy exam outrank
everything and intrinsic self-assessment is never a verifier, and a floor the
loop can never touch. Fixes landed: evidence retrieval now rides the same
`checkEgressUrl` SSRF guard as tool egress (one network policy; refusals
receipted), the specialist count is stated as its composition (460 seed + 160
broader = 620, verifiable from `catalogStats`), and connector/skill copy says
exactly what it is (governed connector declarations; SKILL.md ecosystem
import). Protocol v0.10.7; suites 120/119.

| Gate | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | 0 errors |
| Protocol selftest | `node protocol/test/selftest.js` | 171/171 |
| Unit | `npm run unit` | 20/20 |
| Theme (five-color) | `node tools/run-one-probe.mjs theme` | 11/11 |
| Collab identity | `node tools/run-one-probe.mjs collabInvite` | 29/29 |
| Goals + session rules | `node tools/run-one-probe.mjs goals` | 26/26 |
| Skills | `node tools/run-one-probe.mjs skills` | 16/16 |
| Captains + multi-member + synthesis contract | `node tools/run-one-probe.mjs captains` | 38/38 |
| Specialist tools + member agent loops | `node tools/run-one-probe.mjs agentTools` | 47/47 |
| Captain synthesis | `node tools/run-one-probe.mjs synthesis` | 29/29 |
| Live-data GuardRail (incl. retrieval + unified egress) | `node tools/run-one-probe.mjs liveData` | 27/27 |
| The Shipyard | `node tools/run-one-probe.mjs shipyard` | 22/22 |
| Legacy isolation | `node tools/run-one-probe.mjs legacyCompat` | 3/3 |
| Self-evolution | `node tools/run-one-probe.mjs selfEvolve` | 18/18 |
| Mission self-evolution spine | `node tools/run-one-probe.mjs selfEvolveMission` | 52/52 |
| VH-19 engine | `node tools/run-one-probe.mjs vh19` | 81/81 |
| Team-Evolve | `node tools/run-one-probe.mjs teamEvolve` | 35/35 |
| VH-19 door (incl. BYOA, RSI, egress, full-curriculum, promotion-ladder and trust-intersection pins) | `probe/vh19Door.test.tsx` (via `npm test`) | 38/38 at 19.4.1; 48/48 at 19.4.2; **58/58 at 19.4.3** |
| Version identity | `node tools/run-one-probe.mjs versionDrift` | 41/41 |
| Doc identity | `node tools/run-one-probe.mjs docIdentity` | 6/6 |
| Offline pack | `node verify/run.mjs` | 119 passed, 0 failed |
| Bare-machine verify | `sh VERIFY.sh` | green |
| Live fleet | `npm test` | 120/120 suites green |

---

## The 19.3.0 "Vanguard" record (history) (specialists execute · Captains synthesize · the GuardRail retrieves)

19.3.0 answers the 19.2.0 review's three capability findings: specialists
are executors now (workspace-wired members run a real act/observe loop
over five gated, receipted tools), the Captain REASONS over its members'
real answers (deterministic divergence pass + its own synthesis call, its
own receipt), and the live-data GuardRail performs actual source
retrieval when an evidence fetch is wired — "verified" then means fetched,
and a disclosure stamp can never pose as a retrieval stamp. Built on
19.2.0's multi-member execution and runtime GuardRail. Protocol v0.10.7;
suites 120/119.

| Gate | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | 0 errors |
| Protocol selftest | `node protocol/test/selftest.js` | 171/171 |
| Unit | `npm run unit` | 20/20 |
| Theme (Horizon) | `node tools/run-one-probe.mjs theme` | 10/10 |
| Collab identity | `node tools/run-one-probe.mjs collabInvite` | 29/29 |
| Goals + session rules | `node tools/run-one-probe.mjs goals` | 26/26 |
| Skills | `node tools/run-one-probe.mjs skills` | 16/16 |
| Captains + multi-member + synthesis contract | `node tools/run-one-probe.mjs captains` | 38/38 |
| Specialist tools + member agent loops | `node tools/run-one-probe.mjs agentTools` | 47/47 |
| Captain synthesis | `node tools/run-one-probe.mjs synthesis` | 29/29 |
| Live-data GuardRail (incl. retrieval) | `node tools/run-one-probe.mjs liveData` | 27/27 |
| The Shipyard | `node tools/run-one-probe.mjs shipyard` | 22/22 |
| Legacy isolation | `node tools/run-one-probe.mjs legacyCompat` | 3/3 |
| Self-evolution | `node tools/run-one-probe.mjs selfEvolve` | 18/18 |
| Mission self-evolution spine | `node tools/run-one-probe.mjs selfEvolveMission` | 52/52 |
| VH-19 engine | `node tools/run-one-probe.mjs vh19` | 81/81 |
| Team-Evolve | `node tools/run-one-probe.mjs teamEvolve` | 35/35 |
| VH-19 door | `probe/vh19Door.test.tsx` (via `npm test`) | 28/28 |
| Version identity | `node tools/run-one-probe.mjs versionDrift` | 41/41 |
| Offline pack | `node verify/run.mjs` | 119 passed, 0 failed |
| Bare-machine verify | `sh VERIFY.sh` | green |
| Live fleet | `npm test` | 120/120 suites green |

---

---

# 19.2.0 "Armada" — release verification record (standing depth record)

True multi-member execution + runtime live-data GuardRail + honest naming.
All 19.2.0 gates were green at ship time: tsc 0 · protocol 171 · unit 20 ·
captains 37 · liveData 17 · shipyard 22 · skills 16 · goals 26 · vh19 81 ·
teamEvolve 35 · vh19Door 28 · versionDrift 41 · offline 117 · live 118 ·
VERIFY.sh green. Its disclosure-only GuardRail and report-only Captains
are superseded by 19.3.0's retrieval + synthesis (VH-19.3-UPGRADE.md).

---

# 19.1.0 "Shipyard" — release verification record (standing depth record)

The Shipyard team workspace, Captains (renamed AgentLeads, all-members
aggregation), token optimizer, prompt-level live-data guidance. All
19.1.0 gates were green at ship time: tsc 0 · protocol 171 · unit 20 ·
captains 27 · shipyard 22 · skills 16 · goals 26 · vh19 81 · vh19Door 28 ·
versionDrift 41 · offline 116 · live 117 · VERIFY.sh green. Its
prompt-level live-data "GuardRail" and single-call aggregation are
superseded by 19.2.0's runtime enforcement (VH-19.2-UPGRADE.md).

---

# 18.9.0 "Aurora" — release verification record (standing depth record)

Identity cleanse + skill layer + 300 specialists. All 18.9.0 gates were
green at ship time: tsc 0 · protocol 171 · unit 20 · skills 16 · goals 26 ·
collabInvite 29 · vh19 81 · vh19Door 28 · versionDrift 41 · offline 113 ·
live 114 · VERIFY.sh green. See VH-18.9-UPGRADE.md; the legacy-identifier
absolutes in its notes are superseded by 19.2.0's docs/LEGACY-COMPAT.md
registry.

---

# 18.8.0 "Atlas" — release verification record (standing depth record)

Catalog 147 → 252 + regenerated web build. All 18.8.0 gates were green at
ship time: tsc 0 · protocol 171 · unit 20 · theme 10 · collabInvite 29 ·
goals 26 · selfEvolve 18 · selfEvolveMission 52 · teamEvolve 35 · vh19 81 ·
vh19Door 28 · versionDrift 41 · offline 112 · live 113 · VERIFY.sh green.
See VH-18.8-UPGRADE.md for the full record. (Superseded identity-wise by
18.9.0: the 18.8.0 archive still carried predecessor-product strings.)

---

# 18.7.0 "Keystone" — release verification record (standing depth record)

Goal truthfulness (DONE/PARTIAL/PLANNED/BLOCKED) + A2A handoff ledger +
release-contract fixes + parallel offline verifier. All 18.7.0 gates were
green at ship time: tsc 0 · protocol 171 · unit 20 · theme 10 · collabInvite
29 · goals 26 · selfEvolve 18 · selfEvolveMission 52 · teamEvolve 35 ·
vh19 81 · vh19Door 28 · versionDrift 41 · offline 112 · live 113 ·
VERIFY.sh green. See VH-18.7-UPGRADE.md for the full record.

---

# 18.6.0 "Polaris" — release verification record (standing depth record)

Ledger identity + motion grammar + clean tree. All 18.6.0 gates were green
at ship time: tsc 0 · protocol 171 · unit 20 · theme 10 · collabInvite 29 ·
goals 19 · selfEvolve 18 · selfEvolveMission 52 · teamEvolve 35 · vh19 79 ·
vh19Door 28 · versionDrift 41 · offline 112 · live 113 · VERIFY.sh green.
See VH-18.6-UPGRADE.md for the full record.

---

# 18.5.0 "Apex" — release verification record (standing depth record)

Goal mode (Assignments) + session Auto-Review gate rules + Gemini stable-v1
default. All 18.5.0 gates were green at ship time: tsc 0 · protocol 171 ·
unit 20 · theme 10 · collabInvite 29 · goals 19 · selfEvolve 18 ·
selfEvolveMission 52 · teamEvolve 35 · vh19 79 · vh19Door 28 · offline 112 ·
live 113 · VERIFY.sh green. See VH-18.5-UPGRADE.md for the full record.

---

# 18.4.0 "Zenith" — release verification record (standing depth record)

## The 18.4.0 record (identity self-proof + structural A2A binding + bench depth)

18.4.0 closes the review's last two cryptographic nits (identity record
self-proof, structural card-verified binding), makes verification
reproducible on a bare machine (`sh VERIFY.sh`), and deepens the bench to
147 real specialists.

| Gate | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | 0 errors |
| Protocol selftest | `node protocol/test/selftest.js` | 171/171 |
| Unit | `npm run unit` | 20/20 |
| Theme (Horizon) | `node tools/run-one-probe.mjs theme` | 10/10 |
| Collab identity (self-proof + structural) | `node tools/run-one-probe.mjs collabInvite` | 29/29 |
| Self-evolution | `node tools/run-one-probe.mjs selfEvolve` | 18/18 |
| Mission self-evolution spine | `node tools/run-one-probe.mjs selfEvolveMission` | 52/52 |
| VH-19 engine | `node tools/run-one-probe.mjs vh19` | 81/81 |
| Team-Evolve | `node tools/run-one-probe.mjs teamEvolve` | 35/35 |
| VH-19 door | `probe/vh19Door.test.tsx` (via `npm test`) | 26/26 |
| Version identity | `node tools/run-one-probe.mjs versionDrift` | 41/41 |
| Offline pack | `node verify/run.mjs` | 111 passed, 0 failed |
| Bare-machine verify | `sh VERIFY.sh` | green |
| Live fleet | `npm test` | 112/112 suites green |

---

# 18.3.0 "Meridian" — release verification record (standing hardening record)

## The 18.3.0 record (hardening + motion + new mark + split bundle)

18.3.0 closes the external review's two cryptographic findings (bound-key
approval verification, passphrase-sealed keys), ships the Horizon motion
system, a new icon, route-level code splitting and a browser CSP.

| Gate | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | 0 errors |
| Protocol selftest | `node protocol/test/selftest.js` | 171/171 |
| Unit | `npm run unit` | 20/20 |
| Theme (Horizon) | `node tools/run-one-probe.mjs theme` | 10/10 |
| Collab identity (hardened) | `node tools/run-one-probe.mjs collabInvite` | 23/23 |
| Self-evolution | `node tools/run-one-probe.mjs selfEvolve` | 18/18 |
| Mission self-evolution spine | `node tools/run-one-probe.mjs selfEvolveMission` | 52/52 |
| VH-19 engine | `node tools/run-one-probe.mjs vh19` | 81/81 |
| Team-Evolve | `node tools/run-one-probe.mjs teamEvolve` | 35/35 |
| VH-19 door | `probe/vh19Door.test.tsx` (via `npm test`) | 26/26 |
| Version identity | `node tools/run-one-probe.mjs versionDrift` | 41/41 |
| Offline pack | `node verify/run.mjs` | 111 passed, 0 failed |
| Bundle split | `npm run build` | 9 chunks, main 528 kB |
| Live fleet | `npm test` | 112/112 suites green |

---

# 18.2.0 "Horizon" — release verification record (standing Horizon record)

## The 18.2.0 record (Horizon UI + signed invitations + bounded self-evolution)

18.2.0 ships the premium minimal UI (Horizon tokens, new icon, real Settings
page), the signed collaboration invitation lifecycle the external reviews
named the biggest gap (`probe/collabInvite`, 14 checks), bounded recursive
self-evolution with an unbreakable floor (`probe/selfEvolve`, 18 checks), and
automatic team self-proposal after connection (`probe/teamEvolve`, 35 checks).

| Gate | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | 0 errors |
| Protocol selftest | `node protocol/test/selftest.js` | 171/171 |
| Unit | `npm run unit` | 20/20 |
| Theme (Horizon) | `node tools/run-one-probe.mjs theme` | 10/10 |
| Collab invitations | `node tools/run-one-probe.mjs collabInvite` | 14/14 |
| Self-evolution | `node tools/run-one-probe.mjs selfEvolve` | 18/18 |
| Mission self-evolution spine | `node tools/run-one-probe.mjs selfEvolveMission` | 52/52 |
| VH-19 engine | `node tools/run-one-probe.mjs vh19` | 81/81 |
| Team-Evolve | `node tools/run-one-probe.mjs teamEvolve` | 35/35 |
| VH-19 door | `probe/vh19Door.test.tsx` (via `npm test`) | 26/26 |
| Version identity | `node tools/run-one-probe.mjs versionDrift` | 41/41 |
| Offline pack | `node verify/run.mjs` | 111 passed, 0 failed |
| Live fleet | `npm test` | 112/112 suites green |

---

# 18.1.0 "TeamEvolve" — release verification record (standing Team-Evolve record)

## The 18.1.0 record (cross-user Team-Evolve + category-scoped autonomy)

18.1.0 ships the differentiator the external reviews named as missing: the
team itself learns across users, with every member's explicit consent
structural (`probe/teamEvolve`, 31 checks), autonomy scoped per category, and
the bench grown to 102 real specialists. The stale five-docks comment class
from the 18.0.1 review is fixed and pinned.

| Gate | Command | Result |
|---|---|---|
| TypeScript | `tsc --noEmit` | 0 errors |
| Protocol selftest | `node protocol/test/selftest.js` | 171/171 |
| Unit | `npm run unit` | 20/20 |
| VH-19 engine | `node tools/run-one-probe.mjs vh19` | 81/81 |
| Team-Evolve | `node tools/run-one-probe.mjs teamEvolve` | 31/31 |
| VH-19 door | `probe/vh19Door.test.tsx` (via `npm test`) | 22/22 |
| Version identity | `node tools/run-one-probe.mjs versionDrift` | 41/41 |
| Live fleet | `npm test` | see the run record below |

The protocol is unchanged at v0.10.7, so the 17.10.7 record below remains the
standing verification for the protocol and A2A surfaces.

---

# 18.0.1 "Generalist" — release verification record (standing front-door record)

The VH-19 front-door wiring (18.0.1) was verified at: tsc 0, protocol 171/171,
unit 20/20, vh19 73/73, vh19Door 18/18, versionDrift 41/41, full live fleet
109/109 on node v20.20.2, Linux x64, 2026-09-14.

---

# 17.10.7 "WarrantTeams" — release verification record (standing protocol/A2A record)

Produced on node v20.20.2, Linux x64, 2026-09-13.

## What this release is

17.10.5 shipped WarrantTeams on the 17.10.4 Warrant core, so it carried protocol
RULES 3–5 but not **RULE 6** — and its own attacker-grade campaign reported the two
resulting bounds as `FINDING A` / `FINDING B` instead of scoring them.

**17.10.7 back-ports RULE 6.** `protocol/` is self-contained (no app module imports
it), so the port is a bounded protocol-only diff and `protocol/` is now
byte-identical to the Warrant trunk:

- **Rotation must prove possession of the incoming key** — a second signature over
  `VH-ROTATE-POP-v1 | oldFp | newFp | ts`, bound to the caller's fingerprint.
  Missing `pop`, a wrong key or a mismatched `oldFp` fail closed as
  `invalid-rotation-proof`. Closes offline-fingerprint squatting.
- **Authority is withdrawn by authority** — a revocation against a DESIGNATED
  identity is honoured only from an authorised writer, refused at submission
  (`policy:revocation-requires-authority`, metrics `revocationRejected` /
  `rotationRejected`) and ignored at consumption, so records already in a ledger
  are inert. Closes the designated-authority denial of service.

Full notes: `VH-17.10-UPGRADE.md` §9–§10 and the `17.10.7` row in `CHANGELOG.md`.

## The gates

| Gate | Command | Result |
|---|---|---|
| Live probe suites | `npm ci && npm test` | **107 passed, 0 failed** |
| Offline pack | `node verify/run.mjs` | **106 passed, 0 failed** |
| Protocol self-test | `cd protocol && npm ci && npm test` | **ALL 171 UNIFIED-SENTINEL CHECKS PASSED** |
| Typecheck | `npx tsc --noEmit` | exit 0, no diagnostics |
| Production build | `npx vite build` | 478.33 kB main chunk (147.10 kB gzip), 2.77 s |
| Bridge gate | `node protocol/bridge/bridge-selftest.mjs` | **17/17** (zero-install) |
| Unit runner | `npm run unit` | **20 passed, 0 failed** |
| Version drift | `npm test` → `versionDrift` | **41 passed, 0 failed** |
| A2A runtime mount | `npm test` → `a2aRuntime` | **48 passed, 0 failed** — two independent VH processes |
| A2A host engine pin | `npm test` → `a2aRuntime` §2 | byte-identical rebuild + tampered engine fails closed |
| Benchmark | `node benchmark/run.mjs` | **6 passed, 0 failed** — B3 reports "171 checks" |
| Drill | `node tools/drill-benchmark.mjs` | guard passed · maths passed · **impossible FAILED (correct)** · digest `6a08e448e79255fe1e32ffe998eec7b8788d63ef59625b6b24f72c043c304f24` |

## The attack battery

Start a harbor first:

```bash
cd protocol && npm ci
PORT=3200 VH_DATA_DIR=/tmp/vh-verify node src/server/harbor.js
```

It boots `"version":"0.10.7"`. Then, from the archive root:

| Harness | Expected | Measured |
|---|---|---|
| `node protocol/wcarena/exploit-self-attestation.mjs` | every leg refused | **refused** — `policy:grantor-holds-nothing` |
| `node protocol/wcarena/adversarial-campaign.mjs` | 14/14, control intact | **14/14**, control YES |
| `node protocol/wcarena/v104-authority-matrix.mjs` | 10/10 | **10/10** |
| `node protocol/wcarena/governance-attacks.mjs` | 0 of 4 false-accepts | **0 of 4**, legitimate path true |
| `node protocol/wcarena/warrant-compromise-campaign.mjs` | 22/22 + 4 posture notes | **22/22**, 4 posture notes, **0 findings** |

The harbor's audit log records the blocked attack:

```
member.join    name=attacker_market_data_feed
vouch.rejected reason=grantor-holds-nothing  action=write:purchase_orders  held=["read:public"]
vouch.rejected reason=grantor-holds-nothing  action=*                     held=["read:public"]
```

## The A2A LiveBridge (added after external review of the first 17.10.7 package)

An external review scored the first 17.10.7 package 9.6/10 and made one
substantive finding that was **correct**: cross-harbor delegation had the whole
ladder real — strict A2A v1.0 discovery, JWS card verification, sender routing,
GuardRail, both human gates, tamper-evident digests, replay guards — and then
ended in a template literal.

```ts
const artifact = `${toTeammate.name} completed: "${task}" — executed under … governance.`
```

A claim of execution with no execution behind it, in the one product whose premise
is that a claim without evidence is not a claim. `probe/harborTeams` and
`probe/a2aV10` could not see it: they pinned the ladder, and the ladder was
genuinely real. Only the last step lied.

`src/mission/a2aBridge.ts` replaces it. The chain is now:

```
A2A → Warrant → GuardRail → receiver gate → REAL TeamExecutor
    → real git / CLI result → vh-proof-receipt/2
```

- The verdict is the **repository's own test command**, not the seat's and not ours.
- The bridge runs a **writer plus a read-only reviewer on a different harness**,
  because a single seat tiers `self-verification` and the adversarial gate BLOCKS
  it. The first draft tried one seat; the product's own gate correctly refused it.
- `DelegationRecord` gains `execution` (harness, run status, seats run/verified,
  measured USD, wall clock, `notRun` reasons) and `receipt`. Both are null
  whenever nothing ran.
- **No fallback.** No deps, no harness, no `repoRoot`, or a missing binary →
  refused in words with `artifact: null`. A run whose verification did not pass is
  `executed-failed`, never `completed`. Demos must ask explicitly
  (`allowUnexecuted`) and get a record whose note reads `NOT EXECUTED`.

`probe/a2aBridge` (34 checks) pins it on a real git repo with a real CLI boundary,
including the anti-cheat (a repo whose tests fail never reports a completion) and a
**regression pin** so no path can fabricate a completion string again.

### One correction to the review, in the interest of accuracy

The review asked to "restore the 17.10.6 LiveBridge". **There is no 17.10.6.**
Checked at the time of writing:

- GitHub releases: newest is `v17.10.5` (25 releases total) — no 17.10.6
- GitHub tags: 25 tags, none matching 17.10.6
- Branches: `main` only
- No `a2aBridge.ts` and no `LiveBridge` string in any tree in this workspace,
  including both 17.10.5 release ZIPs

So this bridge was **written, not restored** — built to the architecture the review
specified. If a 17.10.6 LiveBridge exists on a machine that never pushed, its
implementation should be diffed against this one and the better parts kept; the
regression pin in `probe/a2aBridge` will catch any attempt to drop it again.

The review's other findings were all confirmed and fixed: `docs/INTEROP.md` and
`docs/INFORMATION-ARCHITECTURE.md` titles read 17.10.5, `README.md` described the
protocol as "v0.10.2 … 122/122", and `protocol/package.json`'s description said
v0.10.4 while the code declared 0.10.7. None of those were in `versionDrift`'s
enforced set, which is exactly why they survived — the reviewer's proposed release
gate is the right fix, and `probe/a2aBridge` §6 is the first piece of it.

## The A2A runtime mount (rev 3, after the second external review)

The second review scored the LiveBridge 9.9 and then found the thing that
mattered more: the bridge was implemented and probed but **never mounted by the
application**. Its grep was correct — at that point `createA2AServer` appeared in
`src/` once (its own definition) and in comments; the only callers were probe
suites. A harness proves the architecture works when a test wires it. It does not
prove the shipped product exposes it.

Fixed by adding the missing layer, not by re-labelling the old one:

| Piece | What it is |
|---|---|
| `src/mission/a2aRuntime.ts` | `startA2ARuntime()` — the ONE bootstrap: identity → team → signed v1.0 card → delegation handler → receiver risk policy → LiveBridge → listen. Plus `nodeRunnerDeps()` (real process spawning, real git, the repo's own test as the verdict) and `drillBridgeConfig()` (the labelled deterministic seat). |
| `tools/vh-host.entry.ts` → `tools/vh-host-engine.mjs` | the host process, bundled and byte-pinned (`.sha256`) the same way the MCP engine is. |
| `tools/vh-host.mjs` (`npm run host`) | the launcher. Verifies the pin on every start; a doctored engine exits 2 instead of listening. |
| `probe/a2aRuntime.test.ts` | **48 checks**, including the launch-time end-to-end the review asked for. |
| `src/mission/a2aServer.ts` | now accepts a bind port (the signed card advertises an interface URL, so the listener has to be on it) and reports its real host in `baseUrl`. |
| `src/mission/harborTeams.ts` | `receiverRiskVerdict()` — the receiver re-classifies an inbound task with its own §10 table and takes the worse of that and the sender's claim. A sender's `"safe"` is a claim, not a clearance. Every settled record carries the verdict as `receiverPolicy`. |

What `probe/a2aRuntime` actually runs:

1. **§1** a runtime mounts: the signed card is served over real HTTP, passes the
   strict v1.0.0 validator, its JWS verifies against the harbor's own key, and a
   request without the bearer token never reaches a task.
2. **§2** the shipped launcher runs the shipped engine: `tools/vh-host-engine.mjs`
   is byte-identical to a rebuild of `tools/vh-host.entry.ts` and matches its
   committed sha256; a one-byte-flipped copy makes the launcher exit 2.
3. **§3** **two independently running VH processes.** The receiver mounts and
   publishes its JWK; a stranger discovers the card over HTTP and verifies its
   signature; the sender process delegates; the receiver process runs a real
   TeamExecutor mission (2 seats, cross-vendor gate PASS, real worktree, the
   repo's own test as the verdict) and returns a sealed `vh-proof-receipt/2`
   that verifies in the sender's process **and in a third process**
   (`tools/verify-receipt.mjs`, exit 0 with the issuer key pinned out of band,
   exit 3 — integrity valid, issuer UNVERIFIED — without it).
4. **§4** a mounted harbor with no bridge refuses in words: no artifact, no
   execution, no receipt, and the note names the missing capability.
5. **§5** anti-cheat across the wire: a repository whose tests fail comes back
   `refused` with the measured execution attached, never as a completion.
6. **§6** the receiver's own risk table overrules a sender: `git push --force …
   to production` declared `"safe"` is classified CRITICAL, upgraded to risky and
   **denied at a headless gate** — nothing executes — while genuinely read-only
   work stays safe. A sender that declares `"risky"` is never talked down.

Honesty notes for this section:

- **The drill seat is not a model.** §3/§5 run with `--seat-mode drill` because no
  agent CLI is installed on this build host: a real child process, a real
  worktree, a real git repo, the repository's own test as the verdict — and a
  deterministic brain. It is labelled in `describe()`, in the process log and in
  every artifact. The default `--seat-mode real` refuses instead of substituting.
- **A mounted harbor always enforces a bearer token.** Omit `--token` and one is
  minted and reported. The card advertises `harborIdentity`; a card that claims a
  scheme the listener does not enforce refuses everything, so "no auth" is not an
  option the mount offers.
- **The Warrant harbour process is not yet in the same boot.** `npm run host`
  mounts the A2A listener with the receiver ladder, the GuardRail and the
  receiver's own risk policy; it does not spawn
  `protocol/src/server/harbor.js` alongside it or consult that harbour's grant
  ledger before accepting a delegation. Authority on this door is: JWS-verified
  card identity + bearer token + receiver policy + human gate. Wiring the
  protocol harbour's grant check into the receiver gate is the next seam.

## What this archive does not prove

- **The Rust crate was not compiled.** `cargo check` / `cargo test` / `clippy` were
  not run for this record. `src-tauri/Cargo.lock` was updated by hand to keep the
  `vouchharbor` package version consistent with `Cargo.toml`; regenerate it with
  cargo on a host that has the toolchain.
- **No native build.** `npm run tauri:build` was not run.
- **The drill's seats are deterministic built-ins, not a model.** The suite's own
  `scope` string says so: it validates the runtime, governance and verification
  machinery — not frontier-model intelligence. No mission in this record was
  executed by a live model.
- **Still no native brain.** 23 of 25 harnesses are external CLIs; the in-process
  `hermes` seat routes to Ollama at `127.0.0.1:11434`.

## Reproducing

`node_modules/` and `protocol/node_modules/` are not shipped. Two installs:

```bash
npm ci                              # app toolchain
cd protocol && npm ci && cd ..      # protocol gate + attack harnesses
```

Then every command in the tables above runs unchanged. `dist/` is also not
shipped; regenerate it with `npx vite build`.

**One environment note, learned the hard way.** `probe/offlinePack` rebuilds all
106 bundles into a temp directory and byte-compares them against the shipped
pack. On a host where the temp filesystem is small, that rebuild fails with
`no space left on device` and the suite reports a false drift across every
bundle after the failure point. It is an environment failure, not a code
failure — but it looks like one. Give `$TMPDIR` at least ~700 MB free. With
space available the suite reports **17 passed, 0 failed**, including
*every shipped bundle is BYTE-IDENTICAL to a fresh rebuild (106 bundles)*.

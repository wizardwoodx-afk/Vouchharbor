# Vouch Harbor 19.5.4 [Alpha] "Bridge"

This archive contains **only the additive 19.5.4-alpha increment** — five new capability
modules, the +200 specialist batch, their probes, the UI components and the docs.

**It is designed to be dropped into your 19.5.4 repository.** Nothing here overwrites a
released file:

```
src/governance/       policyGate.ts, initiator.ts      →  copy in
src/bridge/           envelope.ts, trust.ts, bridge.ts →  copy in
src/memory/           channel.ts                       →  copy in
src/evidence/         pack.ts                          →  copy in
src/beacon/           beacon.ts                        →  copy in
catalog/              federationBatch.ts               →  copy in
ui/                   Beacon.tsx, BridgePanel.tsx, preview.html
probe/                four new suites                  →  register in tools/run-all-probes.mjs
docs/                 VERSION.ts, MANIFEST.json,       →  merge (do not overwrite if yours differ)
                      ALIGNMENT.md
FEATURES.md           →  replaces the feature sheet
CHANGELOG.md          →  prepend the 19.5.4-alpha section
tools/                run-all-probes.mjs               →  the one-command probe runner
tsconfig.alpha.json   →  verification config for this increment only
research/             the analysis this increment came from (not part of the build)
```

Scripts to add to your `package.json`:

```json
{
  "scripts": {
    "probes": "node tools/run-all-probes.mjs",
    "probes:json": "node tools/run-all-probes.mjs --json",
    "verify:alpha": "tsc -p tsconfig.alpha.json"
  }
}
```

**What was verified before this was packed** — so you are not the first person to find out:
the increment compiles under `strict` + `noUncheckedIndexedAccess` with **0 errors**; the
five suites report **332 checks, 0 failed**; and **10 of 10** deliberate breakages injected
into a copy of the tree were caught by those suites. Full detail in `FEATURES.md` §12 and
`docs/MANIFEST.json` → `verification`.

**Order of work, and the two hard precedences:**

1. Land the files. Run the four probes. Nothing is enabled yet.
2. `VH_POLICY_PLANE=on` — one call site before tool dispatch. Watch the audit trail.
3. `VH_BEACON=on` — UI only; it cannot change what the engine does.
4. `VH_MEMORY_CHANNEL=on` — shadow first: write to both, read from the old path.
5. `VH_EVIDENCE_PACK=on` — read-only over what already exists.
6. `VH_BRIDGE=on` — **only after** the policy plane and attribution are live and reviewed.

Never enable the bridge before the policy plane: the crossing must be refusable before it
is possible.

**Not legal advice.** Confirm the upstream LICENSE at the exact commit you rely on and keep
a copy. See `docs/MANIFEST.json` → `thirdParty`.

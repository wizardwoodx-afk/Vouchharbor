# Vouch Harbor 19.5.6 [Alpha] "Bridge"

An **increment on top of 19.5.6 "Reach"** — not a replacement build, not a new branch.
It adds five capabilities and 200 registered specialists, changes nothing in the released
engine, and every addition is behind a flag that is off until you turn it on. Turn them
all off and you have exactly 19.5.6 "Reach".

**What this archive is:** the increment only. Your engine, your 1,150 established
specialists, your `verify/**` bundles and your Tauri shell are not in here — none of them
were touched and none of them were copied.

**To package the whole app as a release archive**, run the packer that ships with this
increment, from your repo root:

```bash
node tools/pack-release.mjs --name "Vouch Harbor 19.5.6 [Alpha]"
```

It runs the probe gate first and refuses to pack a failing tree, walks the repo with an
exclusion policy (`node_modules`, `target/`, `dist/`, `.git`, `.env`, keys, logs,
databases), writes the ZIP itself with zero dependencies, prints what went in, and reads
the archive back before claiming success. `--list` shows what would be packed.

---

## Verify it before you install it

The numbers in these notes are yours to reproduce, not ours to assert. The archive ships
compiled probe twins, so this works with **plain Node** — no TypeScript loader, no
`node_modules`, no network:

```bash
node dist-verify/tools/run-all-probes.mjs
#  → 372 checks passed, 0 failed, 0 suites not green
```

That sentence is the whole reason the twins exist. The first cut of this archive shipped
TypeScript probes and a runner that imported them natively: extracted anywhere else, it
discovered six suites and loaded none, so "332 checks, 0 failed" was the author's result
rather than the reader's. A verification claim you cannot reproduce is not evidence.

If you edit a probe, rebuild the twins: `node tools/compile-probe-twins.mjs`
(`--tsc /path/to/tsc` or `VH_TSC` if the compiler lives somewhere unusual).

---

## What goes where

```
src/governance/       policyGate.ts, initiator.ts              →  copy in
src/bridge/           envelope.ts, keys.ts, approval.ts,
                      ledger.ts, trust.ts, bridge.ts           →  copy in
src/memory/           channel.ts                               →  copy in
src/evidence/         pack.ts, sha256.ts                       →  copy in
src/beacon/           beacon.ts                                →  copy in
catalog/              federationBatch.ts                       →  copy in
ui/                   Beacon.tsx, BridgePanel.tsx, preview.html
probe/                six suites                               →  register in tools/run-all-probes.mjs
dist-verify/          compiled probe twins (verify with plain node)
docs/                 VERSION.ts, MANIFEST.json, ALIGNMENT.md  →  merge (do not overwrite if yours differ)
tools/                run-all-probes.mjs, compile-probe-twins.mjs,
                      generate-federation-batch.mjs, pack-release.mjs
FEATURES.md           →  replaces the feature sheet
CHANGELOG.md          →  prepend the 19.5.6-alpha section
tsconfig.alpha.json   →  verification config for this increment only
research/             the analysis this increment came from (not part of the build)
```

Scripts to add to your `package.json`:

```json
{
  "scripts": {
    "probes": "node tools/run-all-probes.mjs",
    "probes:standalone": "node dist-verify/tools/run-all-probes.mjs",
    "probes:twins": "node tools/compile-probe-twins.mjs",
    "verify:alpha": "tsc -p tsconfig.alpha.json",
    "pack": "node tools/pack-release.mjs --name \"Vouch Harbor 19.5.6 [Alpha]\""
  }
}
```

---

## Order of work, and the three hard precedences

1. **Verify the pack.** `node dist-verify/tools/run-all-probes.mjs` → 372 green. If it does
   not run, nothing else matters.
2. Land the files. Nothing is enabled yet.
3. `VH_POLICY_PLANE=on` — one call site before tool dispatch. Watch the audit trail.
4. `VH_BEACON=on` — UI only; it cannot change what the engine does.
5. `VH_MEMORY_CHANNEL=on` — shadow first: write to both, read from the old path.
6. `VH_EVIDENCE_PACK=on` — read-only over what already exists.
7. `VH_BRIDGE=on` — **last, on purpose.**

**Never enable the bridge before the policy plane.** A crossing that cannot be refused
must not be possible; the bridge asks the gate, and if the gate is not running there is
nothing to ask.

**Never enable the bridge before attribution.** "Who started this crossing, and was anybody
watching" is the first question an investigation asks, and answering it after the fact is
not answering it.

Rolling back is one flag at a time, in reverse.

---

## Before the bridge crosses anything

- Generate a key pair per harbour (`createHarborKeys`) and exchange **public** keys only.
  Register them in a `KeyRegistry`. Private keys stay where they were made.
- Decide who may hold which `harbor#keyId`, and how a key is retired. This pack provides
  the primitives and the registry; **key custody is yours.**
- The first crossing of a pair will be refused until a person signs an approval bound to
  that envelope's nonce. That is intended.
- The bridge's trust ledger is **local-first on purpose**: each side keeps its own records
  and derives its own score. There is deliberately no shared trust registry, because a
  registry you must trust is a weaker claim than a receipt you can verify.

**Not legal advice.** Confirm the upstream `LICENSE` at the exact commit you rely on and
keep a copy. See `docs/MANIFEST.json` → `thirdParty`, and `docs/ALIGNMENT.md` §6.

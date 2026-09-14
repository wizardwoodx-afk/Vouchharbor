# Code-splitting roadmap (18.2.0)

External review (R2) flagged the 552 kB JS bundle. This is the honest state
and the deliberate plan — no silent rewrites.

## Why the bundle is what it is

The app is local-first: the VH-19 engine (registry of 102 specialists, router,
exam, team-evolve, self-evolution, collab crypto), the protocol layer, and the
shell all ship in one bundle so the desktop app works offline from first
launch. Everything in the bundle is reachable code — no dead weight was found
in the 18.2.0 audit (`probe/codeHygiene`).

## The plan (ordered by value/risk)

1. **Route-level splits first** — the six docks render independently today;
   `React.lazy` per dock (Harbor, Ship, Chart, Register, Harbor Master) moves
   ~everything except the VH-19 default view into on-demand chunks. Vite
   already emits them; the work is the Suspense boundaries + the shell's
   instant-paint splash staying synchronous.
2. **Engine stays in the main chunk.** The Generalist door is the product's
   front; lazy-loading the brain would trade a byte count for a worse first
   interaction. This is a decision, not an oversight.
3. **Vendor split** — react/react-dom into their own long-cached chunk
   (`manualChunks`). Cheap, zero risk, do it with step 1.
4. **Measure, then publish.** The release record must carry the per-chunk
   table before/after; a split that regresses first-interactive time is a
   failed split even if the headline number drops.

## What is NOT planned

- Splitting the specialist registry by category (routing needs the whole
  bench in memory; the registry is data, and it is small per entry).
- Moving any engine code behind a network boundary — local-first is
  non-negotiable.

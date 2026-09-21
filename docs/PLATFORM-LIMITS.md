# Velvet Hand — Platform limits

Known environment-specific limits, documented so they are never mistaken for
regressions.

## Web (browser) edition

Agent execution and git operations require a host OS; on a static web host those
surfaces run the app's labelled `local-test` double. Every event, artifact and UI surface
it produces carries `simulated: true`, and a mission that used it finishes
`BLOCKED`, never `COMPLETED`. Signing, receipts, the vault, the gate and the merge
logic are the same real code in both editions.

### Storage budget, and what happens when it runs out

The browser edition persists to the origin store, which is a small fixed budget
shared by every key the app owns. Three live stores used to answer a full budget
by swallowing the error: the graph's named checkpoints, the editor preferences and
the conversation-memory graph each kept an in-memory copy and said nothing, so the
data read back as gone after a reload with no explanation. They now write through a
declared ladder — each rung names what it gives up, the smallest acceptable payload
is tried last, and the chosen rung is recorded in a notice ledger that Settings can
show. When even the smallest payload does not fit, the write **refuses in words**
rather than pretending. Recall is unaffected by a degraded transcript: every
conversation keeps its date, title and keywords.

Memory is also bounded by hard caps on nodes, edges and sessions. Pruning is counted
and reported — `graphStats()` returns the running totals — so a shrinking memory is
something the product says out loud instead of something a user notices later.

A single-file or OS-backed store on disk remains the intended next seat for the
desktop build; the browser edition is bounded by the origin budget by design, not by
oversight, and now states the bound wherever it bites.

## Windows

Four probe suites are environment-specific on Windows and are treated as such in CI
rather than failures:

- Linux sandbox wrappers cannot run on Windows.
- Windows filename rules differ (the wrapper-permission probes assume POSIX).
- Smoke tests need a real coding CLI binary on PATH.

All other suites pass identically; see `docs/history/VH-11.8.1-WINDOWS-CI.md` (archived engine record) for
the recorded run.

## This development environment

The release gates (tsc, probes, offline pack, vite build) run on Node 22 in this
environment; the Rust/Tauri shell compiles in CI and on any machine with a Rust
toolchain (`cargo check --all-targets`), not here.

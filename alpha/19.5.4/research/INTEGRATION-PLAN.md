# Safe Integration Plan — making an existing AI agentic app enterprise-mature without touching its core

**Assumption set (from your answers):** TypeScript, your own agentic logic, *everything* in it is currently "core," target customers are **enterprises**, and the goal is to be **not another ChatGPT** — closer to how Claude feels, but for your domain.

**The one-line strategy:**

> You don't add features to your core. You **clip mature OSS onto the seams your core already exposes**, one wire at a time, each behind a flag, each revertible by config.

---

## 1. What "maturity" actually means to an enterprise buyer

They are not buying intelligence. They are buying **evidence and control**. Six things get asked in every serious evaluation:

| Enterprise ask | What it really means | Which seam answers it |
|---|---|---|
| "Show me the run that failed" | Step-level traces with inputs/outputs/tokens/cost | **Tracing** |
| "It must not lose work" | Multi-hour tasks survive crashes, restarts, deploys | **Durable execution** |
| "It must not do something dumb/dangerous" | Sandboxed execution + policy gate + approval | **Tool exec + Governance** |
| "Prove it didn't get worse" | Eval suite wired into CI | **Quality gate** |
| "Our data, our tenancy" | Self-hostable, per-tenant isolation, audit log | **Everywhere** |
| "It should get better over time" | Real memory, not a bigger context window | **Memory** |

None of those require rewriting your agent loop. All six are additive at the edges. That is the whole point of the seam approach.

---

## 2. Differentiation: why you're not "another ChatGPT"

Three things make Claude feel different from ChatGPT, and every one of them is an **edge capability**, not a core-logic capability:

1. **Artifacts / real work output** — it produces files, notebooks, working code, documents. → this is a **sandbox** integration (E2B). Your core decides *what* to do; the sandbox makes the output *real*.
2. **Long-running, steerable, resumable tasks** — it works for a long time, you can interrupt and redirect it mid-flight, and nothing is lost. → this is a **durable execution** integration (Restate/Temporal/DBOS). Your loop stays your loop; the runtime journals each step.
3. **Continuity** — it remembers *you* across sessions and projects. → this is a **memory** integration behind your existing context-assembly function.

For an enterprise product, add a fourth differentiator that consumer apps don't have and enterprises desperately want: **an agent that asks permission and shows its work**. Policy gate + audit trail + human-approval checkpoints. That is a moat, and it's all seam-level work.

**Strategic rule:** your differentiation lives in *your* orchestrator's reasoning, planning and domain tools. Every OSS you add must be **replaceable plumbing** — if it becomes your differentiator, you've lost.

---

## 3. The wire map

Legend: 🟢 = clip at the edge, zero core change · 🟡 = needs one adapter/injection point · 🔴 = this IS your core; wrap, never rewrite.

### 🟢 LLM egress — the single best first win
Every model call in your app goes through one choke point. If your base URL is configurable, you already have the seam.

- **Clip on:** **LiteLLM Proxy** (MIT) — OpenAI-compatible gateway: provider fallbacks, retries, budget caps per key/tenant, semantic caching, spend dashboards. Alternative: **Portkey Gateway** (Apache-2.0 core), **Helicone** (Apache-2.0).
- **Core change:** point `baseURL` at the proxy. Nothing else.
- **Instantly unlocks:** "cap spend per customer," "auto-failover if OpenAI is down," "swap model in prod without a deploy." All three are enterprise requirements you get for free.

### 🟢 Tracing — highest ROI, zero runtime risk
- **Clip on:** **Langfuse** (MIT core; self-host free, commercial use allowed) or **Arize Phoenix** (Elastic License 2.0 — fine to run yourself, but you may not resell it as a hosted service) or plain **OpenTelemetry GenAI semconv**. OpenLLMetry is Apache-2.0 if you want to stay vendor-neutral.
- **Core change:** an exporter at the process boundary, fire-and-forget. Traces can't change your behavior.
- **Unlocks:** failure forensics, per-tenant cost attribution, and — critically — the raw material for evals (section 4).

### 🟢 Quality gate — offline, in CI, never in the hot path
- **Clip on:** **promptfoo** (MIT) for YAML-driven regression + red-teaming, **DeepEval** (Apache-2.0) for agent metrics like task completion and tool correctness, **Ragas** (Apache-2.0) if RAG quality matters.
- **Core change:** none. It consumes exported traces.
- **Unlocks:** the sentence enterprise buyers need: *"every prompt/model change is regression-tested against 200 real tasks before release."*

### 🟡 Governance / policy — the enterprise moat
- **Clip on:** **OPA** (Apache-2.0) or **Cerbos** (Apache-2.0) or **Cedar** (Apache-2.0) as a sidecar.
- **Core change:** ONE call — `await policy.check({ tenant, user, tool, args })` — immediately before tool dispatch. If it returns deny, you return a denial message. That's it; your dispatch logic is otherwise untouched.
- **Unlocks:** RBAC, "the agent asked before deleting anything," immutable audit trail, multi-tenant safety. This is what closes enterprise deals.

### 🟡 Tool execution / sandbox
- **Clip on:** **E2B** (Apache-2.0, self-host via Terraform available) or **Daytona / microsandbox** (Apache-2.0).
- **Core change:** wrap each tool *handler function*. Your tool *definitions* (names, schemas, descriptions) stay byte-identical, so the model's behavior doesn't change.
- **Unlocks:** safe execution of model-generated code, real file/data artifacts, and a hard answer to "what stops it from running `rm -rf`?"

### 🟡 Memory / retrieval
- **Clip on:** **Mem0** (Apache-2.0) for long-term user memory, **Zep/Graphiti** (Apache-2.0) for temporal "what changed when," **Qdrant** or **pgvector** (Postgres) as the store, **Docling/unstructured** (MIT/Apache-2.0) for enterprise document ingestion.
- **Core change:** new implementation class **behind your existing context-assembly interface**. Callers keep calling the same function.
- **Unlocks:** cross-session continuity, less context bloat, better grounding. This is the "Claude remembers you" feeling.

### 🟡 Durable execution — the biggest maturity jump
- **Clip on:** **Restate** (single binary; **server is BSL — self-host is free and permitted; SDKs are MIT**), **Temporal** (MIT, heavier ops), or **DBOS Transact** (MIT, Postgres-native — the lightest conceptual jump if you already run Postgres).
- **Core change:** register model/tool calls as durable steps through a thin wrapper. Your control flow and decision logic stay yours; the runtime just journals what happened so a crash replays instead of restarts.
- **Unlocks:** resumable multi-hour runs, approval gates that wait without burning compute, **steering a running agent via signals**, and safe deploys (in-flight runs survive a deploy).

### 🟢 MCP — a distribution channel disguised as a protocol
- **Clip on:** `@modelcontextprotocol/sdk` (MIT).
- **Core change:** expose your existing tools as an MCP server.
- **Unlocks:** your capabilities become usable from Claude Desktop, Cursor, and every MCP client — free distribution — and conversely you can absorb community MCP tools into your registry without writing them yourself. This is the highest-leverage, lowest-risk thing on this list after tracing.

---

## 4. Order of operations (this order is not arbitrary)

**Phase 0 — freeze the core (1 day).**
Tag a release. Write a smoke test that exercises one full agent run end-to-end. Everything below must leave it green. This test *is* your blast shield.

**Phase 1 — see and protect (week 1–2). Zero behavioral change.**
1. Tracing on (Langfuse self-hosted). Ship nothing else until you can see a full run.
2. LiteLLM in front of your model calls. Add per-tenant budget caps.
3. promptfoo in CI over exported traces.
*Exit criteria:* you can point at any failed run and explain it, and CI blocks a bad prompt.

**Phase 2 — control (week 3–6).**
4. Policy gate before tool dispatch (+ audit log).
5. Sandbox the dangerous tools.
6. Eval suite expanded to real enterprise scenarios; expose a "quality dashboard" internally.

**Phase 3 — the differentiators (week 7–12).**
7. One durable-execution wrapper for the long-running path only. Start with ONE workflow, not the whole app.
8. Memory behind the existing interface, shadow-mode first: write to both stores, read from the old one, compare.
9. MCP server exposing your tools.

**Why this order:** tracing makes every later step debuggable, and evals make every later step *provably* safe. Doing durable execution first (the tempting choice) means debugging an invisible system with no telemetry.

---

## 5. Bomb-disposal rules (non-negotiable)

1. **Wrap, don't rewrite.** If an OSS project requires that it owns your agent loop, that is the red wire — don't cut it. Adapters and sidecars only.
2. **Everything behind one flag.** Each integration must be disable-able by an env var or config value, with the old code path intact. Rollback = config change, never a deploy rollback.
3. **Shadow mode before cutover.** Dual-write, diff, get confidence, then flip. Applies to memory, gateways, and sandboxes.
4. **Your repo must pass its tests with every integration OFF.** If it can't, you've coupled the core and you now own an upgrade treadmill.
5. **Pin versions.** OSS moves fast; an unpinned agent-adjacent dependency is a production incident waiting for a Tuesday.
6. **License screen first** (see `OSS-LICENSE-MAP.md`).
7. **One integration per PR.** Never two. When something breaks you must know which one.
8. **No new framework owns your loop.** Vercel AI SDK, LangChain etc. are fine *inside* a leaf function; not as your orchestrator. That's how "my own logic" quietly becomes someone else's roadmap.

---

## 6. What I need to make this exact instead of generic

Run the scanner on your repo:

```bash
node seam-scan.mjs /path/to/your/repo
```

It writes `seam-report.json`, lists your detected building blocks, flags the files that are your **core (red wires)**, shows which seams are PRESENT/PARTIAL/MISSING with line-level evidence, and prints the phased clip-on plan. It never reads secret *values* (only variable names), and it writes exactly one file into the repo.

Then send me: the report (`seam-report.json`), and — if you're comfortable — the repo or at least the agent-loop file, the tool registry, and the memory/context-assembly file. With those three files I can give you:

- the exact file/function to clip each integration onto, with the diff shape;
- which of your current abstractions are already good enough to hide an OSS behind (usually 2 of 3 are);
- the specific enterprise gaps that are costing you deals right now;
- the 3 things you should *not* integrate, and why (there's always a tempting one that would break you).

# OSS License Map — what you may safely embed in a commercial product

Short version for a **cloud SaaS / multi-tenant product**:

| License | Embed in your product & sell it? | Watch out for |
|---|---|---|
| **MIT** | ✅ Yes, freely | Attribution only |
| **Apache-2.0** | ✅ Yes, freely | Patent grant + NOTICE file attribution |
| **BSD** | ✅ Yes | Attribution |
| **PostgreSQL** | ✅ Yes | Basically MIT |
| **BSL 1.1** | ⚠️ Usually **no** for competing use; self-hosting for your own app is generally allowed | Not OSI-approved. Read the "Additional Use Grant." Some convert to Apache after N years |
| **Elastic License 2.0 (ELv2)** | ⚠️ You may use/modify/self-host, but **not** provide it as a hosted/managed service to third parties | Common for self-hosted observability servers |
| **SSPL** | ❌ For a SaaS, treat as unsafe unless the component is a separate unlinked process | MongoDB, Redis (7.4+ for some modules) |
| **AGPL-3.0** | ❌ For a public SaaS, unless it's a **separate process with no linking** and you publish its modifications | The network-use clause is the trap |
| **GPL-3.0** | ❌ If you link/embed it | Fine as a standalone tool you call over CLI/HTTP |
| **Unlicense / CC0** | ✅ Yes | — |
| **"Source available" custom** | 🚨 Read the actual file | Often bans commercial or competing use |

**The practical rule of thumb:**

1. **MIT / Apache-2.0** → embed freely. This is what you build *inside* your product.
2. **BSL / ELv2 / AGPL** → allowed only as a **separately deployed service you talk to over the network** (HTTP/gRPC), self-hosted by you, not rebranded, not offered as your own hosted product. Nothing is imported/linked into your codebase.
3. **No license file at all → it is not open source.** All rights reserved by default. Don't ship it.

---

## Project-by-project (verified Sep 2026)

| Project | License | Verdict for your SaaS | Notes |
|---|---|---|---|
| **LiteLLM** | MIT | ✅ Embed | Move fast, safe forever |
| **Portkey AI Gateway** | Apache-2.0 (core; hosted product is commercial) | ✅ Embed | — |
| **Helicone** | Apache-2.0 | ✅ Embed | — |
| **Langfuse** | MIT core; some features are Enterprise Edition (paid, self-host license) | ✅ Embed/self-host | Cloud tier is SOC 2 Type II / ISO 27001 if you'd rather not self-host |
| **OpenLLMetry / OTel GenAI semconv** | Apache-2.0 | ✅ Embed | Best choice if you want zero vendor lock-in |
| **Arize Phoenix** | Elastic License 2.0 (server + evals pkg); the OTel helper pkg is Apache-2.0 | ✅ Self-host as a separate service | ELv2: don't resell Phoenix itself as a hosted service. Ingesting your own traces is fine |
| **promptfoo** | MIT | ✅ Embed/CLI | Dev dependency in CI |
| **DeepEval** | Apache-2.0 | ✅ Embed | Python — run as a separate eval job, not in your TS runtime |
| **Ragas** | Apache-2.0 | ✅ Embed | Python, same as above |
| **E2B** | Apache-2.0 | ✅ Embed | Self-host via Terraform, or use managed cloud |
| **Daytona / microsandbox** | Apache-2.0 | ✅ Embed | Self-hosted sandbox options |
| **MCP SDK** | MIT | ✅ Embed | Protocol layer, no license risk |
| **Mem0** | Apache-2.0 | ✅ Embed | — |
| **Zep / Graphiti** | Apache-2.0 | ✅ Embed | — |
| **Qdrant / pgvector** | Apache-2.0 / PostgreSQL license | ✅ Embed | pgvector if you're already on Postgres |
| **Docling** | MIT | ✅ Embed | Python service |
| **Unstructured** | Apache-2.0 | ✅ Embed | — |
| **OPA / Cerbos / Cedar** | Apache-2.0 | ✅ Embed | Cerbos has the friendliest TS story |
| **Temporal** | MIT | ✅ Embed | Heavier operationally; run as a separate cluster |
| **DBOS Transact** | MIT | ✅ Embed | Postgres-native durable execution |
| **Restate** | Server: **BSL 1.1**; SDKs: MIT | ⚠️ Separate self-hosted process | Free to self-host for production; you just can't offer Restate itself as a competing hosted service. SDKs (what you import) are MIT |
| **LangChain / LangGraph, Vercel AI SDK, Mastra, AutoGen** | MIT | ✅ License-wise | ⚠️ *Architecturally* the risky ones — don't let them own your loop |

⚠️ **Licenses change.** Google-freedom: some projects (e.g. Neo4j, Redis modules) have flipped licenses before. Before shipping, do a one-time automated check:

```bash
npx license-checker --summary          # npm
npx license-checker --failOn "GPL-3.0;AGPL-3.0;SSPL-1.0"   # fail CI on copyleft
```

Add that to CI once, and this whole category of risk disappears permanently — that's the difference between a mature repo and a repo that hopes.

**Attribution hygiene:** keep a `THIRD-PARTY-NOTICES.md` listing name, license, and copyright for every dependency you embed (Apache-2.0 requires it). Enterprise security reviews ask for this file; most competitors don't have it, which is an easy differentiator.

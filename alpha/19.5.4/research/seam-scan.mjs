#!/usr/bin/env node
/**
 * seam-scan.mjs — zero-dependency auditor for AI agentic codebases.
 *
 * Purpose: find the SEAMS (safe clip-on points) and the RED WIRES (core logic
 * you must never modify) in an existing agentic app, then map each seam to a
 * mature OSS drop-in that attaches without changing your core.
 *
 * Usage:
 *   node seam-scan.mjs                 # scan current directory
 *   node seam-scan.mjs /path/to/repo    # scan another directory
 *   node seam-scan.mjs --json           # machine-readable output only
 *
 * It NEVER writes to your repo except one report file: seam-report.json
 * It NEVER reads .env values — only file names and variable NAMES.
 */

import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt',
  '.svelte-kit', '.turbo', '.cache', '.venv', 'venv', '__pycache__', 'vendor',
  '.output', 'test-results', '.idea', '.vscode', 'tmp', '.yarn', '.pnpm-store',
]);
const CODE_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts',
  '.json', '.yaml', '.yml', '.toml', '.prisma', '.sql', '.env',
]);
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_SAMPLES = 4;

const args = process.argv.slice(2);
const JSON_ONLY = args.includes('--json');
const ROOT = path.resolve(args.find((a) => !a.startsWith('--')) || '.');

/* ------------------------------------------------------------------ *
 * SIGNALS: what we look for, which seam it belongs to, how it maps to
 * a mature OSS drop-in. `risk` = how dangerous it is to integrate there.
 *   green  = attach at the edge, zero core change
 *   amber  = needs an adapter/injection point in your code (few lines)
 *   red    = this IS your core. Wrap it, never rewrite it.
 * ------------------------------------------------------------------ */
const SEAMS = {
  llm_egress: {
    title: 'LLM Egress (every model call)',
    risk: 'green',
    why: 'Single choke point every agentic app has. Point baseUrl at a proxy = 1 line, no core logic change.',
    oss: [
      ['LiteLLM Proxy', 'MIT', 'Universal OpenAI-compatible gateway: multi-provider routing, retries, fallbacks, budget caps, semantic cache, per-key spend.'],
      ['Portkey AI Gateway', 'Apache-2.0 (core)', 'Lightweight TS-friendly gateway: routing, guardrails hooks, caching, observability.'],
      ['Helicone', 'Apache-2.0', 'Proxy that records prompts/responses/cost with ~1 line change.'],
    ],
    unblocks: 'Cost caps, provider fallback, model swap, caching, PII redaction on the wire.',
  },
  tracing: {
    title: 'Telemetry / Traces (agent steps, tool calls, tokens)',
    risk: 'green',
    why: 'Fire-and-forget exporter. If you send nothing today, this is your highest ROI, lowest risk first move.',
    oss: [
      ['Langfuse', 'MIT core (EE extras paid)', 'Traces, sessions, prompt versioning, evals, user feedback. Self-host free, commercial use allowed.'],
      ['OpenLLMetry / OpenTelemetry GenAI', 'Apache-2.0', 'Standard OTel auto-instrumentation — avoids vendor lock-in entirely.'],
      ['Arize Phoenix', 'Elastic License 2.0 (server), Apache-2.0 (otel pkg)', 'Self-hostable trace+eval UI. ELv2 forbids reselling it as a hosted service; internal/product ops use is fine.'],
    ],
    unblocks: 'Why did it fail, per-tenant cost, enterprise audit evidence, eval datasets from real traffic.',
  },
  tool_exec: {
    title: 'Tool Execution (the callable your registry dispatches to)',
    risk: 'amber',
    why: 'Wrap the callable, not the registry. Your tool definitions stay byte-identical.',
    oss: [
      ['E2B', 'Apache-2.0', 'Isolated sandboxes for AI-generated code. Gives you real "artifacts" capability like Claude has.'],
      ['Daytona / microsandbox', 'Apache-2.0', 'Self-hostable sandbox alternatives if you cannot send code to a third party.'],
      ['MCP (Model Context Protocol SDK)', 'MIT', 'Turn your existing tools into a standard server, and inherit thousands of community tools for free.'],
    ],
    unblocks: 'Run dangerous code safely, real file/data outputs, a huge free tool ecosystem.',
  },
  memory: {
    title: 'Memory + Retrieval (context assembly)',
    risk: 'amber',
    why: 'Put the new store BEHIND your existing interface. Callers keep calling the same function.',
    oss: [
      ['Mem0', 'Apache-2.0', 'Long-term user memory extraction + retrieval layer.'],
      ['Zep / Graphiti', 'Apache-2.0', 'Temporal knowledge graph memory — strong for "what changed, when".'],
      ['Qdrant / pgvector', 'Apache-2.0 / PostgreSQL', 'Vector store; pgvector if you already run Postgres.'],
      ['Docling / Unstructured', 'MIT / Apache-2.0', 'Document parsing/OCR for enterprise file ingestion.'],
    ],
    unblocks: 'Cross-session continuity, better grounding, less context bloat, fewer hallucinations.',
  },
  durability: {
    title: 'Durable Execution (long / interrupted runs)',
    risk: 'amber',
    why: 'This is the Claude-like differentiator: runs that survive crashes, resume, and accept human steering mid-task.',
    oss: [
      ['Restate', 'BSL server (self-host free) + MIT SDKs', 'Single binary. Journal every step, resume after crash, pause for human approval, signal a running agent to redirect it.'],
      ['Temporal', 'MIT', 'Battle-tested enterprise durable workflows; heavier ops footprint.'],
      ['DBOS Transact', 'MIT', 'Durable execution anchored in Postgres — lightest conceptual jump if you already run Postgres.'],
    ],
    unblocks: 'No lost work, resumable multi-hour tasks, approval gates, agent steering, safer deploys.',
  },
  quality_gate: {
    title: 'Evals / Regression Gate (offline, in CI)',
    risk: 'green',
    why: 'Runs outside your runtime entirely — consumes exported traces. Zero production risk.',
    oss: [
      ['promptfoo', 'MIT', 'YAML-driven eval + red-team suite; runs in CI, compares models/prompts.'],
      ['DeepEval', 'Apache-2.0', 'Pytest-style agent metrics (task completion, tool correctness, faithfulness).'],
      ['Ragas', 'Apache-2.0', 'Retrieval/RAG quality metrics specifically.'],
    ],
    unblocks: '"We did not regress" proof for enterprise buyers; safe prompt/model swaps.',
  },
  governance: {
    title: 'Policy / Permissions / Audit',
    risk: 'amber',
    why: 'One decision call before dispatch: "is this tool allowed for this tenant/user?" Sidecar, not surgery.',
    oss: [
      ['OPA (Open Policy Agent)', 'Apache-2.0', 'Policy-as-code decisions over HTTP — ideal sidecar.'],
      ['Cerbos', 'Apache-2.0', 'Purpose-built authorization engine with a TS SDK.'],
      ['Cedar', 'Apache-2.0', 'AWS-origin policy language, embedded library.'],
    ],
    unblocks: 'Enterprise RBAC, "agent asked before deleting", durable audit trail, multi-tenant safety.',
  },
};

/* Package / import / code fingerprints per seam. */
const DEP_SIGNALS = {
  llm_sdk:      /^(openai|@anthropic-ai\/sdk|@google\/generative-ai|@google\/genai|ai|@ai-sdk\/.*|cohere-ai|mistralai|@mistralai\/.*|groq-sdk|@aws-sdk\/client-bedrock.*|@azure\/openai|ollama|@ollama\/.*|openrouter.*|together-ai|@huggingface\/.*|replicate)$/i,
  agent_framework: /^(langchain|@langchain\/.*|langgraph|@langgraph\/.*|mastra|@mastra\/.*|@microsoft\/autogen.*|crewai|@openai\/agents.*|@openai\/swarm|@google\/adk.*|@livekit\/agents.*|@cloudflare\/agents.*|@vercel\/ai.*)$/i,
  vector_memory: /^(pinecone|@pinecone-database\/.*|@qdrant\/.*|weaviate.*|chromadb|@chroma-core\/.*|pgvector|redis|ioredis|@upstash\/.*|mem0ai|mem0|@getzep\/.*|zep-js|@langchain\/memory.*|@zilliz\/.*|milvus.*|@lancedb\/.*|lancedb|vectra|@turbopuffer\/.*)$/i,
  persistence:  /^(prisma|@prisma\/client|drizzle-orm|kysely|typeorm|sequelize|mongoose|mongodb|pg|postgres|better-sqlite3|sqlite3|@libsql\/.*|@planetscale\/.*|@neondatabase\/.*|firebase-admin|supabase.*|@supabase\/.*)$/i,
  queue_durable:/^(bullmq|bull|@temporalio\/client|@temporalio\/worker|@temporalio\/workflow|@restatedev\/.*|restate-sdk.*|inngest|@trigger.dev\/.*|@dbos-inc\/.*|kafkajs|amqplib|@aws-sdk\/client-sqs|agenda|bee-queue)$/i,
  tracing_obs:  /^(langfuse|langfuse-js|@langfuse\/.*|@arizeai\/.*|@opentelemetry\/.*|langsmith|@langchain\/langsmith.*|@helicone\/.*|helicone|opik|@comet\/.*|dd-trace|newrelic|@sentry\/.*|posthog-js|posthog-node|braintrust|@braintrust\/.*)$/i,
  sandbox:      /^(@e2b\/.*|e2b|e2b-code-interpreter|daytona.*|vm2|isolated-vm|microsandbox.*|@cloudflare\/sandbox.*)$/i,
  policy_authz: /^(@open-policy-agent\/.*|opa|@cerbos\/.*|casbin|@cedar-policy\/.*|oso|@ory\/.*)$/i,
  mcp:          /^(@modelcontextprotocol\/.*|@mcp\/.*|fastmcp|mcp-.*)$/i,
  evals:        /^(promptfoo|deepeval|@promptfoo\/.*|braintrust|@langfuse\/.*|autoevals|@inspect_ai\/.*)$/i,
};

const CODE_SIGNALS = [
  { seam: 'llm_egress', id: 'direct_provider_url', re: /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.mistral\.ai|api\.groq\.com|openrouter\.ai|bedrock-runtime/i, note: 'Hard-coded provider endpoint' },
  { seam: 'llm_egress', id: 'base_url_config', re: /\bbaseURL\b|\bbase_url\b|\bBASE_URL\b|\bAZURE_OPENAI_ENDPOINT\b|\bOPENAI_API_BASE\b/i, note: 'Base URL is configurable -> proxy-ready, zero core change' },
  { seam: 'llm_egress', id: 'hardcoded_model', re: /["'`](gpt-(4|5)[\w.-]*|o[134][\w.-]*|claude-[\w.-]+|gemini-[\w.-]+|llama-[\w.-]+|mistral[\w.-]*)["'`]/i, note: 'Model names hard-coded' },
  { seam: 'tool_exec', id: 'tool_definitions', re: /\btools\s*:\s*\[|\bregisterTool\b|tool\(\s*\{|input_schema|inputSchema|function\s*:\s*\{\s*name|ToolDefinition|toolRegistry|tool_registry/i, note: 'Tool registry / tool schema definitions' },
  { seam: 'tool_exec', id: 'raw_exec', re: /child_process|execSync|spawnSync|\bexec\(|\beval\(|new Function\(|vm\.(runIn|createContext)/i, note: 'Unsandboxed execution path -> sandbox candidate', bias: 'red' },
  { seam: 'memory', id: 'embeddings', re: /embedding|createEmbedding|text-embedding|\.embed\(/i, note: 'Embedding calls (retrieval path)' },
  { seam: 'memory', id: 'context_assembly', re: /buildContext|assembleContext|systemPrompt|system_prompt|messages\.push|history\.slice|contextWindow|maxTokens|trimMessages|summariz/i, note: 'Context/prompt assembly (memory seam)' },
  { seam: 'memory', id: 'chunking_docs', re: /chunkSize|chunk_overlap|splitText|RecursiveCharacterTextSplitter|pdf-parse|unstructured|docling/i, note: 'Document ingestion / chunking' },
  { seam: 'tracing', id: 'otel_present', re: /@opentelemetry|trace\.getTracer|startActiveSpan|Langfuse|langfuse|phoenix\.otel|arize/i, note: 'Tracing already instrumented' },
  { seam: 'tracing', id: 'ad_hoc_logging', re: /console\.(log|error)\(.*(prompt|message|toolCall|tool_call|completion|response)/i, note: 'Ad-hoc logging where structured traces should go' },
  { seam: 'tracing', id: 'correlation_ids', re: /runId|run_id|traceId|trace_id|sessionId|session_id|conversationId|requestId/i, note: 'Correlation IDs exist -> traces can join end to end' },
  { seam: 'tracing', id: 'token_accounting', re: /prompt_tokens|completion_tokens|total_tokens|usage\.|tokenCount/i, note: 'Token usage captured -> cost attribution is possible' },
  { seam: 'durability', id: 'retry_loop', re: /retry|backoff|backoffMs|maxRetries|attempt/i, note: 'Hand-rolled retry logic -> durable execution candidate' },
  { seam: 'durability', id: 'checkpoint', re: /checkpoint|resume|persistState|saveState|state\.save|journal/i, note: 'Existing state persistence / resume hints' },
  { seam: 'durability', id: 'long_task', re: /setTimeout|setInterval|sleep\(|waitFor|poll\(|queue\.add|enqueue/i, note: 'Async/polling work -> interruption risk' },
  { seam: 'governance', id: 'authz_check', re: /permission|isAllowed|can\(|authorize|rbac|role\s*===|tenantId|tenant_id|orgId|org_id|workspaceId/i, note: 'Tenancy / permission checks (policy seam)' },
  { seam: 'governance', id: 'human_approval', re: /approve|approval|confirm\(|humanInTheLoop|human_in_the_loop|requiresConfirmation|hitl/i, note: 'Approval / HITL hooks' },
  { seam: 'governance', id: 'secrets', re: /process\.env\.[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD)/, note: 'Secrets read from env (names only, values never read)', redact: true },
  { seam: 'quality_gate', id: 'tests_present', re: /describe\(|it\(|test\(|expect\(/i, note: 'Test coverage exists -> eval harness can extend it' },
  { seam: 'quality_gate', id: 'prompt_assets', re: /prompts?\/(\w|-)+\.(md|txt|json|yaml|yml)|\.prompt\.|promptTemplate|PROMPT_/i, note: 'Prompt assets on disk -> versionable' },
  { seam: 'mcp', id: 'mcp_usage', re: /modelcontextprotocol|McpServer|mcpServers|listTools\(\)|callTool\(/i, note: 'MCP already wired' },
];

/* Files that look like the agent loop itself = RED WIRE territory. */
const LOOP_SIGNALS = [
  /\bfor\s*\(\s*(let|var|const)\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*(maxIterations|maxSteps|maxTurns|maxLoops|MAX_)/i,
  /\bwhile\s*\(\s*(true|!done|!finished|!complete|iterations?\s*<|steps?\s*<)/i,
  /agentLoop|runAgent|executeAgent|agent_loop|runTurn|processTurn|reactLoop/i,
  /streamText|generateText|\.chat\.completions\.create|messages\.create|generateContent\(/i,
  /stepCount|maxSteps|maxIterations|recursionLimit|toolCallCount/i,
];

/* Extra recommendation rows keyed by what we find. */
const CONDITIONAL = [
  { if: { seam: 'llm_egress', missing: 'proxy' }, add: 'Put LiteLLM (MIT) in front of every provider call. Wall-clock: hours. Core changes: one env var.' },
  { if: { seam: 'tracing', missing: 'any' }, add: 'Instrument with Langfuse (MIT, self-host free) — highest ROI, zero runtime risk, first enterprise checkbox.' },
  { if: { seam: 'durability', found: 'retry_loop' }, add: 'Hand-rolled retries = the #1 cause of stuck enterprise agents. Move the step boundary into Restate (BSL server, MIT SDK) or DBOS (MIT).' },
  { if: { seam: 'tool_exec', found: 'raw_exec' }, add: 'Unsandboxed exec is an enterprise blocker and a security liability. Route it through E2B (Apache-2.0).' },
  { if: { seam: 'governance', missing: 'any' }, add: 'No policy layer found. Add a single authorize() call before tool dispatch backed by OPA or Cerbos (both Apache-2.0).' },
  { if: { seam: 'quality_gate', missing: 'evals' }, add: 'Add promptfoo (MIT) to CI over recorded traces before you touch any prompt or model.' },
];

/* ------------------------------------------------------------------ */

function walk(dir, acc = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.git')) continue;
      walk(full, acc);
    } else if (e.isFile()) {
      if (e.name === 'seam-report.json') continue;
      const ext = path.extname(e.name);
      if (CODE_EXT.has(ext) || /^\.env/.test(e.name) || e.name === 'package.json') acc.push(full);
    }
  }
  return acc;
}

function readSafe(file) {
  try {
    const st = fs.statSync(file);
    if (st.size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(file, 'utf8');
  } catch { return null; }
}

const files = walk(ROOT);
const rel = (f) => path.relative(ROOT, f) || path.basename(f);

/* ---- 1. package.json / dependency fingerprint ---------------------- */
const deps = { dependencies: {}, devDependencies: {}, scripts: {}, name: '', type: '' };
const depHits = {}; // seam -> Set(pkgName)
const pkgFiles = files.filter((f) => path.basename(f) === 'package.json');
const workspaces = [];

for (const pf of pkgFiles) {
  const txt = readSafe(pf);
  if (!txt) continue;
  let json;
  try { json = JSON.parse(txt); } catch { continue; }
  if (pf === path.join(ROOT, 'package.json')) {
    deps.name = json.name || '';
    deps.type = json.type || '';
    deps.scripts = json.scripts || {};
  }
  // detect workspaces / packages dir (top level only, so we can report it)
  const dir = path.dirname(rel(pf));
  workspaces.push(dir === '.' ? '(root)' : dir);
  const all = { ...(json.dependencies || {}), ...(json.devDependencies || {}) };
  for (const pkg of Object.keys(all)) {
    if (pf === path.join(ROOT, 'package.json')) {
      if (json.dependencies?.[pkg]) deps.dependencies[pkg] = json.dependencies[pkg];
      if (json.devDependencies?.[pkg]) deps.devDependencies[pkg] = json.devDependencies[pkg];
    }
    for (const [key, re] of Object.entries(DEP_SIGNALS)) {
      if (re.test(pkg)) {
        (depHits[key] ||= new Set()).add(pkg);
      }
    }
  }
}

/* ---- 2. code fingerprint ------------------------------------------- */
const codeHits = {}; // seam -> id -> {note, samples:[]}
let totalLines = 0;
let codeFileCount = 0;

for (const f of files) {
  const base = path.basename(f);
  if (base === 'package.json' || base === 'package-lock.json') continue;
  const txt = readSafe(f);
  if (!txt) continue;
  codeFileCount++;
  const lines = txt.split('\n');
  totalLines += lines.length;
  const isEnv = /^\.env/.test(base);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 400) continue;
    for (const sig of CODE_SIGNALS) {
      if (!sig.re.test(line)) continue;
      const bucket = (codeHits[sig.seam] ||= {});
      const entry = (bucket[sig.id] ||= { note: sig.note, bias: sig.bias, samples: [], count: 0 });
      entry.count++;
      if (entry.samples.length < MAX_SAMPLES) {
        // Redact env values / secrets: keep only the variable NAME.
        let shown = line.trim();
        if (sig.redact || isEnv) {
          shown = shown.replace(/(=\s*).+/, '$1<redacted>');
        }
        entry.samples.push(`${rel(f)}:${i + 1}  ${shown.slice(0, 140)}`);
      }
    }
  }
}

/* ---- 3. locate red wires (the agent loop) --------------------------- */
const redWires = [];
for (const f of files) {
  const base = path.basename(f);
  if (base === 'package.json') continue;
  if (!/\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/.test(f)) continue;
  const txt = readSafe(f);
  if (!txt) continue;
  const hits = LOOP_SIGNALS.filter((re) => re.test(txt));
  const hasLlm = /completions\.create|messages\.create|generateText|streamText|generateContent\(|invoke\(/.test(txt);
  const hasTools = /tools\s*:|tool_calls|toolCalls|registerTool|input_schema|inputSchema/i.test(txt);
  if (hits.length >= 2 || (hasLlm && hasTools)) {
    redWires.push({ file: rel(f), loopSignals: hits.length, hasLlmCall: hasLlm, hasToolDispatch: hasTools, lines: txt.split('\n').length });
  }
}
redWires.sort((a, b) => b.loopSignals + +b.hasLlmCall + +b.hasToolDispatch - (a.loopSignals + +a.hasLlmCall + +a.hasToolDispatch));

/* ---- 4. seam status ------------------------------------------------- */
const seamStatus = {};
for (const [id, meta] of Object.entries(SEAMS)) {
  const fromCode = codeHits[id] || {};
  const codeCount = Object.values(fromCode).reduce((n, e) => n + e.count, 0);
  // map dep fingerprints to seams
  let fromDeps = [];
  if (id === 'llm_egress') fromDeps = [...(depHits.llm_sdk || [])];
  if (id === 'tracing') fromDeps = [...(depHits.tracing_obs || [])];
  if (id === 'memory') fromDeps = [...(depHits.vector_memory || [])];
  if (id === 'durability') fromDeps = [...(depHits.queue_durable || [])];
  if (id === 'tool_exec') fromDeps = [...(depHits.sandbox || [])];
  if (id === 'governance') fromDeps = [...(depHits.policy_authz || [])];
  if (id === 'quality_gate') fromDeps = [...(depHits.evals || [])];
  if (id === 'mcp') fromDeps = [...(depHits.mcp || [])];
  const maturity = fromDeps.length || codeCount > 12 ? 'PRESENT' : codeCount > 0 ? 'PARTIAL' : 'MISSING';
  // Signals found *in this seam's own territory* (with counts), plus the
  // cross-cutting ones that matter for judging readiness.
  const instruments = Object.values(fromCode)
    .sort((a, b) => b.count - a.count)
    .map((e) => `${e.note} (${e.count}x)`);
  if (id === 'tracing' && codeHits.llm_egress?.base_url_config) instruments.push('single choke point at the LLM boundary exists');
  if (id === 'durability' && codeHits.policy_authz) instruments.push('human-approval hooks present');
  seamStatus[id] = { ...meta, maturity, codeHits: fromCode, codeCount, fromDeps, instruments };
}

const pkgMgr = fs.existsSync(path.join(ROOT, 'pnpm-lock.yaml')) ? 'pnpm'
  : fs.existsSync(path.join(ROOT, 'yarn.lock')) ? 'yarn'
  : fs.existsSync(path.join(ROOT, 'bun.lockb')) ? 'bun' : 'npm';

const addCmd = (pkgs, dev = false) =>
  pkgMgr === 'npm' ? `npm i${dev ? ' -D' : ''} ${pkgs}` : `${pkgMgr} add${dev ? ' -D' : ''} ${pkgs}`;

const INSTR = {
  tracing: [addCmd('langfuse'), addCmd('@opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node'), '# then: self-host Langfuse via docker compose (2 containers)'],
  llm_egress: ['# run LiteLLM proxy as a container; set OPENAI_BASE_URL + OPENAI_API_KEY to the proxy', '# your code keeps calling the same SDK — only the base URL moves'],
  quality_gate: [addCmd('promptfoo', true), 'npx promptfoo init && npx promptfoo eval   # run in CI on every prompt/model change'],
  governance: ['# run OPA or Cerbos as a sidecar; call POST /v1/allowed before every tool dispatch'],
  memory: [addCmd('mem0ai') + '   # or: @qdrant/js-client-rest + pgvector', '# implement your existing memory interface with the new store; callers unchanged'],
  durability: [addCmd('@restatedev/restate-sdk'), '# register ONE wrapper fn for tool/model calls; the runtime journals each step'],
  tool_exec: ['# keep your tool registry; wrap each handler fn to run inside an E2B sandbox'],
  mcp: [addCmd('@modelcontextprotocol/sdk'), '# expose existing tools as an MCP server -> inherit the ecosystem; nothing internal changes'],
};

/* ---- 5. verdict + phase plan ---------------------------------------- */

function toItem(id) {
  const s = seamStatus[id];
  return { seam: id, status: s.maturity, doThis: s.oss[0][0], license: s.oss[0][1],
           alsoConsider: s.oss.slice(1).map((o) => o[0]), unblocks: s.unblocks, commands: INSTR[id] || [] };
}
function remember() { /* no-op hook: keeps plan generation readable */ }

const verdict = [];
const order = ['tracing', 'llm_egress', 'quality_gate', 'governance', 'memory', 'durability', 'tool_exec'];
const phases = { 1: [], 2: [], 3: [] };
let n = 0;
for (const id of order) {
  const s = seamStatus[id];
  if (!s) continue;
  remember(id);
  if (s.maturity === 'PRESENT' && (id === 'tracing' || id === 'llm_egress')) {
    verdict.push(`${id}: already instrumented — verify it exports traces/costs end to end, do not rebuild.`);
    continue;
  }
  if (s.maturity === 'PRESENT') { verdict.push(`${id}: present — swap/replace only behind your existing interface.`); continue; }
  const phase = n < 2 ? 1 : n < 4 ? 2 : 3;
  phases[phase].push(toItem(id));
  n++;
  verdict.push(`${id}: ${s.maturity} — ${s.oss[0][0]} (${s.oss[0][1]}) is the default clip-on. ${s.why}`);
}

/* ---- 6. report ------------------------------------------------------ */
const report = {
  scannedAt: new Date().toISOString(),
  root: ROOT,
  stack: { name: deps.name, type: deps.type, packageFiles: workspaces, packageManager: pkgMgr, scripts: Object.keys(deps.scripts || {}), fileCount: codeFileCount, lines: totalLines },
  keyDependencies: {
    llmSdk: [...(depHits.llm_sdk || [])],
    agentFramework: [...(depHits.agent_framework || [])],
    vectorMemory: [...(depHits.vector_memory || [])],
    persistence: [...(depHits.persistence || [])],
    queueOrDurable: [...(depHits.queue_durable || [])],
    tracing: [...(depHits.tracing_obs || [])],
    sandbox: [...(depHits.sandbox || [])],
    policy: [...(depHits.policy_authz || [])],
    mcp: [...(depHits.mcp || [])],
    evals: [...(depHits.evals || [])],
  },
  redWires: redWires.slice(0, 12),
  seams: Object.fromEntries(Object.entries(seamStatus).map(([k, v]) => [k, {
    title: v.title, risk: v.risk, maturity: v.maturity, why: v.why, unblocks: v.unblocks,
    instruments: v.instruments, detectedInDeps: v.fromDeps,
    evidenceCount: v.codeCount,
    evidence: Object.fromEntries(Object.entries(v.codeHits).map(([k2, e]) => [k2, { note: e.note, count: e.count, samples: e.samples }])),
    oss: v.oss.map(([name, lic, why]) => ({ name, license: lic, why })),
  }])),
  phasedPlan: phases,
  conditionalAdvice: CONDITIONAL.filter((c) => {
    const s = seamStatus[c.if.seam];
    if (!s) return false;
    if (c.if.found) return Boolean(s.codeHits[c.if.found] || s.instruments.includes(c.if.found));
    if (c.if.missing) {
      if (c.if.missing === 'any') return s.maturity === 'MISSING';
      if (c.if.missing === 'proxy') return !s.instruments.includes('configurable base URL');
      if (c.if.missing === 'evals') return s.maturity === 'MISSING';
    }
    return false;
  }).map((c) => c.add),
  rules: [
    'RED WIRES (listed above) are your core: wrap them, never rewrite them.',
    'Every integration must be reverted by flipping one flag/env var — no code rollback.',
    'Run new components in shadow mode (write alongside, compare, then cut over).',
    'Your repo must build and pass tests with every integration switched OFF.',
    'License rule of thumb: MIT/Apache-2.0 = safe to embed. BSL/ELv2 = run as a separate self-hosted process, never rebrand/resell it. AGPL/SSPL = only if you are NOT a public SaaS, or via a separate unlinked process.',
  ],
};

/* ---- print ---------------------------------------------------------- */
if (JSON_ONLY) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else {
  const B = (s) => `\x1b[1m${s}\x1b[0m`;
  const RED = (s) => `\x1b[31m${s}\x1b[0m`;
  const GRN = (s) => `\x1b[32m${s}\x1b[0m`;
  const YEL = (s) => `\x1b[33m${s}\x1b[0m`;
  const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

  console.log('\n' + B('== SEAM SCAN ==') + DIM(`  ${ROOT}`));
  console.log(`${B('stack')}: ${report.stack.name || '(unnamed)'}  |  ${report.stack.packageManager}  |  ${report.stack.fileCount} files, ${report.stack.lines.toLocaleString()} lines, ${report.stack.packageFiles.length} package.json (${report.stack.packageFiles.slice(0, 6).join(', ')})`);

  const kd = report.keyDependencies;
  const show = (label, arr) => { if (arr.length) console.log(`  ${label}: ${arr.join(', ')}`); };
  console.log(B('\nDetected building blocks'));
  show('LLM SDKs        ', kd.llmSdk);
  show('Agent frameworks', kd.agentFramework);
  show('Vector / memory ', kd.vectorMemory);
  show('Persistence     ', kd.persistence);
  show('Queue / durable ', kd.queueOrDurable);
  show('Tracing         ', kd.tracing);
  show('Sandbox         ', kd.sandbox);
  show('Policy / authz  ', kd.policy);
  show('MCP             ', kd.mcp);
  show('Evals           ', kd.evals);

  console.log('\n' + B('RED WIRES — do not modify, wrap only'));
  if (!redWires.length) console.log(YEL('  (none matched — loop may be spread thin; send me the repo and I will find it)'));
  for (const r of redWires.slice(0, 8)) {
    console.log(`  ${RED('CORE')} ${r.file} ${DIM(`(${r.lines} lines, ${r.loopSignals} loop markers${r.hasLlmCall ? ', LLM call' : ''}${r.hasToolDispatch ? ', tool dispatch' : ''})`)}`);
  }

  console.log('\n' + B('SEAM MAP — where you are allowed to clip in'));
  for (const [id, s] of Object.entries(seamStatus)) {
    const tag = s.maturity === 'PRESENT' ? GRN('PRESENT ') : s.maturity === 'PARTIAL' ? YEL('PARTIAL ') : RED('MISSING ');
    const risk = s.risk === 'green' ? GRN('[green wire]') : s.risk === 'amber' ? YEL('[amber wire]') : RED('[red wire]');
    console.log(`\n  ${tag}${B(s.title)} ${risk}`);
    console.log(`    ${DIM(s.why)}`);
    if (s.fromDeps.length) console.log(`    installed: ${s.fromDeps.join(', ')}`);
    if (s.instruments.length) console.log(`    found    : ${s.instruments.join(', ')}`);
    const ev = Object.values(s.codeHits).slice(0, 3);
    for (const e of ev) console.log(DIM(`      - ${e.note} (${e.count}x)  e.g. ${e.samples[0] || ''}`));
    console.log(`    clip on  : ${s.oss.map((o) => `${o[0]} ${DIM('(' + o[1] + ')')}`).join('  |  ')}`);
    console.log(`    unlocks  : ${s.unblocks}`);
  }

  console.log('\n' + B('PHASED PLAN'));
  for (const [p, items] of Object.entries(phases)) {
    if (!items.length) continue;
    console.log(`\n  ${B('PHASE ' + p)}`);
    for (const it of items) {
      console.log(`    • ${it.seam} -> ${it.doThis} ${DIM('(' + it.license + ')')}`);
      for (const cmd of it.commands) console.log(DIM(`        ${cmd}`));
    }
  }

  if (report.conditionalAdvice.length) {
    console.log('\n' + B('TARGETED CALLS'));
    for (const a of report.conditionalAdvice) console.log(`  ! ${a}`);
  }

  console.log('\n' + B('RULES'));
  for (const r of report.rules) console.log(`  - ${r}`);
  console.log('');
}

try {
  fs.writeFileSync(path.join(ROOT, 'seam-report.json'), JSON.stringify(report, null, 2));
  if (!JSON_ONLY) console.log(DIM(`report written: ${path.join(ROOT, 'seam-report.json')}\n`));
} catch (e) {
  if (!JSON_ONLY) console.error('could not write seam-report.json:', e.message);
}

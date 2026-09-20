/**
 * VH-19 — the conversation memory graph (19.7.0).
 *
 * The idea, stated plainly: every conversation becomes a GRAPH of its
 * keywords. Nodes are keywords, edges are co-occurrence, sessions carry the
 * dated, compressed transcript. Later, when the user says "that day when X
 * happened" or "continue the one about Y", the agent walks the graph by
 * keywords and date, finds the session, and REHYDRATES it: a compact,
 * honest context block built from that conversation's own messages, fed
 * forward so the chat continues from where it left off.
 *
 * Design floor, unchanged from the rest of VH:
 *   • local-first — the graph lives in this webview's store, guarded;
 *   • honest — a recall that finds nothing says so; a rehydrated context is
 *     MARKED as rehydrated inside the prompt text itself, so no member or
 *     captain can mistake it for live memory;
 *   • deterministic — extraction and scoring are pure functions; probes
 *     pin the same input to the same graph.
 *
 * Token synergy: rehydration feeds DIGESTS (keywords + trimmed turns), not
 * full transcripts — the memory layer is itself a token optimizer.
 */

import { vaultStatus, vaultSeal, vaultDecrypt } from "./vault";

const GRAPH_KEY = "vh19.memgraph.v1";
const ENABLED_KEY = "vh19.memgraph.enabled.v1";
const NODE_CAP = 4000;
const EDGE_CAP = 9000;
const SESSION_CAP = 300;
const MSG_CAP_PER_SESSION = 200;

export interface MgMessage { role: "user" | "vh"; text: string; at: string }

export interface MgSession {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string;
  messageCount: number;
  keywords: string[];
  /** sha-free content digest for identity (fnv — fast, non-cryptographic, honest) */
  digest: string;
  messages: MgMessage[];
}

export interface MgNode { id: string; label: string; weight: number; firstSeen: string; lastSeen: string; sessionIds: string[] }
export interface MgEdge { a: string; b: string; weight: number; sessionIds: string[] }
export interface MgGraph {
  version: 1;
  nodes: MgNode[];
  edges: MgEdge[];
  sessions: MgSession[];
  updatedAt: string;
}

/* ── stopword floor (short, closed list — deterministic, no surprises) ──── */
const STOP = new Set(
  ("a an the and or but if then else of to in on at for with from by as is are was were be been being do does did " +
    "i you he she it we they me him her us them my your his its our their this that these those there here what " +
    "which who whom when where why how not no yes so than too very can will just should now also into about over " +
    "under again once only own same s t don ll re ve m y need want make made get got go went have has had please " +
    "thanks thank okay ok hi hello hey uh um the thing things something anything nothing everything").split(" "),
);

/**
 * Deterministic keyword extraction: tokenize, drop stopwords/numbers,
 * score by frequency × length, capitalize first-occurrence bonus, sort by
 * (score desc, alpha asc) and take the top N. Same text in, same list out.
 */
export function extractKeywords(text: string, max = 8): string[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter(Boolean);
  const freq = new Map<string, number>();
  const caps = new Set<string>();
  for (const raw of text.split(/\s+/)) {
    const w = raw.toLowerCase().replace(/[^a-z0-9\s'-]/g, "");
    if (!w) caps.add("__noop__");
  }
  // capitalized-token detection on the ORIGINAL text (proper nouns rank up)
  const capTokens = new Set<string>();
  for (const raw of text.split(/\s+/)) {
    const cleaned = raw.replace(/[^A-Za-z0-9'-]/g, "");
    if (cleaned.length > 2 && /^[A-Z]/.test(cleaned) && !STOP.has(cleaned.toLowerCase())) {
      capTokens.add(cleaned.toLowerCase());
    }
  }
  for (const w of words) {
    const t = w.replace(/^-+|-+$/g, "");
    if (t.length < 3 || STOP.has(t) || /^\d+$/.test(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  const scored = Array.from(freq.entries()).map(([word, f]) => {
    let score = f * (1 + Math.min(1, (word.length - 3) / 8));
    if (capTokens.has(word)) score *= 1.5;
    return { word, score };
  });
  scored.sort((a, b) => (b.score - a.score) || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
  return scored.slice(0, Math.max(1, max)).map((s) => s.word);
}

function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  let h2 = 0x811c9dc5 ^ 0x9e3779b9;
  for (let i = text.length - 1; i >= 0; i--) { h2 ^= text.charCodeAt(i); h2 = Math.imul(h2, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

function storage(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

const EMPTY: MgGraph = { version: 1, nodes: [], edges: [], sessions: [], updatedAt: new Date(0).toISOString() };

/* No storage (plain Node, sandboxed quirks) ⇒ the graph lives in this
 * module's memory for the process lifetime — stated, not hidden. With
 * storage, the cache just mirrors the store.
 *
 * 19.7.1 — ENCRYPTION AT REST. The 19.7.0 review was right: session
 * messages are conversation content, and they sat in plaintext storage.
 * Now: when the owner vault is UNLOCKED, the graph persists ONLY as an
 * AES-256-GCM sealed record (plaintext copies are removed the moment a
 * passphrase exists); when the vault is locked or absent the graph
 * persists as PLAINTEXT and `graphSecurityStatus()` says so in words —
 * it never pretends. Reads stay synchronous from memCache; a sealed
 * store hydrates via `hydrateGraph()` after unlock. */
let memCache: MgGraph | null = null;
let lockedAtBoot = false;
let saveToken = 0;
let persistNote: string | null = null;
let persistInFlight: Promise<void> = Promise.resolve();

/** Await the in-flight sealed write — deterministic probes and tests use this. */
export function flushGraphPersist(): Promise<void> {
  return persistInFlight;
}

function isSealedEnvelope(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { v?: unknown };
    return parsed?.v === "vh-vault/1";
  } catch {
    return false;
  }
}

function loadGraph(): MgGraph {
  const s = storage();
  if (!s) {
    if (!memCache) memCache = { ...EMPTY, nodes: [], edges: [], sessions: [] };
    return memCache;
  }
  const raw = s.getItem(GRAPH_KEY);
  if (isSealedEnvelope(raw)) {
    // sealed at rest: synchronous reads come from memCache; hydration is explicit
    if (!memCache) { lockedAtBoot = true; memCache = { ...EMPTY }; }
    return memCache;
  }
  lockedAtBoot = false;
  try {
    const parsed = JSON.parse(raw ?? "null") as MgGraph | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || !Array.isArray(parsed.sessions)) {
      if (!memCache) memCache = { ...EMPTY };
      return memCache;
    }
    memCache = parsed;
    return parsed;
  } catch {
    if (!memCache) memCache = { ...EMPTY };
    return memCache;
  }
}

function saveGraph(g: MgGraph): void {
  memCache = g;
  const s = storage();
  if (!s) return; // no storage ⇒ the graph lives for this session only; stated, not hidden
  g.updatedAt = new Date().toISOString();
  const token = ++saveToken;
  if (vaultStatus().status === "unlocked") {
    // sealed-only persistence: no plaintext copy survives an unlock
    s.removeItem(GRAPH_KEY);
    persistInFlight = (async () => {
      try {
        const r = await vaultSeal(GRAPH_KEY, JSON.stringify(g));
        if (!r.ok && token === saveToken) persistNote = r.error;
        else if (token === saveToken) persistNote = null;
      } catch (e) {
        if (token === saveToken) persistNote = `sealing failed: ${String(e)} — the graph stays in memory this session rather than downgrading to plaintext silently`;
      }
    })();
    return;
  }
  persistNote = null;
  try { s.setItem(GRAPH_KEY, JSON.stringify(g)); } catch { /* quota — keep memory copy */ }
}

/**
 * 19.7.1 — hydrate a sealed graph after the vault is unlocked (call this
 * from the console whenever the passphrase changes). Honest returns:
 * `locked` when the store is sealed and the vault is not, `loaded` when
 * the in-memory graph now reflects storage.
 */
export async function hydrateGraph(): Promise<{ sealed: boolean; locked: boolean; loaded: boolean }> {
  const s = storage();
  const raw = s?.getItem(GRAPH_KEY) ?? null;
  if (!isSealedEnvelope(raw)) {
    lockedAtBoot = false;
    loadGraph();
    return { sealed: false, locked: false, loaded: true };
  }
  const r = await vaultDecrypt(GRAPH_KEY);
  if (!r.found) return { sealed: true, locked: false, loaded: false };
  if (r.locked) { lockedAtBoot = true; return { sealed: true, locked: true, loaded: false }; }
  try {
    const parsed = JSON.parse(r.text) as MgGraph;
    if (parsed && parsed.version === 1) { memCache = parsed; lockedAtBoot = false; return { sealed: true, locked: false, loaded: true }; }
  } catch { /* a sealed record that decrypts to junk is treated as absent — stated via loaded:false */ }
  return { sealed: true, locked: false, loaded: false };
}

export type GraphSecurityMode = "plaintext" | "sealed" | "locked";

export function graphSecurityStatus(): { mode: GraphSecurityMode; enabled: boolean; note: string | null } {
  const vs = vaultStatus().status;
  const s = storage();
  const sealedOnDisk = isSealedEnvelope(s?.getItem(GRAPH_KEY) ?? null);
  const mode: GraphSecurityMode = sealedOnDisk ? (vs === "unlocked" ? "sealed" : "locked") : "plaintext";
  const bootNote = lockedAtBoot && mode !== "sealed" ? "this graph is sealed on disk and stays hidden until the vault is unlocked" : null;
  return { mode, enabled: memoryEnabled(), note: persistNote ?? bootNote };
}

/* ── the user-controlled memory switch (19.7.1) ─────────────────────────── */
export function memoryEnabled(): boolean {
  const s = storage();
  if (!s) return true; // no store ⇒ nothing persists anyway
  return s.getItem(ENABLED_KEY) !== "off";
}

export function setMemoryEnabled(on: boolean): void {
  const s = storage();
  if (!s) return;
  s.setItem(ENABLED_KEY, on ? "on" : "off");
}

/** The live graph (memory copy when storage is unavailable). */
export function graph(): MgGraph {
  return loadGraph();
}

/** Title a session from its first user message — deterministic. */
export function titleFromMessages(messages: MgMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.text ?? messages[0]?.text ?? "a conversation";
  const t = first.replace(/\s+/g, " ").trim();
  return t.length > 52 ? `${t.slice(0, 49)}…` : t || "a conversation";
}

/**
 * Upsert a conversation as a session and merge its keywords into the graph.
 * Same id ⇒ the session is replaced (a growing chat keeps updating itself)
 * and the graph merge is idempotent per session (sessionIds are set-merged).
 */
export function ingestSession(messages: MgMessage[], opts: { id: string; title?: string; startedAt?: string; endedAt?: string } ): MgSession {
  if (!memoryEnabled()) {
    // the switch is the user's: memory OFF means nothing is learned or stored — stated by graphSecurityStatus()
    return {
      id: opts.id, title: opts.title ?? "memory off", startedAt: opts.startedAt ?? "", endedAt: opts.endedAt ?? "",
      messageCount: messages.length, keywords: [], digest: "memory-off", messages: [],
    };
  }
  const texts = messages.map((m) => m.text).join("\n");
  const keywords = extractKeywords(texts, 10);
  const session: MgSession = {
    id: opts.id,
    title: opts.title ?? titleFromMessages(messages),
    startedAt: opts.startedAt ?? messages[0]?.at ?? new Date().toISOString(),
    endedAt: opts.endedAt ?? messages[messages.length - 1]?.at ?? new Date().toISOString(),
    messageCount: messages.length,
    keywords,
    digest: hash(texts),
    messages: messages.slice(-MSG_CAP_PER_SESSION),
  };
  const g = loadGraph();
  const prev = g.sessions.find((x) => x.id === session.id);
  g.sessions = g.sessions.filter((x) => x.id !== session.id);
  g.sessions.push(session);
  if (g.sessions.length > SESSION_CAP) g.sessions.splice(0, g.sessions.length - SESSION_CAP);

  // keyword co-occurrence edges within the session (complete graph on the keywords, capped)
  const kw = session.keywords;
  for (const k of kw) {
    const n = g.nodes.find((x) => x.id === k);
    if (n) {
      // idempotent per session: a session re-upsert adds no weight twice
      n.weight += prev && n.sessionIds.includes(session.id) ? 0 : 1;
      n.lastSeen = session.endedAt;
      if (!n.sessionIds.includes(session.id)) n.sessionIds.push(session.id);
    } else {
      g.nodes.push({ id: k, label: k, weight: 1, firstSeen: session.endedAt, lastSeen: session.endedAt, sessionIds: [session.id] });
    }
  }
  for (let i = 0; i < kw.length; i++) {
    for (let j = i + 1; j < kw.length; j++) {
      const [a, b] = kw[i] < kw[j] ? [kw[i], kw[j]] : [kw[j], kw[i]];
      const e = g.edges.find((x) => x.a === a && x.b === b);
      if (e) {
        e.weight += prev && e.sessionIds.includes(session.id) ? 0 : 1;
        if (!e.sessionIds.includes(session.id)) e.sessionIds.push(session.id);
      } else {
        g.edges.push({ a, b, weight: 1, sessionIds: [session.id] });
      }
    }
  }
  // evict weakest/oldest beyond caps
  if (g.nodes.length > NODE_CAP) g.nodes = g.nodes.sort((x, y) => (y.weight - x.weight) || (y.lastSeen < x.lastSeen ? -1 : 1)).slice(0, NODE_CAP);
  if (g.edges.length > EDGE_CAP) g.edges = g.edges.sort((x, y) => (y.weight - x.weight) || 0).slice(0, EDGE_CAP);
  saveGraph(g);
  return session;
}

export function listSessions(): MgSession[] {
  return loadGraph().sessions.slice().sort((a, b) => (a.endedAt < b.endedAt ? 1 : -1));
}

export function getSession(id: string): MgSession | null {
  return loadGraph().sessions.find((s) => s.id === id) ?? null;
}

export function deleteSession(id: string): void {
  if (!memoryEnabled()) return;
  const g = loadGraph();
  g.sessions = g.sessions.filter((s) => s.id !== id);
  for (const n of g.nodes) n.sessionIds = n.sessionIds.filter((x) => x !== id);
  for (const e of g.edges) e.sessionIds = e.sessionIds.filter((x) => x !== id);
  saveGraph(g);
}

export function clearGraph(): void {
  const s = storage();
  if (s) { s.removeItem(GRAPH_KEY); s.removeItem(ENABLED_KEY); }
  memCache = null;
  lockedAtBoot = false;
  persistNote = null;
}

/* ── date parsing for "that day when X" recall ──────────────────────────── */

export interface Recalled { session: MgSession; score: number; matchedKeywords: string[]; dateMatch: boolean }

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Parse a query's date window. Returns [startMs, endMs] or null. Deterministic, UTC-day based. */
export function parseDateWindow(query: string, now: () => Date = () => new Date()): [number, number] | null {
  const q = query.toLowerCase();
  const day = 24 * 3600 * 1000;
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const n = now();
  const todayStart = startOfDay(n);

  const rel = /(\d+)\s*(day|days|week|weeks|month|months)\s+ago/.exec(q);
  if (rel) {
    const span = Number(rel[1]);
    const unit = rel[2].startsWith("week") ? 7 * day : rel[2].startsWith("month") ? 30 * day : day;
    const end = todayStart + day;
    return [todayStart - span * unit, end];
  }
  if (/\byesterday\b/.test(q)) return [todayStart - day, todayStart];
  if (/\btoday\b/.test(q)) return [todayStart, todayStart + day];
  if (/\blast\s+week\b/.test(q)) return [todayStart - 7 * day, todayStart + day];
  if (/\blast\s+month\b/.test(q)) return [todayStart - 30 * day, todayStart + day];
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(q);
  if (iso) {
    const t = Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return [t, t + day];
  }
  // "on 12 march", "march 12", "12 march 2026"
  const dmy = /(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*(?:\s+(\d{4}))?/.exec(q);
  const myd = /([a-z]{3})[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/.exec(q);
  const m = dmy ?? myd;
  if (m) {
    const dayN = dmy ? Number(m[1]) : Number(m[2]);
    const monStr = dmy ? m[2] : m[1];
    const mon = MONTHS.indexOf(monStr.slice(0, 3));
    if (mon >= 0 && dayN >= 1 && dayN <= 31) {
      const year = Number(m[3] ?? n.getUTCFullYear());
      const t = Date.UTC(year, mon, dayN);
      return [t, t + day];
    }
  }
  return null;
}

/**
 * Recall sessions by a natural query: keyword overlap on the session's own
 * keywords (and its messages' text), plus a date window when one parses.
 * A date-only query ranks by recency inside the window; a keyword-only
 * query by overlap × node weight. Honest: no match ⇒ [].
 */
export function recall(query: string, limit = 5, now: () => Date = () => new Date()): Recalled[] {
  const g = loadGraph();
  if (g.sessions.length === 0) return [];
  const qk = extractKeywords(query, 10);
  const win = parseDateWindow(query, now);
  const weightOf = new Map(g.nodes.map((n) => [n.id, n.weight]));
  const out: Recalled[] = [];
  for (const s of g.sessions) {
    const sKeys = new Set(s.keywords);
    const matched = qk.filter((k) => sKeys.has(k) || s.messages.some((msg) => msg.text.toLowerCase().includes(k)));
    let score = matched.reduce((acc, k) => acc + 1 + Math.min(2, (weightOf.get(k) ?? 1) / 10), 0);
    const inWin = win ? Date.parse(s.startedAt) >= win[0] && Date.parse(s.startedAt) < win[1] : false;
    if (win) score += inWin ? 2.5 : -1.5; // a date query that misses the window demotes hard
    if (score <= 0) continue;
    out.push({ session: s, score, matchedKeywords: matched, dateMatch: inWin });
  }
  out.sort((a, b) => b.score - a.score || (a.session.endedAt < b.session.endedAt ? 1 : -1));
  return out.slice(0, limit);
}

/** The marker that rides every rehydrated prompt — rehydration is never silent. */
export const REHYDRATION_MARK = "── rehydrated context (from an earlier conversation";

/**
 * Build the rehydration preamble for a session: title, dates, keywords and
 * the most recent turns, trimmed. This text is PREPENDED to the user's new
 * message and marked, so the whole crew sees it as context, not as a claim.
 */
export function rehydrate(sessionId: string, maxTurns = 8, perMessageCap = 240): { preamble: string; session: MgSession } | null {
  const s = getSession(sessionId);
  if (!s) return null;
  const turns = s.messages.slice(-maxTurns);
  const lines: string[] = [];
  lines.push(`${REHYDRATION_MARK} "${s.title}") ──`);
  lines.push(`took place ${s.startedAt.slice(0, 10)} → ${s.endedAt.slice(0, 10)} · ${s.messageCount} message(s) · keywords: ${s.keywords.join(", ")}`);
  lines.push("prior exchange (most recent last, trimmed):");
  for (const m of turns) {
    const who = m.role === "user" ? "user" : "steward";
    const t = m.text.replace(/\s+/g, " ").trim();
    lines.push(`${who}: ${t.length > perMessageCap ? `${t.slice(0, perMessageCap - 1)}…` : t}`);
  }
  lines.push("── end of rehydrated context — continue naturally from the user's new message below ──");
  return { preamble: lines.join("\n"), session: s };
}

/** What the Memory Graphs panel renders: top-weighted nodes + their edges. */
export function graphView(maxNodes = 24): { nodes: MgNode[]; edges: MgEdge[] } {
  const g = loadGraph();
  const nodes = g.nodes.slice().sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id)).slice(0, maxNodes);
  const ids = new Set(nodes.map((n) => n.id));
  const edges = g.edges.filter((e) => ids.has(e.a) && ids.has(e.b)).slice(0, 80);
  return { nodes, edges };
}

/** Cheap stats line for the UI. */
export function graphStats(): { sessions: number; nodes: number; edges: number } {
  const g = loadGraph();
  return { sessions: g.sessions.length, nodes: g.nodes.length, edges: g.edges.length };
}

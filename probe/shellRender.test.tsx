/**
 * Renders the 19.7.12 shell to a string, in node, and checks what it actually says.
 *
 * Successor to probe/v10Page.test.tsx (which rendered the retired Proof page). The
 * reason is unchanged: `tsc --noEmit` proves types line up; it does not prove the
 * screen renders. A bad lookup or a `.map` over `undefined` type-checks perfectly
 * and then blanks the screen behind an error boundary. So this renders the REAL
 * shell and every door through `react-dom/server` and asserts on the output —
 * with no localStorage, no WebGL, no provider: the coldest first run there is.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

let passed = 0;
let failed = 0;
const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed += 1; console.log(`  ok   ${label}`); }
  else { failed += 1; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
function section(name: string): void { console.log(`\n== ${name}`); }
const strip = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ");

// Minimal DOM shims the store touches at module-evaluation time (theme boot).
const g = globalThis as unknown as { document?: unknown; window?: unknown; ResizeObserver?: unknown; MutationObserver?: unknown };
if (!g.document) {
  g.document = { documentElement: { dataset: {}, style: {} }, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), head: { appendChild() {} }, fonts: [] };
}

async function main(): Promise<void> {
  const { Shell } = await import("../src/ui/Shell");
  const { useVh } = await import("../src/ui/store");
  const { Steward } = await import("../src/ui/screens/Steward");
  const { Work } = await import("../src/ui/screens/Work");
  const { Receipts } = await import("../src/ui/screens/Receipts");
  const { Memory } = await import("../src/ui/screens/Memory");
  const { Settings } = await import("../src/ui/screens/Settings");
  const { Chat } = await import("../src/ui/screens/Chat");

  section("0. the shell renders cold (no storage, no provider, no WebGL)");
  let html = "";
  try { html = renderToStaticMarkup(createElement(Shell)); }
  catch (err) { ok("Shell renders without throwing", false, err instanceof Error ? err.message : String(err)); }
  ok("Shell renders without throwing", html.length > 1000, `${html.length} bytes`);
  const text = strip(html);
  ok("the five doors are on screen", ["Steward", "Work", "Receipts", "Memory", "Settings"].every((d) => text.includes(d)), text.slice(0, 200));
  ok("the hero asks the one question", /How can I help you today\s*\?/.test(text), "hero missing");
  ok("it is honest about plan-only without a provider", /plan only|Plan-only/i.test(text) && /Nothing executes yet/.test(text), "no plan-only statement");
  ok("no version number on the primary surface", !/\b19\.\d+\.\d+/.test(text), (text.match(/\b19\.\d+\.\d+/) ?? [""])[0]);
  ok("no agent name leaks (Generalist / specialist ids)", !/Generalist|business\.|code\./.test(text), "internal names leaked");
  ok("no boot splash, no keyboard-shortcut hints", !/vh-boot|⌘K|⌘N/.test(html), "leftover chrome");

  section("1. every door renders on its own, empty");
  for (const [name, C] of [["Steward", Steward], ["Work", Work], ["Receipts", Receipts], ["Memory", Memory], ["Settings", Settings]] as const) {
    let h = ""; let err = "";
    try { h = renderToStaticMarkup(createElement(C as () => JSX.Element)); } catch (e) { err = e instanceof Error ? e.message : String(e); }
    ok(`${name} renders without throwing`, h.length > 200 && !err, err || `${h.length} bytes`);
  }
  let chatHtml = ""; try { chatHtml = renderToStaticMarkup(createElement(Chat, { title: "Steward" })); } catch (e) { chatHtml = ""; }
  ok("Chat renders empty without throwing", chatHtml.length > 200 && /Nothing here yet/.test(strip(chatHtml)));

  section("2. the empty states say the truth, not a loading spinner");
  const work = strip(renderToStaticMarkup(createElement(Work)));
  ok("Work: 'No work yet' — not a spinner, not fake nodes", /No work yet/.test(work) && !/spinner|loading/i.test(work));
  const receipts = strip(renderToStaticMarkup(createElement(Receipts)));
  ok("Receipts: KPI strip renders zeros, not blanks", /0 Verified/.test(receipts) && /No receipts yet/.test(receipts));
  const memory = strip(renderToStaticMarkup(createElement(Memory)));
  ok("Memory: names where memory lives (on device)", /Nothing remembered yet|Memory is off/.test(memory) && /this device/.test(memory));

  section("3. state moves the surface — a gate renders as a decision, never a silent skip");
  // zustand v5 serves the store's INITIAL snapshot to react-dom/server (useSyncExternalStore
  // getServerSnapshot), so a setState() cannot be observed through SSR of a connected screen.
  // The gate is therefore pinned two ways: (a) the store's own transition and resolution,
  // (b) the Work door's source guard — a pending gate MUST defeat the empty state (the render
  // probe caught exactly this on first run: gate before any reply rendered "No work yet").
  let resolved: unknown = null;
  useVh.setState({ gate: { ask: { action: "delete branch", riskTier: "risky", specialistIds: ["x"], summary: "Remove the stale release branch." }, resolve: (d) => { resolved = d; }, askedAt: new Date().toISOString() }, busy: true });
  ok("a pending gate is visible in the store", useVh.getState().gate?.ask.action === "delete branch");
  const fs = await import("node:fs"); const path = await import("node:path");
  const workSrc = fs.readFileSync(path.join(process.cwd(), "src/ui/screens/Work.tsx"), "utf8");
  ok("Work never shows the empty state while a gate is pending", /\{!lastResp && !busy && !gate \? \(/.test(workSrc), "empty-state guard must include !gate");
  ok("Work floats the GateCard over the graph", /gate && <div className="gate-float"><GateCard \/><\/div>/.test(workSrc));
  useVh.getState().decideGate({ approved: false, reason: "not now" });
  ok("refusing resolves the engine's promise with the reason", JSON.stringify(resolved) === JSON.stringify({ approved: false, reason: "not now" }), JSON.stringify(resolved));
  ok("the gate is cleared after the decision", useVh.getState().gate === null);
  ok("a second decision is a no-op, never a double resolve", (() => { resolved = null; useVh.getState().decideGate({ approved: true }); return resolved === null; })());

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) { console.log("\nfailures:"); for (const f of failures) console.log(`  - ${f}`); }
  process.exit(failed > 0 ? 1 : 0);
}
void main();

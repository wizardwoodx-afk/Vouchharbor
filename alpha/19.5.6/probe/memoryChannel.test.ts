/**
 * memoryChannel.test.ts — probe for the Memory Channel.
 * Zero dependencies, injected clock, no network.
 */

import {
  MemoryError,
  SCOPE_TRUST_WEIGHT,
  assembleContext,
  asOf,
  estimateTokens,
  health,
  looksLikeSecret,
  recall,
  writeFact,
  type MemoryFact,
} from '../src/memory/channel';

export interface Check { readonly name: string; readonly ok: boolean; readonly detail?: string; }
export interface ProbeResult { readonly passed: number; readonly failed: number; readonly checks: readonly Check[]; }

const T1 = '2026-03-01T00:00:00.000Z';
const T2 = '2026-06-01T00:00:00.000Z';
const NOW = '2026-09-18T09:00:00.000Z';

export async function runMemoryChannelProbe(): Promise<ProbeResult> {
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: string): void => {
    checks.push(detail === undefined ? { name, ok } : { name, ok, detail });
  };
  const throws = (name: string, fn: () => unknown): void => {
    try { fn(); check(name, false, 'expected a throw, none happened'); } catch { check(name, true); }
  };

  let session: MemoryFact[] = [];

  /* 1. scope discipline */
  const run = writeFact(session, { scope: 'run', scopeKey: 'mission-1', key: 'goal', value: 'reconcile settlement', atIso: T1, source: 'teammate' });
  session = run.facts;
  check('a run-scope fact is accepted', session.length === 1);
  check('the fact is live', session[0]?.validToIso === undefined);
  check('the fact keeps its scope', session[0]?.scope === 'run');

  const user = writeFact(session, { scope: 'user', scopeKey: 'alice', key: 'preference.tone', value: 'blunt and short', atIso: T1, source: 'accept/reject ledger' });
  session = user.facts;
  check('a user-scope fact is accepted', session.length === 2);

  throws('pair scope requires evidence', () =>
    writeFact(session, { scope: 'pair', scopeKey: 'pair:a<->b', key: 'agreed.currency', value: 'EUR', atIso: T1, source: 'bridge' }));
  throws('org scope requires evidence', () =>
    writeFact(session, { scope: 'org', scopeKey: 'acme', key: 'policy.retention', value: '180d', atIso: T1, source: 'admin' }));

  const pairFact = writeFact(session, {
    scope: 'pair', scopeKey: 'pair:alice<->bob', key: 'agreed.currency', value: 'EUR',
    atIso: T1, source: 'bridge crossing brg_1', evidenceRef: 'vh-bridge-joint-receipt/1:brg_1',
  });
  session = pairFact.facts;
  check('pair scope with evidence is accepted', session.some((f) => f.scope === 'pair'));
  check('the evidence reference is kept', session.find((f) => f.scope === 'pair')?.evidenceRef?.includes('brg_1') === true);

  throws('an unknown scope is refused', () =>
    writeFact(session, { scope: 'galaxy' as 'user', scopeKey: 'x', key: 'k', value: 'v', atIso: T1, source: 's' }));
  throws('a scope without a key is refused', () =>
    writeFact(session, { scope: 'user', scopeKey: '  ', key: 'k', value: 'v', atIso: T1, source: 's' }));
  throws('an empty value is refused', () =>
    writeFact(session, { scope: 'user', scopeKey: 'alice', key: 'k', value: '   ', atIso: T1, source: 's' }));
  throws('confidence outside 0..1 is refused', () =>
    writeFact(session, { scope: 'user', scopeKey: 'alice', key: 'k', value: 'v', atIso: T1, source: 's', confidence: 1.4 }));
  check('MemoryError is identifiable', (() => {
    try { writeFact(session, { scope: 'user', scopeKey: '  ', key: 'k', value: 'v', atIso: T1, source: 's' }); return false; }
    catch (e) { return e instanceof MemoryError; }
  })());

  /* 2. supersession: nothing is deleted, history stays answerable */
  const second = writeFact(session, {
    scope: 'user', scopeKey: 'alice', key: 'preference.tone', value: 'warm but concise', atIso: T2,
    source: 'accept/reject ledger', confidence: 0.9,
  });
  session = second.facts;
  check('a repeat key supersedes rather than duplicating', session.length === 4);
  check('the supersession is reported', second.superseded !== undefined);

  const liveNow = recall(session, { scope: 'user', scopeKey: 'alice', liveOnly: true });
  check('only one live fact remains for the key', liveNow.length === 1);
  check('the live fact is the newer value', liveNow[0]?.value === 'warm but concise');

  const inMarch = asOf(session, { scope: 'user', scopeKey: 'alice' }, '2026-04-01T00:00:00.000Z');
  check('the March value is still answerable', inMarch[0]?.value === 'blunt and short');
  check('the March view does not show the June value', !inMarch.some((f) => f.value === 'warm but concise'));

  const inJune = asOf(session, { scope: 'user', scopeKey: 'alice' }, '2026-07-01T00:00:00.000Z');
  check('the June view shows the newer value', inJune[0]?.value === 'warm but concise');

  const superseded = session.find((f) => f.supersededBy !== undefined);
  check('the superseded fact is kept, not deleted', superseded !== undefined);
  check('the superseded fact points forward', superseded?.supersededBy?.startsWith('mem_') === true);
  check('the superseded fact is closed at the supersession instant', superseded?.validToIso === T2);

  /* 3. key prefix queries */
  session = writeFact(session, { scope: 'user', scopeKey: 'alice', key: 'preference.format', value: 'tables over prose', atIso: T2, source: 'accept/reject ledger' }).facts;
  const prefixed = recall(session, { scope: 'user', scopeKey: 'alice', liveOnly: true, keyPrefix: 'preference.' });
  check('prefix recall returns both preferences', prefixed.length === 2);
  check('prefix recall excludes unrelated keys', !prefixed.some((f) => f.key === 'goal'));

  /* 4. cross-scope isolation */
  check('a user fact is not visible at run scope', recall(session, { scope: 'run', scopeKey: 'alice', liveOnly: true }).length === 0);
  check('the run fact stays with its own key', recall(session, { scope: 'run', scopeKey: 'mission-1', liveOnly: true }).length === 1);

  /* 5. the secret guard */
  check('an API-key shape is recognised', looksLikeSecret('sk-abcdefghijklmnop1234'));
  check('a PEM header is recognised', looksLikeSecret('-----BEGIN RSA PRIVATE KEY-----'));
  check('a 16-digit number is recognised', looksLikeSecret('4111111111111111'));
  check('an api_key assignment is recognised', looksLikeSecret('api_key: abcdefgh12345'));
  check('ordinary prose is not flagged', !looksLikeSecret('reconcile the settlement memo against the ledger'));

  const withSecret = writeFact(session, {
    scope: 'run', scopeKey: 'mission-1', key: 'leaked.token', value: 'sk-abcdefghijklmnop1234', atIso: T2, source: 'tool output',
  }).facts;
  const channelWithSecret = assembleContext(withSecret, {
    scopes: [{ scope: 'run', scopeKey: 'mission-1' }], budgetTokens: 2000,
  }, NOW);
  check('a fact that looks like a credential never reaches the channel', !JSON.stringify(channelWithSecret).includes('sk-abcdefghijklmnop1234'));

  /* 6. the channel: priority, budget, and marked cuts */
  const wide: MemoryFact[] = [];
  let acc: MemoryFact[] = [];
  for (let i = 0; i < 12; i += 1) {
    acc = writeFact(acc, {
      scope: i % 2 === 0 ? 'user' : 'run', scopeKey: i % 2 === 0 ? 'alice' : 'mission-1',
      key: `topic.${String(i).padStart(2, '0')}`,
      value: `a deliberately long value for topic ${i} so the token arithmetic is exercised properly`,
      atIso: NOW, source: 'probe',
    }).facts;
  }
  wide.push(...acc);

  const roomy = assembleContext(wide, { scopes: [{ scope: 'user', scopeKey: 'alice' }, { scope: 'run', scopeKey: 'mission-1' }], budgetTokens: 4000 }, NOW);
  check('a roomy budget includes everything live', roomy.droppedCount === 0);
  check('cuts are empty when nothing was dropped', roomy.cuts.length === 0);
  check('the channel reports what it used', roomy.tokensUsed > 0 && roomy.tokensUsed <= roomy.budgetTokens);
  check('narrower scope sorts first', roomy.blocks[0]?.scope === 'run');

  const tight = assembleContext(wide, { scopes: [{ scope: 'user', scopeKey: 'alice' }, { scope: 'run', scopeKey: 'mission-1' }], budgetTokens: 120 }, NOW);
  check('a tight budget drops facts', tight.droppedCount > 0);
  check('the cuts are marked, never silent', tight.cuts.length > 0);
  check('the first cut explains the budget', tight.cuts[0]?.includes('never silent') === true);
  check('a cut names the fact it dropped', tight.cuts.some((c) => c.includes('dropped topic.')));
  check('the channel never exceeds its budget', tight.tokensUsed <= tight.budgetTokens);

  const pinnedId = wide.find((f) => f.scope === 'user')?.id;
  const pinned = assembleContext(wide, {
    scopes: [{ scope: 'user', scopeKey: 'alice' }, { scope: 'run', scopeKey: 'mission-1' }],
    budgetTokens: 120,
    pinned: pinnedId === undefined ? [] : [pinnedId],
  }, NOW);
  check('a pinned fact survives a tight budget', pinnedId !== undefined && JSON.stringify(pinned).includes(pinnedId === undefined ? 'x' : (wide.find((f) => f.id === pinnedId)?.key ?? 'x')));

  check('token estimate is roughly four characters', estimateTokens('abcd') === 1 && estimateTokens('a'.repeat(40)) === 10);
  check('scope weights rank narrow above wide', SCOPE_TRUST_WEIGHT.run > SCOPE_TRUST_WEIGHT.org);

  /* 7. health speaks plainly */
  const h = health(session);
  check('health counts live and superseded', h.live + h.superseded === h.totalFacts);
  check('health counts pair and org facts', h.byScope.pair >= 1);
  check('health states the evidence rule', h.statement.includes('evidence'));

  const passed = checks.filter((c) => c.ok).length;
  return { passed, failed: checks.length - passed, checks };
}

/**
 * Minimal local typing of `process`. Declared here rather than pulled from
 * @types/node so a probe compiles in a runtime that has no Node types installed —
 * which is exactly the situation a zipped archive is opened in.
 */
declare const process: { readonly argv?: readonly string[]; exitCode?: number } | undefined;

const invokedDirectly =
  typeof process !== 'undefined' && Array.isArray(process?.argv) &&
  /memoryChannel\.test(\.(ts|tsx|js|mjs))?$/.test(process?.argv?.[1] ?? '');

if (invokedDirectly) {
  void runMemoryChannelProbe().then((r) => {
    for (const c of r.checks) if (!c.ok) console.log(`  FAIL  ${c.name}${c.detail === undefined ? '' : ` — ${c.detail}`}`);
    console.log(`memoryChannel probe: ${r.passed} passed, ${r.failed} failed`);
    if (r.failed > 0 && process !== undefined) process.exitCode = 1;
  });
}

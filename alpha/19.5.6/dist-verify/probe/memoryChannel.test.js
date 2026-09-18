"use strict";
/**
 * memoryChannel.test.ts — probe for the Memory Channel.
 * Zero dependencies, injected clock, no network.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMemoryChannelProbe = runMemoryChannelProbe;
const channel_1 = require("../src/memory/channel");
const T1 = '2026-03-01T00:00:00.000Z';
const T2 = '2026-06-01T00:00:00.000Z';
const NOW = '2026-09-18T09:00:00.000Z';
async function runMemoryChannelProbe() {
    const checks = [];
    const check = (name, ok, detail) => {
        checks.push(detail === undefined ? { name, ok } : { name, ok, detail });
    };
    const throws = (name, fn) => {
        try {
            fn();
            check(name, false, 'expected a throw, none happened');
        }
        catch {
            check(name, true);
        }
    };
    let session = [];
    /* 1. scope discipline */
    const run = (0, channel_1.writeFact)(session, { scope: 'run', scopeKey: 'mission-1', key: 'goal', value: 'reconcile settlement', atIso: T1, source: 'teammate' });
    session = run.facts;
    check('a run-scope fact is accepted', session.length === 1);
    check('the fact is live', session[0]?.validToIso === undefined);
    check('the fact keeps its scope', session[0]?.scope === 'run');
    const user = (0, channel_1.writeFact)(session, { scope: 'user', scopeKey: 'alice', key: 'preference.tone', value: 'blunt and short', atIso: T1, source: 'accept/reject ledger' });
    session = user.facts;
    check('a user-scope fact is accepted', session.length === 2);
    throws('pair scope requires evidence', () => (0, channel_1.writeFact)(session, { scope: 'pair', scopeKey: 'pair:a<->b', key: 'agreed.currency', value: 'EUR', atIso: T1, source: 'bridge' }));
    throws('org scope requires evidence', () => (0, channel_1.writeFact)(session, { scope: 'org', scopeKey: 'acme', key: 'policy.retention', value: '180d', atIso: T1, source: 'admin' }));
    const pairFact = (0, channel_1.writeFact)(session, {
        scope: 'pair', scopeKey: 'pair:alice<->bob', key: 'agreed.currency', value: 'EUR',
        atIso: T1, source: 'bridge crossing brg_1', evidenceRef: 'vh-bridge-joint-receipt/1:brg_1',
    });
    session = pairFact.facts;
    check('pair scope with evidence is accepted', session.some((f) => f.scope === 'pair'));
    check('the evidence reference is kept', session.find((f) => f.scope === 'pair')?.evidenceRef?.includes('brg_1') === true);
    throws('an unknown scope is refused', () => (0, channel_1.writeFact)(session, { scope: 'galaxy', scopeKey: 'x', key: 'k', value: 'v', atIso: T1, source: 's' }));
    throws('a scope without a key is refused', () => (0, channel_1.writeFact)(session, { scope: 'user', scopeKey: '  ', key: 'k', value: 'v', atIso: T1, source: 's' }));
    throws('an empty value is refused', () => (0, channel_1.writeFact)(session, { scope: 'user', scopeKey: 'alice', key: 'k', value: '   ', atIso: T1, source: 's' }));
    throws('confidence outside 0..1 is refused', () => (0, channel_1.writeFact)(session, { scope: 'user', scopeKey: 'alice', key: 'k', value: 'v', atIso: T1, source: 's', confidence: 1.4 }));
    check('MemoryError is identifiable', (() => {
        try {
            (0, channel_1.writeFact)(session, { scope: 'user', scopeKey: '  ', key: 'k', value: 'v', atIso: T1, source: 's' });
            return false;
        }
        catch (e) {
            return e instanceof channel_1.MemoryError;
        }
    })());
    /* 2. supersession: nothing is deleted, history stays answerable */
    const second = (0, channel_1.writeFact)(session, {
        scope: 'user', scopeKey: 'alice', key: 'preference.tone', value: 'warm but concise', atIso: T2,
        source: 'accept/reject ledger', confidence: 0.9,
    });
    session = second.facts;
    check('a repeat key supersedes rather than duplicating', session.length === 4);
    check('the supersession is reported', second.superseded !== undefined);
    const liveNow = (0, channel_1.recall)(session, { scope: 'user', scopeKey: 'alice', liveOnly: true });
    check('only one live fact remains for the key', liveNow.length === 1);
    check('the live fact is the newer value', liveNow[0]?.value === 'warm but concise');
    const inMarch = (0, channel_1.asOf)(session, { scope: 'user', scopeKey: 'alice' }, '2026-04-01T00:00:00.000Z');
    check('the March value is still answerable', inMarch[0]?.value === 'blunt and short');
    check('the March view does not show the June value', !inMarch.some((f) => f.value === 'warm but concise'));
    const inJune = (0, channel_1.asOf)(session, { scope: 'user', scopeKey: 'alice' }, '2026-07-01T00:00:00.000Z');
    check('the June view shows the newer value', inJune[0]?.value === 'warm but concise');
    const superseded = session.find((f) => f.supersededBy !== undefined);
    check('the superseded fact is kept, not deleted', superseded !== undefined);
    check('the superseded fact points forward', superseded?.supersededBy?.startsWith('mem_') === true);
    check('the superseded fact is closed at the supersession instant', superseded?.validToIso === T2);
    /* 3. key prefix queries */
    session = (0, channel_1.writeFact)(session, { scope: 'user', scopeKey: 'alice', key: 'preference.format', value: 'tables over prose', atIso: T2, source: 'accept/reject ledger' }).facts;
    const prefixed = (0, channel_1.recall)(session, { scope: 'user', scopeKey: 'alice', liveOnly: true, keyPrefix: 'preference.' });
    check('prefix recall returns both preferences', prefixed.length === 2);
    check('prefix recall excludes unrelated keys', !prefixed.some((f) => f.key === 'goal'));
    /* 4. cross-scope isolation */
    check('a user fact is not visible at run scope', (0, channel_1.recall)(session, { scope: 'run', scopeKey: 'alice', liveOnly: true }).length === 0);
    check('the run fact stays with its own key', (0, channel_1.recall)(session, { scope: 'run', scopeKey: 'mission-1', liveOnly: true }).length === 1);
    /* 5. the secret guard */
    check('an API-key shape is recognised', (0, channel_1.looksLikeSecret)('sk-abcdefghijklmnop1234'));
    check('a PEM header is recognised', (0, channel_1.looksLikeSecret)('-----BEGIN RSA PRIVATE KEY-----'));
    check('a 16-digit number is recognised', (0, channel_1.looksLikeSecret)('4111111111111111'));
    check('an api_key assignment is recognised', (0, channel_1.looksLikeSecret)('api_key: abcdefgh12345'));
    check('ordinary prose is not flagged', !(0, channel_1.looksLikeSecret)('reconcile the settlement memo against the ledger'));
    const withSecret = (0, channel_1.writeFact)(session, {
        scope: 'run', scopeKey: 'mission-1', key: 'leaked.token', value: 'sk-abcdefghijklmnop1234', atIso: T2, source: 'tool output',
    }).facts;
    const channelWithSecret = (0, channel_1.assembleContext)(withSecret, {
        scopes: [{ scope: 'run', scopeKey: 'mission-1' }], budgetTokens: 2000,
    }, NOW);
    check('a fact that looks like a credential never reaches the channel', !JSON.stringify(channelWithSecret).includes('sk-abcdefghijklmnop1234'));
    /* 6. the channel: priority, budget, and marked cuts */
    const wide = [];
    let acc = [];
    for (let i = 0; i < 12; i += 1) {
        acc = (0, channel_1.writeFact)(acc, {
            scope: i % 2 === 0 ? 'user' : 'run', scopeKey: i % 2 === 0 ? 'alice' : 'mission-1',
            key: `topic.${String(i).padStart(2, '0')}`,
            value: `a deliberately long value for topic ${i} so the token arithmetic is exercised properly`,
            atIso: NOW, source: 'probe',
        }).facts;
    }
    wide.push(...acc);
    const roomy = (0, channel_1.assembleContext)(wide, { scopes: [{ scope: 'user', scopeKey: 'alice' }, { scope: 'run', scopeKey: 'mission-1' }], budgetTokens: 4000 }, NOW);
    check('a roomy budget includes everything live', roomy.droppedCount === 0);
    check('cuts are empty when nothing was dropped', roomy.cuts.length === 0);
    check('the channel reports what it used', roomy.tokensUsed > 0 && roomy.tokensUsed <= roomy.budgetTokens);
    check('narrower scope sorts first', roomy.blocks[0]?.scope === 'run');
    const tight = (0, channel_1.assembleContext)(wide, { scopes: [{ scope: 'user', scopeKey: 'alice' }, { scope: 'run', scopeKey: 'mission-1' }], budgetTokens: 120 }, NOW);
    check('a tight budget drops facts', tight.droppedCount > 0);
    check('the cuts are marked, never silent', tight.cuts.length > 0);
    check('the first cut explains the budget', tight.cuts[0]?.includes('never silent') === true);
    check('a cut names the fact it dropped', tight.cuts.some((c) => c.includes('dropped topic.')));
    check('the channel never exceeds its budget', tight.tokensUsed <= tight.budgetTokens);
    const pinnedId = wide.find((f) => f.scope === 'user')?.id;
    const pinned = (0, channel_1.assembleContext)(wide, {
        scopes: [{ scope: 'user', scopeKey: 'alice' }, { scope: 'run', scopeKey: 'mission-1' }],
        budgetTokens: 120,
        pinned: pinnedId === undefined ? [] : [pinnedId],
    }, NOW);
    check('a pinned fact survives a tight budget', pinnedId !== undefined && JSON.stringify(pinned).includes(pinnedId === undefined ? 'x' : (wide.find((f) => f.id === pinnedId)?.key ?? 'x')));
    check('token estimate is roughly four characters', (0, channel_1.estimateTokens)('abcd') === 1 && (0, channel_1.estimateTokens)('a'.repeat(40)) === 10);
    check('scope weights rank narrow above wide', channel_1.SCOPE_TRUST_WEIGHT.run > channel_1.SCOPE_TRUST_WEIGHT.org);
    /* 7. health speaks plainly */
    const h = (0, channel_1.health)(session);
    check('health counts live and superseded', h.live + h.superseded === h.totalFacts);
    check('health counts pair and org facts', h.byScope.pair >= 1);
    check('health states the evidence rule', h.statement.includes('evidence'));
    const passed = checks.filter((c) => c.ok).length;
    return { passed, failed: checks.length - passed, checks };
}
const invokedDirectly = typeof process !== 'undefined' && Array.isArray(process?.argv) &&
    /memoryChannel\.test(\.(ts|tsx|js|mjs))?$/.test(process?.argv?.[1] ?? '');
if (invokedDirectly) {
    void runMemoryChannelProbe().then((r) => {
        for (const c of r.checks)
            if (!c.ok)
                console.log(`  FAIL  ${c.name}${c.detail === undefined ? '' : ` — ${c.detail}`}`);
        console.log(`memoryChannel probe: ${r.passed} passed, ${r.failed} failed`);
        if (r.failed > 0 && process !== undefined)
            process.exitCode = 1;
    });
}

"use strict";
/**
 * policyGate.test.ts — probe for the extracted policy plane, in Vouch Harbor's
 * style: zero dependencies, no network, no real clock (one is injected), and a
 * pass/fail count you can assert on from your probe runner.
 *
 * Wire it in as a NEW probe suite (e.g. `probe/policyGate.test.ts`) and register
 * it in `tools/run-all-probes.mjs`. Never edit an existing probe to make this pass.
 *
 * NOTE: `runPolicyGateProbe()` is async because `governAction()` is async. If your
 * runner is synchronous it will see a Promise and could report a vacuous pass —
 * so wire it as `const { failed } = await runPolicyGateProbe(); assert(failed === 0)`.
 * Running the file directly is also supported: `node policyGate.test.ts` (via your
 * TS loader) prints the counts and sets a non-zero exit code on failure.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPolicyGateProbe = runPolicyGateProbe;
const policyGate_1 = require("../src/governance/policyGate");
const initiator_1 = require("../src/governance/initiator");
async function runPolicyGateProbe() {
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
    const fixedClock = () => new Date('2026-09-18T00:00:00.000Z');
    /* ------------------------- 1. fail-closed basics ------------------------ */
    check('empty policy permits nothing', (0, policyGate_1.decide)(policyGate_1.EMPTY_POLICY, {}).allowed === false);
    check('empty policy reason is empty-policy', (0, policyGate_1.decide)(policyGate_1.EMPTY_POLICY, {}).reason === 'empty-policy');
    const allowAll = (0, policyGate_1.loadPolicy)({ deny: [], allow: ['true'] });
    check('allow ["true"] permits', (0, policyGate_1.decide)(allowAll, { 'tool.name': 'pc.exec' }).allowed === true);
    const nothing = (0, policyGate_1.loadPolicy)({ deny: [], allow: [] });
    check('explicit empty allow denies', (0, policyGate_1.decide)(nothing, {}).allowed === false);
    /* --------------------------- 2. deny precedence ------------------------- */
    const denyWins = (0, policyGate_1.loadPolicy)({ deny: ['contains(tool.name, "rm")'], allow: ['true'] });
    const denied = (0, policyGate_1.decide)(denyWins, { 'tool.name': 'pc.exec rm -rf /tmp/x' });
    check('deny rule beats allow:true', denied.allowed === false);
    check('deny rule reason recorded', denied.reason === 'denied-by-rule');
    check('deny rule source recorded', denied.rule === 'contains(tool.name, "rm")');
    /* ------------------------ 3. case-insensitive calls --------------------- */
    const caseDeny = (0, policyGate_1.loadPolicy)({ deny: ['contains(tool.name, "DELETE")'], allow: ['true'] });
    check('contains() is case-insensitive', (0, policyGate_1.decide)(caseDeny, { 'tool.name': 'pc.fs.delete' }).allowed === false);
    const regexDeny = (0, policyGate_1.loadPolicy)({ deny: ['matches(file.path, "\\.env$")'], allow: ['true'] });
    check('matches() is case-insensitive', (0, policyGate_1.decide)(regexDeny, { 'file.path': '/srv/app/.ENV' }).allowed === false);
    check('matches() does not over-match', (0, policyGate_1.decide)(regexDeny, { 'file.path': '/srv/app/readme.md' }).allowed === true);
    const endsDeny = (0, policyGate_1.loadPolicy)({ deny: ['endsWith(file.name, ".pem")'], allow: ['true'] });
    check('endsWith() works', (0, policyGate_1.decide)(endsDeny, { 'file.name': 'server.PEM' }).allowed === false);
    /* --------------------------- 4. boolean algebra ------------------------- */
    const compound = (0, policyGate_1.loadPolicy)({
        deny: ['contains(tool.name, "shell") && !contains(command, "echo")'],
        allow: ['true'],
    });
    check('&& and ! compose', (0, policyGate_1.decide)(compound, { 'tool.name': 'pc.shell', command: 'ls' }).allowed === false);
    check('negation allows the echo case', (0, policyGate_1.decide)(compound, { 'tool.name': 'pc.shell', command: 'echo hi' }).allowed === true);
    const orRule = (0, policyGate_1.loadPolicy)({
        deny: ['contains(page.url, "bank") || contains(page.url, "wallet")'],
        allow: ['true'],
    });
    check('|| composes', (0, policyGate_1.decide)(orRule, { 'page.url': 'https://wallet.example' }).allowed === false);
    const equality = (0, policyGate_1.loadPolicy)({ allow: ['tool.name == "pc.exec"'] });
    check('equality gates an allow list', (0, policyGate_1.decide)(equality, { 'tool.name': 'pc.exec' }).allowed === true);
    check('equality refuses a non-match', (0, policyGate_1.decide)(equality, { 'tool.name': 'pc.browser.open' }).allowed === false);
    /* ------------------- 5. broken rules fail in the safe direction --------- */
    const brokenAllow = (0, policyGate_1.loadPolicy)({ deny: [], allow: ['contains(typo.field, "x")'] });
    const brokenAllowDecision = (0, policyGate_1.decide)(brokenAllow, { 'tool.name': 'pc.exec' });
    check('broken allow rule does not permit', brokenAllowDecision.allowed === false);
    check('broken allow rule reason', brokenAllowDecision.reason === 'no-matching-allow');
    check('broken allow rule says so in words', (brokenAllowDecision.detail ?? '').includes('does not permit'), brokenAllowDecision.detail);
    const brokenDeny = (0, policyGate_1.loadPolicy)({ deny: ['contains(typo.field, "x")'], allow: ['true'] });
    const brokenDenyDecision = (0, policyGate_1.decide)(brokenDeny, { 'tool.name': 'pc.exec' });
    check('broken deny rule denies', brokenDenyDecision.allowed === false);
    check('broken deny rule reason', brokenDenyDecision.reason === 'evaluation-error');
    /* -------------------- 6. malformed policy refuses to load --------------- */
    throws('malformed rule throws at load', () => (0, policyGate_1.loadPolicy)({ deny: [], allow: ['contains(tool.name'] }));
    throws('unknown function throws at load', () => (0, policyGate_1.loadPolicy)({ deny: [], allow: ['startsWiths(tool.name, "x")'] }));
    throws('non-array rule list throws at load', () => (0, policyGate_1.loadPolicy)({ deny: 'nope', allow: [] }));
    throws('non-string rule throws at load', () => (0, policyGate_1.loadPolicy)({ deny: [], allow: [5] }));
    throws('empty rule string throws at load', () => (0, policyGate_1.loadPolicy)({ deny: [], allow: [''] }));
    throws('non-object policy throws at load', () => (0, policyGate_1.loadPolicy)(42));
    /* the tokenizer has two refusal paths; both must refuse, and the message must
       say where, because "invalid policy" with no offset is unactionable. */
    throws('an unterminated string refuses to load', () => (0, policyGate_1.loadPolicy)({ deny: [], allow: ['equals(tool.name, "abc'] }));
    check('an unterminated string says where it started', (() => {
        try {
            (0, policyGate_1.loadPolicy)({ deny: [], allow: ['equals(tool.name, "abc'] });
            return false;
        }
        catch (error) {
            return error instanceof policyGate_1.PolicySyntaxError && error.message.includes('offset');
        }
    })());
    check('an unexpected character says where it is', (() => {
        try {
            (0, policyGate_1.loadPolicy)({ deny: [], allow: ['equals(tool.name, @)'] });
            return false;
        }
        catch (error) {
            return error instanceof policyGate_1.PolicySyntaxError && error.message.includes('offset');
        }
    })());
    /* An empty policy is not malformed — it is the policy in force when nobody
       has written one, and it permits nothing. Loading must succeed so the caller
       can carry on fail-closed; deciding must refuse. */
    check('an empty policy loads rather than throwing', (() => {
        try {
            (0, policyGate_1.loadPolicy)({});
            return true;
        }
        catch {
            return false;
        }
    })());
    const emptyDecision = (0, policyGate_1.decide)((0, policyGate_1.loadPolicy)({}), { 'tool.name': 'pc.exec' });
    check('an empty policy permits nothing', emptyDecision.allowed === false);
    check('an empty policy says why nothing is permitted', emptyDecision.reason === 'empty-policy');
    check('an empty policy speaks in words', (0, policyGate_1.describeDecision)(emptyDecision).includes('permits nothing by default'));
    check('PolicySyntaxError is identifiable', (() => {
        try {
            (0, policyGate_1.loadPolicy)({ deny: [], allow: ['('] });
            return false;
        }
        catch (error) {
            return error instanceof policyGate_1.PolicySyntaxError;
        }
    })());
    /* ------------------------- 7. refusals in words ------------------------- */
    check('describeDecision speaks for an allow', (0, policyGate_1.describeDecision)({ allowed: true, reason: 'allowed', rule: 'true' }).startsWith('Allowed'));
    check('describeDecision speaks for a deny', (0, policyGate_1.describeDecision)({ allowed: false, reason: 'denied-by-rule', rule: 'true' }).startsWith('Refused'));
    check('describeDecision speaks for an empty policy', (0, policyGate_1.describeDecision)({ allowed: false, reason: 'empty-policy' }).includes('permits nothing'));
    /* ------------------------- 8. initiator attribution --------------------- */
    check('person carries no id', (0, initiator_1.initiator)('person').kind === 'person');
    throws('person with an id is rejected', () => (0, initiator_1.initiator)('person', 'abc'));
    throws('routine without an id is rejected', () => (0, initiator_1.initiator)('routine'));
    check('routine keeps its id', (0, initiator_1.initiator)('routine', 'nightly-audit').id === 'nightly-audit');
    check('handoff keeps its id', (0, initiator_1.initiator)('handoff', 'bot-7').id === 'bot-7');
    check('person is watched', (0, initiator_1.isNobodyWatching)((0, initiator_1.initiator)('person')) === false);
    check('deployment is watched', (0, initiator_1.isNobodyWatching)((0, initiator_1.initiator)('deployment')) === false);
    check('routine is nobody watching', (0, initiator_1.isNobodyWatching)((0, initiator_1.initiator)('routine', 'r1')) === true);
    check('handoff is nobody watching', (0, initiator_1.isNobodyWatching)((0, initiator_1.initiator)('handoff', 'bot-7')) === true);
    check('nobody-watching kinds are routine + handoff', (0, initiator_1.nobodyWatchingKinds)().join(',') === 'routine,handoff');
    /* -------------------- 9. the gateway: two rows, no side effects --------- */
    const rows = [];
    const sink = (row) => { rows.push(row); };
    // 9a. a refusal must not execute
    let executed = false;
    const refused = await (0, initiator_1.governAction)({
        policy: (0, policyGate_1.loadPolicy)({ deny: ['contains(tool.name, "rm")'], allow: ['true'] }),
        context: { 'tool.name': 'pc.exec rm -rf /' },
        tool: 'pc.exec',
        actorId: 'owner',
        initiator: (0, initiator_1.initiator)('person'),
        audit: sink,
        clock: fixedClock,
    }, () => { executed = true; return 'should not happen'; });
    check('refused action does not execute', executed === false);
    check('refused action returns ok:false', refused.ok === false);
    check('refused action writes exactly one row', rows.length === 1);
    check('the decision row is a decision phase', rows[0]?.phase === 'decision');
    check('the row carries the injected clock', rows[0]?.at === '2026-09-18T00:00:00.000Z');
    // 9b. a permitted action executes and writes a second row
    rows.length = 0;
    const allowed = await (0, initiator_1.governAction)({
        policy: (0, policyGate_1.loadPolicy)({ deny: [], allow: ['contains(tool.name, "pc.fs.read")'] }),
        context: { 'tool.name': 'pc.fs.read' },
        tool: 'pc.fs.read',
        actorId: 'owner',
        initiator: (0, initiator_1.initiator)('routine', 'nightly-audit'),
        audit: sink,
        clock: fixedClock,
    }, () => 'file-contents');
    check('permitted action executes', allowed.ok === true);
    check('permitted action returns the value', allowed.value === 'file-contents');
    check('permitted action writes two rows', rows.length === 2);
    check('the second row is an outcome phase', rows[1]?.phase === 'outcome');
    check('the outcome row is marked executed', rows[1]?.reason === 'executed');
    check('rows carry initiator kind', rows[0]?.initiator.kind === 'routine');
    check('rows carry nobody-watching flag', rows[0]?.nobodyWatching === true);
    check('rows are serialisable for the receipt digest', JSON.stringify(rows).includes('nightly-audit'));
    // 9c. a permitted action that fails still writes the second row
    rows.length = 0;
    const failed = await (0, initiator_1.governAction)({
        policy: (0, policyGate_1.loadPolicy)({ deny: [], allow: ['true'] }),
        context: { 'tool.name': 'pc.exec' },
        tool: 'pc.exec',
        actorId: 'owner',
        initiator: (0, initiator_1.initiator)('handoff', 'bot-7'),
        audit: sink,
        clock: fixedClock,
    }, () => { throw new Error('spawn refused by the sandbox'); });
    check('failed action returns ok:false', failed.ok === false);
    check('failed action preserves the decision', failed.decision.allowed === true);
    check('failed action reports the error in words', failed.error === 'spawn refused by the sandbox');
    check('failed action writes a failure row', rows.length === 2 && rows[1]?.reason === 'execution-failed');
    check('failure row records nobody-watching too', rows[1]?.nobodyWatching === true);
    const passed = checks.filter((c) => c.ok).length;
    return { passed, failed: checks.length - passed, checks };
}
const invokedDirectly = typeof process !== 'undefined' &&
    Array.isArray(process?.argv) &&
    /policyGate\.test(\.(ts|tsx|js|mjs))?$/.test(process?.argv?.[1] ?? '');
if (invokedDirectly) {
    void runPolicyGateProbe().then((result) => {
        for (const c of result.checks) {
            if (!c.ok)
                console.log(`  FAIL  ${c.name}${c.detail === undefined ? '' : ` — ${c.detail}`}`);
        }
        console.log(`policyGate probe: ${result.passed} passed, ${result.failed} failed`);
        if (result.failed > 0 && process !== undefined)
            process.exitCode = 1;
    });
}

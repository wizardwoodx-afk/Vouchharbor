"use strict";
/**
 * initiator.ts — who (or what) started a run, and the two-row audit pattern.
 *
 * CLEAN-ROOM IMPLEMENTATION of semantics documented in CopilotKit/OpenBot
 * `docs/architecture.md` (MIT, Copyright (c) 2026 CopilotKit), sections
 * "Browser action governance" and "What started a run". No upstream code copied.
 *
 * The idea worth taking: an audit row that records *on whose authority* an action
 * happened cannot tell you whether anybody was present. An interactive run has
 * somebody watching who will notice a wrong tool call; an unattended one does not.
 * So every row also records what caused it — and "Nobody watching" becomes a
 * filter over `routine` + `handoff`, not a guess.
 *
 * This is additive to Vouch Harbor. It introduces no store: rows are handed to
 * your existing ledger/audit sink, so they can be digested into the receipt chain
 * you already mint.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOBODY_WATCHING = exports.INITIATOR_KINDS = void 0;
exports.initiator = initiator;
exports.isNobodyWatching = isNobodyWatching;
exports.nobodyWatchingKinds = nobodyWatchingKinds;
exports.governAction = governAction;
const policyGate_1 = require("./policyGate");
exports.INITIATOR_KINDS = ['person', 'deployment', 'routine', 'handoff'];
/**
 * The kinds where nobody is necessarily in the room. `deployment` is deliberately
 * excluded: a boundary held at start-up is the system holding its own line.
 */
exports.NOBODY_WATCHING = ['routine', 'handoff'];
function initiator(kind, id) {
    if (!exports.INITIATOR_KINDS.includes(kind)) {
        throw new Error(`unknown initiator kind ${JSON.stringify(kind)}`);
    }
    if (kind === 'routine' || kind === 'handoff') {
        if (id === undefined || id.length === 0) {
            throw new Error(`initiator kind "${kind}" requires an id (the routine's, or the handing party's)`);
        }
        return { kind, id };
    }
    if (id !== undefined) {
        throw new Error(`initiator kind "${kind}" must not carry an id`);
    }
    return { kind };
}
function isNobodyWatching(i) {
    return exports.NOBODY_WATCHING.includes(i.kind);
}
function nobodyWatchingKinds() {
    return [...exports.NOBODY_WATCHING];
}
/**
 * The action boundary, in the documented order:
 *   resolve -> decide -> write the decision row -> act only when forwarded
 *   -> write a second row if the forwarded action fails.
 *
 * The interesting property: `execute` is not called at all when the decision is
 * a refusal, so a denied action cannot have side effects.
 */
async function governAction(options, execute) {
    const now = () => (options.clock ? options.clock() : new Date()).toISOString();
    const base = {
        tool: options.tool,
        actorId: options.actorId,
        initiator: options.initiator,
        nobodyWatching: isNobodyWatching(options.initiator),
    };
    const decision = (0, policyGate_1.decide)(options.policy, options.context);
    const rows = [];
    const decisionRow = {
        ...base,
        at: now(),
        phase: 'decision',
        allowed: decision.allowed,
        reason: decision.reason,
        ...(decision.rule === undefined ? {} : { rule: decision.rule }),
        ...(decision.detail === undefined ? {} : { detail: decision.detail }),
    };
    rows.push(decisionRow);
    options.audit(decisionRow);
    if (!decision.allowed) {
        return { ok: false, decision, rows };
    }
    try {
        const value = await execute();
        const outcomeRow = { ...base, at: now(), phase: 'outcome', allowed: true, reason: 'executed' };
        rows.push(outcomeRow);
        options.audit(outcomeRow);
        return { ok: true, decision, value, rows };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failureRow = {
            ...base,
            at: now(),
            phase: 'outcome',
            allowed: true,
            reason: 'execution-failed',
            detail: message,
        };
        rows.push(failureRow);
        options.audit(failureRow);
        return { ok: false, decision, error: message, rows };
    }
}

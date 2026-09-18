"use strict";
/**
 * policyGate.ts — fail-closed action policy for governed tool calls.
 *
 * CLEAN-ROOM IMPLEMENTATION. This file is written against the policy *semantics*
 * documented in CopilotKit/OpenBot `docs/architecture.md` (MIT, Copyright (c) 2026
 * CopilotKit). No upstream code was copied; the semantics are re-expressed for
 * Vouch Harbor's model. If you later vendor upstream source instead, keep their
 * MIT notice verbatim in `vendor/` and add a NOTICE row.
 *
 * Adopted semantics (deliberately, because they are the right ones):
 *   - deny rules are evaluated before allow rules
 *   - contains() / matches() / startsWith() / endsWith() are case-insensitive
 *   - the engine FAILS CLOSED:
 *       missing or empty policy   -> permits nothing
 *       a broken deny rule        -> denies
 *       a broken allow rule       -> does not permit
 *       a malformed policy        -> throws at load, so startup refuses
 *
 * Deliberately NOT adopted: upstream's shipped startup default (`allow: ["true"]`,
 * which permits everything). Vouch Harbor's default posture is deny-risky.
 *
 * Zero dependencies on purpose: Vouch Harbor's 124 offline verification bundles
 * run with `node verify/run.mjs` and no npm resolution. A policy evaluator that
 * drags a runtime into those bundles would break that property.
 *
 * Nothing here mutates engine state, writes receipts, or holds authority. It
 * answers one question — "may this action be forwarded?" — and returns a plain
 * object. Rows are handed to the caller's audit sink (your ledger), never to a
 * store of their own.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPTY_POLICY = exports.KNOWN_FUNCTIONS = exports.PolicyEvaluationError = exports.PolicySyntaxError = void 0;
exports.tokenize = tokenize;
exports.parseRule = parseRule;
exports.loadPolicy = loadPolicy;
exports.decide = decide;
exports.describeDecision = describeDecision;
class PolicySyntaxError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PolicySyntaxError';
    }
}
exports.PolicySyntaxError = PolicySyntaxError;
class PolicyEvaluationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PolicyEvaluationError';
    }
}
exports.PolicyEvaluationError = PolicyEvaluationError;
const IDENT_START = /[A-Za-z_$]/;
const IDENT_BODY = /[A-Za-z0-9_$.-]/;
function tokenize(source) {
    const tokens = [];
    let i = 0;
    while (i < source.length) {
        const c = source[i];
        if (c === undefined)
            break;
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
            i += 1;
            continue;
        }
        if (c === '(') {
            tokens.push({ t: 'lparen' });
            i += 1;
            continue;
        }
        if (c === ')') {
            tokens.push({ t: 'rparen' });
            i += 1;
            continue;
        }
        if (c === ',') {
            tokens.push({ t: 'comma' });
            i += 1;
            continue;
        }
        if (c === '&' && source[i + 1] === '&') {
            tokens.push({ t: 'op', v: '&&' });
            i += 2;
            continue;
        }
        if (c === '|' && source[i + 1] === '|') {
            tokens.push({ t: 'op', v: '||' });
            i += 2;
            continue;
        }
        if (c === '=' && source[i + 1] === '=') {
            tokens.push({ t: 'op', v: '==' });
            i += 2;
            continue;
        }
        if (c === '!' && source[i + 1] === '=') {
            tokens.push({ t: 'op', v: '!=' });
            i += 2;
            continue;
        }
        if (c === '!') {
            tokens.push({ t: 'op', v: '!' });
            i += 1;
            continue;
        }
        if (c === '"' || c === "'") {
            const quote = c;
            let j = i + 1;
            let value = '';
            let closed = false;
            while (j < source.length) {
                const ch = source[j];
                if (ch === undefined)
                    break;
                if (ch === '\\' && j + 1 < source.length) {
                    value += source[j + 1] ?? '';
                    j += 2;
                    continue;
                }
                if (ch === quote) {
                    closed = true;
                    break;
                }
                value += ch;
                j += 1;
            }
            if (!closed)
                throw new PolicySyntaxError(`unterminated string starting at offset ${i}`);
            tokens.push({ t: 'str', v: value });
            i = j + 1;
            continue;
        }
        if (IDENT_START.test(c)) {
            let j = i + 1;
            while (j < source.length) {
                const ch = source[j];
                if (ch === undefined || !IDENT_BODY.test(ch))
                    break;
                j += 1;
            }
            const word = source.slice(i, j);
            if (word === 'true')
                tokens.push({ t: 'bool', v: true });
            else if (word === 'false')
                tokens.push({ t: 'bool', v: false });
            else
                tokens.push({ t: 'ident', v: word });
            i = j;
            continue;
        }
        throw new PolicySyntaxError(`unexpected character ${JSON.stringify(c)} at offset ${i}`);
    }
    return tokens;
}
/** Functions a rule may call. Anything else is a syntax error at load time. */
exports.KNOWN_FUNCTIONS = ['contains', 'matches', 'startsWith', 'endsWith'];
function parseRule(source) {
    const tokens = tokenize(source);
    let pos = 0;
    const at = () => tokens[pos];
    const isOp = (v) => {
        const t = at();
        return t !== undefined && t.t === 'op' && t.v === v;
    };
    const fail = (msg) => {
        throw new PolicySyntaxError(`${msg} in rule ${JSON.stringify(source)}`);
    };
    function parsePrimary() {
        const t = at();
        if (t === undefined)
            return fail('unexpected end of rule');
        if (t.t === 'lparen') {
            pos += 1;
            const inner = parseOr();
            const close = at();
            if (close === undefined || close.t !== 'rparen')
                return fail('missing ")"');
            pos += 1;
            return inner;
        }
        if (t.t === 'str') {
            pos += 1;
            return { k: 'literal', v: t.v };
        }
        if (t.t === 'bool') {
            pos += 1;
            return { k: 'literal', v: t.v };
        }
        if (t.t === 'ident') {
            pos += 1;
            const open = at();
            if (open !== undefined && open.t === 'lparen') {
                if (!exports.KNOWN_FUNCTIONS.includes(t.v))
                    return fail(`unknown function "${t.v}"`);
                pos += 1;
                const args = [];
                const immediateClose = at();
                if (immediateClose !== undefined && immediateClose.t === 'rparen') {
                    pos += 1;
                }
                else {
                    for (;;) {
                        args.push(parseOr());
                        const sep = at();
                        if (sep !== undefined && sep.t === 'comma') {
                            pos += 1;
                            continue;
                        }
                        if (sep !== undefined && sep.t === 'rparen') {
                            pos += 1;
                            break;
                        }
                        return fail('expected "," or ")" in call');
                    }
                }
                return { k: 'call', name: t.v, args };
            }
            return { k: 'field', name: t.v };
        }
        return fail('unexpected token');
    }
    function parseUnary() {
        if (isOp('!')) {
            pos += 1;
            return { k: 'not', a: parseUnary() };
        }
        return parsePrimary();
    }
    function parseComparison() {
        let left = parseUnary();
        const t = at();
        if (t !== undefined && t.t === 'op' && (t.v === '==' || t.v === '!=')) {
            pos += 1;
            const right = parseUnary();
            left = { k: 'cmp', op: t.v, a: left, b: right };
        }
        return left;
    }
    function parseAnd() {
        let node = parseComparison();
        while (isOp('&&')) {
            pos += 1;
            node = { k: 'and', a: node, b: parseComparison() };
        }
        return node;
    }
    function parseOr() {
        let node = parseAnd();
        while (isOp('||')) {
            pos += 1;
            node = { k: 'or', a: node, b: parseAnd() };
        }
        return node;
    }
    const root = parseOr();
    if (pos !== tokens.length)
        return fail('unexpected trailing tokens');
    return root;
}
/* ----------------------------- evaluator ------------------------------ */
function asString(value) {
    return typeof value === 'string' ? value : String(value);
}
function truthy(value) {
    return typeof value === 'boolean' ? value : value.length > 0;
}
function evaluateCall(node, ctx) {
    const args = node.args.map((a) => evaluateNode(a, ctx));
    const arity = (n) => {
        if (args.length !== n)
            throw new PolicyEvaluationError(`${node.name}() expects ${n} arguments, got ${args.length}`);
    };
    /** Arguments are validated by arity() before use; this keeps the type honest. */
    const arg = (index) => {
        const value = args[index];
        if (value === undefined)
            throw new PolicyEvaluationError(`${node.name}() is missing argument ${index + 1}`);
        return value;
    };
    switch (node.name) {
        case 'contains':
            arity(2);
            return asString(arg(0)).toLowerCase().includes(asString(arg(1)).toLowerCase());
        case 'matches': {
            arity(2);
            let re;
            try {
                re = new RegExp(asString(arg(1)), 'i');
            }
            catch {
                throw new PolicyEvaluationError('matches(): pattern is not a valid regular expression');
            }
            return re.test(asString(arg(0)));
        }
        case 'startsWith':
            arity(2);
            return asString(arg(0)).toLowerCase().startsWith(asString(arg(1)).toLowerCase());
        case 'endsWith':
            arity(2);
            return asString(arg(0)).toLowerCase().endsWith(asString(arg(1)).toLowerCase());
        default:
            throw new PolicyEvaluationError(`unknown function "${node.name}"`);
    }
}
function evaluateNode(node, ctx) {
    switch (node.k) {
        case 'literal':
            return node.v;
        case 'field': {
            const value = ctx[node.name];
            if (value === undefined)
                throw new PolicyEvaluationError(`field "${node.name}" is not set`);
            return value;
        }
        case 'not':
            return !truthy(evaluateNode(node.a, ctx));
        case 'and':
            return truthy(evaluateNode(node.a, ctx)) && truthy(evaluateNode(node.b, ctx));
        case 'or':
            return truthy(evaluateNode(node.a, ctx)) || truthy(evaluateNode(node.b, ctx));
        case 'cmp': {
            const a = evaluateNode(node.a, ctx);
            const b = evaluateNode(node.b, ctx);
            const equal = asString(a) === asString(b);
            return node.op === '==' ? equal : !equal;
        }
        case 'call':
            return evaluateCall(node, ctx);
    }
}
/** The policy in force when none is configured: permits nothing. */
exports.EMPTY_POLICY = Object.freeze({ deny: [], allow: [] });
function ruleList(value, field) {
    if (value === undefined)
        return [];
    if (!Array.isArray(value))
        throw new PolicySyntaxError(`policy.${field} must be an array of rule strings`);
    return value.map((entry, i) => {
        if (typeof entry !== 'string')
            throw new PolicySyntaxError(`policy.${field}[${i}] must be a string`);
        return entry;
    });
}
/**
 * Validate + compile a policy document. Throws on anything malformed, so the
 * caller can refuse to start rather than run with a policy it half-understands.
 */
function loadPolicy(raw) {
    if (typeof raw !== 'object' || raw === null) {
        throw new PolicySyntaxError('policy must be an object with "deny" and "allow" arrays');
    }
    const doc = raw;
    const compile = (source) => {
        const ast = parseRule(source);
        // Force evaluation-shape errors (unknown fields are runtime) to at least
        // prove the rule is parseable now.
        void ast;
        return { source, ast };
    };
    return {
        deny: ruleList(doc.deny, 'deny').map(compile),
        allow: ruleList(doc.allow, 'allow').map(compile),
    };
}
/**
 * Decide one action. Deny first, then allow. Fails closed at every branch.
 */
function decide(policy, ctx) {
    if (policy.deny.length === 0 && policy.allow.length === 0) {
        return { allowed: false, reason: 'empty-policy', detail: 'no rules configured: nothing is permitted' };
    }
    for (let i = 0; i < policy.deny.length; i += 1) {
        const rule = policy.deny[i];
        if (rule === undefined)
            continue;
        let hit;
        try {
            hit = truthy(evaluateNode(rule.ast, ctx));
        }
        catch (error) {
            return {
                allowed: false,
                reason: 'evaluation-error',
                rule: rule.source,
                ruleIndex: i,
                detail: `deny rule could not be evaluated and therefore denies: ${error.message}`,
            };
        }
        if (hit) {
            return { allowed: false, reason: 'denied-by-rule', rule: rule.source, ruleIndex: i };
        }
    }
    let firstError;
    for (let i = 0; i < policy.allow.length; i += 1) {
        const rule = policy.allow[i];
        if (rule === undefined)
            continue;
        try {
            if (truthy(evaluateNode(rule.ast, ctx))) {
                return { allowed: true, reason: 'allowed', rule: rule.source, ruleIndex: i };
            }
        }
        catch (error) {
            if (firstError === undefined) {
                firstError = `allow rule could not be evaluated and therefore does not permit: ${error.message}`;
            }
        }
    }
    return {
        allowed: false,
        reason: 'no-matching-allow',
        detail: firstError ?? 'no allow rule matched',
    };
}
/** A refusal in words — Vouch Harbor style, for the gate modal and the log. */
function describeDecision(decision) {
    switch (decision.reason) {
        case 'allowed':
            return `Allowed by rule ${JSON.stringify(decision.rule ?? '')}.`;
        case 'denied-by-rule':
            return `Refused: rule ${JSON.stringify(decision.rule ?? '')} denies this action.`;
        case 'no-matching-allow':
            return `Refused: no allow rule permits this action${decision.detail === undefined ? '' : ` (${decision.detail})`}.`;
        case 'empty-policy':
            return 'Refused: no policy is configured, and the policy plane permits nothing by default.';
        case 'evaluation-error':
            return `Refused: ${decision.detail ?? 'the deny rule could not be evaluated'}.`;
    }
}

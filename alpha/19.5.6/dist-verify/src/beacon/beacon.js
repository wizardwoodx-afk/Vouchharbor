"use strict";
/**
 * beacon.ts — the Beacon: watch an agent work, and take the wheel when it needs you.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT. Several popular desktop agents show a live
 * view of the agent's browser behind an eye icon. Watching is the right idea;
 * the eye is not ours. A harbor has a **beacon**: a light that tells you where
 * the work is from the shore, and whether anything is still moving. So the watch
 * affordance here is a Beacon — a tower, a beam, and a state — and the icon set
 * is ours. Nothing is copied from any project, by code or by asset.
 *
 * The rules that make watching *governance* rather than surveillance:
 *
 *   - **The window is a window; the record is the ledger.** The activity stream
 *     is for the person watching right now. The audit trail (governance plane)
 *     is what an investigation reads later. They are deliberately different
 *     objects, and this module never pretends the stream is evidence.
 *   - **A saved file shows its path and size, never its content.** An agent may
 *     be handling something it was told in confidence.
 *   - **While a person drives, agent actions are REFUSED, not queued.** A queued
 *     action that fires the moment the wheel is released is exactly the surprise
 *     the human gate exists to prevent. This is the rule that makes handover
 *     safe rather than merely available.
 *   - **A stall is an event.** Nothing happening leaves no trace of its own, so
 *     the absence is written down: a run that stops producing is reported, not
 *     left to look identical to a slow one.
 *
 * Additive module. Zero dependencies. No UI in here; the UI consumes the state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BEACON_ICON = exports.Beacon = exports.BeaconError = exports.DEFAULT_BEACON_OPTIONS = exports.BEACON_VERSION = void 0;
exports.describeState = describeState;
exports.describeFileEvent = describeFileEvent;
exports.describeCommandEvent = describeCommandEvent;
exports.redactCommand = redactCommand;
exports.unattendedLabel = unattendedLabel;
exports.BEACON_VERSION = 'vh-beacon/1';
exports.DEFAULT_BEACON_OPTIONS = { stallAfterMs: 60_000, windowSize: 200 };
class BeaconError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BeaconError';
    }
}
exports.BeaconError = BeaconError;
/**
 * The Beacon. Deliberately a plain object with pure transitions, so a probe can
 * drive it without a DOM, a clock, or a running agent.
 */
class Beacon {
    options;
    events = [];
    seq = 0;
    state = 'dark';
    humanDriving = false;
    pendingHelp;
    runStartedIso;
    constructor(options = {}) {
        this.options = { ...exports.DEFAULT_BEACON_OPTIONS, ...options };
    }
    /** Record an event. Producers redact before calling; the Beacon does not guess. */
    record(kind, summary, atIso, extra = {}) {
        if (summary.trim().length === 0)
            throw new BeaconError('a beacon event must say what happened');
        this.seq += 1;
        const event = {
            seq: this.seq,
            atIso,
            kind,
            summary,
            ...(extra.specialistId === undefined ? {} : { specialistId: extra.specialistId }),
            ...(extra.detail === undefined ? {} : { detail: extra.detail }),
        };
        this.events.push(event);
        if (this.events.length > this.options.windowSize)
            this.events = this.events.slice(-this.options.windowSize);
        switch (kind) {
            case 'run.started':
                this.state = 'steady';
                this.runStartedIso = atIso;
                this.pendingHelp = undefined;
                break;
            case 'help.requested':
                this.state = 'waiting';
                this.pendingHelp = summary;
                break;
            case 'control.taken':
                this.state = 'human';
                this.humanDriving = true;
                this.pendingHelp = undefined;
                break;
            case 'control.released':
                this.state = 'steady';
                this.humanDriving = false;
                break;
            case 'run.halted':
                this.state = 'halted';
                this.humanDriving = false;
                this.runStartedIso = undefined;
                break;
            case 'run.finished':
                this.state = 'dark';
                this.runStartedIso = undefined;
                this.pendingHelp = undefined;
                break;
            case 'run.stalled':
                this.state = 'flickering';
                break;
            default:
                if (this.state === 'steady' || this.state === 'flickering')
                    this.state = 'steady';
                break;
        }
        return event;
    }
    /**
     * Ask whether the agent may act right now. This is the core safety rule, and
     * it is a *refusal*, never a queue: while a person drives, the agent stops.
     */
    mayAgentAct() {
        if (this.state === 'human' || this.humanDriving) {
            return {
                allowed: false,
                reason: 'refused: a person currently has the wheel, so the agent does not act. Nothing was queued; the action is denied, not delayed.',
            };
        }
        if (this.state === 'waiting') {
            return {
                allowed: false,
                reason: 'refused: the run has stopped and is waiting for a person\'s answer, so the agent does not act around the question it just asked.',
            };
        }
        if (this.state === 'halted') {
            return { allowed: false, reason: 'refused: the run is halted. Start a new run rather than resuming an old intention.' };
        }
        if (this.state === 'dark') {
            return { allowed: false, reason: 'refused: no run is active.' };
        }
        return { allowed: true, reason: 'allowed: the agent holds the wheel.' };
    }
    /**
     * Whether the beacon should read as stalled. Evaluated on read so the module
     * needs no timer; the UI polls, the ledger does not care.
     */
    tick(nowIso) {
        if (this.state !== 'steady')
            return this.state;
        const last = this.lastEventIso();
        if (last === undefined)
            return this.state;
        const idle = Date.parse(nowIso) - Date.parse(last);
        if (Number.isNaN(idle))
            return this.state;
        this.state = idle > this.options.stallAfterMs ? 'flickering' : 'steady';
        return this.state;
    }
    snapshot(nowIso) {
        const state = this.tick(nowIso);
        const last = this.lastEventIso();
        return {
            state,
            ...(this.runStartedIso === undefined ? {} : { sinceIso: this.runStartedIso }),
            ...(last === undefined ? {} : { lastEventIso: last }),
            window: [...this.events],
            seen: this.seq,
            statement: describeState(state, this.pendingHelp),
            humanDriving: this.humanDriving,
            ...(this.pendingHelp === undefined ? {} : { pendingHelp: this.pendingHelp }),
        };
    }
    lastEventIso() {
        const last = this.events[this.events.length - 1];
        return last?.atIso;
    }
}
exports.Beacon = Beacon;
function describeState(state, pendingHelp) {
    switch (state) {
        case 'dark':
            return 'No run is active. The beacon is dark.';
        case 'steady':
            return 'The run is working.';
        case 'flickering':
            return 'The run has produced nothing for a while. That is reported here because silence leaves no other trace.';
        case 'waiting':
            return pendingHelp === undefined
                ? 'The run is paused, waiting for a person.'
                : `The run is paused and asking for help: ${pendingHelp}`;
        case 'human':
            return 'A person has the wheel. Agent actions are refused, not queued.';
        case 'halted':
            return 'The run was halted on purpose.';
    }
}
exports.BEACON_ICON = {
    name: 'beacon',
    meaning: 'A harbor light: where the work is, and whether anything is still moving.',
    states: {
        dark: { beamOpacity: 0, label: 'dark' },
        steady: { beamOpacity: 1, label: 'working' },
        flickering: { beamOpacity: 0.35, label: 'quiet' },
        waiting: { beamOpacity: 0.7, label: 'needs you' },
        human: { beamOpacity: 0.5, label: 'you have the wheel' },
        halted: { beamOpacity: 0.15, label: 'halted' },
    },
};
/**
 * Redaction helper for producers. Files never carry content into the window,
 * and anything that looks like a credential is described rather than quoted.
 */
function describeFileEvent(path, bytes, action) {
    const verb = action === 'read' ? 'read' : action === 'write' ? 'wrote' : 'listed';
    return `${verb} ${path} (${bytes} bytes; contents stay on your machine)`;
}
function describeCommandEvent(command, exitCode) {
    const tail = exitCode === undefined ? 'still running' : `exit ${exitCode}`;
    return `ran ${redactCommand(command)} (${tail})`;
}
const SECRET_IN_COMMAND = [
    /* the whole match is the secret */
    /sk-[A-Za-z0-9]{8,}/g,
    /(?:ghp_|gho_|ghu_|ghs_|github_pat_)[A-Za-z0-9_]{10,}/g,
    /xox[abps]-[A-Za-z0-9-]{10,}/g,
    /AKIA[0-9A-Z]{12,}/g,
    /-----BEGIN[A-Z ]*PRIVATE KEY-----/g,
    /* the value is the first group; the flag in front of it is worth keeping */
    /(?:--?(?:api[-_]?key|token|password|passwd|secret|credential)[= ])(\S+)/gi,
    /(?:Bearer\s+)(\S+)/gi,
    /(?:Basic\s+)([A-Za-z0-9+/=]{12,})/gi,
];
/**
 * Redact a command before it reaches the watch window, the ledger or a pack.
 * Producers call this; the Beacon never guesses on their behalf. Anything that
 * looks like a credential is replaced, including when the whole argument is the
 * credential rather than a named flag's value.
 */
function redactCommand(command) {
    return SECRET_IN_COMMAND.reduce((out, re) => out.replace(re, (match, ...rest) => {
        const group = rest[0];
        /* A capture group is a string; for a groupless pattern the first extra
           argument is the offset, which is how this bug got in. */
        if (typeof group === 'string' && group.length > 0 && match.endsWith(group)) {
            return `${match.slice(0, match.length - group.length)}[redacted]`;
        }
        return '[redacted]';
    }), command);
}
/** "Nobody watching" — the Beacon's own variant of the audit filter. */
function unattendedLabel(event) {
    switch (event.kind) {
        case 'control.taken':
            return 'a person took the wheel';
        case 'help.requested':
            return 'the agent asked for a person';
        case 'run.stalled':
            return 'nothing happened for a while';
        case 'gate.refused':
            return 'refused by policy';
        default:
            return event.specialistId === undefined ? 'unattributed' : `worked by ${event.specialistId}`;
    }
}

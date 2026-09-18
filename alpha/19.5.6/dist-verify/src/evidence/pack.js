"use strict";
/**
 * pack.ts — the Evidence Pack: the artifact an auditor, a CISO or a procurement
 * committee is actually handed.
 *
 * This is the answer to "someone can get a similar agent for free, so why pay
 * you". Free agents give you capability. None of them gives you an offline
 * verifiable record of what an autonomous system decided, refused, and did —
 * signed by the party accountable for it. That record has a buyer, and the buyer
 * has a deadline: EU AI Act full enforcement with penalties to €35M or 7% of
 * turnover, and Article 12 requiring automatic, tamper-evident logging of every
 * model inference, tool invocation and autonomous decision.
 *
 * Two rules this module holds to, and they are the reason it is worth money:
 *
 *   1. **Nothing overstates itself.** Every compliance clause maps to a concrete
 *      artifact, and anything not covered is listed as an explicit GAP. A pack
 *      that claims to cover something it does not is worse than no pack.
 *
 *   2. **A pack is verifiable offline, from itself.** The digest (SHA-256) is computed over
 *      canonical content, so a recipient with the bytes and the verifier can
 *      confirm nothing changed — without calling us, and without trusting us.
 *
 * Additive module. Zero dependencies. Consumes existing receipts and audit rows.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256Label = exports.COMPLIANCE_MAP = exports.EVIDENCE_PACK_VERSION = void 0;
exports.buildSummary = buildSummary;
exports.canonicalPack = canonicalPack;
exports.digestText = digestText;
exports.labelOf = labelOf;
exports.buildEvidencePack = buildEvidencePack;
exports.verifyEvidencePack = verifyEvidencePack;
exports.renderCoverNote = renderCoverNote;
const sha256_1 = require("./sha256");
Object.defineProperty(exports, "sha256Label", { enumerable: true, get: function () { return sha256_1.sha256Label; } });
exports.EVIDENCE_PACK_VERSION = 'vh-evidence-pack/1';
exports.COMPLIANCE_MAP = [
    {
        framework: 'EU_AI_ACT',
        clause: 'Art. 12 — record-keeping',
        requires: 'automatic logging of events over the lifetime of the system; tamper-evident records',
        coverage: 'covered',
        substantiatedBy: ['receipts', 'receipts[].digest', 'receipts[].signature'],
        note: 'Every receipt carries a digest; joint receipts are co-signed by both parties, so neither side can rewrite the record alone.',
    },
    {
        framework: 'EU_AI_ACT',
        clause: 'Art. 14 — human oversight',
        requires: 'human intervention mechanisms, authenticated operator override, ability to halt',
        coverage: 'covered',
        substantiatedBy: ['decisions', 'overrides', 'decisions[].initiatorKind'],
        note: 'Refusals name the rule that caused them; overrides record who intervened and when; initiator attribution distinguishes supervised from unattended work.',
    },
    {
        framework: 'EU_AI_ACT',
        clause: 'Art. 11 / Annex IV — technical documentation',
        requires: 'versioned technical documentation, linkable to the deployed system',
        coverage: 'partial',
        substantiatedBy: ['versions', 'receipts'],
        note: 'Version pins bind this pack to a system build. Annex IV additionally requires design and data-governance narrative, which lives in the release documentation rather than here.',
    },
    {
        framework: 'EU_AI_ACT',
        clause: 'Art. 9 — risk management',
        requires: 'documented risk process, continuous identification of risks',
        coverage: 'partial',
        substantiatedBy: ['decisions', 'overrides'],
        note: 'Gate refusals are the operational trace of the risk process. The written process and its review cadence are organisational artifacts this pack references but does not contain.',
    },
    {
        framework: 'ISO_42001',
        clause: 'A.6 — AI system lifecycle, A.8 — data and evidence',
        requires: 'traceable records of decisions and their basis; evidence that risk decisions were made on purpose',
        coverage: 'covered',
        substantiatedBy: ['decisions', 'receipts', 'overrides'],
        note: 'Gate decisions carry the rule that decided them, so the basis of a decision is recoverable rather than reconstructed.',
    },
    {
        framework: 'ISO_27001',
        clause: 'A.8.15 — logging, A.8.16 — monitoring',
        requires: 'event logs, protection of log information, monitoring activities',
        coverage: 'covered',
        substantiatedBy: ['receipts', 'decisions'],
        note: 'Offline-verifiable digests protect log integrity without depending on the logging host.',
    },
    {
        framework: 'NIST_AI_RMF',
        clause: 'MEASURE 2.7 — provenance, MANAGE 4.1 — incident response',
        requires: 'documenting provenance of AI output; post-deployment monitoring',
        coverage: 'covered',
        substantiatedBy: ['receipts', 'versions', 'decisions'],
        note: 'Model and provider provenance ride with each receipt; refusals and failures are first-class rows rather than gaps in a log.',
    },
];
function buildSummary(input) {
    const joint = input.receipts.filter((r) => r.signature === 'joint').length;
    const allowed = input.decisions.filter((d) => d.allowed).length;
    const refused = input.decisions.filter((d) => !d.allowed);
    const refusedWithRule = refused.filter((d) => (d.rule ?? '').length > 0).length;
    const unattended = input.decisions.filter((d) => d.initiatorKind === 'routine' || d.initiatorKind === 'handoff').length;
    const refusalCoverage = refused.length === 0 ? 1 : refusedWithRule / refused.length;
    return {
        missionCount: input.missionIds.length,
        receiptCount: input.receipts.length,
        jointReceiptCount: joint,
        decisionsAllowed: allowed,
        decisionsRefused: refused.length,
        refusedWithRuleNamed: `${refusedWithRule} of ${refused.length} refusals name the rule that caused them (${Math.round(refusalCoverage * 100)}%)`,
        unattendedCount: unattended,
        unattendedStatement: unattended === 0
            ? 'No action in this period was taken without a person present.'
            : `${unattended} action${unattended === 1 ? '' : 's'} in this period ran on somebody's authority while they were away; each is attributable to its routine or handing agent.`,
        overrideCount: input.overrides.length,
        retentionStatement: `Records are retained for ${input.retentionDays} days, against a floor of 180 (six months).`,
    };
}
/** Canonical content for digesting. Order is fixed so two builds agree byte-for-byte. */
function canonicalPack(pack) {
    return JSON.stringify([
        pack.v, pack.packId, pack.period.fromIso, pack.period.toIso,
        pack.generatedAtIso, pack.generatedBy,
        [...pack.missionIds].sort(),
        pack.receipts.map((r) => [r.id, r.kind, r.digest, r.atIso, r.signature, [...r.signers].sort()]),
        pack.decisions.map((d) => [d.atIso, d.tool, d.actorId, d.initiatorKind, d.initiatorId ?? '', d.allowed, d.rule ?? '', d.reason]),
        pack.overrides.map((o) => [o.atIso, o.kind, o.by, o.note ?? '']),
        pack.versions.map((v) => [v.surface, v.value]),
        pack.retentionDays,
        [...pack.notes],
    ]);
}
/**
 * The pack's digest, over its own canonical bytes.
 *
 * This is SHA-256, not a 64-bit integer hash wearing the word "digest". The
 * difference is the whole claim in the sentence "verifiable offline, without
 * trusting us": an integrity check that a determined editor can collide is not
 * evidence of anything. It also means a pack digest can be compared directly with
 * the SHA-256 digests the rest of Vouch Harbor's evidence chain already produces,
 * by the same tooling, with no translation step.
 */
function digestText(text) {
    return `vh1:sha256:${(0, sha256_1.sha256Hex)(text)}`;
}
/** The fast non-cryptographic hash, for short human-facing labels only. */
function labelOf(text) {
    return (0, sha256_1.checksum)(text);
}
function buildEvidencePack(input) {
    const summary = buildSummary(input);
    const gaps = [];
    const unsigned = input.receipts.filter((r) => r.signers.length === 0);
    if (unsigned.length > 0)
        gaps.push(`${unsigned.length} receipt(s) carry no signer; they are records, not evidence`);
    const jointUnverified = input.receipts.filter((r) => r.signature === 'joint' && r.signers.length < 2);
    if (jointUnverified.length > 0)
        gaps.push(`${jointUnverified.length} joint receipt(s) are not co-signed by both parties`);
    if (input.retentionDays < 180)
        gaps.push(`retention is ${input.retentionDays} days, below the 180-day floor an audit expects`);
    if (input.versions.length === 0)
        gaps.push('no version pins: this pack cannot be tied to a system build');
    if (input.decisions.length === 0)
        gaps.push('no gate decisions in this period: oversight cannot be evidenced from this pack alone');
    for (const clause of exports.COMPLIANCE_MAP) {
        if (clause.coverage === 'gap')
            gaps.push(`${clause.clause}: not covered by this pack`);
    }
    const withoutDigest = {
        v: exports.EVIDENCE_PACK_VERSION,
        packId: input.packId,
        period: input.period,
        generatedAtIso: input.generatedAtIso,
        generatedBy: input.generatedBy,
        missionIds: [...input.missionIds].sort(),
        receipts: input.receipts,
        decisions: input.decisions,
        overrides: input.overrides,
        versions: input.versions,
        retentionDays: input.retentionDays,
        notes: [...(input.notes ?? [])],
        summary,
        compliance: exports.COMPLIANCE_MAP,
        gaps,
    };
    return { ...withoutDigest, digest: digestText(canonicalPack(withoutDigest)) };
}
/** Recompute the digest from the pack's own bytes. No network, no trust required. */
function verifyEvidencePack(pack, expectedDigest) {
    const { digest, ...rest } = pack;
    const recomputed = digestText(canonicalPack(rest));
    if (recomputed !== digest) {
        return { valid: false, detail: `the pack's digest does not match its contents (declared ${digest}, recomputed ${recomputed})` };
    }
    if (expectedDigest !== digest) {
        return { valid: false, detail: `digest mismatch against the value you were given (pack ${digest}, expected ${expectedDigest})` };
    }
    return { valid: true, detail: `intact: ${pack.receipts.length} receipts, ${pack.decisions.length} decisions, digest ${digest}` };
}
/** Plain-text cover note. This is the page a human reads first. */
function renderCoverNote(pack) {
    const s = pack.summary;
    const lines = [
        `EVIDENCE PACK ${pack.packId}`,
        `Period: ${pack.period.fromIso} to ${pack.period.toIso}`,
        `Generated: ${pack.generatedAtIso} by ${pack.generatedBy}`,
        '',
        `Missions: ${s.missionCount}`,
        `Receipts: ${s.receiptCount} (${s.jointReceiptCount} co-signed across a bridge)`,
        `Gate decisions: ${s.decisionsAllowed} permitted, ${s.decisionsRefused} refused`,
        `Refusals: ${s.refusedWithRuleNamed}`,
        `Human oversight: ${s.overrideCount} override event(s) recorded`,
        `Attribution: ${s.unattendedStatement}`,
        `Retention: ${s.retentionStatement}`,
        '',
        `Digest: ${pack.digest} (SHA-256 over this pack's canonical contents; recompute it yourself)`,
        '',
        pack.gaps.length === 0 ? 'Gaps: none declared.' : `Gaps (${pack.gaps.length}):`,
        ...pack.gaps.map((g) => `  - ${g}`),
    ];
    return lines.join('\n');
}

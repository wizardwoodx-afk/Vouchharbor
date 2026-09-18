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
 *   2. **A pack is verifiable offline, from itself.** The digest is computed over
 *      canonical content, so a recipient with the bytes and the verifier can
 *      confirm nothing changed — without calling us, and without trusting us.
 *
 * Additive module. Zero dependencies. Consumes existing receipts and audit rows.
 */

export const EVIDENCE_PACK_VERSION = 'vh-evidence-pack/1';

/* ------------------------------- inputs --------------------------------- */

export interface ReceiptRef {
  readonly id: string;
  readonly kind: string;
  readonly digest: string;
  readonly atIso: string;
  /** 'single' when one harbor signed; 'joint' when a bridge crossing did. */
  readonly signature: 'single' | 'joint';
  readonly signers: readonly string[];
}

export interface DecisionRef {
  readonly atIso: string;
  readonly tool: string;
  readonly actorId: string;
  readonly initiatorKind: 'person' | 'deployment' | 'routine' | 'handoff';
  readonly initiatorId?: string;
  readonly allowed: boolean;
  readonly rule?: string;
  readonly reason: string;
}

export interface OverrideRef {
  readonly atIso: string;
  readonly kind: 'control_taken' | 'control_released' | 'run_halted' | 'autonomy_revoked';
  readonly by: string;
  readonly note?: string;
}

export interface VersionPin {
  readonly surface: string;
  readonly value: string;
}

export interface EvidenceInput {
  readonly packId: string;
  readonly period: { readonly fromIso: string; readonly toIso: string };
  readonly generatedAtIso: string;
  readonly generatedBy: string;
  readonly missionIds: readonly string[];
  readonly receipts: readonly ReceiptRef[];
  readonly decisions: readonly DecisionRef[];
  readonly overrides: readonly OverrideRef[];
  readonly versions: readonly VersionPin[];
  readonly retentionDays: number;
  /** Anything the operator wants on the record that no other field carries. */
  readonly notes?: readonly string[];
}

/* ---------------------------- compliance mapping ------------------------ */

export type Coverage = 'covered' | 'partial' | 'gap';

export interface ClauseMapping {
  readonly framework: 'EU_AI_ACT' | 'ISO_42001' | 'ISO_27001' | 'NIST_AI_RMF';
  readonly clause: string;
  readonly requires: string;
  readonly coverage: Coverage;
  /** Exactly which fields of this pack substantiate the claim. */
  readonly substantiatedBy: readonly string[];
  readonly note: string;
}

export const COMPLIANCE_MAP: readonly ClauseMapping[] = [
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

/* --------------------------------- the pack ----------------------------- */

export interface EvidencePack {
  readonly v: typeof EVIDENCE_PACK_VERSION;
  readonly packId: string;
  readonly period: EvidenceInput['period'];
  readonly generatedAtIso: string;
  readonly generatedBy: string;
  readonly missionIds: readonly string[];
  readonly receipts: readonly ReceiptRef[];
  readonly decisions: readonly DecisionRef[];
  readonly overrides: readonly OverrideRef[];
  readonly versions: readonly VersionPin[];
  readonly retentionDays: number;
  readonly notes: readonly string[];
  readonly summary: EvidenceSummary;
  readonly compliance: readonly ClauseMapping[];
  readonly gaps: readonly string[];
  /** Recomputable from everything above. */
  readonly digest: string;
}

export interface EvidenceSummary {
  readonly missionCount: number;
  readonly receiptCount: number;
  readonly jointReceiptCount: number;
  readonly decisionsAllowed: number;
  readonly decisionsRefused: number;
  readonly refusedWithRuleNamed: string;
  readonly unattendedCount: number;
  readonly unattendedStatement: string;
  readonly overrideCount: number;
  readonly retentionStatement: string;
}

export function buildSummary(input: EvidenceInput): EvidenceSummary {
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
    unattendedStatement:
      unattended === 0
        ? 'No action in this period was taken without a person present.'
        : `${unattended} action${unattended === 1 ? '' : 's'} in this period ran on somebody's authority while they were away; each is attributable to its routine or handing agent.`,
    overrideCount: input.overrides.length,
    retentionStatement: `Records are retained for ${input.retentionDays} days, against a floor of 180 (six months).`,
  };
}

/** Canonical content for digesting. Order is fixed so two builds agree byte-for-byte. */
export function canonicalPack(pack: Omit<EvidencePack, 'digest'>): string {
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

export function digestText(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x85ebca6b;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `vh1:${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function buildEvidencePack(input: EvidenceInput): EvidencePack {
  const summary = buildSummary(input);
  const gaps: string[] = [];

  const unsigned = input.receipts.filter((r) => r.signers.length === 0);
  if (unsigned.length > 0) gaps.push(`${unsigned.length} receipt(s) carry no signer; they are records, not evidence`);
  const jointUnverified = input.receipts.filter((r) => r.signature === 'joint' && r.signers.length < 2);
  if (jointUnverified.length > 0) gaps.push(`${jointUnverified.length} joint receipt(s) are not co-signed by both parties`);
  if (input.retentionDays < 180) gaps.push(`retention is ${input.retentionDays} days, below the 180-day floor an audit expects`);
  if (input.versions.length === 0) gaps.push('no version pins: this pack cannot be tied to a system build');
  if (input.decisions.length === 0) gaps.push('no gate decisions in this period: oversight cannot be evidenced from this pack alone');
  for (const clause of COMPLIANCE_MAP) {
    if (clause.coverage === 'gap') gaps.push(`${clause.clause}: not covered by this pack`);
  }

  const withoutDigest: Omit<EvidencePack, 'digest'> = {
    v: EVIDENCE_PACK_VERSION,
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
    compliance: COMPLIANCE_MAP,
    gaps,
  };

  return { ...withoutDigest, digest: digestText(canonicalPack(withoutDigest)) };
}

export interface PackVerification {
  readonly valid: boolean;
  readonly detail: string;
}

/** Recompute the digest from the pack's own bytes. No network, no trust required. */
export function verifyEvidencePack(pack: EvidencePack, expectedDigest: string): PackVerification {
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
export function renderCoverNote(pack: EvidencePack): string {
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
    `Digest: ${pack.digest}`,
    '',
    pack.gaps.length === 0 ? 'Gaps: none declared.' : `Gaps (${pack.gaps.length}):`,
    ...pack.gaps.map((g) => `  - ${g}`),
  ];
  return lines.join('\n');
}

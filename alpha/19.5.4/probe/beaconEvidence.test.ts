/**
 * beaconEvidence.test.ts — probe for the Beacon (watch + take the wheel) and the
 * Evidence Pack (the artifact an auditor is handed).
 * Zero dependencies, injected clock, no network.
 */

import {
  BEACON_ICON,
  Beacon,
  BeaconError,
  DEFAULT_BEACON_OPTIONS,
  describeCommandEvent,
  describeFileEvent,
  redactCommand,
  unattendedLabel,
} from '../src/beacon/beacon';
import {
  COMPLIANCE_MAP,
  EVIDENCE_PACK_VERSION,
  buildEvidencePack,
  digestText,
  renderCoverNote,
  verifyEvidencePack,
  type EvidenceInput,
} from '../src/evidence/pack';

export interface Check { readonly name: string; readonly ok: boolean; readonly detail?: string; }
export interface ProbeResult { readonly passed: number; readonly failed: number; readonly checks: readonly Check[]; }

const T0 = '2026-09-18T09:00:00.000Z';
const T1 = '2026-09-18T09:00:30.000Z';
const T2 = '2026-09-18T09:02:30.000Z';

export async function runBeaconEvidenceProbe(): Promise<ProbeResult> {
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: string): void => {
    checks.push(detail === undefined ? { name, ok } : { name, ok, detail });
  };
  const throws = (name: string, fn: () => unknown): void => {
    try { fn(); check(name, false, 'expected a throw, none happened'); } catch { check(name, true); }
  };

  /* ------------------------------- BEACON ------------------------------- */

  const b = new Beacon({ stallAfterMs: 60_000, windowSize: 5 });
  check('a fresh beacon is dark', b.snapshot(T0).state === 'dark');
  check('a dark beacon refuses agent action', b.mayAgentAct().allowed === false);
  check('the refusal explains itself', b.mayAgentAct().reason.includes('no run is active'));

  b.record('run.started', 'mission 4471 started', T0);
  check('starting a run lights the beacon', b.snapshot(T0).state === 'steady');
  check('a working beacon allows agent action', b.mayAgentAct().allowed === true);
  check('the snapshot records the run start', b.snapshot(T0).sinceIso === T0);
  check('no person is driving at the start', b.snapshot(T0).humanDriving === false);

  throws('an event must say what happened', () => b.record('tool.command', '   ', T0));

  b.record('tool.command', describeCommandEvent('sfc /verify --scope invoices', 0), T1, { detail: 'exit 0' });
  b.record('file.write', describeFileEvent('/work/recon.md', 4096, 'write'), T1, { detail: '4096 bytes' });
  check('events land in the window', b.snapshot(T1).window.length === 3);
  check('file events never carry contents', describeFileEvent('/work/recon.md', 4096, 'write').includes('contents stay on your machine'));
  check('a file event states the size', describeFileEvent('/work/recon.md', 4096, 'write').includes('4096 bytes'));

  /* stall detection: the failure that leaves no trace of its own */
  check('a quiet run reads as steady while inside the stall window', b.snapshot('2026-09-18T09:01:00.000Z').state === 'steady');
  const stalled = b.snapshot(T2);
  check('a quiet run reads as flickering after the stall window', stalled.state === 'flickering');
  check('the stall is stated in words', stalled.statement.includes('produced nothing for a while'));

  b.record('run.stalled', 'no output for 60s; the run is reported stalled', T2);
  check('a stall becomes an event of its own', b.snapshot(T2).window.some((e) => e.kind === 'run.stalled'));
  check('the stall event is labelled in the feed', unattendedLabel(b.snapshot(T2).window.find((e) => e.kind === 'run.stalled')!) === 'nothing happened for a while');

  /* ask for help, then take the wheel */
  b.record('help.requested', 'stuck on a 2FA prompt on the vendor portal', T2);
  check('asking for help pauses the run', b.snapshot(T2).state === 'waiting');
  check('the help request is carried on the snapshot', b.snapshot(T2).pendingHelp?.includes('2FA') === true);
  check('a waiting run does not let the agent act', b.mayAgentAct().allowed === false);
  check('the waiting refusal names the reason', b.mayAgentAct().reason.includes('run is halted') || b.mayAgentAct().reason.includes('person'));

  b.record('control.taken', 'alice took the wheel', T2);
  const driving = b.snapshot(T2);
  check('taking the wheel marks the human driving', driving.humanDriving === true);
  check('the beacon state is human', driving.state === 'human');
  const refused = b.mayAgentAct();
  check('while a person drives the agent is refused', refused.allowed === false);
  check('the refusal is a refusal, not a queue', refused.reason.includes('not delayed'));
  check('the refusal says nothing was queued', refused.reason.includes('Nothing was queued'));

  b.record('control.released', 'alice handed the wheel back', T2);
  check('releasing the wheel returns the beacon to steady', b.snapshot(T2).state === 'steady');
  check('the agent may act again', b.mayAgentAct().allowed === true);

  /* halting */
  b.record('run.halted', 'owner halted the run', T2);
  check('a halted run reads as halted', b.snapshot(T2).state === 'halted');
  check('a halted run refuses action', b.mayAgentAct().allowed === false);
  check('the halt refusal advises a new run', b.mayAgentAct().reason.includes('new run'));

  const b2 = new Beacon({ stallAfterMs: 60_000, windowSize: 5 });
  b2.record('run.started', 'run', T0);
  for (let i = 0; i < 12; i += 1) b2.record('file.read', `read file ${i}`, T1);
  const bounded = b2.snapshot(T1);
  check('the window is bounded', bounded.window.length === 5);
  check('the window keeps the newest events', bounded.window[bounded.window.length - 1]?.summary === 'read file 11');
  check('the window is not the record', bounded.seen === 13 && bounded.window.length < bounded.seen);
  check('the default window is a window, not a log', DEFAULT_BEACON_OPTIONS.windowSize <= 200);

  b2.record('run.finished', 'mission complete', T2);
  check('finishing turns the beacon dark', b2.snapshot(T2).state === 'dark');

  /* redaction */
  check('an api key in a command is redacted', !redactCommand('curl -H "key: sk-abcdefghijklmnop"').includes('sk-abcdefghijklmnop'));
  check('a flagged argument is redacted', redactCommand('deploy --token abcdef123456').includes('[redacted]'));
  check('an ordinary command survives redaction', redactCommand('npm run verify').includes('npm run verify'));
  check('a command event reports the exit code', describeCommandEvent('ls -la', 0).includes('exit 0'));
  check('a running command says so', describeCommandEvent('ls -la', undefined).includes('still running'));

  /* a credential cannot reach a window by any of the shapes it arrives in */
  check('a github token is redacted', !redactCommand('git push https://ghp_ABCDEFGHIJ0123456789@github.com/x/y').includes('ghp_ABCDEFGHIJ0123456789'));
  check('a bearer token is redacted', !redactCommand('curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig"').includes('eyJhbGciOiJIUzI1NiJ9.payload.sig'));
  check('a private key header is redacted', !redactCommand('cat /tmp/-----BEGIN RSA PRIVATE KEY-----').includes('BEGIN RSA PRIVATE KEY'));
  check('the flag in front of a redacted value survives', redactCommand('deploy --token abcdef123456').includes('--token'));
  check('redaction leaves an ordinary line alone', redactCommand('ls -la /work && npm run verify') === 'ls -la /work && npm run verify');

  /* the icon is ours */
  check('the beacon icon is named beacon', BEACON_ICON.name === 'beacon');
  check('the icon covers every state', Object.keys(BEACON_ICON.states).length === 6);
  check('the dark state has no beam', BEACON_ICON.states.dark.beamOpacity === 0);
  check('the icon explains itself', BEACON_ICON.meaning.includes('whether anything is still moving'));
  check('BeaconError is identifiable', (() => {
    try { b.record('run.started', '', T0); return false; } catch (e) { return e instanceof BeaconError; }
  })());

  /* ---------------------------- EVIDENCE PACK --------------------------- */

  const input: EvidenceInput = {
    packId: 'pack-2026-09-alice',
    period: { fromIso: '2026-09-01T00:00:00.000Z', toIso: '2026-09-30T23:59:59.000Z' },
    generatedAtIso: T2,
    generatedBy: 'alice@harbor-a',
    missionIds: ['4471', '4472'],
    receipts: [
      { id: 'vh-proof-receipt/2:r1', kind: 'mission', digest: 'vh1:aaaa1111', atIso: T0, signature: 'single', signers: ['harbor-a#alice'] },
      { id: 'vh-bridge-joint-receipt/1:j1', kind: 'bridge-crossing', digest: 'sha256:bbbb2222', atIso: T1, signature: 'joint', signers: ['harbor-a#alice', 'harbor-b#bob'] },
    ],
    decisions: [
      { atIso: T0, tool: 'pc.fs.read', actorId: 'alice', initiatorKind: 'person', allowed: true, reason: 'allowed' },
      { atIso: T1, tool: 'pc.exec', actorId: 'alice', initiatorKind: 'person', allowed: false, rule: 'contains(tool.name, "rm")', reason: 'denied-by-rule' },
      { atIso: T1, tool: 'fs.write', actorId: 'alice', initiatorKind: 'routine', initiatorId: 'nightly-audit', allowed: true, reason: 'allowed' },
      {
        atIso: T1,
        tool: 'pc.browser.open',
        actorId: 'alice',
        initiatorKind: 'handoff',
        initiatorId: 'fed-legal-verification',
        allowed: false,
        rule: 'initiator.kind == "handoff" && tool.name == "pc.browser.open"',
        reason: 'denied-by-rule',
      },
    ],
    overrides: [{ atIso: T1, kind: 'control_taken', by: 'alice', note: 'took the wheel at a 2FA prompt' }],
    versions: [{ surface: 'app', value: '19.5.4-alpha' }, { surface: 'engine', value: '19.5.4-alpha' }],
    retentionDays: 365,
    notes: ['Bridge opened with harbor-b for settlement verification.'],
  };

  const pack = buildEvidencePack(input);
  check('the pack carries its version', pack.v === EVIDENCE_PACK_VERSION);
  check('the pack counts missions', pack.summary.missionCount === 2);
  check('the pack counts receipts', pack.summary.receiptCount === 2);
  check('the pack counts joint receipts separately', pack.summary.jointReceiptCount === 1);
  check('the pack counts permitted and refused', pack.summary.decisionsAllowed === 2 && pack.summary.decisionsRefused === 2);
  check('the pack reports refusal coverage', pack.summary.refusedWithRuleNamed.includes('2 of 2') && pack.summary.refusedWithRuleNamed.includes('100%'));
  check('the pack reports unattended work', pack.summary.unattendedCount === 2);
  check('the unattended statement is plain', pack.summary.unattendedStatement.includes('while they were away'));
  check('the retention statement states the floor', pack.summary.retentionStatement.includes('180'));

  check('the pack maps EU AI Act Art. 12', COMPLIANCE_MAP.some((c) => c.clause.includes('Art. 12')));
  check('Art. 12 is marked covered', pack.compliance.find((c) => c.clause.includes('Art. 12'))?.coverage === 'covered');
  check('Art. 14 is marked covered', pack.compliance.find((c) => c.clause.includes('Art. 14'))?.coverage === 'covered');
  check('Art. 11 is honest about being partial', pack.compliance.find((c) => c.clause.includes('Art. 11'))?.coverage === 'partial');
  check('every mapping names what substantiates it', pack.compliance.every((c) => c.substantiatedBy.length > 0));
  check('every mapping explains itself', pack.compliance.every((c) => c.note.length > 20));

  check('a clean pack declares no gaps', pack.gaps.length === 0);
  check('the pack carries a digest', pack.digest.startsWith('vh1:'));

  const verify = verifyEvidencePack(pack, pack.digest);
  check('the pack verifies against its own digest', verify.valid === true);
  check('verification states what it checked', verify.detail.includes('intact'));
  const wrongDigest = verifyEvidencePack(pack, 'vh1:00000000');
  check('a wrong expected digest fails', wrongDigest.valid === false);
  const tampered = { ...pack, retentionDays: 30 };
  check('a tampered pack fails verification', verifyEvidencePack(tampered, tampered.digest).valid === false);

  /* a refusal with no named rule lowers the measured coverage — the number is
     computed, not asserted */
  const undocumented = buildEvidencePack({
    ...input,
    decisions: [
      ...input.decisions,
      { atIso: T2, tool: 'pc.exec', actorId: 'alice', initiatorKind: 'person', allowed: false, reason: 'denied-by-rule' },
    ],
  });
  check('an unnamed refusal lowers coverage', undocumented.summary.refusedWithRuleNamed.includes('2 of 3'));

  /* gaps are declared, never hidden */
  const gappy = buildEvidencePack({
    ...input,
    receipts: [
      { id: 'r', kind: 'mission', digest: 'x', atIso: T0, signature: 'joint', signers: ['harbor-a#alice'] },
      { id: 'r2', kind: 'mission', digest: 'y', atIso: T0, signature: 'single', signers: [] },
    ],
    versions: [],
    retentionDays: 30,
  });
  check('an unsigned receipt is declared as a gap', gappy.gaps.some((g) => g.includes('carry no signer')));
  check('a joint receipt with one signer is a gap', gappy.gaps.some((g) => g.includes('not co-signed')));
  check('short retention is a gap', gappy.gaps.some((g) => g.includes('below the 180-day floor')));
  check('missing version pins are a gap', gappy.gaps.some((g) => g.includes('version pins')));
  check('a gappy pack still verifies as intact', verifyEvidencePack(gappy, gappy.digest).valid === true);

  const cover = renderCoverNote(pack);
  check('the cover note leads with the pack id', cover.startsWith('EVIDENCE PACK pack-2026-09-alice'));
  check('the cover note carries the digest', cover.includes(pack.digest));
  check('the cover note reports refusals', cover.includes('refusals'));
  const gappyCover = renderCoverNote(gappy);
  check('the cover note lists gaps when there are any', gappyCover.includes('Gaps ('));
  check('a clean cover note says so', cover.includes('Gaps: none declared.'));
  check('the digest helper is stable', digestText('abc') === digestText('abc'));
  check('the digest helper separates inputs', digestText('abc') !== digestText('abd'));

  const passed = checks.filter((c) => c.ok).length;
  return { passed, failed: checks.length - passed, checks };
}

const invokedDirectly =
  typeof process !== 'undefined' && Array.isArray(process.argv) &&
  /beaconEvidence\.test(\.(ts|tsx|js|mjs))?$/.test(process.argv[1] ?? '');

if (invokedDirectly) {
  void runBeaconEvidenceProbe().then((r) => {
    for (const c of r.checks) if (!c.ok) console.log(`  FAIL  ${c.name}${c.detail === undefined ? '' : ` — ${c.detail}`}`);
    console.log(`beaconEvidence probe: ${r.passed} passed, ${r.failed} failed`);
    if (r.failed > 0) process.exitCode = 1;
  });
}

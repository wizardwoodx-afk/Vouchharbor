/**
 * bridge.test.ts — probe for the Agent Bridge (envelope + trust + crossing).
 * Zero dependencies, no network, injected clock. Vouch Harbor probe style.
 */

import {
  BRIDGE_CAPABILITIES,
  ENVELOPE_VERSION,
  EnvelopeError,
  buildEnvelope,
  canHop,
  canonicalEnvelope,
  validateEnvelope,
  type PeerRef,
} from '../src/bridge/envelope';
import {
  DECAY_PER_30_DAYS,
  TRUST_START,
  effectiveScore,
  newPairTrust,
  pairId,
  posture,
  reVouch,
  recordOutcome,
  trustTier,
} from '../src/bridge/trust';
import {
  capabilityMatrix,
  crossBridge,
  digestText,
  negotiate,
  verifyJointReceipt,
  type CrossingInput,
} from '../src/bridge/bridge';

export interface Check { readonly name: string; readonly ok: boolean; readonly detail?: string; }
export interface ProbeResult { readonly passed: number; readonly failed: number; readonly checks: readonly Check[]; }

const at = (iso: string): string => iso;
const NOW = at('2026-09-18T09:00:00.000Z');

const alice: PeerRef = { handle: 'alice', harbor: 'harbor-a', agentId: 'fed-bankingoperations-execution' };
const bob: PeerRef = { handle: 'bob', harbor: 'harbor-b', agentId: 'fed-legalcontractlifecycle-verification' };

/** Deterministic toy signer: correct shape, no crypto claim. */
const toySigner = (secret: string) => (bytes: Uint8Array): string => {
  let h = 0x811c9dc5;
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  let s = 0xcbf29ce4;
  for (let i = 0; i < secret.length; i += 1) s = Math.imul(s ^ secret.charCodeAt(i), 0x01000193) >>> 0;
  return `toy:${(h ^ s).toString(16).padStart(8, '0')}`;
};

export async function runBridgeProbe(): Promise<ProbeResult> {
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: string): void => {
    checks.push(detail === undefined ? { name, ok } : { name, ok, detail });
  };
  const throws = (name: string, fn: () => unknown): void => {
    try { fn(); check(name, false, 'expected a throw, none happened'); } catch { check(name, true); }
  };

  const good = {
    capability: 'verify',
    task: 'Check whether the settlement memo reconciles against the ledger extract.',
    bounds: { maxDepth: 2, maxCostMinor: 500, deadlineIso: '2026-09-19T09:00:00.000Z' },
    answerShape: { deliverable: 'a reconciliation verdict with each mismatch listed', mustInclude: ['the ledger line ids'], mustAvoid: ['unsourced assertions'] },
    from: alice,
    to: bob,
    nowIso: NOW,
  };

  /* 1. envelope construction and validation */
  const env = buildEnvelope(good);
  check('envelope carries the version', env.v === ENVELOPE_VERSION);
  check('envelope ids are stable for identical input', buildEnvelope(good).id === env.id);
  check('a different task yields a different id', buildEnvelope({ ...good, task: 'Something else entirely' }).id !== env.id);
  check('valid envelope reports no problems', validateEnvelope(env).length === 0);
  check('capability catalogue is exposed', BRIDGE_CAPABILITIES.includes('verify'));

  throws('unknown capability is refused', () => buildEnvelope({ ...good, capability: 'mindread' }));
  throws('a task shorter than a sentence is refused', () => buildEnvelope({ ...good, task: 'do it' }));
  throws('a missing answer shape is refused', () =>
    buildEnvelope({ ...good, answerShape: { deliverable: '' } }));
  throws('an unparseable deadline is refused', () =>
    buildEnvelope({ ...good, bounds: { maxDepth: 1, maxCostMinor: 1, deadlineIso: 'soon' } }));
  throws('a self-addressed envelope is refused', () =>
    buildEnvelope({ ...good, to: { ...alice, agentId: 'x' } }));

  const problems = validateEnvelope({ v: ENVELOPE_VERSION, id: 'short' });
  check('validation lists every problem at once', problems.length >= 5.0 - 1); // at least 4 fields named
  check('validation names the field', problems.some((p) => p.field === 'capability'));
  check('EnvelopeError carries problems', (() => {
    try { buildEnvelope({ ...good, capability: 'nope' }); return false; }
    catch (e) { return e instanceof EnvelopeError && e.problems.length > 0; }
  })());

  /* 2. hop discipline: refuse, never truncate */
  const shallow = buildEnvelope({ ...good, bounds: { ...good.bounds, maxDepth: 0 } });
  const hop0 = canHop(shallow, NOW);
  check('depth 0 may not hop', hop0.ok === false);
  check('depth refusal says why', hop0.reason.includes('may not be handed on again'));
  const hopOk = canHop(env, NOW);
  check('depth within bounds may hop', hopOk.ok === true);
  check('hop reports the child depth', hopOk.childDepth === env.depth + 1);
  const expired = buildEnvelope({ ...good, bounds: { ...good.bounds, deadlineIso: '2026-09-17T00:00:00.000Z' } });
  check('an expired envelope may not hop', canHop(expired, NOW).ok === false);
  check('expiry refusal names the deadline', canHop(expired, NOW).reason.includes('2026-09-17'));

  /* 3. canonical form is stable */
  check('canonical form is deterministic', canonicalEnvelope(env) === canonicalEnvelope(buildEnvelope(good)));
  check('canonical form is JSON', typeof JSON.parse(canonicalEnvelope(env)) === 'object');
  check('canonical form covers the answer shape', canonicalEnvelope(env).includes('reconciliation verdict'));

  /* 4. negotiation can only narrow */
  const grant = { offers: ['verify', 'review', 'research'] as const, canDo: ['verify', 'review'] as const };
  const ok = negotiate(grant, { capability: 'verify', bounds: good.bounds, task: good.task });
  check('an intersection is accepted', ok.accepted === true);
  const notOffered = negotiate(grant, { capability: 'simulate', bounds: good.bounds, task: good.task });
  check('a capability outside the grant is refused', notOffered.accepted === false);
  const notOfferedCause = (notOffered as { cause: string }).cause;
  check(
    'the refusal names every capability that is available',
    notOfferedCause.includes('verify') && notOfferedCause.includes('review'),
    notOfferedCause,
  );
  check('the available list never includes what was just refused', (notOfferedCause.split('it can offer')[1] ?? '').includes('simulate') === false);
  check('a capability it offers but cannot perform is also refused', (() => {
    /* 'research' is in offers but not in canDo: offering is not performing, and
       negotiation must not let the far side find that out the hard way. */
    const onlyOffered = negotiate(grant, { capability: 'research', bounds: good.bounds, task: good.task });
    if (onlyOffered.accepted) return false;
    const list = onlyOffered.cause.split('it can offer')[1] ?? '';
    return !list.includes('research') && list.includes('verify') && list.includes('review');
  })());
  const offeredNotPerformable = negotiate(
    { offers: ['simulate'], canDo: ['verify'] },
    { capability: 'simulate', bounds: good.bounds, task: good.task },
  );
  check('offer without ability is refused', offeredNotPerformable.accepted === false);
  check('a refusal always carries a cause', typeof (notOffered as { cause: string }).cause === 'string');

  const matrix = capabilityMatrix({ offers: ['verify'], canDo: ['verify'] }, { offers: [], canDo: ['verify', 'research'] });
  check('the matrix covers every capability', matrix.length === BRIDGE_CAPABILITIES.length);
  check('the matrix marks the crossable cell', matrix.find((m) => m.capability === 'verify')?.crossable === true);
  check('the matrix marks a non-crossable cell', matrix.find((m) => m.capability === 'research')?.crossable === false);

  /* 5. trust ledger */
  const id = pairId('harbor-a', 'alice', 'harbor-b', 'bob');
  check('pair ids are order independent', id === pairId('harbor-b', 'bob', 'harbor-a', 'alice'));
  check('pair id names both sides', id.includes('harbor-a#alice') && id.includes('harbor-b#bob'));
  let trust = newPairTrust(id);
  check('a new pair starts at the stated score', trust.score === TRUST_START && TRUST_START === 20);

  trust = recordOutcome(trust, { outcome: 'joint_success', envelopeId: 'e1', atIso: NOW });
  check('success raises trust', trust.score === TRUST_START + 6);
  check('the event is kept', trust.events.length === 1);
  trust = recordOutcome(trust, { outcome: 'joint_failure', envelopeId: 'e2', atIso: NOW, cause: 'no answer within bounds' });
  check('failure lowers trust more than success raised it', trust.score === TRUST_START - 2);
  throws('a refusal without a cause is refused', () =>
    recordOutcome(trust, { outcome: 'refused_by_policy', envelopeId: 'e3', atIso: NOW }));
  trust = recordOutcome(trust, { outcome: 'refused_by_policy', envelopeId: 'e3', atIso: NOW, cause: 'rule denies pc.exec' });
  check('a refusal with a cause is recorded', trust.events[2]?.cause === 'rule denies pc.exec');

  trust = recordOutcome(trust, { outcome: 'disputed', envelopeId: 'e4', atIso: NOW, cause: 'signature did not verify' });
  check('a dispute is the heaviest single hit', trust.score === 0);
  check('trust never goes below the floor', trust.score >= 0);
  const locked = recordOutcome(trust, { outcome: 'revoked', envelopeId: 'e5', atIso: NOW, cause: 'owner revoked' });
  check('revocation locks the pair', locked.locked === true);
  check('revocation floors the score', locked.score === 0);
  throws('a locked pair refuses further scoring', () =>
    recordOutcome(locked, { outcome: 'joint_success', envelopeId: 'e6', atIso: NOW }));
  const reopened = reVouch(locked, NOW, 'new engagement, new scope');
  check('an explicit re-vouch reopens the pair', reopened.locked === false && reopened.score === TRUST_START);
  throws('a re-vouch without a reason is refused', () => reVouch(locked, NOW, '  '));

  /* 6. decay: trust is about now, not history */
  const aged = { ...newPairTrust(id), score: 80, lastEventIso: '2026-03-01T00:00:00.000Z' };
  const decayed = effectiveScore(aged, NOW);
  check('trust decays with age', decayed < 80);
  check('decay is the stated rate', decayed === Math.round(80 - ((Date.parse(NOW) - Date.parse('2026-03-01T00:00:00.000Z')) / 2592000000) * DECAY_PER_30_DAYS));
  check('the stored score is untouched by decay', aged.score === 80);
  check('tiers map from the score', trustTier(0) === 'none' && trustTier(20) === 'read_only' && trustTier(50) === 'supervised' && trustTier(90) === 'standing');

  const frozen = posture({ ...newPairTrust(id), lastEventIso: NOW }, NOW);
  check('a fresh pair is read-only', frozen.tier === 'read_only');
  check('a fresh pair needs a human', frozen.requiresHumanApproval === true);
  const warm = posture({ ...newPairTrust(id), score: 80, lastEventIso: NOW }, NOW);
  check('a standing pair crosses without a human', warm.tier === 'standing' && warm.requiresHumanApproval === false);
  check('a standing pair may hand on twice', warm.maxDepth === 2);
  check('a revoked pair reads as none', posture(locked, NOW).tier === 'none');
  check('the posture speaks in words', warm.statement.includes('standing'));

  /* 7. the crossing: co-signed, verifiable, both sides hold a copy */
  const signerA = toySigner('alice-private');
  const signerB = toySigner('bob-private');
  const base: CrossingInput = {
    envelope: env,
    trust: { ...newPairTrust(id), score: 80, lastEventIso: NOW },
    nowIso: NOW,
    requester: { ref: alice, alg: 'toy-hash', sign: signerA, grant: { offers: ['verify'], canDo: ['verify'] } },
    responder: { ref: bob, alg: 'toy-hash', sign: signerB, grant: { offers: ['verify'], canDo: ['verify'] } },
    answer: { summary: 'Reconciled: 3 mismatches, all timing differences; ledger lines L-4102, L-4110, L-4188.' },
  };
  const crossed = crossBridge(base);
  check('a valid crossing is answered', crossed.status === 'answered');
  if (crossed.status === 'answered') {
    check('the receipt declares both signers', crossed.receipt.signatures.length === 2);
    check('the receipt is a joint kind', crossed.receipt.v.includes('joint'));
    check('the receipt names the pair', crossed.receipt.pairId === id);
    check('the receipt digests the answer rather than copying it', crossed.receipt.answerDigest.startsWith('sha256:'));
    check('the receipt keeps a human-readable summary', crossed.receipt.answerSummary.includes('L-4102'));
    check('crossings counts the hop', crossed.receipt.crossings === 1);
    check('verification succeeds for a genuine co-signature', crossed.verification.valid === true);
    check('verification names both signers', crossed.verification.signedBy.length === 2);
    check('the statement says it is co-signed', crossed.statement.includes('co-signed'));
    check('a successful crossing raises trust', crossed.trust.score > 80);

    const tampered = { ...crossed.receipt, answerSummary: 'Reconciled: no mismatches at all.' };
    const keys = new Map([
      [`harbor-a#alice`, signerA],
      [`harbor-b#bob`, signerB],
    ]);
    const tamperVerdict = verifyJointReceipt(tampered, keys);
    check('a tampered receipt fails verification', tamperVerdict.valid === false);
    check('the tamper failure is named, not repaired', tamperVerdict.detail.includes('does not verify'));
    const missingKey = verifyJointReceipt(crossed.receipt, new Map([[`harbor-a#alice`, signerA]]));
    check('a missing key is reported as such', missingKey.valid === false && missingKey.detail.includes('no key held'));
  }

  /* 8. refusals never produce a half-made receipt */
  const refused = crossBridge({ ...base, refusedCause: 'refused: our policy denies cross-harbor file writes' });
  check('a peer refusal is refused', refused.status === 'refused');
  check('a refusal carries its cause', refused.status === 'refused' && refused.cause.includes('cross-harbor'));
  check('a refusal lowers trust', refused.status === 'refused' && refused.trust.score < 80);
  check('a refusal produces no receipt field', !('receipt' in refused));

  const expiredCross = crossBridge({ ...base, envelope: expired });
  check('an expired crossing is refused', expiredCross.status === 'refused');
  check('expiry refusal explains itself', expiredCross.status === 'refused' && expiredCross.cause.includes('deadline'));

  const noAnswer = crossBridge({ ...base, answer: undefined });
  check('an empty answer is a failure, not a success', noAnswer.status === 'refused');
  check('an empty answer names the failure', noAnswer.status === 'refused' && noAnswer.cause.includes('no answer'));
  check('an empty answer lowers trust', noAnswer.status === 'refused' && noAnswer.trust.score < 80);

  const boundedOut = crossBridge({ ...base, envelope: buildEnvelope({ ...good, bounds: { ...good.bounds, maxDepth: 0 }, depth: 1 }) });
  check('an envelope beyond the pair depth is refused', boundedOut.status === 'refused');
  check('depth refusal quotes the limit', boundedOut.status === 'refused' && boundedOut.cause.includes('depth'));

  /* 9. digest helper */
  check('digest is stable for identical text', digestText('abc') === digestText('abc'));
  check('digest differs for different text', digestText('abc') !== digestText('abd'));

  const passed = checks.filter((c) => c.ok).length;
  return { passed, failed: checks.length - passed, checks };
}

const invokedDirectly =
  typeof process !== 'undefined' && Array.isArray(process.argv) &&
  /bridge\.test(\.(ts|tsx|js|mjs))?$/.test(process.argv[1] ?? '');

if (invokedDirectly) {
  void runBridgeProbe().then((r) => {
    for (const c of r.checks) if (!c.ok) console.log(`  FAIL  ${c.name}${c.detail === undefined ? '' : ` — ${c.detail}`}`);
    console.log(`bridge probe: ${r.passed} passed, ${r.failed} failed`);
    if (r.failed > 0) process.exitCode = 1;
  });
}

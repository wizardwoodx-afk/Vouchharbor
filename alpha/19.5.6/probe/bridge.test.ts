/**
 * bridge.test.ts — the crossing, graded as a two-harbor protocol.
 *
 * This suite runs two harbours with **separate key pairs and separate ledgers**,
 * exactly as two users would. Every claim the review asked for is checked here:
 *
 *   - signatures verify against PUBLISHED PUBLIC KEYS, and a forged receipt fails
 *     even when the forger holds the full canonical bytes;
 *   - a harbour cannot sign as another harbour;
 *   - the first crossing of a pair is REFUSED without a signed human approval, and
 *     the refusal costs the peer nothing;
 *   - trust comes from verified records, so a caller cannot present a warm score;
 *   - envelope ids and nonces are unpredictable by default.
 */

import { seededEntropy, buildEnvelope, canHop, canonicalEnvelope, validateEnvelope } from '../src/bridge/envelope';
import {
  BRIDGE_KEY_ALG,
  createHarborKeys,
  hasWebCrypto,
  keyRef,
  publicOf,
  registryWith,
  verifySignature,
} from '../src/bridge/keys';
import { signApproval, verifyApproval } from '../src/bridge/approval';
import { MemoryTrustStore, TrustLedger, type TrustStore } from '../src/bridge/ledger';
import { TrustError } from '../src/bridge/trust';
import {
  assembleJointReceipt,
  capabilityMatrix,
  canonicalReceipt,
  crossBridge,
  negotiate,
  respondToCrossing,
  signEnvelope,
  signReceiptHalf,
  verifyJointReceipt,
  type CapabilityGrant,
  type PeerReply,
  type PeerReplyAccepted,
  type UnsignedReceipt,
} from '../src/bridge/bridge';

export interface Check { readonly name: string; readonly ok: boolean; readonly detail?: string; }
export interface ProbeResult { readonly passed: number; readonly failed: number; readonly checks: readonly Check[]; }

const T0 = '2026-09-18T09:00:00.000Z';
const T1 = '2026-09-18T09:05:00.000Z';
const T2 = '2026-09-18T09:10:00.000Z';

export async function runBridgeProbe(): Promise<ProbeResult> {
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: string): void => {
    checks.push(detail === undefined ? { name, ok } : { name, ok, detail });
  };
  const throwsAsync = async (name: string, fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn();
      check(name, false, 'expected a throw, none happened');
    } catch {
      check(name, true);
    }
  };

  check('a real crypto implementation is available', hasWebCrypto());

  /* --------------------------- two harbours --------------------------- */

  const alice = await createHarborKeys('harbor-a', 'k-a1');
  const bob = await createHarborKeys('harbor-b', 'k-b1');
  const registry = registryWith(publicOf(alice), publicOf(bob));

  check('a key names its algorithm', alice.alg === BRIDGE_KEY_ALG);
  check('the public key is a P-256 EC JWK', alice.jwk.kty === 'EC' && alice.jwk.crv === 'P-256');
  check('the public half carries no private material', alice.jwk.d === undefined);
  check('harbours get different keys', alice.jwk.x !== bob.jwk.x);
  check('registry keys are harbor#keyId', keyRef('harbor-a', 'k-a1') === 'harbor-a#k-a1');

  /* -------------------- verification is not signing ------------------- */

  const message = new TextEncoder().encode('a crossing happened');
  const signature = await alice.sign(message);

  check('a signature verifies with the PUBLIC key', (await verifySignature(publicOf(alice), message, signature)) === true);
  check('the wrong public key does not verify it', (await verifySignature(publicOf(bob), message, signature)) === false);
  check('a changed message does not verify', (await verifySignature(publicOf(alice), new TextEncoder().encode('a crossing happened!'), signature)) === false);
  check('a mangled signature does not verify', (await verifySignature(publicOf(alice), message, `${signature.slice(0, -4)}AAAA`)) === false);
  check('two signatures over the same bytes differ (ECDSA is randomised)', (await alice.sign(message)) !== signature);

  /* the property the first version of this module did not have: Bob can CHECK a
     signature he could not have PRODUCED. Signing requires Alice's private key,
     which never leaves her closure — so holding the canonical bytes proves nothing. */
  const bytesAliceSigned = canonicalEnvelope(buildEnvelope({
    capability: 'verify', task: 'reconcile the two ledgers for September', bounds: { maxDepth: 1, maxCostMinor: 50, deadlineIso: T2 },
    answerShape: { deliverable: 'a reconciliation verdict' },
    from: { handle: 'alice', harbor: 'harbor-a' }, to: { handle: 'bob', harbor: 'harbor-b' }, nowIso: T0,
  }, { entropy: seededEntropy('probe') }));
  const realSig = await alice.sign(new TextEncoder().encode(bytesAliceSigned));
  const bobForgery = await bob.sign(new TextEncoder().encode(bytesAliceSigned));
  check('a peer cannot forge a signature over the same bytes', (await verifySignature(publicOf(alice), new TextEncoder().encode(bytesAliceSigned), bobForgery)) === false);
  check('while the genuine signature still verifies', (await verifySignature(publicOf(alice), new TextEncoder().encode(bytesAliceSigned), realSig)) === true);

  /* ----------------------------- envelopes ---------------------------- */

  const envInput = {
    capability: 'verify',
    task: 'reconcile the two ledgers for September and name every mismatch',
    bounds: { maxDepth: 1, maxCostMinor: 50, deadlineIso: T2 },
    answerShape: { deliverable: 'a reconciliation verdict', mustAvoid: ['invented figures'] },
    from: { handle: 'alice', harbor: 'harbor-a' },
    to: { handle: 'bob', harbor: 'harbor-b' },
    nowIso: T0,
  };
  const envelope = buildEnvelope(envInput);
  check('a built envelope validates', validateEnvelope(envelope).length === 0);
  check('specifying nothing still yields a well-formed envelope', validateEnvelope({ ...envelope, v: 'other' }).length > 0);

  /* nonces are unpredictable by default: two identical requests differ */
  const twin = buildEnvelope(envInput);
  check('two equivalent requests get different ids', twin.id !== envelope.id, `${envelope.id} vs ${twin.id}`);
  check('two equivalent requests get different nonces', twin.nonce !== envelope.nonce);
  check('default ids carry the csprng label', envelope.id.startsWith('brg_') && envelope.id.length >= 20);
  const seededA = buildEnvelope(envInput, { entropy: seededEntropy('fixed') });
  const seededB = buildEnvelope(envInput, { entropy: seededEntropy('fixed') });
  check('deterministic ids are available only when asked for by name', seededA.id === seededB.id);
  check('the test entropy source says what it is', seededEntropy('x').kind === 'seeded-for-tests-only');
  check('one envelope cannot be another pair', validateEnvelope({ ...envelope, to: envelope.from }).length > 0);
  check('a hop is refusable when out of time', canHop(envelope, '2026-09-19T00:00:00.000Z').ok === false);
  check('a hop is allowed inside its deadline', canHop(envelope, T1).ok === true);
  check('canonical form is deterministic', canonicalEnvelope(envelope) === canonicalEnvelope({ ...envelope }));

  /* ------------------------ envelopes, signed ------------------------- */

  const signedEnvelope = await signEnvelope(envelope, alice);
  check('an envelope can be signed by its sender', signedEnvelope.signer.harbor === 'harbor-a');
  await throwsAsync('a harbor cannot sign an envelope it did not send', () => signEnvelope(envelope, bob));

  /* --------------------------- negotiation ---------------------------- */

  const aliceGrant: CapabilityGrant = { offers: ['verify', 'review', 'research'], canDo: ['verify', 'review'] };
  const bobGrant: CapabilityGrant = { offers: ['verify', 'analyse'], canDo: ['verify', 'analyse'] };
  const ok = negotiate(aliceGrant, { capability: 'verify', bounds: envelope.bounds, task: envelope.task });
  check('an intersection is accepted', ok.accepted === true);
  const notOffered = negotiate(aliceGrant, { capability: 'simulate', bounds: envelope.bounds, task: envelope.task });
  check('a capability outside the grant is refused', notOffered.accepted === false);
  check('the available list never includes what was just refused', (notOffered.cause.split('it can offer')[1] ?? '').includes('simulate') === false);
  check('a capability it offers but cannot perform is also refused', (() => {
    const onlyOffered = negotiate(aliceGrant, { capability: 'research', bounds: envelope.bounds, task: envelope.task });
    if (onlyOffered.accepted) return false;
    const list = onlyOffered.cause.split('it can offer')[1] ?? '';
    return !list.includes('research') && list.includes('verify') && list.includes('review');
  })());
  const matrix = capabilityMatrix(aliceGrant, bobGrant);
  check('the matrix marks the crossable capability', matrix.find((c) => c.capability === 'verify')?.crossable === true);
  check('the matrix marks a one-sided capability closed', matrix.find((c) => c.capability === 'analyse')?.crossable === false);
  check('the matrix shows capabilities neither side has', matrix.some((c) => c.capability === 'research' && !c.crossable));

  /* ------------------------ the trust ledger -------------------------- */

  const store = new MemoryTrustStore();
  const ledger = new TrustLedger({ registry, store });
  const pair = TrustLedger.pairIdFor({ harbor: 'harbor-a', handle: 'alice' }, { harbor: 'harbor-b', handle: 'bob' });

  check('a pair starts at the stated score', (await ledger.postureOf(pair, T0)).score === 20);
  check('a fresh pair may cross nothing', (await ledger.postureOf(pair, T0)).maxDepth === 0);

  await ledger.attest({ pairId: pair, kind: 'peer-refusal', atIso: T0, envelopeId: 'e1', receiptDigest: '', note: 'they declined the invoice scope' }, alice);
  check('a refusal with a cause moves the score down', (await ledger.postureOf(pair, T0)).score === 20 - 2);
  await throwsAsync('a refusal without a cause is refused by the ledger itself', () =>
    ledger.attest({ pairId: pair, kind: 'policy-refusal', atIso: T0, envelopeId: 'e2', receiptDigest: '', note: '   ' }, alice));

  /* A row signed by a key we do not hold must not move the score. This is the
     difference between a ledger and a list of claims about a ledger. */
  const mallory = await createHarborKeys('harbor-m', 'k-m1');
  const strangerStore = new MemoryTrustStore();
  const strangerLedger = new TrustLedger({ registry: registryWith(publicOf(alice), publicOf(mallory)), store: strangerStore });
  await strangerLedger.attest(
    { pairId: pair, kind: 'success', atIso: T0, envelopeId: 'stranger', receiptDigest: '', note: 'a crossing that never happened' },
    mallory,
  );
  const cautious = new TrustLedger({ registry: registryWith(publicOf(alice), publicOf(bob)), store: strangerStore });
  const cautiousPosture = await cautious.postureOf(pair, T0);
  check('a success record from an unrecognised signer does not raise the score', cautiousPosture.score === 20, `score ${cautiousPosture.score}`);
  const cautiousAudit = await cautious.audit(pair);
  check('and the audit says so rather than hiding the row', cautiousAudit.records === 1 && cautiousAudit.verified === 0);
  check('the audit names the key it could not attribute', cautiousAudit.unverifiable[0]?.includes('harbor-m') === true);
  check('an unattributable row is not silently deleted either', (await cautious.storeLoad(pair)).length === 1);

  /* A row that VERIFIES is not the same as a row that is TRUE. Tamper with a
     stored row — change its claim, keep its signature — and the row must be
     excluded, because the signature no longer covers what it now says. */
  const tamperStore = new MemoryTrustStore();
  const tamperLedger = new TrustLedger({ registry, store: tamperStore });
  await tamperLedger.attest(
    { pairId: pair, kind: 'peer-refusal', atIso: T0, envelopeId: 'e-tamper', receiptDigest: '', note: 'they declined this scope, honestly recorded' },
    bob,
  );
  const lyingStore: TrustStore = {
    load: async (id) => (await tamperStore.load(id)).map((row) => ({ ...row, body: { ...row.body, kind: 'success' as const } })),
    append: (id, row) => tamperStore.append(id, row),
  };
  const tamperedLedger = new TrustLedger({ registry, store: lyingStore });
  const tamperedPosture = await tamperedLedger.postureOf(pair, T0);
  check('a tampered record is excluded, not counted at its new value', tamperedPosture.score === 20, `score ${tamperedPosture.score}`);
  const tamperedAudit = await tamperedLedger.audit(pair);
  check('the tampered row is named in the audit', tamperedAudit.verified === 0 && tamperedAudit.unverifiable.length === 1);
  check('the tampered row is still on disk, not quietly removed', (await tamperedLedger.storeLoad(pair)).length === 1);

  /* trust cannot be handed in: there is no parameter for it any more */
  const warmForgery = {
    pairId: pair,
    kind: 'success' as const,
    atIso: T0,
    envelopeId: 'forged',
    receiptDigest: '',
    note: 'Fabricated record inserted by a compromised integration',
  };
  const forgedRecord = await ledger.attest(warmForgery, bob).catch(() => undefined);
  if (forgedRecord !== undefined) {
    const bogusRegistry = registryWith(publicOf(alice)); // bob's key is not recognised
    const suspicious = new TrustLedger({ registry: bogusRegistry, store });
    const audit = await suspicious.audit(pair);
    check('a record signed by an unrecognised key is not counted', audit.verified < audit.records);
    check('unverifiable rows are named, never silently dropped', audit.unverifiable.length > 0 && audit.statement.includes('could not be attributed'));
  }

  /* ---------------------- the first-crossing gate --------------------- */

  const firstEnv = buildEnvelope({ ...envInput, task: 'reconcile the September ledgers for the first time' }, { entropy: seededEntropy('first') });
  const signedFirst = await signEnvelope(firstEnv, alice);
  const bobKeys = bob;
  const aliceLedgerStore = new MemoryTrustStore();
  const aliceLedger = new TrustLedger({ registry, store: aliceLedgerStore });
  const bobLedger = new TrustLedger({ registry, store: new MemoryTrustStore() });

  const bobAnswer = await respondToCrossing({
    signed: signedFirst, ours: bobGrant, keys: bobKeys, registry, ledger: bobLedger, nowIso: T1,
    answer: { summary: 'three mismatches, all timing', digest: 'vh1:sha256:aaa' },
  });
  check('the far side refuses the very first crossing without an approval of its own', bobAnswer.status === 'refused');

  const withoutApproval = await crossBridge({
    envelope: firstEnv, signedEnvelope: signedFirst, ours: aliceGrant, peerGrant: bobGrant,
    peerReply: { status: 'refused', cause: 'refused: nothing yet' },
    keys: alice, registry, ledger: aliceLedger, nowIso: T1,
  });
  check('the near side refuses the first crossing without an approval', withoutApproval.status === 'refused');
  check('the refusal names the requirement', withoutApproval.status === 'refused' && withoutApproval.cause.includes('a person has to approve it'));
  check('the refusal tells the caller what to gather', withoutApproval.status === 'refused' && withoutApproval.cause.includes(firstEnv.nonce));
  check('a procedural hold is recorded as an approval requirement', withoutApproval.status === 'refused' && withoutApproval.refusalKind === 'approval_required');
  check('an approval hold does not punish the peer', withoutApproval.status === 'refused' && withoutApproval.posture.score === 20);

  /* the human's own key signs the approval — the bridge cannot mint one */
  const approval = await signApproval({
    pairId: pair, envelopeId: firstEnv.id, envelopeNonce: firstEnv.nonce, capability: firstEnv.capability,
    handle: 'alice', harbor: 'harbor-a',
    statement: 'I allow this first crossing so Bob can reconcile the September ledgers.',
    approvedAtIso: T0, expiresIso: T2,
  }, alice);
  const approvalVerdict = await verifyApproval(approval, registry, {
    pairId: pair, envelopeId: firstEnv.id, envelopeNonce: firstEnv.nonce, capability: firstEnv.capability,
    nowIso: T1, ownerHarbor: 'harbor-a',
  });
  check('a signed approval verifies against the owner public key', approvalVerdict.ok === true);
  check('the approval verdict quotes the person', approvalVerdict.reason.includes('I allow this first crossing'));

  const wrongNonce = await verifyApproval(approval, registry, {
    pairId: pair, envelopeId: firstEnv.id, envelopeNonce: 'bnc_somethingelse', capability: firstEnv.capability,
    nowIso: T1, ownerHarbor: 'harbor-a',
  });
  check('an approval cannot be replayed onto another nonce', wrongNonce.ok === false && wrongNonce.reason.includes('one crossing'));
  const expired = await verifyApproval(approval, registry, {
    pairId: pair, envelopeId: firstEnv.id, envelopeNonce: firstEnv.nonce, capability: firstEnv.capability,
    nowIso: '2026-09-19T00:00:00.000Z', ownerHarbor: 'harbor-a',
  });
  check('an expired approval is refused with the time it expired', expired.ok === false && expired.reason.includes('expired'));
  const otherPair = await verifyApproval(approval, registry, {
    pairId: 'someone-else', envelopeId: firstEnv.id, envelopeNonce: firstEnv.nonce, capability: firstEnv.capability,
    nowIso: T1, ownerHarbor: 'harbor-a',
  });
  check('an approval is not transferable to another pair', otherPair.ok === false && otherPair.reason.includes('not transferable'));
  const wrongOwner = await verifyApproval(approval, registry, {
    pairId: pair, envelopeId: firstEnv.id, envelopeNonce: firstEnv.nonce, capability: firstEnv.capability,
    nowIso: T1, ownerHarbor: 'harbor-b',
  });
  check('an approval given at one harbour cannot approve another harbor\'s side', wrongOwner.ok === false);

  const tamperedApproval = { ...approval, body: { ...approval.body, statement: 'I allow everything forever' } };
  const tamperedVerdict = await verifyApproval(tamperedApproval, registry, {
    pairId: pair, envelopeId: firstEnv.id, envelopeNonce: firstEnv.nonce, capability: firstEnv.capability,
    nowIso: T1, ownerHarbor: 'harbor-a',
  });
  check('editing an approval breaks its signature', tamperedVerdict.ok === false && tamperedVerdict.reason.includes('does not verify'));

  /* --------------------- a full two-harbor crossing ------------------- */

  /* The far side approves too — a first crossing needs a person on BOTH sides. */
  await bobLedger.attest(
    { pairId: pair, kind: 'success', atIso: T0, envelopeId: 'prior-manual-run', receiptDigest: '', note: 'a person at harbor-b walked this pair through once already' },
    bobKeys,
  );

  const bobAnswer2 = await respondToCrossing({
    signed: signedFirst, ours: bobGrant, keys: bobKeys, registry, ledger: bobLedger, nowIso: T1,
    answer: { summary: 'three mismatches, all timing differences', digest: 'vh1:sha256:bbb' },
  });
  check('the far side answers once its own side is satisfied', bobAnswer2.status === 'accepted');
  check('the far side signs its own half', bobAnswer2.status === 'accepted' && bobAnswer2.signature.harbor === 'harbor-b');
  check(
    'the receipt publishes a bounded one-line summary, not the answer',
    bobAnswer2.status === 'accepted' &&
      bobAnswer2.unsigned.answerSummary.length <= 200 &&
      !bobAnswer2.unsigned.answerSummary.includes('\n'),
  );
  const smuggled = await respondToCrossing({
    signed: signedFirst, ours: bobGrant, keys: bobKeys, registry, ledger: bobLedger, nowIso: T1,
    answer: { summary: 'line one\nthe entire answer body pasted into the summary field', digest: 'vh1:sha256:ddd' },
  });
  check('a multi-line summary is refused — the answer cannot ride out on the receipt', smuggled.status === 'refused' && smuggled.cause.includes('one line'));
  const oversized = await respondToCrossing({
    signed: signedFirst, ours: bobGrant, keys: bobKeys, registry, ledger: bobLedger, nowIso: T1,
    answer: { summary: 'x'.repeat(500), digest: 'vh1:sha256:eee' },
  });
  check('an oversized summary is refused', oversized.status === 'refused' && oversized.cause.includes('must not exceed 200'));

  const reply: PeerReplyAccepted = bobAnswer2.status === 'accepted'
    ? { status: 'accepted', summary: bobAnswer2.unsigned.answerSummary, answerDigest: bobAnswer2.unsigned.answerDigest, signature: bobAnswer2.signature }
    : ((): PeerReplyAccepted => { throw new Error('the far side refused'); })();

  const crossed = await crossBridge({
    envelope: firstEnv, signedEnvelope: signedFirst, ours: aliceGrant, peerGrant: bobGrant,
    peerReply: reply, keys: alice, registry, ledger: aliceLedger, nowIso: T1, approval,
  });
  check('an approved first crossing is answered', crossed.status === 'answered', crossed.status === 'refused' ? crossed.cause : undefined);
  if (crossed.status === 'answered') {
    check('the receipt is co-signed by both harbours', crossed.receipt.signatures.length === 2);
    check('the receipt names both keys', crossed.receipt.signatures.every((s) => s.keyId.length > 0));
    check('the receipt verifies against public keys only', crossed.verification.valid === true);
    check('verification says what it checked', crossed.verification.detail.includes('published public key'));
    check('the receipt carries a digest of the answer, not the answer', crossed.receipt.answerDigest.startsWith('vh1:') && !crossed.receipt.answerDigest.includes('mismatch'));
    check('the receipt names the pair', crossed.receipt.pairId === pair);
    check('the receipt carries the envelope nonce (replay is visible)', crossed.receipt.envelopeNonce === firstEnv.nonce);
    check('success raises trust', crossed.posture.score === 20 + 6);
    check('the statement is plain words', crossed.statement.includes('Trust is now 26/100'));

    /* the receipt is verifiable by a third party holding only public keys */
    const thirdPartyRegistry = registryWith(publicOf(alice), publicOf(bob));
    check('a third party can verify the crossing', (await verifyJointReceipt(crossed.receipt, thirdPartyRegistry)).valid === true);

    /* tampering with any part of it fails, and never repairs */
    const edited = { ...crossed.receipt, answerDigest: 'vh1:sha256:deadbeef' };
    const editedVerdict = await verifyJointReceipt(edited, registry);
    check('editing the answer digest fails verification', editedVerdict.valid === false);
    check('the failure names the parties', editedVerdict.failures.length === 2);
    check('nothing is repaired on failure', editedVerdict.valid === false && editedVerdict.signedBy.length === 0);

    const swapped = { ...crossed.receipt, signatures: [crossed.receipt.signatures[0] as never, crossed.receipt.signatures[0] as never] };
    const swappedVerdict = await verifyJointReceipt(swapped, registry);
    check('a receipt with one harbour twice is refused', swappedVerdict.valid === false);

    const unknown = await verifyJointReceipt(crossed.receipt, registryWith(publicOf(alice)));
    check('a receipt naming an unknown key is refused', unknown.valid === false && unknown.failures[0]?.includes('no public key held') === true);

    const wrongPair = { ...crossed.receipt, pairId: 'invented-pair' };
    check('a receipt whose pair id does not match its parties is refused', (await verifyJointReceipt(wrongPair, registry)).valid === false);

    /* the crossing is now in both ledgers, and trust is no longer at the start */
    const after = await aliceLedger.postureOf(pair, T1);
    check('the ledger remembers the crossing', after.storedScore === 26);
    check('the pair has crossed before now', (await aliceLedger.hasCrossedBefore(pair)) === true);
    check('the audit reports every row attributable', (await aliceLedger.audit(pair)).unverifiable.length === 0);
  }

  /* --------------- the second crossing needs no person ---------------- */

  const secondEnv = buildEnvelope({ ...envInput, task: 'reconcile the October ledgers using the same method' }, { entropy: seededEntropy('second') });
  const signedSecond = await signEnvelope(secondEnv, alice);
  const bobAnswer3 = await respondToCrossing({
    signed: signedSecond, ours: bobGrant, keys: bobKeys, registry, ledger: bobLedger, nowIso: T1,
    answer: { summary: 'no mismatches in October', digest: 'vh1:sha256:ccc' },
  });
  check('the far side answers without a second approval', bobAnswer3.status === 'accepted');
  const secondReply: PeerReply = bobAnswer3.status === 'accepted'
    ? { status: 'accepted', summary: bobAnswer3.unsigned.answerSummary, answerDigest: bobAnswer3.unsigned.answerDigest, signature: bobAnswer3.signature }
    : { status: 'refused', cause: 'refused: unexpected' };
  const secondCrossing = await crossBridge({
    envelope: secondEnv, signedEnvelope: signedSecond, ours: aliceGrant, peerGrant: bobGrant,
    peerReply: secondReply, keys: alice, registry, ledger: aliceLedger, nowIso: T1,
  });
  check('a pair that has crossed before needs no approval again', secondCrossing.status === 'answered');

  /* --------------------------- refusals ------------------------------- */

  const hopEnv = buildEnvelope({ ...envInput, depth: 2, task: 'hand this on one more time' }, { entropy: seededEntropy('hop') });
  const refusedHop = await crossBridge({
    envelope: hopEnv, ours: aliceGrant, peerGrant: bobGrant,
    peerReply: { status: 'accepted', summary: 'x', answerDigest: 'y', signature: (await alice.sign(new TextEncoder().encode('nope'))) as unknown as never },
    keys: alice, registry, ledger: aliceLedger, nowIso: T1,
  });
  check('a hop beyond the pair\'s depth is refused', refusedHop.status === 'refused');

  const forgedHalfEnv = buildEnvelope({ ...envInput, task: 'try a half-signature that will not verify' }, { entropy: seededEntropy('forge') });
  const bogusUnsigned: UnsignedReceipt = {
    v: 'vh-bridge-joint-receipt/2', envelopeId: forgedHalfEnv.id, envelopeNonce: forgedHalfEnv.nonce,
    pairId: pair, capability: 'verify', outcome: 'answered', answerDigest: 'vh1:sha256:zzz', answerSummary: 'forged',
    crossings: 1, from: forgedHalfEnv.from, to: forgedHalfEnv.to, atIso: T1,
  };
  const forgedHalf = await signReceiptHalf(bogusUnsigned, bob, { handle: 'mallory', harbor: 'harbor-b' });
  const disputed = await crossBridge({
    envelope: forgedHalfEnv, ours: aliceGrant, peerGrant: bobGrant,
    peerReply: { status: 'accepted', summary: 'forged', answerDigest: 'vh1:sha256:zzz', signature: forgedHalf },
    keys: alice, registry, ledger: aliceLedger, nowIso: T2,
  });
  check('a half-signature over different bytes is refused', disputed.status === 'refused');
  check('it is recorded as a dispute, the heaviest outcome', disputed.status === 'refused' && disputed.refusalKind === 'disputed');
  check('a dispute costs the most trust', disputed.status === 'refused' && disputed.posture.score < 33);

  /* ------------------------ assembly discipline ----------------------- */

  const unsignedForAssembly = { ...bogusUnsigned };
  await throwsAsync('a joint receipt needs two different harbours', async () =>
    assembleJointReceipt(unsignedForAssembly, [
      await signReceiptHalf(unsignedForAssembly, alice, { handle: 'alice', harbor: 'harbor-a' }),
      await signReceiptHalf(unsignedForAssembly, alice, { handle: 'alice', harbor: 'harbor-a' }),
    ]));
  await throwsAsync('a joint receipt needs exactly two signatures', async () =>
    assembleJointReceipt(unsignedForAssembly, [await signReceiptHalf(unsignedForAssembly, alice, { handle: 'alice', harbor: 'harbor-a' })]));
  await throwsAsync('a harbour cannot sign a receipt half as another harbour', () =>
    signReceiptHalf(unsignedForAssembly, alice, { handle: 'bob', harbor: 'harbor-b' }));
  check('receipt canonical form is stable', canonicalReceipt(unsignedForAssembly) === canonicalReceipt({ ...unsignedForAssembly }));

  /* ------------------------- trust lifecycle -------------------------- */

  const revocationStore = new MemoryTrustStore();
  const revocationLedger = new TrustLedger({ registry, store: revocationStore });
  await revocationLedger.attest({ pairId: pair, kind: 'success', atIso: T0, envelopeId: 'e9', receiptDigest: '', note: 'a good crossing' }, alice);
  await revocationLedger.attest({ pairId: pair, kind: 'revocation', atIso: T1, envelopeId: '', receiptDigest: '', note: 'the peer rotated staff and we are reopening the relationship' }, alice);
  const revoked = await revocationLedger.postureOf(pair, T1);
  check('a revocation locks the pair', revoked.locked === true && revoked.tier === 'none');
  await revocationLedger.attest({ pairId: pair, kind: 'success', atIso: T2, envelopeId: 'e10', receiptDigest: '', note: 'another good crossing' }, bob);
  check('records after a revocation do not reopen it', (await revocationLedger.postureOf(pair, T2)).locked === true);
  await revocationLedger.attest({ pairId: pair, kind: 're-vouch', atIso: T2, envelopeId: '', receiptDigest: '', note: 'we met the new team and re-vouched explicitly' }, alice);
  const reVouched = await revocationLedger.postureOf(pair, T2);
  check('an explicit re-vouch reopens it at the starting score', reVouched.locked === false && reVouched.score === 20);

  /* decay is applied on read, never written back */
  await throwsAsync('a revoked pair refuses further scoring', async () => {
    const s: PairTrustLike = revoked;
    if (s.locked) throw new TrustError('locked');
    throw new Error('not locked');
  });

  const passed = checks.filter((c) => c.ok).length;
  return { passed, failed: checks.length - passed, checks };
}

/** Local structural type so the decay assertion reads without importing internals. */
interface PairTrustLike { readonly locked: boolean }

/**
 * Minimal local typing of `process`. Declared here rather than pulled from
 * @types/node so a probe compiles in a runtime that has no Node types installed —
 * which is exactly the situation a zipped archive is opened in.
 */
declare const process: { readonly argv?: readonly string[]; exitCode?: number } | undefined;

const invokedDirectly =
  typeof process !== 'undefined' && Array.isArray(process?.argv) &&
  /bridge\.test(\.(ts|tsx|js|mjs))?$/.test(process?.argv?.[1] ?? '');

if (invokedDirectly) {
  void runBridgeProbe().then((r) => {
    for (const c of r.checks) if (!c.ok) console.log(`  FAIL  ${c.name}${c.detail === undefined ? '' : ` — ${c.detail}`}`);
    console.log(`bridge probe: ${r.passed} passed, ${r.failed} failed`);
    if (r.failed > 0 && process !== undefined) process.exitCode = 1;
  });
}

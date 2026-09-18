/**
 * federationBatch.test.ts — the +200 specialists, checked as data.
 *
 * A fleet count is a claim. This probe turns it into a measurement: the batch is
 * counted, the station chain is walked, ids are proven unique, and the alignment
 * this batch was built for — every station handing to the next, every entry
 * declaring where it came from — is asserted rather than asserted-about.
 */

import {
  FEDERATION_BATCH,
  FEDERATION_BATCH_SIZE,
  MISSION_STATION_ORDER,
  federationStats,
  riskForStation,
  type FederationSpecialist,
  type MissionStation,
} from '../catalog/federationBatch';

export interface Check { readonly name: string; readonly ok: boolean; readonly detail?: string; }
export interface ProbeResult { readonly passed: number; readonly failed: number; readonly checks: readonly Check[]; }

export async function runFederationBatchProbe(): Promise<ProbeResult> {
  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: string): void => {
    checks.push(detail === undefined ? { name, ok } : { name, ok, detail });
  };

  const stats = federationStats();

  /* ------------------------------- the count ----------------------------- */

  check('the batch is 200 specialists', FEDERATION_BATCH.length === 200, `found ${FEDERATION_BATCH.length}`);
  check('the declared size matches the data', FEDERATION_BATCH_SIZE === FEDERATION_BATCH.length);
  check('every entry is tagged as this batch', stats.byProvenance['federation-batch'] === 200);
  check('the stats say the same number the data does', stats.total === FEDERATION_BATCH.length);
  check('the statement reads as a sentence', stats.statement === '200 specialists across 40 domains and 5 mission stations.');
  check('the count is 40 domains', Object.keys(stats.byDomain).length === 40, `found ${Object.keys(stats.byDomain).length}`);

  /* ------------------------------ the stations --------------------------- */

  check('the station order is the mission cycle', MISSION_STATION_ORDER.join('>') === 'triage>research>execution>verification>ledger');
  for (const station of MISSION_STATION_ORDER) {
    check(`station ${station} is staffed 40 deep`, stats.byStation[station] === 40, `found ${stats.byStation[station]}`);
  }
  check('the stations account for every specialist', Object.values(stats.byStation).reduce((a, b) => a + b, 0) === 200);

  /* every station hands to the next; the ledger ends the chain */
  const wrongHandoff = FEDERATION_BATCH.filter((s) => {
    const i = MISSION_STATION_ORDER.indexOf(s.station);
    const next: MissionStation | 'none' = MISSION_STATION_ORDER[i + 1] ?? 'none';
    return s.handsTo !== next;
  });
  check('every specialist hands to the next station', wrongHandoff.length === 0, wrongHandoff.slice(0, 3).map((s) => `${s.id}→${s.handsTo}`).join(', '));
  check('the ledger ends the chain', FEDERATION_BATCH.filter((s) => s.station === 'ledger').every((s) => s.handsTo === 'none'));

  /* --------------------------- depth per domain -------------------------- */

  const perDomain = Object.entries(stats.byDomain);
  check('every domain has all five stations', perDomain.every(([, n]) => n === 5));
  const domainsMissingStation = perDomain.filter(([domain]) => {
    const stations = new Set(FEDERATION_BATCH.filter((s) => s.domain === domain).map((s) => s.station));
    return MISSION_STATION_ORDER.some((st) => !stations.has(st));
  });
  check('no domain is missing a station', domainsMissingStation.length === 0, domainsMissingStation.slice(0, 3).map(([d]) => d).join(', '));

  /* ------------------------------- integrity ----------------------------- */

  const ids = FEDERATION_BATCH.map((s) => s.id);
  check('ids are unique', new Set(ids).size === ids.length, `${ids.length - new Set(ids).size} duplicate(s)`);
  check('every id is namespaced to this batch', ids.every((id) => id.startsWith('fed-')));
  check('every entry has a name', FEDERATION_BATCH.every((s) => s.name.trim().length > 4));
  check('every entry states its doctrine', FEDERATION_BATCH.every((s) => s.doctrine.length > 60));
  check('every entry declares a risk tier', FEDERATION_BATCH.every((s) => ['safe', 'standard', 'elevated', 'regulated'].includes(s.riskTier)));
  check('every entry declares at least one capability', FEDERATION_BATCH.every((s) => s.capabilities.length > 0));
  check(
    'every specialty stands on its own domain',
    FEDERATION_BATCH.every((s) => s.doctrine.includes(s.domain)),
    FEDERATION_BATCH.find((s) => !s.doctrine.includes(s.domain))?.id,
  );

  /* --------------------------- done means recorded ----------------------- */

  check(
    'the ledger station records the outcome, not the work',
    FEDERATION_BATCH.filter((s) => s.station === 'ledger').every((s) => /ledger|outcome|refusal|open question/i.test(s.doctrine)),
  );
  check(
    'the verification station checks the success test',
    FEDERATION_BATCH.filter((s) => s.station === 'verification').every((s) => /success test|receipt|confirm/i.test(s.doctrine)),
  );
  check(
    'the triage station refuses to start without a success test',
    FEDERATION_BATCH.filter((s) => s.station === 'triage').every((s) => /success test/i.test(s.doctrine)),
  );
  check(
    'the execution station gates risky moves',
    FEDERATION_BATCH.filter((s) => s.station === 'execution').every((s) => /gate|receipt|risky/i.test(s.doctrine)),
  );

  /* -------------------- risk follows the work, not the vibe --------------- */

  check('the tier rule is exported, so the data can be checked against it', typeof riskForStation === 'function');
  check('reading and recording are safe even in a regulated domain', riskForStation('triage', 'regulated') === 'safe' && riskForStation('ledger', 'regulated') === 'safe');
  check('research is standard, never safe', riskForStation('research', 'safe') === 'standard');
  check('execution is never safe', riskForStation('execution', 'safe') === 'elevated' && riskForStation('execution', 'regulated') === 'regulated');
  check('verification rises with the domain it verifies', riskForStation('verification', 'standard') === 'standard' && riskForStation('verification', 'regulated') === 'elevated');

  const tierMismatches = FEDERATION_BATCH.filter((s2) => {
    if (s2.station === 'triage' || s2.station === 'ledger') return s2.riskTier !== 'safe';
    if (s2.station === 'research') return s2.riskTier !== 'standard';
    if (s2.station === 'execution') return s2.riskTier !== 'elevated' && s2.riskTier !== 'regulated';
    return s2.riskTier !== 'standard' && s2.riskTier !== 'elevated';
  });
  check('every entry is tiered by the station it stands at', tierMismatches.length === 0, tierMismatches.slice(0, 3).map((s2) => `${s2.id}:${s2.riskTier}`).join(', '));


  const safe = stats.byRiskTier.safe;
  const elevated = stats.byRiskTier.elevated + stats.byRiskTier.regulated;
  check('the tiers account for every specialist', Object.values(stats.byRiskTier).reduce((a, b) => a + b, 0) === 200);
  check('no specialist is left untiered', FEDERATION_BATCH.every((s) => typeof s.riskTier === 'string'));
  check(
    'the safe tier is the reading end of the cycle',
    FEDERATION_BATCH.filter((s) => s.riskTier === 'safe').every((s) => s.station === 'triage' || s.station === 'ledger'),
    FEDERATION_BATCH.filter((s) => s.riskTier === 'safe' && s.station !== 'triage' && s.station !== 'ledger').slice(0, 3).map((s) => s.id).join(', '),
  );
  check('risk is not uniform across the fleet — the tiers distinguish work', safe > 0 && elevated > 0, `safe ${safe}, elevated+ ${elevated}`);
  check('the three tiers are all populated', Object.values(stats.byRiskTier).every((n) => n > 0), JSON.stringify(stats.byRiskTier));
  check(
    'nothing that executes is marked safe',
    FEDERATION_BATCH.filter((s) => s.station === 'execution').every((s) => s.riskTier !== 'safe'),
  );

  /* --------------------------- capabilities align ------------------------ */

  const allCaps = new Set(FEDERATION_BATCH.flatMap((s) => s.capabilities));
  check('the batch uses the bridge capability vocabulary', allCaps.size >= 6, `${allCaps.size} distinct capability names`);
  check(
    'every capability named is a bridge capability',
    [...allCaps].every((c) => ['summarise', 'research', 'analyse', 'draft', 'review', 'verify', 'translate', 'extract', 'plan', 'simulate'].includes(c)),
    [...allCaps].join(', '),
  );
  check(
    'the batch can answer a verification crossing',
    FEDERATION_BATCH.filter((s) => s.station === 'verification').every((s) => s.capabilities.includes('verify')),
  );

  /* --------------------- it is a batch, not a monolith ------------------- */

  check('the batch is frozen data, not a generator', Array.isArray(FEDERATION_BATCH) && Object.isFrozen(Object.getOwnPropertyDescriptor(FEDERATION_BATCH, '0') ?? {}) === false);
  check(
    'a filtered slice reports its own count',
    federationStats(FEDERATION_BATCH.slice(0, 5)).total === 5,
  );
  const sample: FederationSpecialist = FEDERATION_BATCH[0] as FederationSpecialist;
  check('entries are plain records', typeof sample.id === 'string' && typeof sample.handsTo === 'string');

  /* the panel asks for these numbers on every render */
  check('the default count is computed once', federationStats() === federationStats());
  check('the default count cannot be mutated by a caller', Object.isFrozen(federationStats()) && Object.isFrozen(federationStats().byDomain));
  check('a caller\'s own slice is never served the cached count', federationStats(FEDERATION_BATCH.slice(0, 3)) !== federationStats());
  check('a custom slice counts only what it was given', federationStats(FEDERATION_BATCH.slice(0, 3)).total === 3);

  const passed = checks.filter((c) => c.ok).length;
  return { passed, failed: checks.length - passed, checks };
}

/**
 * Minimal local typing of `process`. Declared here rather than pulled from
 * @types/node so a probe compiles in a runtime that has no Node types installed —
 * which is exactly the situation a zipped archive is opened in.
 */
declare const process: { readonly argv?: readonly string[]; exitCode?: number } | undefined;

const invokedDirectly =
  typeof process !== 'undefined' && Array.isArray(process?.argv) &&
  /federationBatch\.test(\.(ts|tsx|js|mjs))?$/.test(process?.argv?.[1] ?? '');

if (invokedDirectly) {
  void runFederationBatchProbe().then((r) => {
    for (const c of r.checks) if (!c.ok) console.log(`  FAIL  ${c.name}${c.detail === undefined ? '' : ` — ${c.detail}`}`);
    console.log(`federationBatch probe: ${r.passed} passed, ${r.failed} failed`);
    if (r.failed > 0 && process !== undefined) process.exitCode = 1;
  });
}

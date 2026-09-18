#!/usr/bin/env node
/**
 * generate-federation-batch.mjs — the +200 specialists are generated, not typed.
 *
 * WHY THIS EXISTS. Two hundred hand-written records drift. One of them eventually
 * gets a tier that does not match its station, a station that hands to the wrong
 * place, or a doctrine that no longer describes the work — and nobody notices,
 * because 200 records are read by nobody. So the batch is derived from this one
 * table, and `--check` proves the file on disk still matches what the table says.
 *
 *   node tools/generate-federation-batch.mjs          # rewrite catalog/federationBatch.ts
 *   node tools/generate-federation-batch.mjs --check  # exit 1 if the file has drifted
 *
 * The rule the tier column follows is `riskForStation()`: the station sets the
 * floor, the domain raises it. Keep those two in step — the probe checks the data
 * against the exported function, and this script writes the data the function
 * would produce.
 *
 * Zero dependencies. Deterministic: the same table always emits the same bytes.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TARGET = join(ROOT, 'catalog', 'federationBatch.ts');

/** [domain, category, slug, floor] — the floor applies to execution and verification. */
const DOMAINS = [
  ['Banking Operations', 'financial-services', 'bankingoperations', 'regulated'],
  ['Payments & Settlement', 'financial-services', 'paymentssettlement', 'regulated'],
  ['Insurance Underwriting', 'financial-services', 'insuranceunderwriting', 'regulated'],
  ['Insurance Claims', 'financial-services', 'insuranceclaims', 'regulated'],
  ['Wealth & Asset Management', 'financial-services', 'wealthassetmanagement', 'regulated'],
  ['Corporate Treasury', 'financial-services', 'corporatetreasury', 'regulated'],
  ['Trade Finance', 'financial-services', 'tradefinance', 'regulated'],
  ['Retail Banking Compliance', 'financial-services', 'retailbankingcompliance', 'regulated'],
  ['Healthcare Revenue Cycle', 'healthcare', 'healthcarerevenuecycle', 'regulated'],
  ['Clinical Research Operations', 'healthcare', 'clinicalresearchoperations', 'regulated'],
  ['Pharmacovigilance', 'healthcare', 'pharmacovigilance', 'regulated'],
  ['Medical Device Quality', 'healthcare', 'medicaldevicequality', 'regulated'],
  ['Public Health Reporting', 'healthcare', 'publichealthreporting', 'regulated'],
  ['Legal Contract Lifecycle', 'legal', 'legalcontractlifecycle', 'standard'],
  ['Litigation Support', 'legal', 'litigationsupport', 'standard'],
  ['Intellectual Property', 'legal', 'intellectualproperty', 'standard'],
  ['Data Protection & Privacy', 'legal', 'dataprotectionprivacy', 'regulated'],
  ['Procurement & Sourcing', 'operations', 'procurementsourcing', 'standard'],
  ['Supply Chain Logistics', 'operations', 'supplychainlogistics', 'standard'],
  ['Warehouse & Fulfilment', 'operations', 'warehousefulfilment', 'standard'],
  ['Manufacturing Quality', 'industrial', 'manufacturingquality', 'standard'],
  ['Industrial Maintenance', 'industrial', 'industrialmaintenance', 'standard'],
  ['Energy Grid Operations', 'energy', 'energygridoperations', 'standard'],
  ['Oil & Gas Asset Integrity', 'energy', 'oilgasassetintegrity', 'standard'],
  ['Renewables & Carbon Accounting', 'energy', 'renewablescarbonaccounting', 'standard'],
  ['Utilities Billing', 'energy', 'utilitiesbilling', 'standard'],
  ['Telecom Network Operations', 'telecom', 'telecomnetworkoperations', 'standard'],
  ['Telecom Revenue Assurance', 'telecom', 'telecomrevenueassurance', 'standard'],
  ['Aviation Maintenance', 'transport', 'aviationmaintenance', 'regulated'],
  ['Maritime Freight', 'transport', 'maritimefreight', 'standard'],
  ['Rail Operations', 'transport', 'railoperations', 'standard'],
  ['Automotive Fleet', 'transport', 'automotivefleet', 'standard'],
  ['Construction Project Controls', 'built-environment', 'constructionprojectcontrols', 'standard'],
  ['Real Estate Portfolio', 'built-environment', 'realestateportfolio', 'standard'],
  ['Agritech Yield', 'agriculture', 'agritechyield', 'standard'],
  ['Food Safety', 'agriculture', 'foodsafety', 'regulated'],
  ['Mining Safety', 'extractives', 'miningsafety', 'regulated'],
  ['Public Sector Casework', 'public-sector', 'publicsectorcasework', 'regulated'],
  ['Defence Logistics Sustainment', 'defence', 'defencelogisticssustainment', 'regulated'],
  ['Higher Education Accreditation', 'education', 'highereducationaccreditation', 'standard'],
];

/** The five stations, in the order a mission walks them. */
const STATIONS = [
  {
    station: 'triage',
    suffix: 'Intake & Triage',
    doctrine: (d) =>
      `Intake & Triage for ${d}: states the ask in one line, names what would make it wrong, and refuses to start without a stated success test.`,
    capabilities: ['summarise', 'extract', 'plan'],
    handsTo: 'research',
    tier: () => 'safe',
  },
  {
    station: 'research',
    suffix: 'Evidence & Research',
    doctrine: (d) =>
      `Evidence & Research for ${d}: files evidence before the claim, dates every live source, and marks anything it could not verify.`,
    capabilities: ['research', 'extract', 'verify'],
    handsTo: 'execution',
    tier: () => 'standard',
  },
  {
    station: 'execution',
    suffix: 'Execution & Build',
    doctrine: (d) =>
      `Execution & Build for ${d}: gates every risky move, mints a receipt per tool call, and reports failures in words rather than guessing.`,
    capabilities: ['draft', 'analyse', 'simulate'],
    handsTo: 'verification',
    tier: (floor) => (floor === 'regulated' ? 'regulated' : 'elevated'),
  },
  {
    station: 'verification',
    suffix: 'Verification & Review',
    doctrine: (d) =>
      `Verification & Review for ${d}: checks the work against the stated success test and against the receipt chain, and says plainly what it could not confirm.`,
    capabilities: ['review', 'verify', 'analyse'],
    handsTo: 'ledger',
    tier: (floor) => (floor === 'regulated' ? 'elevated' : 'standard'),
  },
  {
    station: 'ledger',
    suffix: 'Reporting & Ledger',
    doctrine: (d) =>
      `Reporting & Ledger for ${d}: writes the outcome, the refusals and the open questions into the ledger so the next run starts informed.`,
    capabilities: ['summarise', 'draft', 'translate'],
    handsTo: 'none',
    tier: () => 'safe',
  },
];

const HEADER_START = '/**\n * federationBatch.ts';
const BATCH_MARKER = 'export const FEDERATION_BATCH: readonly FederationSpecialist[] = [';
const TAIL_MARKER = 'export const FEDERATION_BATCH_SIZE';

function entry(domain, category, slug, floor, spec) {
  const caps = spec.capabilities.map((c) => `'${c}'`).join(', ');
  const doctrine = spec.doctrine(domain).replace(/'/g, "\\'");
  return `  {
    id: 'fed-${slug}-${spec.station}',
    name: '${domain.replace(/'/g, "\\'")} — ${spec.suffix}',
    domain: '${domain.replace(/'/g, "\\'")}',
    category: '${category}',
    station: '${spec.station}',
    doctrine: '${doctrine}',
    riskTier: '${spec.tier(floor)}',
    capabilities: [${caps}],
    handsTo: '${spec.handsTo}',
    provenance: 'federation-batch',
  },`;
}

function generate() {
  const lines = [];
  for (const [domain, category, slug, floor] of DOMAINS) {
    for (const spec of STATIONS) lines.push(entry(domain, category, slug, floor, spec));
  }
  return lines.join('\n');
}

const generated = generate();
const current = readFileSync(TARGET, 'utf8');

/* Splice by whole markers rather than by scanning for brackets: the array's own
   type annotation contains '[' and ']', and a naive search for the first one
   mangles the declaration. */
const OPEN = 'export const FEDERATION_BATCH: readonly FederationSpecialist[] = [';
const CLOSE = '] as const;';
const TAIL = 'export const FEDERATION_BATCH_SIZE';

const openAt = current.indexOf(OPEN);
const tailAt = current.indexOf(TAIL);
if (openAt === -1 || tailAt === -1 || current.indexOf(CLOSE) === -1) {
  console.error('federationBatch.ts is not in the shape this generator expects (markers missing).');
  process.exit(2);
}
const head = current.slice(0, openAt + OPEN.length + 1);
const tail = current.slice(tailAt);
const rebuilt = `${head}${generated}\n${CLOSE}\n\n${tail}`;

const sameCount = (generated.match(/id: 'fed-/g) ?? []).length;
if (process.argv.includes('--check')) {
  if (rebuilt !== current) {
    console.error(`catalog/federationBatch.ts has drifted from the generator (${sameCount} entries would be written).`);
    console.error('Run: node tools/generate-federation-batch.mjs');
    process.exit(1);
  }
  console.log(`federationBatch.ts matches the generator: ${sameCount} specialists across ${DOMAINS.length} domains, ${STATIONS.length} stations each.`);
  process.exit(0);
}

writeFileSync(TARGET, rebuilt);
console.log(`wrote ${sameCount} specialists across ${DOMAINS.length} domains to catalog/federationBatch.ts`);

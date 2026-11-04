import { test } from 'node:test';
import assert from 'node:assert/strict';
import snapshot from '../../src/snapshot.js';
import { PART2, PART3, PART4 } from './fixtures.mjs';
import {
  findings, smallMolecules, decadeOf, propertyByDecade, elementShares, elementByDecade, ringCounts, chiralityByDecade, stemCounts, flagCounts, atcGroups, typeGroups, systemName,
} from '../../src/findings.js';

const drug = (id, over = {}) => ({
  id, name: id.toUpperCase(), type: 'Small molecule', year: 1990, routes: ['oral'], atc: [], p: { mw: 300, ro5: 0, alogp: 2, psa: 60, hbd: 1, hba: 4, rtb: 3, qed: 0.6 },
  chem: { rings: ['benzene'], systems: 1, fsp3: 0.3, stereo: 0, elements: ['C', 'N', 'O'] }, chirality: 2, flags: [], stem: null, ...over,
});

const fixture = {
  generated: '2026-11-08T06:17:00.000Z',
  chembl: { release: 'ChEMBL_37', date: '2026-05-01', activities: 24527044, atc: { L: 'ANTINEOPLASTIC AND IMMUNOMODULATING AGENTS', N: 'NERVOUS SYSTEM' } },
  drugs: [
    drug('a', { year: 1955, p: { mw: 250, ro5: 0, qed: 0.7 }, chem: { rings: ['benzene', 'piperidine'], systems: 2, fsp3: 0.4, stereo: 0, elements: ['C', 'N'] }, atc: ['N05AA01'], stem: { stem: '-azepam', definition: 'antianxiety agents' } }),
    drug('b', { year: 1958, p: { mw: 310, ro5: 1, qed: 0.6 }, chirality: 0, chem: { rings: ['piperidine'], systems: 1, fsp3: 0.5, stereo: 1, elements: ['C', 'Cl', 'N'] }, atc: ['N02BA01', 'N02BE01'] }),
    drug('c', { year: 2012, p: { mw: 450, ro5: 2, qed: 0.4 }, chirality: 1, chem: { rings: ['benzene', 'pyridine'], systems: 2, fsp3: 0.2, stereo: 2, elements: ['C', 'F', 'N'] }, flags: ['boxed warning'], atc: ['L01EA01'], stem: { stem: '-tinib', definition: 'tyrosine kinase inhibitors' } }),
    drug('d', { year: 2015, p: { mw: 470, ro5: 0, qed: 0.5 }, chirality: 1, chem: { rings: ['benzene'], systems: 1, fsp3: 0.3, stereo: 1, elements: ['C', 'F', 'O'] }, flags: ['boxed warning', 'withdrawn'], atc: ['L01EA02'], stem: { stem: '-tinib', definition: 'tyrosine kinase inhibitors' } }),
    drug('e', { year: 2018, p: { mw: 500, ro5: 0, qed: 0.3 }, chirality: 2, chem: { rings: [], systems: 0, fsp3: 1, stereo: 0, elements: ['C', 'O'] }, atc: [] }),
    drug('f', {
      type: 'Antibody', year: 2016, p: null, chem: null, mol: null, flags: ['orphan'], stem: { stem: '-mab; -mab', definition: 'monoclonal antibodies: humanized' }, atc: ['L04AC01'],
    }),
    drug('g', { type: 'Protein', year: null, p: null, chem: null, mol: null, atc: [] }),
  ],
  ...PART2,
  ...PART3,
  ...PART4,
};

test('smallMolecules and decadeOf group approved small molecules by first approval', () => {
  assert.deepEqual(smallMolecules(fixture).map((d) => d.id), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(decadeOf(1958), 1950);
  assert.equal(decadeOf(null), null);
});

test('typeGroups counts drugs by molecule type, largest first', () => {
  assert.deepEqual(typeGroups(fixture), [{ type: 'Small molecule', n: 5 }, { type: 'Antibody', n: 1 }, { type: 'Protein', n: 1 }]);
});

test('propertyByDecade summarises a property for each decade with enough drugs', () => {
  const rows = propertyByDecade(fixture, 'mw', 2);
  assert.deepEqual(rows.map((r) => [r.decade, r.n, r.summary.median]), [[1950, 2, 280], [2010, 3, 470]]);
  assert.deepEqual([rows[0].p5, rows[0].p95], [253, 307]);
  assert.deepEqual(propertyByDecade(fixture, (d) => d.chem?.fsp3, 2).map((r) => r.summary.median), [0.45, 0.3]);
});

test('elementShares and elementByDecade measure how often an element appears', () => {
  const shares = elementShares(fixture);
  assert.deepEqual(shares.find((s) => s.el === 'F'), { el: 'F', n: 2, share: 0.4 });
  assert.deepEqual(shares.map((s) => s.el).slice(0, 2), ['C', 'N']);
  assert.deepEqual(elementByDecade(fixture, 'F', 1), [{ decade: 1950, n: 2, with: 0, share: 0 }, { decade: 2010, n: 3, with: 2, share: 2 / 3 }]);
});

test('ringCounts counts each ring name once per drug', () => {
  assert.deepEqual(ringCounts(fixture).slice(0, 3), [{ name: 'benzene', n: 3 }, { name: 'piperidine', n: 2 }, { name: 'pyridine', n: 1 }]);
});

test('chiralityByDecade splits small molecules into racemic, single stereoisomer and achiral', () => {
  assert.deepEqual(chiralityByDecade(fixture, 1), [{ decade: 1950, racemic: 1, single: 0, achiral: 1, n: 2 }, { decade: 2010, racemic: 0, single: 2, achiral: 1, n: 3 }]);
});

test('stemCounts splits combined stems and counts each once per drug', () => {
  assert.deepEqual(stemCounts(fixture), [{ stem: '-tinib', n: 2, definition: 'tyrosine kinase inhibitors' }, { stem: '-azepam', n: 1, definition: 'antianxiety agents' }, { stem: '-mab', n: 1, definition: 'monoclonal antibodies: humanized' }]);
});

test('flagCounts and atcGroups count drugs by flag and by anatomical main group', () => {
  assert.deepEqual(flagCounts(fixture), [{ flag: 'boxed warning', n: 2 }, { flag: 'orphan', n: 1 }, { flag: 'withdrawn', n: 1 }]);
  assert.deepEqual(atcGroups(fixture), [{ code: 'L', name: 'ANTINEOPLASTIC AND IMMUNOMODULATING AGENTS', n: 3 }, { code: 'N', name: 'NERVOUS SYSTEM', n: 2 }]);
});

test('systemName names common fused ring systems from their rings, in any order', () => {
  assert.equal(systemName(['benzene']), 'benzene');
  assert.equal(systemName(['pyrrole', 'benzene']), 'indole');
  assert.equal(systemName(['benzene', 'pyrrole']), 'indole');
  assert.equal(systemName(['imidazole', 'pyrimidine']), 'purine');
  assert.equal(systemName(['benzene', 'benzene']), 'naphthalene');
  assert.equal(systemName(['cyclopentane', 'cyclohexane', 'cyclohexane', '6-ring, carbocyclic, partly unsaturated']), 'steroid nucleus');
  assert.equal(systemName(['cyclopentane', 'cyclohexane', 'cyclohexane', 'cyclohexane']), 'steroid nucleus');
  assert.equal(systemName(['β-lactam', 'dihydrothiazine']), 'cephem');
  assert.equal(systemName(['β-lactam', 'thiazolidine']), 'penam');
  assert.equal(systemName(['benzene', '1,4-diazepine']), '1,4-benzodiazepine');
  assert.equal(systemName(['imidazole', 'benzene']), 'benzimidazole');
  assert.equal(systemName(['pyridine', 'benzene']), 'quinoline or isoquinoline');
  assert.equal(systemName(['benzene', 'benzene', '6-ring, S1N1, partly unsaturated']), 'phenothiazine');
  assert.equal(systemName(['piperidine', 'pyrrolidine']), 'piperidine + pyrrolidine');
});

test('systemName names ring systems that carry oxo groups', () => {
  assert.equal(systemName(['pyridine', 'benzene'], 1), 'quinolone');
  assert.equal(systemName(['imidazole', 'pyrimidine'], 2), 'xanthine');
  assert.equal(systemName(['benzene', '1,4-diazepine'], 1), '1,4-benzodiazepin-2-one');
  assert.equal(systemName(['benzene', 'pyrrole'], 1), 'oxindole');
  assert.equal(systemName(['β-lactam', 'thiazolidine'], 1), 'penam');
  assert.equal(systemName(['cyclopentane', 'cyclohexane', 'cyclohexane', 'cyclohexane'], 2), 'steroid nucleus');
  assert.equal(systemName(['piperidine'], 1), 'piperidine, with an oxo group');
});

test('findings state the molecules part as numbers', () => {
  const f = findings(fixture);
  assert.equal(f.approved, 'ChEMBL 37 counts 7 approved drugs; 5 are small molecules and 1 an antibody or antibody–drug conjugate');
  assert.equal(f.druglike, '60% of approved small molecules break none of Lipinski’s four rules; 20% break two or more');
  assert.equal(f.properties, 'The median small molecule first approved in the 2010s weighs 470 Da; in the 1950s, 280 Da');
  assert.equal(f.extremes, 'Approved small molecules run from a, 250 Da, to e, 500 Da');
  assert.equal(f.rings, 'Benzene is in 3 approved small molecules, 60% of those with a structure; piperidine is in 2');
  assert.equal(f.atoms, 'Fluorine is in 40% of approved small molecules, and in 66.7% of those first approved in the 2010s');
  assert.equal(f.stereo, 'Of small molecules first approved since 2010, 66.7% are single stereoisomers and 0% racemates');
  assert.equal(f.stems, '4 approved drugs carry a USAN stem; -tinib, tyrosine kinase inhibitors, is the commonest, on 2');
  assert.equal(f.flags, 'ChEMBL flags 2 approved drugs with a boxed warning and 1 as withdrawn somewhere');
  assert.equal(f.atc, 'Antineoplastic and immunomodulating agents is the largest ATC group, with 3 drugs; 2 approved drugs have no ATC code');
});

test('the real snapshot gives every finding as plain text without filler words', () => {
  const f = findings(snapshot);
  assert.ok(Object.keys(f).length >= 20);
  for (const key of ['classes', 'actions', 'drugged', 'network', 'gtopdb', 'orphans', 'enzymes', 'genetics', 'kinome', 'structures', 'record', 'potency', 'efficiency', 'agreement', 'kinetics', 'combinations', 'pk', 'ddi', 'cipa']) assert.ok(f[key], key);
  for (const [key, text] of Object.entries(f)) {
    assert.equal(typeof text, 'string', key);
    assert.ok(text.length > 10 && text.length < 140, `${key}: ${text}`);
    assert.doesNotMatch(text, /NaN|undefined|null|Infinity/, `${key}: ${text}`);
    assert.doesNotMatch(text, /\b(only|just|mere|merely|soar\w*|plung\w*|stagger\w*|shock\w*|remarkabl\w*|astonish\w*)\b/i, `${key}: ${text}`);
  }
});

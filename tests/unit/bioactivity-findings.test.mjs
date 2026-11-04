import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PART2, PART3 } from './fixtures.mjs';
import {
  binShares, medianBin, efficiencyPoints, agreementStats, kineticRows, drugBase, comboMatrix, topPairs, bioFindings,
} from '../../src/bioactivity.js';

const drugs = [
  {
    id: 'a', name: 'HALOPERIDOL', type: 'Small molecule', atc: [], p: { heavy: 26, alogp: 4.4 },
  },
  {
    id: 'b', name: 'LORATADINE', type: 'Small molecule', atc: [], p: { heavy: 27, alogp: 5 },
  },
  {
    id: 'c', name: 'IMATINIB', type: 'Small molecule', atc: [], p: { heavy: 37, alogp: 4.6 },
  },
  {
    id: 'f', name: 'ADALIMUMAB', type: 'Antibody', atc: [], p: null,
  },
];

const snap = {
  generated: '2026-11-08T06:17:00.000Z', chembl: { release: 'ChEMBL_37' }, drugs, ...PART2, ...PART3,
};

test('binShares turns histogram bins into shares, and medianBin finds the bin that holds the median', () => {
  assert.deepEqual(binShares([[5, 100], [6, 100], [7, 60], [8, 40]]).map((r) => [r.x, Number(r.y.toFixed(4))]), [[5, 0.3333], [6, 0.3333], [7, 0.2], [8, 0.1333]]);
  assert.equal(medianBin([[5, 100], [6, 100], [7, 60], [8, 40]]), 6);
  assert.equal(medianBin([[5, 10], [5.5, 1]]), 5);
});

test('efficiencyPoints joins approved-drug affinities to heavy atoms and ALogP for ligand and lipophilic efficiency', () => {
  assert.deepEqual(efficiencyPoints(snap), [
    {
      ligand: 'haloperidol', target: 'D2 receptor', units: 'pKi', p: 9, heavy: 26, alogp: 4.4, le: 0.47, lle: 4.6,
    },
    {
      ligand: 'loratadine', target: 'H1 receptor', units: 'pKi', p: 8.2, heavy: 27, alogp: 5, le: 0.42, lle: 3.2,
    },
    {
      ligand: 'imatinib', target: 'ABL1', units: 'pKd', p: 8.1, heavy: 37, alogp: 4.6, le: 0.3, lle: 3.5,
    },
  ]);
});

test('agreementStats gives the bias, limits of agreement and rank correlation of repeated Kd values', () => {
  const s = agreementStats(snap);
  assert.equal(s.n, 4);
  assert.equal(s.bias, 0);
  assert.equal(s.sd, 0.58);
  assert.deepEqual([s.lo, s.hi], [-1.13, 1.13]);
  assert.equal(s.within, 1);
  assert.equal(s.spearman, 0.95);
  assert.equal(s.discordant, 2);
});

test('kineticRows adds affinity and residence time to each kinetic pair', () => {
  assert.deepEqual(kineticRows(snap).map((r) => [r.molecule, r.pkd, r.residence, r.logKon, r.logKoff]), [['M1', 9, 100, 7, -2], ['M2', 9, 10000, 5, -4], ['M3', 9, 1000, 6, -3]]);
});

test('drugBase drops salt names and lowercases drug names', () => {
  assert.equal(drugBase('Estramustine phosphate sodium'), 'estramustine');
  assert.equal(drugBase('Imatinib mesylate'), 'imatinib');
  assert.equal(drugBase('Gemcitabine hydrochloride'), 'gemcitabine');
  assert.equal(drugBase('Vinorelbine tartrate'), 'vinorelbine');
  assert.equal(drugBase('Arsenic trioxide'), 'arsenic trioxide');
});

test('comboMatrix lays pair scores out as a symmetric matrix with a cluster order, and topPairs ranks them', () => {
  const m = comboMatrix(snap);
  assert.deepEqual(m.names, ['methotrexate', 'thioguanine', 'chlorambucil']);
  assert.deepEqual(m.values, [[null, 5, -3], [5, null, 12], [-3, 12, null]]);
  assert.deepEqual([...m.order].sort(), [0, 1, 2]);
  assert.deepEqual(topPairs(snap, 2), [{
    a: 'thioguanine', b: 'chlorambucil', score: 12, cells: 60,
  }, {
    a: 'methotrexate', b: 'thioguanine', score: 5, cells: 60,
  }]);
  assert.deepEqual(topPairs(snap, 1, -1), [{
    a: 'methotrexate', b: 'chlorambucil', score: -3, cells: 58,
  }]);
});

test('bioFindings state the bioactivity part as numbers', () => {
  const f = bioFindings(snap);
  assert.equal(f.record, 'ChEMBL 37 holds 1,000 activity records; 40% come from the literature and 30% carry a pChEMBL value');
  assert.equal(f.potency, 'Measured potencies in ChEMBL centre on pChEMBL 6 to 6.5; approved drugs bind their primary targets at a median of 8.1');
  assert.equal(f.efficiency, 'Approved drugs have a median ligand efficiency of 0.42 kcal/mol per heavy atom at their primary targets; 33.3% fall below 0.3');
  assert.equal(f.agreement, 'Repeated on the same platform, 100% of 4 kinase Kd values agree within half a log unit; 2 pairs bound in only one run');
  assert.equal(f.kinetics, 'In K4DD, residence times run from 1.7 min to 2.8 h across 3 compound–target pairs on 2 targets');
  assert.equal(f.combinations, 'In NCI-ALMANAC, thioguanine with chlorambucil beats the Bliss expectation most, by 12 points; 66.7% of 3 pairs score above zero');
});

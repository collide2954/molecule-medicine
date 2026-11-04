import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PART2 } from './fixtures.mjs';
import {
  familyCounts, actionCounts, familyActions, topTargets, degreeBins, targetHierarchy, classCounts, ecCounts, networkGraph, networkPieces, gtopdbRows, affinityByType, kinomeGroups, kinomeOrder, targetFindings,
} from '../../src/targets.js';

const drugs = [
  ['a', 'HALOPERIDOL', 'Small molecule', ['N05AD01']], ['b', 'LORATADINE', 'Small molecule', ['R06AX13']], ['c', 'IMATINIB', 'Small molecule', ['L01EA01']],
  ['d', 'DASATINIB', 'Small molecule', ['L01EA02']], ['e', 'MANNITOL', 'Small molecule', []], ['f', 'ADALIMUMAB', 'Antibody', ['L04AB04']], ['g', 'INSULIN HUMAN', 'Protein', []],
].map(([id, name, type, atc]) => ({
  id, name, type, atc,
}));

const snap = {
  generated: '2026-11-08T06:17:00.000Z', chembl: { release: 'ChEMBL_37' }, drugs, ...PART2,
};

test('familyCounts counts distinct approved drugs and targets in each target family', () => {
  assert.deepEqual(familyCounts(snap), [
    { family: 'GPCR', drugs: 2, targets: 2 }, { family: 'Kinase', drugs: 2, targets: 1 }, { family: 'Other enzyme', drugs: 1, targets: 1 }, { family: 'Other protein', drugs: 1, targets: 1 },
  ]);
});

test('actionCounts and familyActions count drug–target pairs by action', () => {
  assert.deepEqual(actionCounts(snap), [
    { action: 'INHIBITOR', pairs: 3, drugs: 2 }, { action: 'ANTAGONIST', pairs: 2, drugs: 1 }, { action: 'BINDING AGENT', pairs: 1, drugs: 1 }, { action: 'INVERSE AGONIST', pairs: 1, drugs: 1 },
  ]);
  assert.deepEqual(familyActions(snap, 2), {
    families: ['GPCR', 'Kinase', 'Other enzyme', 'Other protein'], actions: ['INHIBITOR', 'ANTAGONIST', 'REST'], counts: [[0, 2, 1], [2, 0, 0], [1, 0, 0], [0, 0, 1]],
  });
});

test('topTargets ranks targets by approved drugs with examples, and degreeBins counts drugs per target and targets per drug', () => {
  assert.deepEqual(topTargets(snap, 3), [
    {
      id: 'T2', name: 'Histamine H1 receptor', family: 'GPCR', drugs: 2, examples: ['haloperidol', 'loratadine'],
    },
    {
      id: 'T3', name: 'Tyrosine-protein kinase ABL', family: 'Kinase', drugs: 2, examples: ['imatinib', 'dasatinib'],
    },
    {
      id: 'T4', name: 'Cyclooxygenase', family: 'Other enzyme', drugs: 1, examples: ['dasatinib'],
    },
  ]);
  const bins = degreeBins(snap);
  assert.deepEqual(bins.perTarget.map((b) => [b.label, b.n]), [['1', 3], ['2', 2], ['3–5', 0], ['6–10', 0], ['11–20', 0], ['21–50', 0], ['51+', 0]]);
  assert.deepEqual(bins.perDrug.map((b) => [b.label, b.n]), [['1', 3], ['2', 2], ['3', 0], ['4–5', 0], ['6–10', 0], ['11+', 0]]);
});

test('targetHierarchy nests drug–target pairs by protein class, four levels deep', () => {
  const tree = targetHierarchy(snap);
  assert.equal(tree.value, 7);
  assert.deepEqual(tree.children.map((c) => [c.name, c.value, c.drugs, c.targets]), [['Enzyme', 3, 2, 2], ['Membrane receptor', 3, 2, 2], ['Secreted protein', 1, 1, 1]]);
  assert.deepEqual(tree.children[0].children.map((c) => c.name), ['Kinase', 'Oxidoreductase']);
  const deepest = tree.children[0].children[0].children[0].children[0];
  assert.equal(deepest.name, 'TK protein kinase group');
  assert.deepEqual(deepest.children, []);
});

test('classCounts and ecCounts count targets and drugs by class and by EC number', () => {
  assert.deepEqual(classCounts(snap, ['Enzyme'], 1), [{ name: 'Kinase', targets: 1, drugs: 2 }, { name: 'Oxidoreductase', targets: 1, drugs: 1 }]);
  assert.deepEqual(classCounts(snap, ['Membrane receptor'], 2), [{ name: 'Small molecule receptor (family A GPCR)', targets: 2, drugs: 2 }]);
  assert.deepEqual(ecCounts(snap).map((r) => [r.ec, r.name, r.targets, r.drugs]), [
    ['1', 'oxidoreductases', 1, 1], ['2', 'transferases', 1, 2], ['3', 'hydrolases', 0, 0], ['4', 'lyases', 0, 0], ['5', 'isomerases', 0, 0], ['6', 'ligases', 0, 0], ['7', 'translocases', 0, 0],
  ]);
});

test('networkGraph names the laid-out nodes and counts their links', () => {
  const g = networkGraph(snap);
  assert.equal(g.nodes.length, 10);
  assert.deepEqual(g.nodes[0], {
    id: 'a', kind: 'drug', name: 'haloperidol', group: 'N', degree: 2, x: 0.1, y: 0.2,
  });
  assert.deepEqual(g.nodes[5], {
    id: 'T2', kind: 'target', name: 'Histamine H1 receptor', group: 'GPCR', degree: 2, x: 0.15, y: 0.25,
  });
  assert.deepEqual(g.edges, PART2.network.edges);
});

test('networkPieces counts drugs, targets and target families in each connected piece, largest first', () => {
  assert.deepEqual(networkPieces(snap), [
    { drugs: 2, targets: 2, families: [{ family: 'GPCR', n: 2 }] },
    { drugs: 2, targets: 2, families: [{ family: 'Kinase', n: 1 }, { family: 'Other enzyme', n: 1 }] },
    { drugs: 1, targets: 1, families: [{ family: 'Other protein', n: 1 }] },
  ]);
});

test('gtopdbRows splits each target type by its ligands, and affinityByType summarises approved affinities', () => {
  assert.deepEqual(gtopdbRows(snap), [
    {
      type: 'gpcr', label: 'GPCRs', targets: 10, approved: 5, otherLigand: 3, none: 2, orphans: 2, endogenous: 6,
    },
    {
      type: 'enzyme', label: 'enzymes', targets: 20, approved: 4, otherLigand: 8, none: 8, orphans: 0, endogenous: 1,
    },
    {
      type: 'transporter', label: 'transporters', targets: 5, approved: 1, otherLigand: 0, none: 4, orphans: 1, endogenous: 0,
    },
  ]);
  assert.deepEqual(affinityByType(snap, 2).map((r) => [r.type, r.label, r.n, r.median]), [['gpcr', 'GPCRs', 3, 8.2], ['enzyme', 'enzymes', 2, 6.7]]);
});

test('kinomeGroups finds the runs of each kinome group and kinomeOrder ranks inhibitors from most selective', () => {
  assert.deepEqual(kinomeGroups(snap), [{ key: 'TK', from: 0, to: 2 }, { key: 'AGC', from: 3, to: 3 }, { key: 'CMGC', from: 4, to: 4 }]);
  assert.deepEqual(kinomeOrder(snap), [0, 1]);
});

test('targetFindings state the targets part as numbers', () => {
  const f = targetFindings(snap);
  assert.equal(f.classes, 'Approved drugs act on 5 ChEMBL targets; 2 drugs act on a GPCR and 2 on an enzyme');
  assert.equal(f.actions, '42.9% of approved drug–target pairs are inhibitors; 28.6% antagonists and 14.3% binding agents');
  assert.equal(f.drugged, 'The histamine H1 receptor is the target of 2 approved drugs, the most; 3 of 5 targets have one');
  assert.equal(f.network, '7 drug–target links join 5 approved drugs to 5 targets; 60% of those drugs have one target');
  assert.equal(f.gtopdb, 'GtoPdb 2026.3.1 lists 35 targets; 10 have an approved drug among their human ligands');
  assert.equal(f.orphans, 'GtoPdb counts 2 orphan GPCRs, with no confirmed endogenous ligand; 6 of 10 endogenous ligands are peptides');
  assert.equal(f.enzymes, 'Kinases carry the most approved drugs of any enzyme class, 2, across 1 target');
  assert.equal(f.genetics, '70% of genes for approved-drug targets have a pathogenic or likely pathogenic ClinVar variant; 40% of all protein-coding genes do');
  assert.equal(f.kinome, 'In Davis 2011, staurosporine binds 4 of 4 wild-type kinases with Kd below 3 µM; imatinib binds 1');
  assert.equal(f.structures, 'The PDB holds 1,000 experimental structures; electron microscopy solved 31.7% of those released in 2025');
});

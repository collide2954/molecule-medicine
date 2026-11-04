import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mechanismRecords, targetRecord, classTree, classPath, targetFamily, targetClass, moleculeLabel,
} from '../../scripts/chembl.mjs';
import {
  gtopdbVersion, gtopdbTargets, gtopdbSummary, approvedAffinities,
} from '../../scripts/gtopdb.mjs';
import {
  davisMatrix, selectivity, kinaseGroup, KINASE_GROUPS,
} from '../../scripts/kinome.mjs';
import { rcsbByYear, gpcrdbSummary } from '../../scripts/structures.mjs';
import { forceLayout, components, packedLayout } from '../../scripts/layout.mjs';
import { drugTargetNetwork } from '../../scripts/network.mjs';

test('mechanismRecords keeps parent drug, target, action and directness, dropping mechanisms with no target', () => {
  const rows = mechanismRecords([
    { molecule_chembl_id: 'CHEMBL1200', parent_molecule_chembl_id: 'CHEMBL25', target_chembl_id: 'CHEMBL221', action_type: 'INHIBITOR', mechanism_of_action: 'Cyclooxygenase inhibitor', direct_interaction: 1 },
    { molecule_chembl_id: 'CHEMBL3', parent_molecule_chembl_id: 'CHEMBL3', target_chembl_id: null, action_type: 'UNKNOWN', mechanism_of_action: 'Unknown', direct_interaction: 0 },
  ]);
  assert.deepEqual(rows, [{ drug: 'CHEMBL25', target: 'CHEMBL221', action: 'INHIBITOR', moa: 'Cyclooxygenase inhibitor', direct: 1 }]);
});

test('targetRecord keeps names, genes, accessions, EC numbers and component classes', () => {
  const t = targetRecord({
    target_chembl_id: 'CHEMBL2326', pref_name: 'Carbonic anhydrase 7', target_type: 'SINGLE PROTEIN', organism: 'Homo sapiens',
    target_components: [{
      accession: 'P43166', component_id: 667, target_component_synonyms: [{ component_synonym: '4.2.1.1', syn_type: 'EC_NUMBER' }, { component_synonym: 'CA7', syn_type: 'GENE_SYMBOL' }, { component_synonym: 'CA-VII', syn_type: 'UNIPROT' }],
    }],
  }, new Map([[667, [648]]]));
  assert.deepEqual(t, {
    id: 'CHEMBL2326', name: 'Carbonic anhydrase 7', type: 'SINGLE PROTEIN', organism: 'Homo sapiens', genes: ['CA7'], accessions: ['P43166'], ec: ['4.2.1.1'], classes: [648],
  });
});

const CLASSES = [
  { protein_class_id: 0, parent_id: null, pref_name: 'Protein class', class_level: 0 },
  { protein_class_id: 1, parent_id: 0, pref_name: 'Enzyme', class_level: 1 },
  { protein_class_id: 2, parent_id: 1, pref_name: 'Kinase', class_level: 2 },
  { protein_class_id: 3, parent_id: 2, pref_name: 'Protein kinase', class_level: 3 },
  { protein_class_id: 4, parent_id: 0, pref_name: 'Membrane receptor', class_level: 1 },
  { protein_class_id: 5, parent_id: 4, pref_name: 'Family A G protein-coupled receptor', class_level: 2 },
];

test('classTree and classPath walk the ChEMBL protein classification from the top level down', () => {
  const tree = classTree(CLASSES);
  assert.deepEqual(classPath(tree, 3), ['Enzyme', 'Kinase', 'Protein kinase']);
  assert.deepEqual(classPath(tree, 5), ['Membrane receptor', 'Family A G protein-coupled receptor']);
  assert.deepEqual(classPath(tree, 99), []);
});

test('targetFamily sorts class paths into the families drugs are counted by', () => {
  assert.equal(targetFamily(['Membrane receptor', 'Family A G protein-coupled receptor', 'Small molecule receptor']), 'GPCR');
  assert.equal(targetFamily(['Ion channel', 'Voltage-gated ion channel']), 'Ion channel');
  assert.equal(targetFamily(['Enzyme', 'Kinase', 'Protein kinase']), 'Kinase');
  assert.equal(targetFamily(['Transcription factor', 'Nuclear receptor']), 'Nuclear receptor');
  assert.equal(targetFamily(['Enzyme', 'Protease', 'Serine protease']), 'Protease');
  assert.equal(targetFamily(['Enzyme', 'Oxidoreductase']), 'Other enzyme');
  assert.equal(targetFamily(['Transporter', 'Electrochemical transporter']), 'Transporter');
  assert.equal(targetFamily(['Membrane receptor', 'Toll-like and Il-1 receptors']), 'Other receptor');
  assert.equal(targetFamily(['Epigenetic regulator', 'Reader']), 'Epigenetic regulator');
  assert.equal(targetFamily(['Secreted protein']), 'Other protein');
  assert.equal(targetFamily([]), 'Unclassified');
  assert.equal(targetFamily([], 'NUCLEIC-ACID'), 'Nucleic acid');
  assert.equal(targetFamily([], 'ORGANISM'), 'Organism or cell');
});

test('targetFamily keeps mRNA, ribosome and non-protein targets out of the protein families', () => {
  assert.equal(targetFamily(['Unclassified protein'], 'NUCLEIC-ACID'), 'Nucleic acid');
  assert.equal(targetFamily(['Other cytosolic protein'], 'PROTEIN NUCLEIC-ACID COMPLEX'), 'Ribosome');
  for (const type of ['SMALL MOLECULE', 'METAL', 'OLIGOSACCHARIDE', 'LIPID', 'MACROMOLECULE']) assert.equal(targetFamily([], type), 'Non-protein molecule', type);
  assert.equal(targetFamily([], 'SUBCELLULAR'), 'Organism or cell');
  assert.equal(targetFamily([], 'UNKNOWN'), 'Unclassified');
});

test('moleculeLabel prefers the preferred name, then a research code, then any synonym, then the ID', () => {
  assert.equal(moleculeLabel({ molecule_chembl_id: 'CHEMBL941', pref_name: 'IMATINIB', molecule_synonyms: [] }), 'IMATINIB');
  const synonyms = [{ molecule_synonym: 'Ki 20227', syn_type: 'OTHER' }, { molecule_synonym: 'PD-173955', syn_type: 'RESEARCH_CODE' }];
  assert.equal(moleculeLabel({ molecule_chembl_id: 'CHEMBL2', pref_name: null, molecule_synonyms: synonyms }), 'PD-173955');
  assert.equal(moleculeLabel({ molecule_chembl_id: 'CHEMBL3', pref_name: null, molecule_synonyms: synonyms.slice(0, 1) }), 'Ki 20227');
  assert.equal(moleculeLabel({ molecule_chembl_id: 'CHEMBL4', pref_name: null }), 'CHEMBL4');
});

const BANNER = '"# GtoPdb Version: 2026.3.1 - published: 2026-10-12"';
const TARGETS = [
  BANNER,
  '"Type","Family id","Family name","Target id","Target name","Subunit id","Subunit name","HGNC symbol","Human SwissProt"',
  '"gpcr","1","Adrenoceptors","28","β<sub>2</sub>-adrenoceptor","","","ADRB2","P07550"',
  '"gpcr","114","Class A Orphans with no pharmacology","90","GPR6","","","GPR6","P46095"',
  '"lgic","72","GABA<sub>A</sub> receptors","404","GABA<sub>A</sub> receptor α1β2γ2","2","α1","GABRA1","P14867"',
  '"lgic","72","GABA<sub>A</sub> receptors","404","GABA<sub>A</sub> receptor α1β2γ2","3","β2","GABRB2","P47870"',
  '"enzyme","268","Cyclooxygenase","1375","COX-1","","","PTGS1","P23219"',
].join('\n');

const INTERACTIONS = [
  BANNER,
  '"Target","Target ID","Target Species","Ligand ID","Ligand","Ligand Type","Approved","Type","Action","Endogenous","Primary Target","Affinity Units","Affinity Median","Affinity High","Affinity Low"',
  '"β<sub>2</sub>-adrenoceptor","28","Human","558","salbutamol","Synthetic organic","true","Agonist","Partial agonist","false","true","pKi","5.83","",""',
  '"β<sub>2</sub>-adrenoceptor","28","Human","484","adrenaline","Metabolite","false","Agonist","Full agonist","true","false","pKi","","6.5","5.5"',
  '"β<sub>2</sub>-adrenoceptor","28","Rat","558","salbutamol","Synthetic organic","true","Agonist","Partial agonist","false","true","pKi","6.1","",""',
  '"COX-1","1375","Human","4139","aspirin","Synthetic organic","true","Inhibitor","Irreversible inhibition","false","true","pIC50","5.3","",""',
  '"COX-1","1375","Human","5000","tool compound","Synthetic organic","false","Inhibitor","Inhibition","false","false","-","","",""',
  '"COX-1","1375","Human","5001","ibuprofen","Synthetic organic","true","Inhibitor","Inhibition","false","true","pIC50","","5.300000190734863","4.900000095367432"',
].join('\n');

test('gtopdbVersion reads the release from the banner line', () => {
  assert.equal(gtopdbVersion(TARGETS), '2026.3.1');
});

test('gtopdbTargets keeps one row per target with its type, family and genes', () => {
  const t = gtopdbTargets(TARGETS);
  assert.equal(t.length, 4);
  assert.deepEqual(t.find((x) => x.id === '404'), {
    id: '404', type: 'lgic', family: 'GABAA receptors', name: 'GABAA receptor α1β2γ2', genes: ['GABRA1', 'GABRB2'], orphan: false,
  });
  assert.equal(t.find((x) => x.id === '90').orphan, true);
});

test('gtopdbSummary counts targets by type with any, approved and endogenous human ligands', () => {
  const s = gtopdbSummary(gtopdbTargets(TARGETS), INTERACTIONS);
  assert.deepEqual(s.types.gpcr, { targets: 2, ligand: 1, approved: 1, endogenous: 1, orphans: 1 });
  assert.deepEqual(s.types.enzyme, { targets: 1, ligand: 1, approved: 1, endogenous: 0, orphans: 0 });
  assert.deepEqual(s.types.lgic, { targets: 1, ligand: 0, approved: 0, endogenous: 0, orphans: 0 });
  assert.deepEqual(s.endogenous, { Metabolite: 1 });
  assert.equal(s.interactions, 5);
});

test('approvedAffinities lists approved ligands at their human primary targets with one value to two decimals', () => {
  assert.deepEqual(approvedAffinities(gtopdbTargets(TARGETS), INTERACTIONS), [
    { ligand: 'salbutamol', target: 'β2-adrenoceptor', type: 'gpcr', units: 'pKi', value: 5.83, action: 'Partial agonist' },
    { ligand: 'aspirin', target: 'COX-1', type: 'enzyme', units: 'pIC50', value: 5.3, action: 'Irreversible inhibition' },
    { ligand: 'ibuprofen', target: 'COX-1', type: 'enzyme', units: 'pIC50', value: 5.1, action: 'Inhibition' },
  ]);
});

test('targetClass takes the deepest class path among a target’s components and names its family', () => {
  const tree = classTree(CLASSES);
  assert.deepEqual(targetClass([1, 3], tree, 'PROTEIN COMPLEX'), { family: 'Kinase', path: ['Enzyme', 'Kinase', 'Protein kinase'] });
  assert.deepEqual(targetClass([5], tree, 'SINGLE PROTEIN'), { family: 'GPCR', path: ['Membrane receptor', 'Family A G protein-coupled receptor'] });
  assert.deepEqual(targetClass([], tree, 'ORGANISM'), { family: 'Organism or cell', path: [] });
});

const activity = (mol, molName, assay, target, construct, pchembl, relation = '=', variant = null) => ({
  molecule_chembl_id: mol,
  molecule_pref_name: molName,
  assay_chembl_id: assay,
  assay_description: `Binding constant for ${construct} kinase domain`,
  assay_variant_mutation: variant,
  target_chembl_id: target,
  target_pref_name: 'Tyrosine-protein kinase',
  pchembl_value: pchembl,
  standard_relation: relation,
  standard_type: 'Kd',
});

test('davisMatrix lays Kd measurements out as inhibitors by kinase constructs in kinome-group order, inactive as null', () => {
  const groups = { CHEMBL1862: 'TK', CHEMBL203: 'TK', CHEMBL301: 'CMGC' };
  const m = davisMatrix([
    activity('CHEMBL941', 'IMATINIB', 'A1', 'CHEMBL1862', 'ABL1', '8.0'),
    activity('CHEMBL941', 'IMATINIB', 'A2', 'CHEMBL1862', 'ABL1(T315I)', null, '>', 'T315I'),
    activity('CHEMBL941', 'IMATINIB', 'A3', 'CHEMBL301', 'CDK2', null, '>'),
    activity('CHEMBL553', 'ERLOTINIB', 'A3', 'CHEMBL301', 'CDK2', '6.1'),
    activity('CHEMBL553', 'ERLOTINIB', 'A4', 'CHEMBL203', 'EGFR', '9.2'),
    activity('CHEMBL4', null, 'A4', 'CHEMBL203', 'EGFR', '5.5'),
  ], (target) => groups[target]);
  assert.deepEqual(m.inhibitors, [{ id: 'CHEMBL4', name: 'CHEMBL4' }, { id: 'CHEMBL553', name: 'ERLOTINIB' }, { id: 'CHEMBL941', name: 'IMATINIB' }]);
  assert.deepEqual(m.kinases, [
    { id: 'A1', target: 'CHEMBL1862', name: 'ABL1', variant: null, group: 'TK' },
    { id: 'A2', target: 'CHEMBL1862', name: 'ABL1(T315I)', variant: 'T315I', group: 'TK' },
    { id: 'A4', target: 'CHEMBL203', name: 'EGFR', variant: null, group: 'TK' },
    { id: 'A3', target: 'CHEMBL301', name: 'CDK2', variant: null, group: 'CMGC' },
  ]);
  assert.deepEqual(m.pkd, [[null, null, 5.5, null], [null, null, 9.2, 6.1], [8, null, null, null]]);
});

test('kinaseGroup names the kinome group from the ChEMBL class path', () => {
  assert.equal(kinaseGroup(['Enzyme', 'Kinase', 'Protein Kinase', 'TK protein kinase group', 'Tyrosine protein kinase Abl family']), 'TK');
  assert.equal(kinaseGroup(['Enzyme', 'Kinase', 'Protein Kinase', 'Atypical protein kinase group', 'Atypical protein kinase PIKK family']), 'Atypical');
  assert.equal(kinaseGroup(['Enzyme', 'Kinase', 'Lipid kinase']), 'Lipid or other kinase');
  assert.equal(kinaseGroup(['Enzyme', 'Kinase', 'Protein Kinase', 'CAMK protein kinase group'], 'Plasmodium falciparum'), 'Non-human');
  assert.equal(kinaseGroup([], 'Homo sapiens'), 'Unclassified');
  assert.deepEqual(KINASE_GROUPS.slice(0, 7), ['TK', 'TKL', 'STE', 'CK1', 'AGC', 'CAMK', 'CMGC']);
});

test('kinaseGroup falls back on EC numbers for kinases with no kinome group', () => {
  assert.equal(kinaseGroup(['Enzyme', 'Transferase'], 'Homo sapiens', ['2.7.1.153', '2.7.11.1']), 'Lipid or other kinase');
  assert.equal(kinaseGroup([], 'Homo sapiens', ['2.7.11.1', '3.1.26.-']), 'Unclassified protein kinase');
  assert.equal(kinaseGroup([], 'Homo sapiens', ['2.7.10.1']), 'Unclassified protein kinase');
  assert.equal(kinaseGroup(['Enzyme', 'Kinase', 'Protein Kinase', 'TK protein kinase group'], 'Homo sapiens', ['2.7.1.1']), 'TK');
  assert.equal(kinaseGroup([], 'Homo sapiens', ['3.4.21.5']), 'Unclassified');
  assert.ok(KINASE_GROUPS.indexOf('Unclassified protein kinase') < KINASE_GROUPS.indexOf('Lipid or other kinase'));
});

test('selectivity gives S(3 µM) and a Gini score over affinities', () => {
  const s = selectivity([8, null, 5, 6]);
  assert.equal(s.s3, 0.5);
  assert.equal(s.hits, 2);
  assert.ok(s.gini > 0.6 && s.gini < 1, `${s.gini}`);
  assert.equal(selectivity([null, null]).s3, 0);
});

test('rcsbByYear folds experimental methods into four groups by release year', () => {
  const json = {
    facets: [{
      name: 'year',
      buckets: [
        { label: '1976', population: 13, facets: [{ name: 'method', buckets: [{ label: 'X-RAY DIFFRACTION', population: 13 }] }] },
        { label: '2020', population: 10, facets: [{ name: 'method', buckets: [{ label: 'X-RAY DIFFRACTION', population: 5 }, { label: 'ELECTRON MICROSCOPY', population: 3 }, { label: 'SOLUTION NMR', population: 1 }, { label: 'FIBER DIFFRACTION', population: 1 }] }] },
      ],
    }],
  };
  assert.deepEqual(rcsbByYear(json), {
    years: [1976, 2020], methods: { 'X-ray': [13, 5], 'Electron microscopy': [0, 3], NMR: [0, 1], Other: [0, 1] },
  });
});

test('gpcrdbSummary counts GPCR structures by class, method, state and year', () => {
  const s = gpcrdbSummary([
    {
      class: 'Class A (Rhodopsin)', protein: 'adrb2_human', type: 'X-ray diffraction', state: 'Inactive', publication_date: '2007-10-25', species: 'Homo sapiens',
    },
    {
      class: 'Class A (Rhodopsin)', protein: 'adrb2_human', type: 'Electron microscopy', state: 'Active', publication_date: '2022-08-03', species: 'Homo sapiens',
    },
    {
      class: 'Class B1 (Secretin)', protein: 'glp1r_mouse', type: 'Electron microscopy', state: 'Active', publication_date: '2022-01-05', species: 'Mus musculus',
    },
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.human, 2);
  assert.deepEqual(s.classes, { 'Class A (Rhodopsin)': 2, 'Class B1 (Secretin)': 1 });
  assert.deepEqual(s.states, { Inactive: 1, Active: 2 });
  assert.deepEqual(s.years, [2007, 2022]);
  assert.deepEqual(s.methods, { 'X-ray': [1, 0], 'Electron microscopy': [0, 2] });
  assert.deepEqual(s.byClass, { 'Class A (Rhodopsin)': { Inactive: 1, Active: 1 }, 'Class B1 (Secretin)': { Active: 1 } });
  assert.equal(s.receptors, 2);
});

test('drugTargetNetwork links each known drug to each known target once and counts degrees', () => {
  const net = drugTargetNetwork([
    { drug: 'D1', target: 'T1' }, { drug: 'D1', target: 'T1' }, { drug: 'D1', target: 'T2' }, { drug: 'D2', target: 'T1' }, { drug: 'D3', target: 'T9' },
  ], new Map([['D1', { name: 'one', group: 'N' }], ['D2', { name: 'two', group: 'C' }]]), new Map([['T1', { name: 'alpha', group: 'GPCR' }], ['T2', { name: 'beta', group: 'Kinase' }]]));
  assert.deepEqual(net.nodes, [
    { id: 'D1', kind: 'drug', name: 'one', group: 'N', degree: 2 },
    { id: 'D2', kind: 'drug', name: 'two', group: 'C', degree: 1 },
    { id: 'T1', kind: 'target', name: 'alpha', group: 'GPCR', degree: 2 },
    { id: 'T2', kind: 'target', name: 'beta', group: 'Kinase', degree: 1 },
  ]);
  assert.deepEqual(net.edges, [[0, 2], [0, 3], [1, 2]]);
});

test('components lists connected components from the largest, ties by first node', () => {
  assert.deepEqual(components(8, [[0, 1], [1, 2], [3, 4], [6, 5]]), [[0, 1, 2], [3, 4], [5, 6], [7]]);
});

test('packedLayout lays each component out in its own block, largest first, inside the unit square', () => {
  const edges = [[0, 1], [1, 2], [2, 0], [2, 3], [4, 5], [6, 7]];
  const a = packedLayout(8, edges, { iterations: 100 });
  assert.deepEqual(a, packedLayout(8, edges, { iterations: 100 }));
  for (const [x, y] of a) assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, `${x},${y}`);
  const d = (i, j) => Math.hypot(a[i][0] - a[j][0], a[i][1] - a[j][1]);
  assert.ok(d(4, 5) < d(4, 6) && d(6, 7) < d(5, 7));
  assert.ok(d(0, 1) < d(0, 4) && d(2, 3) < d(3, 6));
  assert.ok(Math.max(...a.map(([, y]) => y)) <= 1 && Math.max(...a.map(([x]) => x)) === 1);
});

test('forceLayout is deterministic, keeps nodes in the unit square and pulls linked nodes together', () => {
  const edges = [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3]];
  const a = forceLayout(6, edges, { iterations: 200 });
  const b = forceLayout(6, edges, { iterations: 200 });
  assert.deepEqual(a, b);
  for (const [x, y] of a) assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, `${x},${y}`);
  const d = (i, j) => Math.hypot(a[i][0] - a[j][0], a[i][1] - a[j][1]);
  const linked = (d(0, 1) + d(1, 2) + d(3, 4)) / 3;
  const apart = (d(0, 3) + d(1, 4) + d(2, 5)) / 3;
  assert.ok(linked < apart, `${linked} ${apart}`);
});

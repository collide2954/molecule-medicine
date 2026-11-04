import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activitySummary, kineticRate, kineticPairs, agreementPairs,
} from '../../scripts/bioactivity.mjs';
import { almanacNames, almanacScores } from '../../scripts/almanac.mjs';

const bucket = (key, n, extra = {}) => ({ key, doc_count: n, ...extra });

const ES = {
  hits: { total: { value: 1000, relation: 'eq' } },
  aggregations: {
    types: { buckets: [bucket('IC50', 500), bucket('Ki', 200), bucket('kon', 100)] },
    assay: { buckets: [bucket('F', 600), bucket('B', 400)] },
    year: { buckets: [bucket(2019, 300), bucket(2020, 700)] },
    pchembl: { buckets: [bucket(6, 50), bucket(6.5, 30)] },
    source: { buckets: [bucket('1', 700), bucket('7', 300)] },
    relation: { buckets: [bucket('=', 900), bucket('>', 100)] },
    withp: { doc_count: 80 },
    phantom: { doc_count: 99 },
    duplicates: { buckets: [bucket(0, 990), bucket(1, 10)] },
    validity: { buckets: [bucket('Outside typical range', 7)] },
    formats: { buckets: [bucket('cell-based format', 600)] },
    potent: {
      doc_count: 80,
      types: { buckets: [bucket('IC50', 60, { bins: { buckets: [bucket(6, 40), bucket(6.5, 20)] } })] },
      molecules: { buckets: [bucket('DOXORUBICIN', 9)] },
      organisms: { buckets: [bucket('Homo sapiens', 70)] },
    },
  },
};

test('activitySummary turns the Elasticsearch aggregations into counts by type, assay, year, source and potency', () => {
  assert.deepEqual(activitySummary(ES, new Map([[1, 'Scientific Literature'], [7, 'PubChem BioAssays']])), {
    total: 1000,
    withPchembl: 80,
    phantomKinetics: 99,
    duplicates: 10,
    types: [{ type: 'IC50', n: 500 }, { type: 'Ki', n: 200 }, { type: 'kon', n: 100 }],
    assays: [{ type: 'F', n: 600 }, { type: 'B', n: 400 }],
    years: [[2019, 300], [2020, 700]],
    pchembl: [[6, 50], [6.5, 30]],
    sources: [{ id: 1, name: 'Scientific Literature', n: 700 }, { id: 7, name: 'PubChem BioAssays', n: 300 }],
    relations: [{ relation: '=', n: 900 }, { relation: '>', n: 100 }],
    validity: [{ comment: 'Outside typical range', n: 7 }],
    formats: [{ format: 'cell-based format', n: 600 }],
    byType: [{ type: 'IC50', n: 60, bins: [[6, 40], [6.5, 20]] }],
    molecules: [{ name: 'DOXORUBICIN', n: 9 }],
    organisms: [{ organism: 'Homo sapiens', n: 70 }],
  });
});

test('kineticRate puts association rates in per molar per second and dissociation rates in per second', () => {
  assert.equal(kineticRate('0.042', 'nM^-1 min^-1'), 700000);
  assert.equal(kineticRate('345900.0', 'Ms-1'), 345900);
  assert.equal(kineticRate('25', 'M-1.s-1'), 25);
  assert.equal(kineticRate('2', '10e3* M-1 s-1'), 2000);
  assert.equal(kineticRate('0.027', 'min^-1'), 0.00045);
  assert.equal(kineticRate('0.0009352', 's-1'), 0.0009352);
  assert.equal(kineticRate('0.001', '1-s'), 0.001);
  assert.equal(kineticRate(null, 's-1'), null);
  assert.equal(kineticRate('1', null), null);
  assert.equal(kineticRate('1', 'furlongs'), null);
});

const kin = (molecule, target, type, value, units, relation = '=') => ({
  parent_molecule_chembl_id: molecule, molecule_pref_name: molecule === 'M1' ? 'RIVAROXABAN' : null, target_chembl_id: target, target_pref_name: `${target} name`, standard_type: type, standard_value: value, standard_units: units, standard_relation: relation,
});

test('kineticPairs pairs association and dissociation rates for each molecule on each target, as geometric means', () => {
  const rows = [
    kin('M1', 'T1', 'kon', '0.06', 'nM^-1 min^-1'), kin('M1', 'T1', 'kon', '4000000', 'Ms-1'), kin('M1', 'T1', 'koff', '0.6', 'min^-1'), kin('M1', 'T1', 'k_off', '0.01', 's-1'),
    kin('M2', 'T1', 'kon', '100000', 'Ms-1'), kin('M2', 'T1', 'k_off', '0.001', 's-1', '<'),
    kin('M3', 'T2', 'kon', '50000', 'M-1.s-1'), kin('M3', 'T2', 'koff', '0.005', '1-s'),
    kin('M4', 'T2', 'Kd', '10', 'nM'),
  ];
  assert.deepEqual(kineticPairs(rows), [
    {
      molecule: 'M1', name: 'RIVAROXABAN', target: 'T1', targetName: 'T1 name', kon: 2000000, koff: 0.01, n: 2,
    },
    {
      molecule: 'M3', name: null, target: 'T2', targetName: 'T2 name', kon: 50000, koff: 0.005, n: 1,
    },
  ]);
});

const KINOME = {
  inhibitors: [{ id: 'CHEMBL941', parent: 'CHEMBL941', name: 'IMATINIB' }, { id: 'CHEMBL5416410', parent: 'CHEMBL1421', name: 'DASATINIB' }],
  kinases: [
    { id: 'A1', target: 'T_ABL', name: 'ABL1', variant: null },
    { id: 'A2', target: 'T_ABL', name: 'ABL1(T315I)', variant: 'T315I' },
    { id: 'A3', target: 'T_KIT', name: 'KIT', variant: null },
    { id: 'A4', target: 'T_RPS', name: 'RPS6KA4(Kin.Dom.1)', variant: null },
    { id: 'A5', target: 'T_RPS', name: 'RPS6KA4(Kin.Dom.2)', variant: null },
  ],
  pkd: [[8, null, 6, 5, null], [9, 7, null, null, null]],
};

const kd = (parent, target, mutation, relation, p, type = 'Kd') => ({
  parent_molecule_chembl_id: parent, target_chembl_id: target, assay_variant_mutation: mutation, standard_relation: relation, pchembl_value: p, standard_type: type,
});

test('agreementPairs matches Karaman 2008 to Davis 2011 by parent compound, target and mutation, skipping ambiguous constructs', () => {
  const karaman = [
    kd('CHEMBL941', 'T_ABL', null, '=', '7.6'), kd('CHEMBL941', 'T_ABL', 'T315I', '>', null), kd('CHEMBL941', 'T_KIT', null, '>', null), kd('CHEMBL941', 'T_RPS', null, '=', '5.2'),
    kd('CHEMBL1421', 'T_ABL', null, '=', '9.4'), kd('CHEMBL1421', 'T_ABL', 'T315I', '=', '6.5'), kd('CHEMBL1421', 'T_KIT', null, '>', null),
    kd('CHEMBL99', 'T_ABL', null, '=', '6'), kd('CHEMBL941', null, null, '=', null, 'Selectivity'),
  ];
  assert.deepEqual(agreementPairs(KINOME, karaman), {
    pairs: [[8, 7.6], [9, 9.4], [7, 6.5]],
    counts: {
      both: 3, davisOnly: 1, karamanOnly: 0, neither: 2,
    },
    ambiguous: 1,
    molecules: 2,
  });
});

const HEAD = 'COMBODRUGSEQ,SCREENER,STUDY,TESTDATE,PLATE,PANELNBR,CELLNBR,PREFIX1,NSC1,SAMPLE1,CONCINDEX1,CONC1,CONCUNIT1,PREFIX2,NSC2,SAMPLE2,CONCINDEX2,CONC2,CONCUNIT2,PERCENTGROWTH,PERCENTGROWTHNOTZ,TESTVALUE,CONTROLVALUE,TZVALUE,EXPECTEDGROWTH,SCORE,VALID,PANEL,CELLNAME';
const alone = (nsc, conc, growth, cell) => `1,FG,S1,06/23/2011,P1,9,18,S,${nsc},37,1,${conc},M,,,,0,,,${growth},${growth},1,1,1,,,Y,Panel,${cell}`;
const pair = (nsc1, conc1, nsc2, conc2, growth, cell) => `2,FG,S1,06/23/2011,P1,9,18,S,${nsc1},37,1,${conc1},M,S,${nsc2},10,2,${conc2},M,${growth},${growth},1,1,1,0,-999,Y,Panel,${cell}`;

test('almanacNames keeps the first name given for each NSC number', () => {
  const names = almanacNames('740\tMethotrexate\n752\tThioguanine\n752\t6-Thioguanine\n3088\tChlorambucil\n');
  assert.equal(names.get('752'), 'Thioguanine');
  assert.equal(names.size, 3);
});

test('almanacScores scores each pair against the median single-drug growth across plates, per cell line, then averages', () => {
  const lines = [
    HEAD,
    alone(752, '1.00E-07', 80, '786-0'), alone(752, '1.00E-07', 60, '786-0'), alone(3088, '1.00E-06', 50, '786-0'), alone(3088, '1.00E-05', -20, '786-0'),
    alone(752, '1.00E-07', 90, 'K-562'), alone(3088, '1.00E-06', 40, 'K-562'), alone(740, '1.00E-08', 100, '786-0'),
    pair(752, '1.00E-07', 3088, '1.00E-06', 20, '786-0'), pair(752, '1.00E-07', 3088, '1.00E-05', -30, '786-0'),
    pair(3088, '1.00E-06', 752, '1.00E-07', 30, 'K-562'), pair(740, '1.00E-08', 752, '1.00E-07', 40, '786-0'), pair(740, '1.00E-07', 752, '1.00E-07', 10, '786-0'),
  ];
  const names = new Map([['740', 'Methotrexate'], ['752', 'Thioguanine'], ['3088', 'Chlorambucil']]);
  assert.deepEqual(almanacScores(() => lines, names), {
    drugs: [{ nsc: '740', name: 'Methotrexate' }, { nsc: '752', name: 'Thioguanine' }, { nsc: '3088', name: 'Chlorambucil' }],
    pairs: [[0, 1, 30, 1], [1, 2, 9.25, 2]],
    cells: 2,
    wells: 4,
  });
});

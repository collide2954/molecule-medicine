import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCES, SOURCE_TITLES, SOURCE_GROUPS, EXAMPLES, LANDMARKS, GENETIC_SUPPORT, ATTRITION, RD_COST, SOLVENTS, ELEMENTS,
} from '../../src/facts.js';
import { identify } from '../../src/lib.js';
import snapshot from '../../src/snapshot.js';

test('every source is an https URL with a title in a known group', () => {
  assert.ok(Object.keys(SOURCES).length >= 10);
  for (const [key, url] of Object.entries(SOURCES)) {
    assert.match(url, /^https:\/\//, key);
    const [group, title] = SOURCE_TITLES[key] ?? [];
    assert.ok(SOURCE_GROUPS.includes(group), `${key}: ${group}`);
    assert.ok(title?.length > 5 && !/^https?:|^www\./.test(title), key);
  }
  for (const key of Object.keys(SOURCE_TITLES)) assert.ok(SOURCES[key], `title without source: ${key}`);
});

test('the molecules part cites ChEMBL and the medicinal chemistry it measures against', () => {
  for (const key of ['chembl', 'zdrazil2024', 'atcIndex', 'usanStems']) assert.equal(SOURCE_TITLES[key]?.[0], 'Databases and classifications', key);
  for (const key of ['lipinski1997', 'bickerton2012', 'ertl2008', 'lovering2009', 'taylor2014', 'bemis1996', 'purser2008', 'hann2011', 'agranat2002']) assert.equal(SOURCE_TITLES[key]?.[0], 'Medicinal chemistry', key);
});

test('the targets part cites the databases and papers it draws on', () => {
  for (const key of ['gtopdb', 'harding2024', 'rcsb', 'burley2023', 'gpcrdb', 'pandy2023', 'clinvar', 'hgnc']) assert.equal(SOURCE_TITLES[key]?.[0], 'Databases and classifications', key);
  for (const key of ['davis2011', 'karaman2008', 'graczyk2007', 'santos2017', 'overington2006', 'yildirim2007', 'oprea2018']) assert.equal(SOURCE_TITLES[key]?.[0], 'Pharmacology', key);
  for (const key of ['minikel2024', 'nelson2015']) assert.equal(SOURCE_TITLES[key]?.[0], 'Trials and development', key);
});

test('the bioactivity part cites its datasets and the theory it draws', () => {
  for (const key of ['klaeger2017', 'k4dd', 'copeland2006', 'black1983', 'schild1949', 'cheng1973', 'bliss1939', 'holbeck2017']) assert.equal(SOURCE_TITLES[key]?.[0], 'Pharmacology', key);
  for (const key of ['hopkins2004', 'leeson2007']) assert.equal(SOURCE_TITLES[key]?.[0], 'Medicinal chemistry', key);
});

test('the fixed genetic support table is cited and internally consistent', () => {
  assert.equal(GENETIC_SUPPORT.source, 'minikel2024');
  assert.ok(SOURCES[GENETIC_SUPPORT.source]);
  assert.equal(GENETIC_SUPPORT.sources[0].label, 'All germline');
  assert.equal(GENETIC_SUPPORT.areas.length, 17);
  for (const r of [...GENETIC_SUPPORT.sources, ...GENETIC_SUPPORT.areas]) {
    assert.ok(r.lo <= r.rs && r.rs <= r.hi, r.label);
    assert.ok(r.launched <= r.supported, r.label);
  }
  assert.deepEqual(GENETIC_SUPPORT.areas.map((r) => r.rs), [...GENETIC_SUPPORT.areas.map((r) => r.rs)].sort((a, b) => b - a));
});

test('the trials part cites the registry, the studies of its reporting and the attrition and cost estimates', () => {
  for (const key of ['ctgov', 'zarin2011']) assert.equal(SOURCE_TITLES[key]?.[0], 'Databases and classifications', key);
  for (const key of ['wong2019', 'hay2014', 'wouters2020', 'dimasi2016', 'devito2020', 'anderson2015', 'deangelis2004']) assert.equal(SOURCE_TITLES[key]?.[0], 'Trials and development', key);
});

const POS_KEYS = ['p12', 'p23', 'p3a', 'p1a'];

test('the fixed attrition table from Wong et al. 2019 is cited, complete and ordered', () => {
  assert.equal(ATTRITION.source, 'wong2019');
  assert.ok(SOURCES[ATTRITION.source]);
  assert.equal(ATTRITION.groups.length, 9);
  for (const g of [...ATTRITION.groups, ATTRITION.overall, ATTRITION.withoutOncology]) {
    for (const k of POS_KEYS) assert.ok(g[k] > 0 && g[k] < 100, `${g.label} ${k}`);
    assert.ok(g.p1a < g.p12 && g.p1a < g.p3a, g.label);
    assert.ok(g.se > 0 && g.se < 3, g.label);
    assert.ok(Number.isInteger(g.paths) && g.paths > 500, g.label);
  }
  assert.deepEqual(ATTRITION.groups.map((g) => g.p1a), [...ATTRITION.groups.map((g) => g.p1a)].sort((a, b) => b - a));
  assert.equal(ATTRITION.groups.reduce((n, g) => n + g.paths, 0), ATTRITION.overall.paths);
  assert.equal(ATTRITION.estimates.length, 7);
  for (const e of ATTRITION.estimates) {
    for (const k of POS_KEYS) assert.ok(e[k] > 0 && e[k] < 100, `${e.label} ${k}`);
    assert.match(e.span, /^\d{4}–\d{4}$/, e.label);
  }
  assert.ok(ATTRITION.biomarker.with > ATTRITION.biomarker.without);
  assert.ok(ATTRITION.orphan.oncology < ATTRITION.orphan.overall && ATTRITION.orphan.overall < ATTRITION.orphan.withoutOncology);
});

test('the fixed R&D cost estimates are cited and their medians sit inside their intervals', () => {
  const w = RD_COST.wouters2020;
  assert.ok(SOURCES.wouters2020 && SOURCES.dimasi2016);
  assert.ok(w.medianLo < w.median && w.median < w.medianHi);
  assert.ok(w.meanLo < w.mean && w.mean < w.meanHi);
  assert.ok(w.withData < w.approvals);
  assert.ok(w.nervous < w.median && w.median < w.antineoplastic);
  const d = RD_COST.dimasi2016;
  assert.ok(d.outOfPocket < d.capitalized && d.capitalized < d.withPostApproval);
  assert.deepEqual([w.dollars, d.dollars], [2018, 2013]);
});

test('the manufacturing part cites openFDA, FDA’s nitrosamine and excipient pages, ICH Q3C and Q3D and USP', () => {
  for (const key of ['openfdaEnforcement', 'openfdaShortages', 'fdaNitrosamines', 'fdaNdsri', 'fdaIid', 'ichQ3c', 'ichQ3d', 'uspElemental']) assert.equal(SOURCE_TITLES[key]?.[0], 'Manufacturing and quality', key);
});

test('the fixed ICH Q3C solvent table is complete and its ppm limits follow from the PDEs at 10 g a day', () => {
  assert.equal(SOLVENTS.source, 'ichQ3c');
  assert.deepEqual(SOLVENTS.class1.map((s) => s.ppm), [2, 4, 5, 8, 1500]);
  assert.equal(SOLVENTS.class2.length, 31);
  for (const s of SOLVENTS.class2) {
    assert.ok(s.pde > 0 && s.ppm > 0, s.name);
    assert.equal(Math.round(s.pde * 100), s.ppm, s.name);
  }
  assert.equal(new Set(SOLVENTS.class2.map((s) => s.name)).size, 31);
  assert.equal(SOLVENTS.class3.length, 27);
  assert.equal(SOLVENTS.noData.length, 10);
  assert.equal(SOLVENTS.class3Pde, 50);
});

test('the fixed ICH Q3D table gives oral, parenteral and inhalation PDEs for 24 elements in four classes', () => {
  assert.equal(ELEMENTS.source, 'ichQ3d');
  assert.equal(ELEMENTS.rows.length, 24);
  assert.deepEqual(ELEMENTS.rows.filter((r) => r.cls === '1').map((r) => r.el), ['Cd', 'Pb', 'As', 'Hg']);
  assert.deepEqual([...new Set(ELEMENTS.rows.map((r) => r.cls))], ['1', '2A', '2B', '3']);
  for (const r of ELEMENTS.rows) {
    for (const route of ['oral', 'parenteral', 'inhalation']) assert.ok(r[route] > 0, `${r.el} ${route}`);
    assert.ok(r.parenteral <= r.oral, r.el);
  }
  assert.equal(ELEMENTS.unset.length, 10);
});

test('every decoder example is recognised, unique and described', () => {
  assert.ok(EXAMPLES.length >= 25);
  assert.equal(new Set(EXAMPLES.map((e) => e.id)).size, EXAMPLES.length);
  for (const e of EXAMPLES) {
    assert.ok(identify(e.id), e.id);
    assert.ok(e.is.length > 3, e.id);
  }
  const types = new Set(EXAMPLES.map((e) => identify(e.id).type));
  assert.ok(types.size >= 20, [...types].join(', '));
});

test('every landmark molecule is in the snapshot with a structure, in order of introduction', () => {
  assert.ok(LANDMARKS.length >= 12);
  const byId = new Map(snapshot.drugs.map((d) => [d.id, d]));
  for (const l of LANDMARKS) {
    assert.ok(byId.get(l.id)?.mol, l.id);
    assert.ok(l.note.length > 20, l.id);
    assert.ok(Number.isInteger(l.year) && l.year > 1800 && l.year < 2030, l.id);
  }
  const years = LANDMARKS.map((l) => l.year);
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
});

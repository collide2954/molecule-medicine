import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PART6 } from './fixtures.mjs';
import {
  RECALL_LABELS, CPCA, recallSeries, recallCauses, nitrosamineSeries, potencyCategories, ndsriSources, shortageView, elementGrid, manufacturingFindings,
} from '../../src/manufacturing.js';
import { ELEMENTS } from '../../src/facts.js';

const snap = { generated: '2026-11-08T06:17:00.000Z', ...PART6 };

test('recallSeries stacks recalls by class each year', () => {
  const s = recallSeries(snap);
  assert.deepEqual(s.years, [2012, 2013]);
  assert.deepEqual(s.series.map((x) => [x.key, x.label, x.values]), [['I', 'Class I', [2, 3]], ['II', 'Class II', [20, 30]], ['III', 'Class III', [5, 6]]]);
});

test('recallCauses names each recall cause and its share', () => {
  const c = recallCauses(snap);
  assert.deepEqual(c[0], {
    key: 'sterility', label: RECALL_LABELS.sterility, n: 40, share: 0.4, I: 2, II: 35, III: 3,
  });
  assert.equal(c.length, 4);
  for (const key of ['nitrosamine', 'microbial', 'cgmp', 'other']) assert.ok(RECALL_LABELS[key], key);
});

test('nitrosamineSeries fills every year from the first nitrosamine recall with each drug group', () => {
  const s = nitrosamineSeries(snap, 2021);
  assert.deepEqual(s.years, [2018, 2019, 2020, 2021]);
  assert.deepEqual(s.series.map((x) => [x.key, x.values]), [['sartans', [4, 2, 0, 0]], ['h2', [0, 3, 0, 0]], ['metformin', [0, 0, 0, 0]], ['varenicline', [0, 0, 0, 0]], ['other', [0, 0, 0, 1]]]);
});

test('potencyCategories counts FDA’s drug-specific nitrosamines in each CPCA category with its intake limit', () => {
  assert.deepEqual(CPCA, {
    1: 26.5, 2: 100, 3: 400, 4: 1500, 5: 1500,
  });
  assert.deepEqual(potencyCategories(snap), [
    { category: 1, limit: 26.5, n: 1 },
    { category: 2, limit: 100, n: 0 },
    { category: 3, limit: 400, n: 0 },
    { category: 4, limit: 1500, n: 1 },
    { category: 5, limit: 1500, n: 1 },
  ]);
  assert.deepEqual(ndsriSources(snap, 2), [{ source: 'a', n: 2 }, { source: 'c', n: 1 }]);
});

test('shortageView counts drugs in shortage, injectables and drugs being discontinued, by category and year posted', () => {
  const v = shortageView(snap);
  assert.deepEqual([v.current, v.injectable, v.discontinuing, v.resolved], [2, 1, 1, 1]);
  assert.deepEqual(v.categories[0], { name: 'Anesthesia', current: 1, discontinuing: 0 });
  assert.deepEqual(v.categories.find((c) => c.name === 'Cardiovascular'), { name: 'Cardiovascular', current: 0, discontinuing: 1 });
  assert.deepEqual(v.posted, { 2012: 1, 2023: 1 });
  assert.deepEqual(v.oldest[0], { name: 'A Injection', posted: '2012-01-01' });
});

test('elementGrid lays the ICH Q3D PDEs out by element and route', () => {
  const g = elementGrid();
  assert.deepEqual(g.routes, ['oral', 'parenteral', 'inhalation']);
  assert.equal(g.rows.length, ELEMENTS.rows.length);
  assert.deepEqual(g.values[0], [5, 2, 3]);
  assert.equal(g.rows[0], 'Cd, cadmium');
});

test('manufacturingFindings state the manufacturing part as numbers', () => {
  const f = manufacturingFindings(snap);
  assert.equal(f.recalls, 'openFDA lists 100 recalled drug products since 2012; 40% were recalled for lack of sterility assurance');
  assert.equal(f.nitrosamines, '10 drug recalls since 2018 cite nitrosamines; FDA sets acceptable intakes for 3 drug-specific nitrosamines');
  assert.equal(f.shortages, '2 drugs are in shortage on FDA’s list, 1 of them injectable, and 1 more is being discontinued');
  assert.equal(f.excipients, 'FDA’s Inactive Ingredient Database lists 4 excipients in 10 route and dosage form limits; 3 are accepted orally');
  assert.equal(f.limits, 'ICH limits residual benzene to 2 ppm and methanol to 3,000 ppm, and oral cadmium and lead to 5 µg a day');
});

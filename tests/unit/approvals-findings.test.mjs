import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PART7 } from './fixtures.mjs';
import {
  novelSeries, pathShares, windowShare, calendarRows, lagBins, emaSeries, biosimilarYears, biosimilarReferences, exclusivityLabel, titleCase, approvalFindings,
} from '../../src/approvals.js';

const snap = { generated: '2026-11-08T06:17:00.000Z', ...PART7 };

test('novelSeries stacks novel approvals by kind each year', () => {
  const s = novelSeries(snap);
  assert.equal(s.years.length, 36);
  assert.deepEqual(s.series.map((x) => x.key), ['nda', 'mab', 'biologic']);
  assert.deepEqual(s.series[1].values.slice(9, 11), [0, 10]);
});

test('pathShares and windowShare give the priority and orphan shares of novel approvals', () => {
  const p = pathShares(snap, 1990);
  assert.equal(p.years[0], 1990);
  assert.equal(p.priority[0], 0.4);
  assert.equal(p.orphan[0], 0.2);
  assert.equal(windowShare(snap, 'orphan', 1990, 1994), 0.2);
  assert.equal(windowShare(snap, 'orphan', 2021, 2025), Number((125 / 225).toFixed(6)));
});

test('calendarRows names weekdays and months with their counts', () => {
  const c = calendarRows(snap);
  assert.deepEqual(c.weekdays.map((d) => [d.key, d.n]), [['Mon', 10], ['Tue', 10], ['Wed', 10], ['Thu', 10], ['Fri', 30], ['Sat or Sun', 0]]);
  assert.equal(c.months[11].key, 'Dec');
  assert.equal(c.months[11].n, 15);
});

test('lagBins sorts the FDA–EMA gaps into six-month bins, with the tails gathered at each end', () => {
  const b = lagBins(snap, -24, 24, 6);
  assert.deepEqual(b.map((x) => [x.from, x.to, x.n]), [[-Infinity, -24, 0], [-24, -18, 0], [-18, -12, 0], [-12, -6, 1], [-6, 0, 1], [0, 6, 3], [6, 12, 2], [12, 18, 1], [18, 24, 0], [24, Infinity, 2]]);
});

test('emaSeries stacks EU authorisations by kind', () => {
  assert.deepEqual(emaSeries(snap).series.map((x) => [x.key, x.values]), [['novel', [60, 70]], ['generic', [10, 12]], ['biosimilar', [5, 6]]]);
});

test('biosimilarYears and biosimilarReferences count FDA’s biosimilars by year and by the molecule they copy', () => {
  assert.deepEqual(biosimilarYears(snap), { years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], counts: [1, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 1] });
  assert.deepEqual(biosimilarReferences(snap), [{ inn: 'denosumab', n: 2, products: ['Prolia', 'Xgeva'] }, { inn: 'filgrastim', n: 1, products: ['Neupogen'] }, { inn: 'ranibizumab', n: 1, products: ['Lucentis'] }]);
});

test('exclusivityLabel and titleCase name Orange Book codes and products for reading', () => {
  assert.equal(exclusivityLabel('ODE'), 'orphan drug exclusivity, ODE');
  assert.equal(exclusivityLabel('XYZ'), 'XYZ');
  assert.equal(titleCase('AUVELITY'), 'Auvelity');
  assert.equal(titleCase('IMBRUVICA XR'), 'Imbruvica Xr');
});

test('approvalFindings state the approvals part as numbers', () => {
  const f = approvalFindings(snap);
  assert.equal(f.novel, 'Drugs@FDA lists 45 new molecular entities and new biologics approved in 2025; 10 are antibodies');
  assert.equal(f.calendar, '42.9% of novel approvals since 1990 fell on a Friday, and 21.4% in December');
  assert.equal(f.paths, 'Orphan drugs were 55.6% of novel approvals in 2021 to 2025, against 20% in 1990 to 1994');
  assert.equal(f.ema, 'Of 10 substances approved as new by both FDA and EMA since 1995, FDA approved 80% first; the median EU approval came 4.5 months later');
  assert.equal(f.generics, 'FDA approved 659 generic drug applications in 2025, and 1,376 since 2024');
  assert.equal(f.patents, 'The Orange Book lists 6,531 patents on 1,348 applications; Auvelity carries the most, 148');
  assert.equal(f.biosimilars, 'FDA has approved 4 biosimilars since 2015; 2 copy denosumab, more than any other molecule');
});

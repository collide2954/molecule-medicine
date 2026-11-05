import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PART5 } from './fixtures.mjs';
import { ATTRITION } from '../../src/facts.js';
import {
  PHASE_BANDS, registrations, designShares, enrollmentShares, statusRows, reportingCurves, pooledReporting, psychoactiveSeries, attritionForest, trialFindings,
} from '../../src/trials.js';

const snap = { generated: '2026-11-08T06:17:00.000Z', ...PART5 };

test('registrations fold the eight phase groups into five bands by first-posted year', () => {
  const r = registrations(snap);
  assert.deepEqual(PHASE_BANDS.map((b) => b.key), ['p1', 'p2', 'p3', 'p4', 'na']);
  assert.deepEqual(r.years, [2014, 2015]);
  assert.deepEqual(r.bands.map((b) => [b.key, b.values]), [['p1', [21, 41]], ['p2', [25, 45]], ['p3', [29, 49]], ['p4', [16, 26]], ['na', [17, 27]]]);
  assert.deepEqual(r.totals, [108, 188]);
  assert.equal(r.before, 28);
});

test('designShares divides each feature by its phase total, and results by completed trials', () => {
  const d = designShares(snap);
  assert.equal(d.groups.length, 8);
  assert.equal(d.features.length, 10);
  assert.equal(d.shares[5][0], 0.8);
  assert.equal(d.shares[5][9], 0.5);
  assert.equal(d.shares[0][8], 0.02);
});

test('enrollmentShares gives the share of each phase in each enrollment band', () => {
  const e = enrollmentShares(snap);
  assert.deepEqual(e.bins.map((b) => b.key), ['e20', 'e50', 'e100', 'e300', 'e1000', 'more']);
  assert.deepEqual(e.shares[1], [0.4, 0.3, 0.2, 0.1, 0, 0]);
});

test('statusRows names each registry status in plain words, largest first', () => {
  assert.deepEqual(statusRows(snap).map((r) => [r.key, r.label, r.n]), [['COMPLETED', 'completed', 600], ['RECRUITING', 'recruiting', 250], ['UNKNOWN', 'unknown', 150]]);
});

test('reportingCurves turn submission times into cumulative shares by month, with the share at 12 months and the median', () => {
  const [industry, federal, other, certified] = reportingCurves(snap, 60);
  assert.deepEqual([industry.key, industry.label, industry.n], ['industry', 'Industry', 4]);
  assert.equal(industry.points.length, 61);
  assert.deepEqual(industry.points.slice(5, 8).map((p) => [p.x, p.y]), [[5, 0], [6, 0.25], [7, 0.25]]);
  assert.equal(industry.at12, 0.5);
  assert.equal(industry.median, 12);
  assert.equal(industry.ever, 0.75);
  assert.equal(federal.at12, 0.5);
  assert.equal(other.at12, 0);
  assert.equal(other.median, 30);
  assert.equal(certified.label, 'Delay certified');
  assert.equal(certified.ever, 1);
});

test('pooledReporting merges the sponsor groups without a delay certificate', () => {
  const p = pooledReporting(snap);
  assert.equal(p.n, 8);
  assert.equal(p.at12, 0.375);
});

test('psychoactiveSeries gives every year in range for one group, zeros included', () => {
  const s = psychoactiveSeries(snap, 'psychedelics', 2013, 2015);
  assert.deepEqual(s.map((c) => c.key), ['psilocybin', 'mdma']);
  assert.deepEqual(s[0].rows, [{ x: 2013, y: 0 }, { x: 2014, y: 2 }, { x: 2015, y: 20 }]);
  assert.equal(psychoactiveSeries(snap, 'cannabinoids', 2014, 2015)[0].trials, 7);
});

test('attritionForest gives each group’s phase 1 to approval rate with a 95% interval', () => {
  const [byGroup, pooled] = attritionForest();
  assert.equal(byGroup.rows.length, ATTRITION.groups.length);
  const onc = byGroup.rows.find((r) => r.key === 'Oncology');
  assert.deepEqual([onc.rs, onc.lo, onc.hi], [3.4, 3.01, 3.79]);
  assert.deepEqual(pooled.rows.map((r) => r.key), ['All groups', 'All but oncology']);
  assert.equal(pooled.rows[0].mark, true);
});

test('trialFindings state the trials part as numbers', () => {
  const f = trialFindings(snap);
  assert.equal(f.registry, 'ClinicalTrials.gov holds 1,000 studies; 400 are interventional trials of drugs or biologics');
  assert.equal(f.design, '80% of phase 3 drug trials are randomized and 50% double-blind or more; 40% of phase 1 trials accept healthy volunteers');
  assert.equal(f.reporting, 'Of 8 FDA-regulated drug trials finished in 2018 to 2021 without a delay certificate, 37.5% submitted results within a year');
  assert.equal(f.attrition, 'Wong et al. estimate 13.8% of drug programs in phase 1 reach approval, from 3.4% in oncology to 33.4% for vaccines');
  assert.equal(f.psychedelics, 'Psilocybin trials starting each year rose from 1 in 2005 to 20 in 2015, and MDMA trials from 2 to 3');
});

test('trialFindings say when a count fell or held', () => {
  const flat = {
    ...snap,
    psychoactive: {
      compounds: [
        { ...PART5.psychoactive.compounds[0], years: { 2005: 9, 2015: 4 } },
        { ...PART5.psychoactive.compounds[1], years: { 2005: 3, 2015: 3 } },
      ],
    },
  };
  assert.equal(trialFindings(flat).psychedelics, 'Psilocybin trials starting each year fell from 9 in 2005 to 4 in 2015, and MDMA trials held at 3');
});

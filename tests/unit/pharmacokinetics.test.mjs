import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PART4 } from './fixtures.mjs';
import {
  pkSummary, ddiMatrix, transporterMatrix, perpetrators, cipaSorted, pkFindings, CYPS, CYP_CATEGORIES,
} from '../../src/pharmacokinetics.js';

const snap = { generated: '2026-11-08T06:17:00.000Z', ...PART4 };

test('pkSummary gives the median and quartiles of each human PK parameter', () => {
  const s = pkSummary(snap);
  assert.deepEqual([s.f.n, s.f.median, s.f.q1, s.f.q3], [3, 60, 45, 75]);
  assert.deepEqual([s.halfLife.n, s.halfLife.median, s.halfLife.q1, s.halfLife.q3], [3, 4, 2.25, 8]);
  assert.deepEqual([s.ppb.n, s.ppb.median], [2, 74.5]);
});

test('ddiMatrix and transporterMatrix count FDA-listed drugs by enzyme or transporter and role', () => {
  const m = ddiMatrix(snap);
  assert.deepEqual(m.systems, CYPS);
  assert.deepEqual(m.categories, CYP_CATEGORIES.map((c) => c.label));
  const at = (system, label) => m.counts[CYPS.indexOf(system)][m.categories.indexOf(label)];
  assert.equal(at('3A', 'strong inhibitor'), 1);
  assert.equal(at('3A', 'strong inducer'), 1);
  assert.equal(at('3A', 'sensitive substrate'), 1);
  assert.equal(at('2C19', 'strong inducer'), 1);
  assert.equal(at('2D6', 'strong inhibitor'), 0);
  const t = transporterMatrix(snap);
  assert.deepEqual(t.roles, ['inhibitor', 'substrate']);
  assert.equal(t.counts[t.systems.indexOf('P-gp')][0], 1);
  assert.equal(t.counts[t.systems.indexOf('OATP1B1')][0], 1);
  assert.equal(t.counts[t.systems.indexOf('BCRP')][1], 0);
});

test('perpetrators ranks drugs by the inhibition and induction FDA lists for them', () => {
  assert.deepEqual(perpetrators(snap).map((p) => [p.drug, p.n]), [['rifampin', 3], ['clarithromycin', 2]]);
});

test('cipaSorted orders CiPA drugs from high risk to low, then by hERG margin', () => {
  assert.deepEqual(cipaSorted(snap).map((r) => r.drug), ['dofetilide', 'sotalol', 'verapamil', 'diltiazem']);
});

test('pkFindings state the pharmacokinetics part as numbers', () => {
  const f = pkFindings(snap);
  assert.equal(f.pk, 'Approved drugs in ChEMBL have a median human half-life of 4 h, across 3 drugs, and oral bioavailability of 60%, across 3');
  assert.equal(f.ddi, 'FDA lists 3 drugs and foods with clinical CYP or transporter interactions, among them 1 strong CYP3A inhibitor and 1 sensitive CYP3A substrate');
  assert.equal(f.cipa, 'Of CiPA’s 4 training drugs, verapamil blocks hERG at 3.56 times its free Cmax yet is low risk; sotalol is high risk at 7.53 times');
});

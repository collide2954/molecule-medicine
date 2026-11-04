import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  occupancy, operational, operationalSummary, doseRatio, chengPrusoff, association, washout, curve,
} from '../../src/theory.js';

const r4 = (v) => Math.round(v * 10000) / 10000;

test('occupancy follows the Hill–Langmuir equation', () => {
  assert.equal(occupancy(10, 10), 0.5);
  assert.equal(r4(occupancy(90, 10)), 0.9);
  assert.equal(r4(occupancy(10, 10, 2)), 0.5);
  assert.equal(r4(occupancy(20, 10, 2)), 0.8);
  assert.equal(occupancy(0, 10), 0);
});

test('the operational model turns affinity and efficacy into potency and maximal effect', () => {
  assert.equal(r4(operational(5, 10, 1)), 0.25);
  assert.deepEqual(operationalSummary(10, 1, 1), { ec50: 5, emax: 0.5, occupancyAtEc50: 0.3333 });
  assert.deepEqual(operationalSummary(10, 9, 1), { ec50: 1, emax: 0.9, occupancyAtEc50: 0.0909 });
  assert.equal(r4(operational(1, 10, 9)), 0.45);
});

test('a competitive antagonist shifts the agonist curve by the Schild dose ratio, and Cheng–Prusoff turns IC50 into Ki', () => {
  assert.equal(doseRatio(100, 10), 11);
  assert.equal(doseRatio(0, 10), 1);
  assert.equal(chengPrusoff(100, 10, 10), 50);
});

test('binding kinetics give the approach to equilibrium and the washout', () => {
  assert.equal(r4(association(0, 1e-9, 1e6, 1e-3)), 0);
  assert.equal(r4(association(1e6, 1e-9, 1e6, 1e-3)), 0.5);
  assert.equal(r4(association(Math.LN2 / 2e-3, 1e-9, 1e6, 1e-3)), 0.25);
  assert.equal(r4(washout(Math.LN2 / 1e-3, 0.5, 1e-3)), 0.25);
});

test('curve samples a function at evenly spaced log concentrations', () => {
  assert.deepEqual(curve((c) => c, -2, 0, 3).map((p) => [p.x, r4(p.y)]), [[-2, 0.01], [-1, 0.1], [0, 1]]);
});

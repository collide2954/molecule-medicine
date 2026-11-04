import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  quantile, summary, logEdges, linearEdges, binIndex, histogram, lorenz, gini, pearson, linearFit, spearman, ranks, clusterOrder, topBy,
  kde, silverman, ecdf, kaplanMeier, ror, prr, chi2, informationComponent, wilson, blandAltman, hexbin, geomean, mergeIntervals,
} from '../../src/stats.js';

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test('quantile and summary interpolate between ranks', () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.ok(Number.isNaN(quantile([], 0.5)));
  assert.deepEqual(summary([3, 1, 2]), {
    n: 3, min: 1, q1: 1.5, median: 2, q3: 2.5, max: 3, mean: 2,
  });
  assert.equal(summary([]), null);
});

test('edges, binIndex and histogram bin values with the last bin closed', () => {
  assert.deepEqual(logEdges(0, 2, 2), [1, 3.16227766017, 10, 31.6227766017, 100]);
  assert.deepEqual(linearEdges(0, 1, 0.25), [0, 0.25, 0.5, 0.75, 1]);
  const edges = [0, 1, 2, 3];
  assert.equal(binIndex(edges, 0.5), 0);
  assert.equal(binIndex(edges, 2.5), 2);
  assert.equal(binIndex(edges, 3), 2);
  assert.equal(binIndex(edges, -1), 0);
  assert.deepEqual(histogram([0.5, 1.5, 1.7, 9], edges), [1, 2, 1]);
});

test('lorenz and gini measure how concentrated a distribution is', () => {
  assert.deepEqual(lorenz([1, 1, 1, 1], 4), [[0, 0], [0.25, 0.25], [0.5, 0.5], [0.75, 0.75], [1, 1]]);
  assert.equal(gini([1, 1, 1, 1]), 0);
  assert.equal(gini([0, 0, 0, 10]), 0.75);
  assert.equal(gini([]), 0);
});

test('pearson, linearFit and spearman relate two variables', () => {
  assert.equal(pearson([1, 2, 3], [2, 4, 6]), 1);
  assert.deepEqual(linearFit([0, 1, 2], [1, 3, 5]), { slope: 2, intercept: 1 });
  assert.deepEqual(ranks([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
  assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  near(spearman([1, 2, 2, 3], [1, 3, 2, 4]), 0.948683298);
});

test('clusterOrder keeps similar rows next to each other', () => {
  const m = [[1, 0.1, 0.9, 0.1], [0.1, 1, 0.1, 0.8], [0.9, 0.1, 1, 0.1], [0.1, 0.8, 0.1, 1]];
  const order = clusterOrder(m);
  assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
  assert.equal(Math.abs(order.indexOf(0) - order.indexOf(2)), 1);
  assert.equal(Math.abs(order.indexOf(1) - order.indexOf(3)), 1);
});

test('topBy ranks rows by a key without changing them', () => {
  const rows = [{ k: 'a', n: 1 }, { k: 'b', n: 3 }, { k: 'c', n: 2 }];
  assert.deepEqual(topBy(rows, 'n', 2).map((r) => r.k), ['b', 'c']);
  assert.deepEqual(rows.map((r) => r.k), ['a', 'b', 'c']);
});

test('kde estimates a Gaussian density on a grid', () => {
  const grid = kde([0], { bandwidth: 1, from: -1, to: 1, points: 3 });
  assert.deepEqual(grid.map((g) => g.x), [-1, 0, 1]);
  near(grid[1].y, 0.3989422804);
  near(grid[0].y, 0.2419707245);
  near(silverman([1, 2, 3, 4, 5]), 0.9 * Math.min(Math.sqrt(2.5), 2 / 1.34) * 5 ** -0.2);
});

test('ecdf steps through the sorted values', () => {
  assert.deepEqual(ecdf([3, 1, 2, 2]), [{ x: 1, p: 0.25 }, { x: 2, p: 0.75 }, { x: 3, p: 1 }]);
});

test('kaplanMeier drops survival at each event and keeps censored times apart', () => {
  const km = kaplanMeier([1, 2, 3, 4, 5], [1, 0, 1, 1, 0]);
  assert.deepEqual(km.steps.map((s) => s.t), [0, 1, 3, 4]);
  assert.deepEqual(km.steps.map((s) => s.atRisk), [5, 5, 3, 2]);
  near(km.steps[1].s, 0.8);
  near(km.steps[2].s, 0.8 * (2 / 3));
  near(km.steps[3].s, 0.8 * (2 / 3) * 0.5);
  assert.deepEqual(km.censored, [2, 5]);
  assert.equal(km.median, 4);
  assert.equal(kaplanMeier([1, 2], [0, 0]).median, null);
});

test('disproportionality statistics follow the usual formulas', () => {
  const r = ror(20, 80, 100, 9800);
  near(r.value, 24.5);
  near(r.lo, 14.449, 1e-3);
  near(r.hi, 41.543, 1e-3);
  const p = prr(20, 80, 100, 9800);
  near(p.value, 19.8);
  near(p.lo, 12.780, 1e-3);
  near(p.hi, 30.676, 1e-3);
  near(chi2(20, 80, 100, 9800), 301.12, 1e-3);
  const ic = informationComponent(20, 80, 100, 9800);
  near(ic.value, 3.5920, 1e-3);
  near(ic.lo, 2.8416, 1e-3);
  assert.equal(ror(0, 80, 100, 9800).value, 0);
});

test('wilson gives a score interval for a proportion', () => {
  const [lo, hi] = wilson(8, 10);
  near(lo, 0.49016, 1e-4);
  near(hi, 0.94334, 1e-4);
  assert.deepEqual(wilson(0, 0), [0, 0]);
});

test('blandAltman gives the mean difference and limits of agreement', () => {
  const ba = blandAltman([10, 12, 14], [11, 11, 15]);
  near(ba.bias, -1 / 3);
  near(ba.sd, 1.154700538);
  near(ba.lo, -1 / 3 - 1.96 * 1.154700538);
  near(ba.hi, -1 / 3 + 1.96 * 1.154700538);
  assert.deepEqual(ba.points.map((p) => p.mean), [10.5, 11.5, 14.5]);
  assert.deepEqual(ba.points.map((p) => p.diff), [-1, 1, -1]);
});

test('hexbin counts points in pointy-top hexagons', () => {
  const bins = hexbin([[0, 0], [0.1, 0.1], [5, 5.6]], 1);
  assert.equal(bins.length, 2);
  const big = bins.find((b) => b.n === 2);
  assert.deepEqual([big.x, big.y], [0, 0]);
  const small = bins.find((b) => b.n === 1);
  near(small.x, 3 * Math.sqrt(3));
  near(small.y, 6);
  assert.deepEqual(big.members, [0, 1]);
  assert.deepEqual(small.members, [2]);
});

test('geomean and mergeIntervals', () => {
  near(geomean([1, 10, 100]), 10);
  assert.deepEqual(mergeIntervals([[5, 8], [1, 3], [2, 4]]), [[1, 4], [5, 8]]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  waffle, scaleLinear, scaleLog, logTicks, stack, zoomDomain, panDomain, easeOut, spread, squarify, spanTicks, heat, stepPath,
} from '../../src/lib.js';

const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('spanTicks covers the whole range with round steps', () => {
  assert.deepEqual(spanTicks(73, 803), [0, 200, 400, 600, 800, 1000]);
  assert.deepEqual(spanTicks(0, 800), [0, 200, 400, 600, 800]);
  assert.deepEqual(spanTicks(36.5, 47.9), [35, 40, 45, 50]);
  assert.deepEqual(spanTicks(5, 5), [5, 6]);
});

test('waffle splits 100 cells by largest remainder', () => {
  const cells = waffle([{ key: 'yes', value: 24.1 }, { key: 'no', value: 75.9 }]);
  assert.equal(cells.length, 100);
  assert.equal(cells.filter((c) => c === 'yes').length, 24);
  const parts = waffle([1, 1, 1, 1, 1, 1].map((value, key) => ({ key, value })));
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => parts.filter((c) => c === k).length), [17, 17, 17, 17, 16, 16]);
});

test('scales map linearly and logarithmically', () => {
  assert.equal(scaleLinear([0, 10], [0, 100])(5), 50);
  assert.equal(scaleLinear([0, 10], [100, 0])(10), 0);
  assert.ok(close(scaleLog([1, 1000], [0, 300])(10), 100));
});

test('logTicks lists powers of ten inside the range', () => {
  assert.deepEqual(logTicks(56, 41381383), [100, 1000, 10000, 100000, 1000000, 10000000]);
  assert.deepEqual(logTicks(1e-9, 1e-6), [1e-9, 1e-8, 1e-7, 1e-6]);
});

test('stack accumulates series per row', () => {
  const rows = [{ year: 1, a: 1, b: 2 }, { year: 2, a: 3, b: 1 }];
  assert.deepEqual(stack(rows, ['a', 'b']), [
    { key: 'a', points: [[0, 1], [0, 3]] },
    { key: 'b', points: [[1, 3], [3, 4]] },
  ]);
});

test('zoomDomain zooms around a point and stays inside limits, and panDomain clamps', () => {
  assert.deepEqual(zoomDomain([1800, 2000], 1900, 0.5, [1800, 2026]), [1850, 1950]);
  assert.deepEqual(zoomDomain([1950, 2026], 2026, 4, [1800, 2026]), [1800, 2026]);
  assert.deepEqual(zoomDomain([1900, 1902], 1901, 0.1, [1800, 2026], 4), [1899, 1903]);
  assert.deepEqual(panDomain([1900, 1950], 100, [1800, 2026]), [1976, 2026]);
  assert.deepEqual(panDomain([1900, 1950], -200, [1800, 2026]), [1800, 1850]);
});

test('easeOut eases toward one', () => {
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  assert.equal(easeOut(0.5), 0.875);
});

test('spread keeps labels a minimum gap apart, in order and inside the range', () => {
  const out = spread([100, 102, 104, 200], 14, 0, 300);
  for (let i = 1; i < out.length; i += 1) assert.ok(out[i] - out[i - 1] >= 14 - 1e-9, JSON.stringify(out));
  assert.equal(out[3], 200);
  assert.deepEqual(spread([50, 10, 90], 12, 0, 100), [50, 10, 90]);
  const edge = spread([295, 298, 299], 12, 0, 300);
  assert.ok(Math.max(...edge) <= 300 && edge[0] < edge[1] && edge[1] < edge[2]);
});

test('squarify tiles the whole box with areas in proportion to values', () => {
  const tiles = squarify([{ key: 'a', value: 6 }, { key: 'b', value: 3 }, { key: 'c', value: 1 }], 100, 50);
  const area = (t) => t.w * t.h;
  assert.ok(close(tiles.reduce((n, t) => n + area(t), 0), 5000));
  assert.ok(close(area(tiles.find((t) => t.key === 'a')), 3000));
  for (const t of tiles) assert.ok(t.x >= -1e-9 && t.y >= -1e-9 && t.x + t.w <= 100 + 1e-9 && t.y + t.h <= 50 + 1e-9);
});

test('heat maps a value into an opacity between 0.06 and 1', () => {
  assert.equal(heat(0, 0, 10), 0.06);
  assert.equal(heat(10, 0, 10), 1);
  assert.equal(heat(5, 0, 10), 0.53);
  assert.equal(heat(20, 0, 10), 1);
  assert.equal(heat(3, 3, 3), 1);
});

test('stepPath draws a survival curve as horizontal then vertical steps', () => {
  const x = (t) => t * 10;
  const y = (s) => 100 - s * 100;
  assert.equal(stepPath([{ t: 0, s: 1 }, { t: 1, s: 0.8 }, { t: 3, s: 0.4 }], x, y, 5), 'M0,0H10V20H30V60H50');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matches, filterTimeline, sortRows, niceTicks, labelStep, LENSES, readLens, inLens, lensSearch,
} from '../../src/lib.js';

test('matches needs every term, ignoring case and accents', () => {
  assert.equal(matches('Sertürner isolates morphine from opium', 'serturner morphine'), true);
  assert.equal(matches('CYP2D6 poor metabolizer', 'cyp2d6 ultrarapid'), false);
  assert.equal(matches('anything', ''), true);
  assert.equal(matches('anything', '   '), true);
});

const ITEMS = [
  { date: '1805', org: 'Science', tag: 'discovery', text: 'Sertürner isolates morphine from opium' },
  { date: '1938-06-25', org: 'Law', tag: 'law', text: 'Federal Food, Drug, and Cosmetic Act' },
  { date: '1962-10-10', org: 'Law', tag: 'law', text: 'Kefauver-Harris Amendments require proof of efficacy' },
];

test('filterTimeline filters by tag, lane and query', () => {
  assert.equal(filterTimeline(ITEMS, {}).length, 3);
  assert.deepEqual(filterTimeline(ITEMS, { tags: ['discovery'] }).map((i) => i.date), ['1805']);
  assert.deepEqual(filterTimeline(ITEMS, { orgs: ['Law'] }).map((i) => i.date), ['1938-06-25', '1962-10-10']);
  assert.deepEqual(filterTimeline(ITEMS, { query: 'efficacy' }).map((i) => i.date), ['1962-10-10']);
});

test('sortRows sorts numbers and strings with nulls last', () => {
  const rows = [{ n: 2, s: 'b' }, { n: null, s: 'c' }, { n: 10, s: 'a' }];
  assert.deepEqual(sortRows(rows, 'n', 'desc').map((r) => r.n), [10, 2, null]);
  assert.deepEqual(sortRows(rows, 'n', 'asc').map((r) => r.n), [2, 10, null]);
  assert.deepEqual(sortRows(rows, 's', 'asc').map((r) => r.s), ['a', 'b', 'c']);
  assert.deepEqual(rows.map((r) => r.n), [2, null, 10]);
});

test('niceTicks returns round steps up to max', () => {
  assert.deepEqual(niceTicks(1_882_376, 4), [0, 500000, 1000000, 1500000, 2000000]);
  assert.deepEqual(niceTicks(9, 3), [0, 5, 10]);
  assert.deepEqual(niceTicks(0.62, 3), [0, 0.5, 1]);
  assert.deepEqual(niceTicks(0.29, 3), [0, 0.1, 0.2, 0.3]);
  assert.deepEqual(niceTicks(0, 3), [0]);
  assert.deepEqual(niceTicks(100.00000000000003, 4), [0, 50, 100]);
});

test('labelStep spaces axis labels to fit the width', () => {
  assert.equal(labelStep(82, 770), 5);
  assert.equal(labelStep(82, 290), 10);
  assert.equal(labelStep(5, 600), 1);
  assert.equal(labelStep(300, 200), 50);
});

test('lenses read from the URL and filter sections', () => {
  assert.deepEqual(LENSES.map((l) => l.id), ['all', 'basic', 'clinical', 'safety', 'genomics']);
  assert.ok(LENSES.every((l) => l.label && l.hint));
  assert.equal(readLens('?lens=safety'), 'safety');
  assert.equal(readLens('?lens=bogus'), 'all');
  assert.equal(readLens(''), 'all');
  assert.equal(inLens('basic clinical', 'clinical'), true);
  assert.equal(inLens('basic', 'genomics'), false);
  assert.equal(inLens('', 'safety'), true);
  assert.equal(inLens('safety', 'all'), true);
  assert.equal(lensSearch('?lens=basic&x=1', 'all'), '?x=1');
  assert.equal(lensSearch('', 'genomics'), '?lens=genomics');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSections, diffCounts } from '../../scripts/sections.mjs';

const NOW = new Date('2026-11-08T06:17:00Z');
const quiet = () => {};

test('every section builds and is stamped with the run time', async () => {
  const out = await runSections({ chembl: async () => ({ n: 1 }), faers: async () => [2] }, { now: NOW, log: quiet });
  assert.equal(out.generated, '2026-11-08T06:17:00.000Z');
  assert.deepEqual(out.chembl, { n: 1 });
  assert.deepEqual(out.faers, [2]);
  assert.deepEqual(out.asOf, { chembl: '2026-11-08T06:17:00.000Z', faers: '2026-11-08T06:17:00.000Z' });
  assert.deepEqual(out.failed, []);
});

test('a failing section keeps last week\'s values and date and is listed', async () => {
  const previous = { generated: '2026-11-01T06:17:00.000Z', asOf: { chembl: '2026-11-01T06:17:00.000Z' }, chembl: { n: 0 } };
  const out = await runSections({
    chembl: async () => { throw new Error('HTTP 503'); },
    faers: async () => 'ok',
  }, { now: NOW, previous, log: quiet });
  assert.deepEqual(out.chembl, { n: 0 });
  assert.equal(out.asOf.chembl, '2026-11-01T06:17:00.000Z');
  assert.equal(out.faers, 'ok');
  assert.deepEqual(out.failed, [{ section: 'chembl', error: 'HTTP 503' }]);
});

test('a failing section with nothing to fall back on throws', async () => {
  await assert.rejects(runSections({ chembl: async () => { throw new Error('gone'); } }, { now: NOW, log: quiet }), /chembl: gone/);
});

test('named sections rebuild alone and the rest carry over', async () => {
  const previous = { generated: '2026-11-01T06:17:00.000Z', asOf: { a: '2026-11-01T06:17:00.000Z', b: '2026-10-25T06:17:00.000Z' }, a: 1, b: 2 };
  let builtA = false;
  const out = await runSections({ a: async () => { builtA = true; return 10; }, b: async () => 20 }, { now: NOW, previous, only: ['b'], log: quiet });
  assert.equal(builtA, false);
  assert.equal(out.a, 1);
  assert.equal(out.b, 20);
  assert.deepEqual(out.asOf, { a: '2026-11-01T06:17:00.000Z', b: '2026-11-08T06:17:00.000Z' });
});

test('diffCounts lists the counts that moved, largest relative change first', () => {
  const before = { faers: 1000, labels: 500, activities: 24527044, approvals: 10 };
  const after = { faers: 1100, labels: 500, activities: 24527045, approvals: 12, trials: 5 };
  assert.deepEqual(diffCounts(before, after), [
    { key: 'approvals', before: 10, after: 12, delta: 2 },
    { key: 'faers', before: 1000, after: 1100, delta: 100 },
    { key: 'activities', before: 24527044, after: 24527045, delta: 1 },
  ]);
  assert.deepEqual(diffCounts(undefined, after), []);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCES, SOURCE_TITLES, SOURCE_GROUPS, EXAMPLES, LANDMARKS,
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

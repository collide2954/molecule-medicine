import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  lines, bufferLines, unzip, gzLines, fileLines, cacheName, anyLines,
} from '../../scripts/streams.mjs';
import { retry } from '../../src/lib.js';
import { zipOf } from './fixtures.mjs';

const collect = async (iterable) => {
  const out = [];
  for await (const x of iterable) out.push(x);
  return out;
};

test('lines joins chunks split mid-line and drops carriage returns', async () => {
  const chunks = ['ab\ncd', '\r\nef', '\ngh'].map((s) => Buffer.from(s));
  assert.deepEqual(await collect(lines(chunks)), ['ab', 'cd', 'ef', 'gh']);
  assert.deepEqual(await collect(lines([Buffer.from('x\n')])), ['x']);
});

test('lines keeps multibyte characters split across chunks', async () => {
  const bytes = Buffer.from('5 Âµg/mL\nok');
  const chunks = [bytes.subarray(0, 3), bytes.subarray(3)];
  assert.deepEqual(await collect(lines(chunks)), ['5 Âµg/mL', 'ok']);
});

test('bufferLines walks a buffer line by line', () => {
  assert.deepEqual([...bufferLines(Buffer.from('a\r\nb\n\nc'))], ['a', 'b', '', 'c']);
});

test('unzip inflates every entry by name', () => {
  const files = unzip(zipOf({ 'Products.txt': 'ApplNo~Form\n001234~TABLET\n', 'patent.txt': 'hello' }));
  assert.deepEqual(Object.keys(files), ['Products.txt', 'patent.txt']);
  assert.equal(files['Products.txt'].toString(), 'ApplNo~Form\n001234~TABLET\n');
  assert.equal(files['patent.txt'].toString(), 'hello');
});

test('gzLines and fileLines stream a file from disk', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pharm-'));
  try {
    await writeFile(join(dir, 'a.gz'), gzipSync('one\ntwo\nthree'));
    await writeFile(join(dir, 'b.txt'), 'four\r\nfive\n');
    assert.deepEqual(await collect(gzLines(join(dir, 'a.gz'))), ['one', 'two', 'three']);
    assert.deepEqual(await collect(fileLines(join(dir, 'b.txt'))), ['four', 'five']);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('anyLines reads gzipped and plain files alike, whatever their names say', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pharm-'));
  try {
    await writeFile(join(dir, 'stream'), gzipSync('one\ntwo'));
    await writeFile(join(dir, 'plain.txt'), 'three\nfour\n');
    await writeFile(join(dir, 'empty'), '');
    assert.deepEqual(await collect(await anyLines(join(dir, 'stream'))), ['one', 'two']);
    assert.deepEqual(await collect(await anyLines(join(dir, 'plain.txt'))), ['three', 'four']);
    assert.deepEqual(await collect(await anyLines(join(dir, 'empty'))), []);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('cacheName turns a URL into a safe file name', () => {
  assert.equal(cacheName('https://www.fda.gov/media/89850/download'), 'www.fda.gov_media_89850_download');
  assert.equal(cacheName('https://api.fda.gov/drug/event.json?count=receivedate'), 'api.fda.gov_drug_event.json_count_receivedate');
});

test('cacheName shortens long URLs and keeps them apart', () => {
  const long = (field) => `https://www.ebi.ac.uk/chembl/api/data/molecule.json?only=${Array.from({ length: 40 }, (_, i) => `${field}_${i}`).join(',')}`;
  const a = cacheName(long('molecule_properties'));
  const b = cacheName(long('molecule_structures'));
  assert.ok(a.length <= 160, `${a.length}`);
  assert.notEqual(a, b);
  assert.match(a, /^www\.ebi\.ac\.uk_chembl_api_data_molecule\.json_only_molecule_properties/);
  assert.equal(cacheName(long('molecule_properties')), a);
});

test('retry returns the first success and rethrows after the last try', async () => {
  let calls = 0;
  const ok = await retry(async () => {
    calls += 1;
    if (calls < 3) throw new Error('flaky');
    return 'done';
  }, { tries: 3, wait: 1 });
  assert.equal(ok, 'done');
  assert.equal(calls, 3);
  await assert.rejects(retry(async () => { throw new Error('down'); }, { tries: 2, wait: 1 }), /down/);
});

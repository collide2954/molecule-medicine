import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { retry } from '../src/lib.js';
import { FILES, USER_AGENT, CHEMBL } from '../src/queries.js';
import { cacheName, downloadTo } from './streams.mjs';
import { runSections, toModule } from './sections.mjs';
import {
  chemblStatus, approvedDrugs, atcNames, pages, ringSystemTable,
} from './chembl.mjs';

const OUT = new URL('../src/snapshot.js', import.meta.url);
const HEADERS = { 'user-agent': USER_AGENT, accept: 'application/json' };
const CACHE = process.env.SNAPSHOT_CACHE ?? await mkdtemp(join(tmpdir(), 'basic-clinical-pharm-'));
await mkdir(CACHE, { recursive: true });

const file = (url) => retry(async () => {
  const path = join(CACHE, cacheName(url));
  return existsSync(path) ? path : downloadTo(url, path, HEADERS);
}, { tries: 5, wait: 3000 });

const text = async (url) => {
  const buffer = await readFile(await file(url));
  return (buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer) : buffer).toString('utf8');
};

const json = async (url) => JSON.parse(await text(url));

const chemblJson = (path) => json(`${CHEMBL}${path}`);
const relative = (url) => url.slice(CHEMBL.length);

const chembl = async () => ({
  ...chemblStatus(await json(FILES.chemblStatus)),
  atc: atcNames(await pages(chemblJson, relative(FILES.chemblAtc), 'atc')),
});

let drugList;
const drugs = async () => {
  drugList ??= approvedDrugs(await pages(chemblJson, relative(FILES.chemblApproved), 'molecules'));
  return drugList;
};

const chemistry = async () => ({ systems: ringSystemTable(await drugs(), 40) });

const SECTIONS = { chembl, drugs, chemistry };

const now = new Date();
const only = process.argv.slice(2).filter((a) => SECTIONS[a]);
const previous = existsSync(OUT) ? (await import(`${OUT.href}?t=${now.getTime()}`)).default : {};
const snapshot = await runSections(SECTIONS, { now, previous, only });
await writeFile(OUT, toModule(snapshot));
process.stderr.write(`wrote ${OUT.pathname}\n`);

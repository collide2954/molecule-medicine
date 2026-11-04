import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { retry } from '../src/lib.js';
import {
  FILES, USER_AGENT, CHEMBL, RCSB_YEARS,
} from '../src/queries.js';
import { cacheName, downloadTo } from './streams.mjs';
import { runSections, toModule } from './sections.mjs';
import {
  chemblStatus, approvedDrugs, atcNames, pages, ringSystemTable, mechanismRecords, targetRecord, classTree, targetClass, moleculeLabel,
} from './chembl.mjs';
import {
  gtopdbVersion, gtopdbTargets, gtopdbSummary, approvedAffinities,
} from './gtopdb.mjs';
import { davisMatrix, selectivity, kinaseGroup } from './kinome.mjs';
import { rcsbByYear, gpcrdbSummary } from './structures.mjs';
import { packedLayout } from './layout.mjs';
import { drugTargetNetwork } from './network.mjs';
import { clinvarGenes, hgncCoding, geneSupport } from './genetics.mjs';

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

const posted = (url, body) => retry(async () => {
  const path = join(CACHE, `${cacheName(url)}_${createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 12)}.json`);
  if (existsSync(path)) return JSON.parse(await readFile(path, 'utf8'));
  const res = await fetch(url, { method: 'POST', headers: { ...HEADERS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const out = await res.json();
  await writeFile(path, JSON.stringify(out));
  return out;
}, { tries: 5, wait: 3000 });

const chemblJson = (path) => json(`${CHEMBL}${path}`);
const relative = (url) => url.slice(CHEMBL.length);
const chunks = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));
const query = (params) => new URLSearchParams(params).toString();
const memo = (build) => {
  let value;
  return () => {
    value ??= build();
    return value;
  };
};

const chembl = async () => ({
  ...chemblStatus(await json(FILES.chemblStatus)),
  atc: atcNames(await pages(chemblJson, relative(FILES.chemblAtc), 'atc')),
});

const drugs = memo(async () => approvedDrugs(await pages(chemblJson, relative(FILES.chemblApproved), 'molecules')));

const chemistry = async () => ({ systems: ringSystemTable(await drugs(), 40) });

const classes = memo(async () => classTree(await pages(chemblJson, relative(FILES.chemblClasses), 'protein_classifications')));

const targetDetails = async (ids) => {
  const raw = [];
  for (const batch of chunks([...ids].sort(), 50)) raw.push(...await pages(chemblJson, `target.json?${query({ target_chembl_id__in: batch.join(','), limit: '1000' })}`, 'targets'));
  const componentIds = [...new Set(raw.flatMap((t) => (t.target_components ?? []).map((c) => c.component_id)))].sort((a, b) => a - b);
  const componentClasses = new Map();
  for (const batch of chunks(componentIds, 100)) {
    const rows = await pages(chemblJson, `target_component.json?${query({ component_id__in: batch.join(','), limit: '1000', only: 'component_id,protein_classifications' })}`, 'target_components');
    for (const c of rows) componentClasses.set(c.component_id, (c.protein_classifications ?? []).map((p) => p.protein_classification_id));
  }
  const tree = await classes();
  return raw.map((t) => {
    const { classes: classIds, ...rest } = targetRecord(t, componentClasses);
    return { ...rest, ...targetClass(classIds, tree, rest.type) };
  }).sort((a, b) => Number(a.id.slice(6)) - Number(b.id.slice(6)));
};

const rawMechanisms = memo(() => pages(chemblJson, relative(FILES.chemblMechanisms), 'mechanisms'));

const targetData = memo(async () => {
  const approved = new Set((await drugs()).map((d) => d.id));
  const raw = (await rawMechanisms()).filter((m) => approved.has(m.parent_molecule_chembl_id ?? m.molecule_chembl_id));
  const seen = new Set();
  const mechanisms = mechanismRecords(raw).filter((m) => {
    const key = `${m.drug}|${m.target}|${m.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => Number(a.drug.slice(6)) - Number(b.drug.slice(6)) || Number(a.target.slice(6)) - Number(b.target.slice(6)));
  const withTarget = new Set(mechanisms.map((m) => m.drug));
  const withRow = new Set(raw.map((m) => m.parent_molecule_chembl_id ?? m.molecule_chembl_id));
  return {
    coverage: { approved: approved.size, withTarget: withTarget.size, untargeted: [...withRow].filter((d) => !withTarget.has(d)).length, none: [...approved].filter((d) => !withRow.has(d)).length },
    mechanisms,
    targets: await targetDetails(new Set(mechanisms.map((m) => m.target))),
  };
});

const targets = () => targetData();

const network = async () => {
  const { mechanisms, targets: list } = await targetData();
  const drugMap = new Map((await drugs()).map((d) => [d.id, { group: d.atc[0]?.[0] ?? null }]));
  const targetMap = new Map(list.map((t) => [t.id, { group: t.family }]));
  const net = drugTargetNetwork(mechanisms, drugMap, targetMap);
  const xy = packedLayout(net.nodes.length, net.edges, { iterations: 300 });
  return {
    drugs: net.nodes.filter((n) => n.kind === 'drug').length,
    nodes: net.nodes.map((n, i) => [n.id, ...xy[i]]),
    edges: net.edges,
  };
};

const round = (v, digits) => Number(v.toFixed(digits));

const kinome = async () => {
  const acts = await pages(chemblJson, relative(FILES.davis), 'activities');
  const details = new Map((await targetDetails(new Set(acts.map((a) => a.target_chembl_id)))).map((t) => [t.id, t]));
  const m = davisMatrix(acts, (id) => kinaseGroup(details.get(id)?.path ?? [], details.get(id)?.organism, details.get(id)?.ec ?? []));
  const only = 'molecule_chembl_id,pref_name,molecule_synonyms,molecule_hierarchy';
  const molecules = new Map((await pages(chemblJson, `molecule.json?${query({ molecule_chembl_id__in: m.inhibitors.map((r) => r.id).join(','), limit: '1000', only })}`, 'molecules')).map((x) => [x.molecule_chembl_id, x]));
  const approved = new Set((await drugs()).map((d) => d.id));
  const wild = m.kinases.map((k, j) => (k.variant ? -1 : j)).filter((j) => j >= 0);
  return {
    document: 'CHEMBL1908390',
    inhibitors: m.inhibitors.map((r, i) => {
      const s = selectivity(wild.map((j) => m.pkd[i][j]));
      const mol = molecules.get(r.id);
      const parent = mol?.molecule_hierarchy?.parent_chembl_id ?? r.id;
      return {
        id: r.id, parent, name: mol ? moleculeLabel(mol) : r.name, approved: approved.has(parent), hits: s.hits, s3: round(s.s3, 4), gini: round(s.gini, 3),
      };
    }),
    kinases: m.kinases.map((k) => ({ ...k, gene: details.get(k.target)?.genes?.[0] ?? null })),
    pkd: m.pkd,
  };
};

const gtopdb = async () => {
  const targetsText = await text(FILES.gtopdbTargets);
  const interactionsText = await text(FILES.gtopdbInteractions);
  const list = gtopdbTargets(targetsText);
  return {
    version: gtopdbVersion(targetsText),
    ...gtopdbSummary(list, interactionsText),
    orphans: list.filter((t) => t.orphan).map((t) => ({
      id: t.id, type: t.type, family: t.family, name: t.name, gene: t.genes[0] ?? null,
    })),
    affinities: approvedAffinities(list, interactionsText),
  };
};

const GENE_TARGETS = new Set(['SINGLE PROTEIN', 'PROTEIN COMPLEX']);

const genetics = async () => {
  const cv = clinvarGenes(await text(FILES.clinvarGenes));
  const coding = hgncCoding(await text(FILES.hgncCoding));
  const { targets: list } = await targetData();
  const accessions = list.filter((t) => t.organism === 'Homo sapiens' && GENE_TARGETS.has(t.type)).flatMap((t) => t.accessions);
  return { clinvarDated: cv.dated, ...geneSupport(coding, cv.genes, accessions) };
};

const structures = async () => {
  const rcsb = await posted(FILES.rcsbSearch, RCSB_YEARS);
  return { pdb: { total: rcsb.total_count, ...rcsbByYear(rcsb) }, gpcrdb: gpcrdbSummary(await json(FILES.gpcrdb)) };
};

const SECTIONS = {
  chembl, drugs, chemistry, targets, network, kinome, gtopdb, genetics, structures,
};

const now = new Date();
const only = process.argv.slice(2).filter((a) => SECTIONS[a]);
const previous = existsSync(OUT) ? (await import(`${OUT.href}?t=${now.getTime()}`)).default : {};
const snapshot = await runSections(SECTIONS, { now, previous, only });
await writeFile(OUT, toModule(snapshot));
process.stderr.write(`wrote ${OUT.pathname}\n`);

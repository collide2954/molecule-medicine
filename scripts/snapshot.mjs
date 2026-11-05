import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { retry } from '../src/lib.js';
import {
  FILES, USER_AGENT, CHEMBL, RCSB_YEARS, ACTIVITY_AGGS, DOCUMENTS, PK_PARAMETERS, pkQuery,
  DRUG_TRIALS, PHASE_GROUPS, TRIAL_FEATURES, ENROLLMENT_BINS, REPORTING, PSYCHOACTIVE, PSYCHOACTIVE_FIELDS, ctCount, ctPage, postedIn, postedBefore, enrolled, openfdaPage,
} from '../src/queries.js';
import {
  recallRecords, recallSummary, nitrosamineRecalls, nitrosamineLimits, shortageRecords, shortageSummary, iidLink, iidRows, iidSummary,
} from './manufacturing.mjs';
import { readXlsx } from './readers.mjs';
import {
  delimited, novelApprovals, novelYears, approvalCalendar, andaApprovals, patentSummary, exclusivitySummary, teSummary, mostCopied, emaMedicines, emaYears, emaFlags, fdaEmaLag, biosimilarRows,
} from './approvals.mjs';
import {
  ctFieldValues, ctStudies, reportingTimes, reportingGroups, compoundTrials,
} from './trials.mjs';
import {
  cacheName, downloadTo, unzip, bufferLines,
} from './streams.mjs';
import {
  activitySummary, kineticPairs, agreementPairs,
} from './bioactivity.mjs';
import { almanacNames, almanacScores } from './almanac.mjs';
import { ddiRows, cipaRows, perDrugMedians } from './adme.mjs';
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
const now = new Date();
const HEADERS = { 'user-agent': USER_AGENT, accept: 'application/json' };
const CACHE = process.env.SNAPSHOT_CACHE ?? await mkdtemp(join(tmpdir(), 'molecule-medicine-'));
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

const esSearch = (body) => posted(FILES.chemblSearch, body);

const ACTIVITY_FIELDS = [
  'activity_id', 'molecule_chembl_id', 'parent_molecule_chembl_id', 'molecule_pref_name', 'target_chembl_id', 'target_pref_name', 'target_organism', 'assay_chembl_id', 'assay_description', 'assay_variant_mutation',
  'standard_type', 'standard_value', 'standard_units', 'standard_relation', 'pchembl_value',
];

const esDocument = async (doc) => {
  const rows = [];
  let after = null;
  for (;;) {
    const body = {
      size: 5000, query: { term: { document_chembl_id: doc } }, sort: [{ activity_id: 'asc' }], _source: ACTIVITY_FIELDS, ...(after ? { search_after: after } : {}),
    };
    const hits = (await esSearch(body)).hits?.hits ?? [];
    rows.push(...hits.map((h) => h._source));
    if (hits.length < 5000) return rows;
    after = hits.at(-1).sort;
  }
};

const activities = async () => {
  const names = new Map((await pages(chemblJson, relative(FILES.chemblSources), 'sources')).map((s) => [s.src_id, s.src_description]));
  return activitySummary(await esSearch(ACTIVITY_AGGS), names);
};

const kinomeData = memo(async () => {
  const acts = await esDocument(DOCUMENTS.davis);
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
});

const kinome = () => kinomeData();

const agreement = async () => {
  const davis = await kinomeData();
  const against = async (doc) => ({ document: doc, ...agreementPairs(davis, await esDocument(doc)) });
  return { karaman: await against(DOCUMENTS.karaman), klaeger: await against(DOCUMENTS.klaeger) };
};

const kinetics = async () => ({ document: DOCUMENTS.k4dd, pairs: kineticPairs(await esDocument(DOCUMENTS.k4dd)) });

const almanac = async () => {
  const names = almanacNames(await text(FILES.almanacNames));
  const [, csv] = Object.entries(unzip(await readFile(await file(FILES.almanac)))).find(([name]) => /\.csv$/i.test(name));
  return almanacScores(bufferLines(csv), names);
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

const pk = async () => {
  const ids = (await drugs()).map((d) => d.id);
  const out = {};
  for (const parameter of PK_PARAMETERS) out[parameter.key] = perDrugMedians(await esSearch(pkQuery(parameter, ids)));
  return out;
};

const ddi = async () => ({ rows: ddiRows(await text(FILES.fdaInteractions)) });

const cipa = async () => ({ commit: '539ff80d6616895de5d943e7bfb77b346d195db4', rows: cipaRows(await text(FILES.cipaIc50), await text(FILES.cipaDrugs)) });

const ctTotal = async (expr) => {
  const n = (await json(ctCount(expr))).totalCount;
  if (!Number.isInteger(n)) throw new Error(`no count for ${expr}`);
  return n;
};

const ctAll = async (params) => {
  const rows = [];
  let token = null;
  do {
    const page = await json(ctPage(params, token));
    rows.push(...ctStudies(page));
    token = page.nextPageToken ?? null;
  } while (token);
  return rows;
};

const trials = async () => {
  const last = now.getUTCFullYear() - 1;
  const years = Array.from({ length: last - 1999 }, (_, i) => 2000 + i);
  const within = (g, extra) => `${DRUG_TRIALS} AND (${g.expr})${extra ? ` AND (${extra})` : ''}`;
  const registered = [];
  const design = [];
  const enrollment = [];
  for (const g of PHASE_GROUPS) {
    const counts = [];
    for (const y of years) counts.push(await ctTotal(within(g, postedIn(y))));
    registered.push({ key: g.key, before: await ctTotal(within(g, postedBefore(2000))), years: counts });
    const features = [];
    for (const f of TRIAL_FEATURES) features.push(await ctTotal(within(g, f.of ? `${f.of} AND ${f.expr}` : f.expr)));
    design.push({
      key: g.key, total: await ctTotal(within(g)), completed: await ctTotal(within(g, 'AREA[OverallStatus]COMPLETED')), features,
    });
    const bins = [];
    for (const b of ENROLLMENT_BINS) bins.push(await ctTotal(within(g, enrolled(b))));
    enrollment.push({ key: g.key, bins });
  }
  const size = await json(FILES.ctSize);
  return {
    total: size.totalStudies, drug: await ctTotal(DRUG_TRIALS), fields: ctFieldValues(await json(FILES.ctFields)), years, registered, design, enrollment,
  };
};

const reporting = async () => {
  const rows = await ctAll({ 'filter.advanced': REPORTING.expr, fields: REPORTING.fields.join(',') });
  const asOf = now.toISOString().slice(0, 10);
  return {
    from: REPORTING.from, to: REPORTING.to, asOf, n: rows.length, groups: reportingGroups(reportingTimes(rows, asOf)),
  };
};

const psychoactive = async () => {
  const compounds = [];
  for (const spec of PSYCHOACTIVE) {
    const rows = await ctAll({
      'query.intr': spec.search, ...(spec.cond ? { 'query.cond': spec.cond } : {}), 'filter.advanced': 'AREA[StudyType]INTERVENTIONAL', fields: PSYCHOACTIVE_FIELDS.join(','),
    });
    compounds.push(compoundTrials(rows, spec));
  }
  return { compounds };
};

const openfdaAll = async (url) => {
  const first = await json(openfdaPage(url, 0));
  const total = first.meta?.results?.total ?? 0;
  const batches = [first];
  for (let skip = 1000; skip < total; skip += 1000) batches.push(await json(openfdaPage(url, skip)));
  return { meta: first.meta, results: batches.flatMap((p) => p.results ?? []) };
};

const unique = (rows, key) => {
  const seen = new Set();
  return rows.filter((r) => {
    if (seen.has(key(r))) return false;
    seen.add(key(r));
    return true;
  });
};

const recallData = memo(async () => {
  const all = await openfdaAll(FILES.fdaEnforcement);
  return { updated: all.meta?.last_updated ?? null, records: unique(recallRecords(all), (r) => r.id) };
});

const recalls = async () => {
  const { updated, records } = await recallData();
  return { updated, ...recallSummary(records, now.getUTCFullYear() - 1) };
};

const nitrosamines = async () => {
  const { records } = await recallData();
  return { recalls: nitrosamineRecalls(records), ...nitrosamineLimits(await text(FILES.nitrosamineLimits)) };
};

const shortages = async () => {
  const all = await openfdaAll(FILES.fdaShortages);
  return { updated: all.meta?.last_updated ?? null, ...shortageSummary(shortageRecords(all)) };
};

const excipients = async () => {
  const link = iidLink(await text(FILES.iidPage));
  if (!link) throw new Error('no Inactive Ingredient Database link');
  const [, xlsx] = Object.entries(unzip(await readFile(await file(link)))).find(([name]) => /\.xlsx$/i.test(name)) ?? [];
  if (!xlsx) throw new Error('no xlsx in the Inactive Ingredient Database download');
  return { link, ...iidSummary(iidRows(readXlsx(xlsx))) };
};

const zipTables = async (url, names, delimiter) => {
  const files = unzip(await readFile(await file(url)));
  return Object.fromEntries(Object.entries(names).map(([key, name]) => {
    if (!files[name]) throw new Error(`no ${name} in ${url}`);
    return [key, delimited(files[name].toString('latin1'), delimiter)];
  }));
};

const fdaTables = memo(() => zipTables(FILES.drugsAtFda, {
  applications: 'Applications.txt', classes: 'SubmissionClass_Lookup.txt', submissions: 'Submissions.txt', properties: 'SubmissionPropertyType.txt', products: 'Products.txt',
}, '\t'));

const novelData = memo(async () => novelApprovals(await fdaTables()));

const approvals = async () => {
  const last = now.getUTCFullYear() - 1;
  const novel = await novelData();
  return {
    total: novel.length,
    ...novelYears(novel, 1950, last),
    calendar: approvalCalendar(novel, 1990),
    latest: novel.filter((n) => Number(n.date.slice(0, 4)) === last),
    generics: andaApprovals(await fdaTables(), 1984, last),
  };
};

const orangebook = async () => {
  const t = await zipTables(FILES.orangeBook, { products: 'products.txt', patents: 'patent.txt', exclusivity: 'exclusivity.txt' }, '~');
  return {
    ...patentSummary(t.products, t.patents, 15), exclusivity: exclusivitySummary(t.exclusivity), te: teSummary(t.products), copied: mostCopied(t.products, 15),
  };
};

const ema = async () => {
  const rows = emaMedicines(readXlsx(await readFile(await file(FILES.emaMedicines))));
  if (!rows.length) throw new Error('no human medicines in EMA’s report');
  return { ...emaYears(rows, 1995, now.getUTCFullYear() - 1), flags: emaFlags(rows), lag: fdaEmaLag(await novelData(), rows, 1995) };
};

const biosimilars = async () => {
  const rows = biosimilarRows(await text(FILES.biosimilars));
  if (!rows.length) throw new Error('no biosimilar table');
  return { rows };
};

const SECTIONS = {
  chembl, drugs, chemistry, targets, network, kinome, gtopdb, genetics, structures, activities, agreement, kinetics, almanac, pk, ddi, cipa, trials, reporting, psychoactive, recalls, nitrosamines, shortages, excipients, approvals, orangebook, ema, biosimilars,
};

const only = process.argv.slice(2).filter((a) => SECTIONS[a]);
const previous = existsSync(OUT) ? (await import(`${OUT.href}?t=${now.getTime()}`)).default : {};
const snapshot = await runSections(SECTIONS, { now, previous, only });
await writeFile(OUT, toModule(snapshot));
process.stderr.write(`wrote ${OUT.pathname}\n`);

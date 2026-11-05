import snapshot from './snapshot.js';
import {
  SOURCES, SOURCE_TITLES, SOURCE_GROUPS, EXAMPLES, LANDMARKS, GENETIC_SUPPORT, ATTRITION, RD_COST,
} from './facts.js';
import {
  exact, compact, pct, daltons, identify, matches, LENSES, readLens, inLens, lensSearch, toCsv, longDate, soften, decimal, partition, molar, pToMolar, clipLine, pow10, seconds, duration,
} from './lib.js';
import {
  linearEdges, logEdges, histogram, summary,
} from './stats.js';
import { unpackMol } from './chem.js';
import { FILES } from './queries.js';
import {
  findings, release, smallMolecules, propertyByDecade, elementShares, elementByDecade, ringCounts, chiralityByDecade, stemCounts, flagCounts, atcGroups, typeGroups, systemName, drugName,
} from './findings.js';
import {
  familyCounts, actionCounts, familyActions, topTargets, degreeBins, targetHierarchy, classCounts, ecCounts, networkGraph, networkPieces, gtopdbRows, affinityByType, kinomeGroups, kinomeOrder, softName, lastFullYear,
} from './targets.js';
import {
  medianBin, efficiencyPoints, agreementStats, kineticRows, comboMatrix, topPairs,
} from './bioactivity.js';
import {
  occupancy, operational, operationalSummary, doseRatio, association, washout, curve,
} from './theory.js';
import {
  repeatedDoses, averageSteadyState, accumulation, halfLife,
} from './pk.js';
import {
  pkSummary, ddiMatrix, transporterMatrix, perpetrators, cipaSorted,
} from './pharmacokinetics.js';
import {
  registrations, designShares, enrollmentShares, statusRows, reportingCurves, psychoactiveSeries, attritionForest,
} from './trials.js';
import {
  hbars, dotplot, stackedArea, waffle, columns, histo, lines, treemap, hexmap, boxes, molgrid, observeFigures, countUp, tipLines, icicle, grid, kinomeMap, network, forest, scatter, rampLegend, curves, heatmap, html,
} from './charts.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const h = (tag, props = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid !== null && kid !== undefined && kid !== false) node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
};

const ext = (href, text, props = {}) => h('a', { href, target: '_blank', rel: 'noopener', ...props }, text);
const fill = (sel, ...nodes) => $(sel).replaceChildren(...nodes);
const CAT = ['var(--s2)', 'var(--s1)', 'var(--s4)', 'var(--s3)', 'var(--s5)', 'var(--data)', 'var(--data-2)', 'var(--ink-2)'];
const TILES = ['var(--s2)', 'var(--s1)', 'var(--s4)', 'var(--s3)', 'var(--s5)', 'var(--data)'];
const SITE = 'https://collide2954.github.io/basic-clinical-pharm/';
const REPO = 'https://github.com/collide2954/basic-clinical-pharm';
const chemblUrl = (id) => `https://www.ebi.ac.uk/chembl/explore/compound/${id}`;
const capital = (s) => (s ? `${s[0].toUpperCase()}${s.slice(1)}` : s);

const F = findings(snapshot);
const D = snapshot.drugs;
const SMALL = smallMolecules(snapshot);
const DESCRIBED = SMALL.filter((d) => d.chem);
const BY_ID = new Map(D.map((d) => [d.id, d]));

const state = { query: '', lens: 'all' };

const attachData = (mountSel, name, heads, rows) => {
  const caption = $(mountSel).closest('.fig').querySelector('figcaption');
  caption.querySelectorAll('.figdata').forEach((n) => n.remove());
  const table = h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, heads.map((c) => h('th', { scope: 'col' }, c)))),
    h('tbody', {}, rows.map((r) => h('tr', { 'data-search': r.join(' ') }, r.map((v) => h('td', { class: typeof v === 'number' ? 'n' : null }, v === null ? '—' : typeof v === 'number' ? (Number.isInteger(v) ? exact(v) : String(v)) : v))))));
  caption.append(
    h('span', { class: 'figdata' }, ' ', h('details', { class: 'data' }, h('summary', {}, 'Table'), h('div', { class: 'scroll' }, table))),
    h('a', { class: 'csv figdata', download: `${name}.csv`, href: `data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(heads, rows))}` }, 'CSV'),
  );
};

const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const renderHead = () => {
  $('#stamp').textContent = `Data as of ${day(snapshot.generated)}. Rebuilt every Sunday from ${release(snapshot)} and the other public files listed under Sources.`;
  for (const node of $$('[data-finding]')) node.textContent = F[node.dataset.finding];
};

const TYPE_NAMES = {
  'Small molecule': 'small molecules', Antibody: 'antibodies', Protein: 'proteins', Unknown: 'unknown type', 'Vaccine component': 'vaccine components', Enzyme: 'enzymes',
  Oligonucleotide: 'oligonucleotides', Gene: 'gene therapies', 'Antibody drug conjugate': 'antibody–drug conjugates', Oligosaccharide: 'oligosaccharides', Cell: 'cell therapies',
};
const typeName = (t) => TYPE_NAMES[t] ?? String(t).toLowerCase();

const renderLede = () => {
  const C = snapshot.chembl;
  countUp($('[data-hero="activities"]'), C.activities);
  const b = (text) => h('b', {}, text);
  fill('#lede-text',
    'That is ', release(snapshot), ', released ', longDate(C.date), ': ', b(`${exact(C.compounds)} distinct compounds`), ' measured against ', b(`${exact(C.targets)} targets`),
    ' in ', exact(C.documents), ' documents. ', b(`${exact(D.length)} of those compounds are approved drugs`), ', counted once each with their salts folded in.');
  const atcSubstances = Object.keys(C.atc).filter((k) => k.length === 7).length;
  const items = [
    ['Approved drugs', exact(D.length)],
    ['Small molecules', exact(SMALL.length)],
    ['Antibodies and ADCs', exact(D.filter((d) => /^Antibody/.test(d.type)).length)],
    ['With a boxed warning', exact(D.filter((d) => d.flags.includes('boxed warning')).length)],
    ['ATC chemical substances', exact(atcSubstances)],
    ['Targets in ChEMBL', exact(C.targets)],
  ];
  fill('#ticker', ...items.map(([label, value]) => h('div', {}, h('dt', {}, label), h('dd', {}, value))));
};

const renderApproved = () => {
  const dated = D.filter((d) => d.year);
  const oldest = dated.reduce((a, b) => (b.year < a.year ? b : a));
  const newest = Math.max(...dated.map((d) => d.year));
  $('#approved-dek').textContent = `The oldest first approval ChEMBL records is ${oldest.year}, for ${drugName(oldest.name)}; the latest in this release is ${newest}. ${exact(D.length - dated.length)} approved drugs carry no year, most of them biologics and vaccine components.`;
  const groups = typeGroups(snapshot);
  const shown = groups.filter((g) => g.n / D.length >= 0.005);
  const rest = groups.filter((g) => g.n / D.length < 0.005);
  const parts = [
    ...shown.map((g, i) => ({ label: typeName(g.type), value: g.n, color: CAT[i % CAT.length] })),
    { label: `other (${rest.map((g) => typeName(g.type)).join(', ')})`, value: rest.reduce((n, g) => n + g.n, 0), color: 'var(--rule)' },
  ];
  waffle({ mount: $('#types-chart'), parts, aria: 'Approved drugs by molecule type' });
  attachData('#types-chart', 'approved-drug-types', ['Molecule type', 'Approved drugs'], groups.map((g) => [g.type, g.n]));
  const KINDS = [
    { key: 'small', label: 'Small molecules', color: 'var(--s2)', test: (t) => t === 'Small molecule' },
    { key: 'antibody', label: 'Antibodies and ADCs', color: 'var(--s1)', test: (t) => /^Antibody/.test(t) },
    { key: 'protein', label: 'Proteins and enzymes', color: 'var(--s4)', test: (t) => t === 'Protein' || t === 'Enzyme' },
    { key: 'other', label: 'Other', color: 'var(--data)', test: () => true },
  ];
  const kindOf = (t) => KINDS.find((k) => k.test(t)).key;
  const years = Array.from({ length: newest - oldest.year + 1 }, (_, i) => oldest.year + i);
  const series = KINDS.map((k) => {
    let acc = 0;
    return {
      ...k, values: years.map((y) => {
        acc += dated.filter((d) => d.year === y && kindOf(d.type) === k.key).length;
        return acc;
      }),
    };
  });
  stackedArea({ mount: $('#approvals-chart'), years, series, aria: 'Approved drugs by year of first approval, cumulative, by kind' });
  attachData('#approvals-chart', 'approved-drugs-by-year', ['Year', ...KINDS.map((k) => `${k.label} to date`)], years.map((y, i) => [y, ...series.map((s) => s.values[i])]));
};

const renderDruglike = () => {
  const withP = SMALL.filter((d) => d.p);
  const med = (key) => summary(withP.map((d) => d.p[key]).filter((v) => v !== null)).median;
  $('#druglike-dek').textContent = `The median approved small molecule weighs ${exact(med('mw'))} Da, has an ALogP of ${decimal(med('alogp'))}, ${med('hbd')} hydrogen-bond donors, ${med('hba')} acceptors and ${med('rtb')} rotatable bonds, and a polar surface area of ${exact(med('psa'))} Å². Its QED is ${decimal(med('qed'), 2)}.`;
  const points = withP.filter((d) => d.p.mw !== null && d.p.alogp !== null).map((d) => ({ x: d.p.mw, y: d.p.alogp, name: drugName(d.name), id: d.id }));
  const range = (list, key) => `${decimal(Math.min(...list.map((p) => p[key])), key === 'x' ? 0 : 1)}–${decimal(Math.max(...list.map((p) => p[key])), key === 'x' ? 0 : 1)}`;
  hexmap({
    mount: $('#space-chart'),
    points,
    xDomain: [0, 1000],
    yDomain: [-6, 10],
    box: { x: 500, y: 5 },
    boxLabel: 'rule of five',
    xLabel: 'molecular weight, Da',
    yLabel: 'ALogP',
    aria: 'Approved small molecules by molecular weight and calculated logP',
    describe: (members) => tipLines(`${exact(members.length)} small ${members.length === 1 ? 'molecule' : 'molecules'}`, `${range(members, 'x')} Da, ALogP ${range(members, 'y')}`,
      members.slice(0, 4).map((m) => m.name).join(', ') + (members.length > 4 ? ', …' : '')),
  });
  attachData('#space-chart', 'chemical-space', ['ChEMBL ID', 'Drug', 'Molecular weight', 'ALogP'], points.map((p) => [p.id, p.name, p.x, p.y]));
  const ro5 = [0, 1, 2, 3, 4].map((v) => ({ v, n: withP.filter((d) => d.p.ro5 === v).length }));
  columns({
    mount: $('#ro5-chart'),
    rows: ro5,
    key: (r) => r.v,
    attr: 'violations',
    label: (r) => String(r.v),
    value: (r) => r.n,
    highlight: (r) => r.v >= 2,
    aria: 'Approved small molecules by number of rule-of-five violations',
    describe: (r) => tipLines(`${exact(r.n)} small molecules`, `${r.v} ${r.v === 1 ? 'rule' : 'rules'} broken`, pct(r.n / withP.length)),
  });
  attachData('#ro5-chart', 'rule-of-five', ['Rules broken', 'Small molecules'], ro5.map((r) => [r.v, r.n]));
  const edges = linearEdges(0, 1, 0.05);
  const qeds = withP.map((d) => d.p.qed).filter((v) => v !== null);
  const counts = histogram(qeds, edges);
  histo({
    mount: $('#qed-chart'),
    bins: counts,
    series: [{ key: 'qed', label: 'QED', color: 'var(--data)', values: counts }],
    tickLabel: (b, i) => (i % 4 === 0 ? decimal(edges[i], 1) : null),
    tickEvery: 1,
    aria: 'Approved small molecules by QED',
    describe: (i) => tipLines(`${exact(counts[i])} small molecules`, `QED ${decimal(edges[i], 2)} to ${decimal(edges[i + 1], 2)}`),
  });
  attachData('#qed-chart', 'qed', ['QED from', 'QED to', 'Small molecules'], counts.map((n, i) => [edges[i], edges[i + 1], n]));
};

const boxRows = (rows) => rows.map((r) => ({
  key: r.decade, label: `${r.decade}s`, n: r.n, lo: r.p5, q1: r.summary.q1, median: r.summary.median, q3: r.summary.q3, hi: r.p95,
}));

const PROPERTIES = [
  ['#mw-decade-chart', 'mw', 'molecular weight', (v) => `${exact(v)} Da`, 'molecular-weight-by-decade'],
  ['#logp-decade-chart', 'alogp', 'ALogP', (v) => decimal(v), 'alogp-by-decade'],
  ['#psa-decade-chart', 'psa', 'polar surface area', (v) => `${exact(v)} Å²`, 'psa-by-decade'],
  ['#qed-decade-chart', 'qed', 'QED', (v) => decimal(v, 2), 'qed-by-decade'],
];

const drawBoxes = (sel, rows, label, format, file) => {
  boxes({
    mount: $(sel),
    rows: boxRows(rows),
    yFormat: (v) => (Math.abs(v) < 10 && !Number.isInteger(v) ? decimal(v, 1) : compact(v)),
    aria: `${capital(label)} of approved small molecules by decade`,
    describe: (r) => tipLines(`median ${format(r.median)}`, `${label}, drugs first approved in the ${r.label}`, `middle half ${format(r.q1)} to ${format(r.q3)}`, `5th to 95th percentile ${format(r.lo)} to ${format(r.hi)}`, `${exact(r.n)} drugs`),
  });
  attachData(sel, file, ['Decade', 'Drugs', '5th percentile', 'Lower quartile', 'Median', 'Upper quartile', '95th percentile'], rows.map((r) => [`${r.decade}s`, r.n, r.p5, r.summary.q1, r.summary.median, r.summary.q3, r.p95]));
};

const renderProperties = () => {
  const mw = propertyByDecade(snapshot, 'mw');
  const qed = propertyByDecade(snapshot, 'qed');
  const psa = propertyByDecade(snapshot, 'psa');
  $('#properties-dek').textContent = `From the ${mw[0].decade}s to the ${mw.at(-1).decade}s the median polar surface area went from ${exact(psa[0].summary.median)} to ${exact(psa.at(-1).summary.median)} Å² and the median QED from ${decimal(qed[0].summary.median, 2)} to ${decimal(qed.at(-1).summary.median, 2)}: newer drugs are larger, more polar and less like the oral drugs QED was fitted to.`;
  for (const [sel, key, label, format, file] of PROPERTIES) drawBoxes(sel, propertyByDecade(snapshot, key), label, format, file);
};

const renderExtremes = () => {
  const withMw = SMALL.filter((d) => d.p?.mw).sort((a, b) => a.p.mw - b.p.mw);
  const over1k = withMw.filter((d) => d.p.mw > 1000).length;
  $('#extremes-dek').textContent = `${exact(over1k)} approved small molecules weigh more than 1,000 Da and ${exact(withMw.filter((d) => d.p.mw < 100).length)} less than 100 Da. The structures below are drawn here from ChEMBL’s coordinates, with no image files.`;
  const items = LANDMARKS.map((l) => {
    const d = BY_ID.get(l.id);
    return {
      key: l.id, label: drugName(d.name), sub: String(l.year), mol: unpackMol(d.mol), note: l.note, d,
    };
  });
  molgrid({
    mount: $('#landmarks-chart'),
    items,
    aria: 'Twelve landmark small molecules drawn from their structures',
    describe: (it) => tipLines(it.label, it.note, `${it.d.formula}, ${daltons(it.d.p?.mw)}`, { href: chemblUrl(it.key), text: `${it.key} in ChEMBL` }),
  });
  attachData('#landmarks-chart', 'landmark-molecules', ['Year', 'Drug', 'ChEMBL ID', 'Formula', 'Molecular weight', 'Note'], items.map((it) => [String(it.sub), it.label, it.key, it.d.formula, it.d.p?.mw ?? null, it.note]));
  const rowsOf = (list) => list.map((d) => ({ key: d.id, label: drugName(d.name), value: d.p.mw }));
  for (const [sel, list, file, aria, scale] of [['#lightest-chart', withMw.slice(0, 15), 'lightest-small-molecules', 'The 15 lightest approved small molecules', 'log'], ['#heaviest-chart', withMw.slice(-15).reverse(), 'heaviest-small-molecules', 'The 15 heaviest approved small molecules', 'linear']]) {
    dotplot({
      mount: $(sel),
      rows: rowsOf(list),
      scale,
      format: daltons,
      tickFormat: exact,
      aria,
      describe: (r) => tipLines(daltons(r.value), r.label, BY_ID.get(r.key).formula),
      href: (r) => chemblUrl(r.key),
      linkText: (r) => `${r.key} in ChEMBL`,
    });
    attachData(sel, file, ['ChEMBL ID', 'Drug', 'Formula', 'Molecular weight'], list.map((d) => [d.id, drugName(d.name), d.formula, d.p.mw]));
  }
};

const renderRings = () => {
  const counts = ringCounts(snapshot);
  const perDrug = DESCRIBED.map((d) => d.chem.rings.length);
  const most = DESCRIBED.reduce((a, b) => (b.chem.rings.length > a.chem.rings.length ? b : a));
  $('#rings-dek').textContent = `The median approved small molecule has ${summary(perDrug).median} rings; ${exact(perDrug.filter((n) => n === 0).length)} have none, and ${drugName(most.name)} has the most, ${most.chem.rings.length}. ${exact(counts.length)} kinds of ring turn up in all.`;
  const top = counts.slice(0, 25);
  dotplot({
    mount: $('#ring-chart'),
    rows: top.map((r) => ({ key: r.name, label: r.name, value: r.n, hi: r.name === counts[0].name })),
    labelMax: 300,
    aria: 'The 25 commonest rings in approved small molecules',
    describe: (r) => tipLines(`${exact(r.value)} approved small molecules`, r.label, `${pct(r.value / DESCRIBED.length)} of those with a structure`),
  });
  attachData('#ring-chart', 'rings', ['Ring', 'Approved small molecules'], counts.map((r) => [r.name, r.n]));
  const systems = snapshot.chemistry.systems.slice(0, 16).map((s) => {
    const d = BY_ID.get(s.example);
    return {
      key: s.key, label: systemName(s.rings, s.exo), sub: `${exact(s.n)} drugs · ${drugName(d.name)}`, mol: unpackMol(d.mol), atoms: s.atoms, s, d,
    };
  });
  molgrid({
    mount: $('#systems-chart'),
    items: systems,
    aria: 'The 16 commonest ring systems in approved small molecules',
    describe: (it) => tipLines(`${exact(it.s.n)} approved small molecules`, it.label, `rings: ${it.s.rings.join(', ')}`, `drawn from ${drugName(it.d.name)}`),
  });
  attachData('#systems-chart', 'ring-systems', ['Ring system', 'Rings', 'Oxo groups', 'Approved small molecules', 'Drawn from'], snapshot.chemistry.systems.map((s) => [systemName(s.rings, s.exo), s.rings.join(' + '), s.exo, s.n, drugName(BY_ID.get(s.example).name)]));
  const bins = Array.from({ length: 11 }, (_, k) => ({ k, n: perDrug.filter((n) => (k === 10 ? n >= 10 : n === k)).length }));
  columns({
    mount: $('#ring-count-chart'),
    rows: bins,
    key: (r) => r.k,
    attr: 'rings',
    label: (r) => (r.k === 10 ? '10+' : String(r.k)),
    value: (r) => r.n,
    aria: 'Approved small molecules by number of rings',
    describe: (r) => tipLines(`${exact(r.n)} small molecules`, `${r.k === 10 ? '10 or more' : r.k} ${r.k === 1 ? 'ring' : 'rings'}`),
  });
  attachData('#ring-count-chart', 'rings-per-molecule', ['Rings', 'Small molecules'], bins.map((r) => [r.k === 10 ? '10 or more' : r.k, r.n]));
};

const ELEMENTS = {
  C: 'carbon', N: 'nitrogen', O: 'oxygen', S: 'sulfur', Cl: 'chlorine', F: 'fluorine', P: 'phosphorus', I: 'iodine', Br: 'bromine', Na: 'sodium', K: 'potassium', Mg: 'magnesium', Ca: 'calcium',
  B: 'boron', Al: 'aluminium', Zn: 'zinc', Se: 'selenium', Li: 'lithium', As: 'arsenic', Si: 'silicon', Pt: 'platinum', Gd: 'gadolinium', Fe: 'iron', Bi: 'bismuth', Ga: 'gallium', Tc: 'technetium', Co: 'cobalt',
};

const renderAtoms = () => {
  const shares = elementShares(snapshot).filter((s) => s.n >= 5);
  const metals = DESCRIBED.filter((d) => d.chem.elements.some((e) => !['C', 'N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I', 'B', 'Se', 'Si', 'H', 'He', 'Kr', 'Xe'].includes(e))).length;
  const of = (el) => shares.find((s) => s.el === el)?.share ?? 0;
  $('#atoms-dek').textContent = `Nitrogen is in ${pct(of('N'))} of approved small molecules, oxygen in ${pct(of('O'))} and sulfur in ${pct(of('S'))}; ${exact(metals)} carry a metal. The rise of fluorine tracks its use to block metabolism and tune lipophilicity.`;
  hbars({
    mount: $('#element-chart'),
    rows: shares.map((s) => ({ key: s.el, label: ELEMENTS[s.el] ?? s.el, values: { share: s.share } })),
    segments: [{ key: 'share', label: 'Share of small molecules', color: 'var(--s2)' }],
    format: pct,
    tickFormat: (v) => `${Math.round(v * 100)}%`,
    max: 1,
    labelShare: 0.22,
    aria: 'Share of approved small molecules containing each element',
    describe: (r) => {
      const s = shares.find((x) => x.el === r.key);
      return tipLines(pct(s.share), `${ELEMENTS[s.el] ?? s.el} (${s.el})`, `${exact(s.n)} of ${exact(DESCRIBED.length)} small molecules`);
    },
  });
  attachData('#element-chart', 'elements', ['Element', 'Symbol', 'Small molecules', 'Share'], shares.map((s) => [ELEMENTS[s.el] ?? s.el, s.el, s.n, Number(s.share.toFixed(4))]));
  const f = elementByDecade(snapshot, 'F');
  const cl = elementByDecade(snapshot, 'Cl');
  lines({
    mount: $('#fluorine-chart'),
    series: [{ label: 'fluorine', rows: f.map((r) => ({ x: r.decade, y: r.share })), color: 'var(--s4)' }, { label: 'chlorine', rows: cl.map((r) => ({ x: r.decade, y: r.share })), alt: true }],
    scale: 'linear',
    yFormat: (v) => `${Math.round(v * 100)}%`,
    aria: 'Share of approved small molecules with fluorine or chlorine, by decade',
    describe: (x) => {
      const a = f.find((r) => r.decade === x);
      const b = cl.find((r) => r.decade === x);
      return tipLines(`${x}s`, `fluorine ${pct(a?.share ?? 0)}, ${exact(a?.with ?? 0)} of ${exact(a?.n ?? 0)}`, `chlorine ${pct(b?.share ?? 0)}, ${exact(b?.with ?? 0)}`);
    },
  });
  attachData('#fluorine-chart', 'halogens-by-decade', ['Decade', 'Small molecules', 'With fluorine', 'With chlorine'], f.map((r) => [`${r.decade}s`, r.n, r.with, cl.find((c) => c.decade === r.decade)?.with ?? 0]));
  drawBoxes('#fsp3-chart', propertyByDecade(snapshot, (d) => d.chem?.fsp3), 'Fsp3', (v) => decimal(v, 2), 'fsp3-by-decade');
};

const renderStereo = () => {
  const rows = chiralityByDecade(snapshot);
  const counts = DESCRIBED.map((d) => d.chem.stereo);
  const most = DESCRIBED.reduce((a, b) => (b.chem.stereo > a.chem.stereo ? b : a));
  $('#stereo-dek').textContent = `${pct(counts.filter((n) => n > 0).length / counts.length)} of approved small molecules have at least one stereocentre; ${drugName(most.name)} has the most, ${most.chem.stereo}. Single enantiomers of older racemates, such as esomeprazole from omeprazole, are the chiral switch.`;
  const SEG = [{ key: 'racemic', label: 'racemic mixture', color: 'var(--s1)' }, { key: 'single', label: 'single stereoisomer', color: 'var(--s2)' }, { key: 'achiral', label: 'achiral', color: 'var(--data-2)' }];
  hbars({
    mount: $('#chirality-chart'),
    rows: rows.map((r) => ({ key: String(r.decade), label: `${r.decade}s`, values: Object.fromEntries(SEG.map((s) => [s.key, r[s.key] / r.n])), n: r.n })),
    segments: SEG,
    format: pct,
    tickFormat: (v) => `${Math.round(v * 100)}%`,
    max: 1,
    valueText: (r) => `${exact(r.n)} drugs`,
    aria: 'Approved small molecules by chirality and decade of first approval',
    describe: (r) => {
      const d = rows.find((x) => String(x.decade) === r.key);
      return tipLines(`${d.decade}s`, ...SEG.map((s) => `${s.label}: ${pct(d[s.key] / d.n)}, ${exact(d[s.key])}`), `${exact(d.n)} drugs`);
    },
  });
  attachData('#chirality-chart', 'chirality-by-decade', ['Decade', 'Racemic', 'Single stereoisomer', 'Achiral', 'Drugs'], rows.map((r) => [`${r.decade}s`, r.racemic, r.single, r.achiral, r.n]));
  const bins = Array.from({ length: 11 }, (_, k) => ({ k, n: counts.filter((n) => (k === 10 ? n >= 10 : n === k)).length }));
  columns({
    mount: $('#stereocentre-chart'),
    rows: bins,
    key: (r) => r.k,
    attr: 'centres',
    label: (r) => (r.k === 10 ? '10+' : String(r.k)),
    value: (r) => r.n,
    aria: 'Approved small molecules by number of stereocentres',
    describe: (r) => tipLines(`${exact(r.n)} small molecules`, `${r.k === 10 ? '10 or more' : r.k} ${r.k === 1 ? 'stereocentre' : 'stereocentres'}`),
  });
  attachData('#stereocentre-chart', 'stereocentres', ['Stereocentres', 'Small molecules'], bins.map((r) => [r.k === 10 ? '10 or more' : r.k, r.n]));
};

const stemOf = (d) => String(d.stem?.stem ?? '').split(/;\s*/).map((s) => s.trim()).filter(Boolean);

const renderStems = () => {
  const stems = stemCounts(snapshot);
  const smallStem = stems.find((s) => SMALL.some((d) => stemOf(d).includes(s.stem)));
  $('#stems-dek').textContent = `${exact(stems.length)} distinct stems appear on approved drugs. A stem says what a drug is or does, not who made it: ${stems[0].stem} for ${stems[0].definition.split(':')[0]}, ${smallStem.stem} for ${smallStem.definition}.`;
  const top = stems.slice(0, 25);
  const examples = (stem) => D.filter((d) => stemOf(d).includes(stem)).slice(0, 3).map((d) => drugName(d.name));
  dotplot({
    mount: $('#stem-chart'),
    rows: top.map((s) => ({ key: s.stem, label: s.stem, value: s.n })),
    aria: 'The 25 USAN stems on the most approved drugs',
    describe: (r) => {
      const s = top.find((x) => x.stem === r.key);
      return tipLines(`${exact(s.n)} approved drugs`, `${s.stem}: ${s.definition}`, `for example ${examples(s.stem).join(', ')}`);
    },
  });
  attachData('#stem-chart', 'usan-stems', ['Stem', 'Definition', 'Approved drugs'], stems.map((s) => [s.stem, s.definition, s.n]));
  const six = stems.slice(0, 6);
  const dated = D.filter((d) => d.stem?.year);
  const first = Math.min(...dated.map((d) => d.stem.year));
  const last = Math.max(...dated.map((d) => d.stem.year));
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const series = six.map((s, i) => ({
    label: s.stem,
    color: CAT[i],
    rows: years.map((y) => ({ x: y, y: dated.filter((d) => d.stem.year <= y && stemOf(d).includes(s.stem)).length })),
  }));
  lines({
    mount: $('#stem-years-chart'),
    series,
    scale: 'linear',
    yFormat: compact,
    aria: 'Approved drugs carrying the six commonest stems, cumulative by year of adoption',
    describe: (x) => tipLines(String(x), ...series.map((s) => `${s.label} ${exact(s.rows.find((r) => r.x === x).y)}`)),
  });
  attachData('#stem-years-chart', 'stems-by-year', ['Year', ...six.map((s) => s.stem)], years.map((y, i) => [y, ...series.map((s) => s.rows[i].y)]));
};

const FLAGS = [
  ['boxed warning', 'Boxed warning'], ['natural product', 'Natural product or derived'], ['prodrug', 'Prodrug'], ['first in class', 'First in class'], ['orphan', 'Orphan designation'], ['withdrawn', 'Withdrawn somewhere'],
];
const AVAILABILITY = [[1, 'prescription only'], [2, 'over the counter'], [0, 'discontinued'], [-2, 'withdrawn'], [-1, 'unknown']];

const renderFlags = () => {
  const counts = flagCounts(snapshot);
  const n = (flag) => counts.find((c) => c.flag === flag)?.n ?? 0;
  const bbwSmall = SMALL.filter((d) => d.flags.includes('boxed warning')).length;
  $('#flags-dek').textContent = `${exact(bbwSmall)} of the ${exact(n('boxed warning'))} drugs with a boxed warning are small molecules. ${exact(n('prodrug'))} are prodrugs, given in a form the body converts to the active drug, and ${exact(n('first in class'))} were first in their class.`;
  hbars({
    mount: $('#flag-chart'),
    rows: FLAGS.map(([key, label]) => ({ key, label, values: { n: n(key) } })),
    segments: [{ key: 'n', label: 'Approved drugs', color: 'var(--s1)' }],
    labelShare: 0.4,
    aria: 'Approved drugs by ChEMBL flag',
    describe: (r) => tipLines(`${exact(r.values.n)} approved drugs`, r.label, pct(r.values.n / D.length)),
  });
  attachData('#flag-chart', 'flags', ['Flag', 'Approved drugs'], FLAGS.map(([key, label]) => [label, n(key)]));
  const routes = ['oral', 'parenteral', 'topical'].map((r) => ({ key: r, label: r, values: { n: D.filter((d) => d.routes.includes(r)).length } }));
  hbars({
    mount: $('#route-chart'),
    rows: routes,
    segments: [{ key: 'n', label: 'Approved drugs', color: 'var(--s2)' }],
    labelShare: 0.3,
    aria: 'Approved drugs by route',
    describe: (r) => tipLines(`${exact(r.values.n)} approved drugs`, r.label, pct(r.values.n / D.length)),
  });
  attachData('#route-chart', 'routes', ['Route', 'Approved drugs'], routes.map((r) => [r.label, r.values.n]));
  const avail = AVAILABILITY.map(([code, label]) => ({ key: String(code), label, value: D.filter((d) => d.availability === code).length }));
  dotplot({
    mount: $('#availability-chart'),
    rows: avail,
    aria: 'Approved drugs by availability in the US',
    describe: (r) => tipLines(`${exact(r.value)} approved drugs`, r.label, pct(r.value / D.length)),
  });
  attachData('#availability-chart', 'availability', ['Availability', 'Approved drugs'], avail.map((r) => [r.label, r.value]));
};

const renderAtc = () => {
  const groups = atcGroups(snapshot);
  const third = new Map();
  for (const d of D) for (const code of new Set(d.atc.map((a) => a.slice(0, 4)))) third.set(code, (third.get(code) ?? 0) + 1);
  const ranked = [...third].map(([code, n]) => ({ code, n, name: snapshot.chembl.atc[code] ?? code })).sort((a, b) => b.n - a.n || a.code.localeCompare(b.code));
  const multi = D.filter((d) => new Set(d.atc.map((a) => a[0])).size > 1).length;
  $('#atc-dek').textContent = `${exact(multi)} approved drugs sit in more than one anatomical group, such as a steroid used on the skin and by mouth. The largest pharmacological subgroup is ${ranked[0].code}, ${soften(ranked[0].name)}, with ${exact(ranked[0].n)} drugs.`;
  treemap({
    mount: $('#atc-chart'),
    items: groups.map((g, i) => ({ key: g.code, label: `${g.code} ${capital(soften(g.name))}`, sub: `${exact(g.n)} drugs`, value: g.n, color: TILES[i % TILES.length] })),
    aria: 'Approved drugs by ATC anatomical main group',
    describe: (it) => tipLines(`${exact(it.value)} drugs`, `${it.key}, ${soften(snapshot.chembl.atc[it.key] ?? it.key)}`, pct(it.value / D.length)),
  });
  attachData('#atc-chart', 'atc-groups', ['Code', 'Group', 'Approved drugs'], groups.map((g) => [g.code, soften(g.name), g.n]));
  const top = ranked.slice(0, 20);
  dotplot({
    mount: $('#atc3-chart'),
    rows: top.map((r) => ({ key: r.code, label: `${r.code} ${soften(r.name)}`, value: r.n })),
    labelShare: 0.5,
    labelMax: 380,
    aria: 'The 20 ATC pharmacological subgroups with the most approved drugs',
    describe: (r) => tipLines(`${exact(r.value)} drugs`, r.label),
    href: (r) => `https://atcddd.fhi.no/atc_ddd_index/?code=${r.key}`,
    linkText: () => 'Open in the WHO ATC index',
  });
  attachData('#atc3-chart', 'atc-subgroups', ['Code', 'Subgroup', 'Approved drugs'], ranked.map((r) => [r.code, soften(r.name), r.n]));
};

const TP = snapshot.targets;
const DRUG_NAME = new Map(D.map((d) => [d.id, drugName(d.name)]));
const lower = (s) => String(s ?? '').toLowerCase();
const plural = (n, one, many = `${one}s`) => `${exact(n)} ${n === 1 ? one : many}`;
const targetUrl = (id) => `https://www.ebi.ac.uk/chembl/explore/target/${id}`;
const pairCount = new Set(TP.mechanisms.map((m) => `${m.drug}|${m.target}`)).size;
const ACTION_SHORT = {
  'POSITIVE ALLOSTERIC MODULATOR': 'PAM', 'NEGATIVE ALLOSTERIC MODULATOR': 'NAM', REST: 'all others',
};
const actionLabel = (a) => ACTION_SHORT[a] ?? lower(a);
const FAMILY_COLORS = {
  GPCR: 'var(--s2)', Kinase: 'var(--s1)', 'Ion channel': 'var(--s4)', 'Nuclear receptor': 'var(--s3)', Protease: 'var(--s5)',
};

const renderClasses = () => {
  const cov = TP.coverage;
  const tree = targetHierarchy(snapshot);
  const share = (names) => tree.children.filter((c) => names.includes(c.name)).reduce((n, c) => n + c.value, 0) / tree.value;
  $('#classes-dek').textContent = `${exact(cov.withTarget)} of ${exact(cov.approved)} approved drugs have at least one molecular target in ChEMBL; ${exact(cov.untargeted)} have a mechanism with no named target, and ${exact(cov.none)} have no mechanism recorded. Enzymes, membrane receptors and ion channels take ${pct(share(['Enzyme', 'Membrane receptor', 'Ion channel']))} of drug–target pairs.`;
  const palette = [...TILES, 'var(--ink-2)'];
  const colors = new Map(tree.children.map((c, i) => [c.name, palette[i] ?? 'var(--muted)']));
  const cells = partition(tree, 4);
  icicle({
    mount: $('#class-chart'),
    cells,
    colorOf: (c) => colors.get(c.node.path[0]),
    aria: 'Drug–target pairs of approved drugs by ChEMBL protein class, four levels deep',
    describe: (c) => tipLines(`${exact(c.node.value)} drug–target pairs`, c.node.path.join(' › '), `${plural(c.node.drugs, 'approved drug')}`, `${plural(c.node.targets, 'target')}`, `${pct(c.node.value / tree.value)} of all pairs`),
  });
  attachData('#class-chart', 'target-classes', ['Level', 'Class', 'Drug–target pairs', 'Approved drugs', 'Targets'], cells.filter((c) => c.depth > 0).map((c) => [c.depth, c.node.path.join(' > '), c.node.value, c.node.drugs, c.node.targets]));
  const fams = familyCounts(snapshot);
  hbars({
    mount: $('#family-chart'),
    rows: fams.map((f) => ({ key: f.family, label: f.family, values: { drugs: f.drugs } })),
    segments: [{ key: 'drugs', label: 'Approved drugs', color: 'var(--s2)' }],
    labelShare: 0.3,
    R: 140,
    valueText: (r) => `${exact(r.values.drugs)} drugs · ${plural(fams.find((f) => f.family === r.key).targets, 'target')}`,
    aria: 'Approved drugs by target family',
    describe: (r) => {
      const f = fams.find((x) => x.family === r.key);
      return tipLines(`${exact(f.drugs)} approved drugs`, f.family, plural(f.targets, 'target'), `${pct(f.drugs / TP.coverage.withTarget)} of drugs with a target`);
    },
  });
  attachData('#family-chart', 'target-families', ['Family', 'Approved drugs', 'Targets'], fams.map((f) => [f.family, f.drugs, f.targets]));
};

const renderActions = () => {
  const fa = familyActions(snapshot);
  const counts = actionCounts(snapshot);
  const row = (fam) => fa.counts[fa.families.indexOf(fam)] ?? [];
  const total = (r) => r.reduce((a, b) => a + b, 0) || 1;
  const at = (fam, action) => (row(fam)[fa.actions.indexOf(action)] ?? 0) / total(row(fam));
  $('#actions-dek').textContent = `On GPCRs, ${pct(at('GPCR', 'AGONIST'))} of drug–target pairs are agonists and ${pct(at('GPCR', 'ANTAGONIST'))} antagonists; on ion channels, ${pct(at('Ion channel', 'BLOCKER'))} are blockers, and on enzymes of every kind inhibition is the rule. ChEMBL records ${exact(counts.length)} kinds of action in all.`;
  grid({
    mount: $('#action-chart'),
    rows: fa.families,
    cols: fa.actions.map(actionLabel),
    values: fa.counts,
    color: 'var(--s2)',
    aria: 'Drug–target pairs by target family and action',
    describe: (i, j) => tipLines(exact(fa.counts[i][j]), `drug–target pairs: ${fa.families[i]}, ${actionLabel(fa.actions[j])}`, `${pct(fa.counts[i][j] / total(fa.counts[i]))} of the family’s pairs`),
  });
  attachData('#action-chart', 'actions-by-family', ['Family', ...fa.actions.map(actionLabel)], fa.families.map((f, i) => [f, ...fa.counts[i]]));
  const top = counts.slice(0, 15);
  dotplot({
    mount: $('#action-count-chart'),
    rows: top.map((a) => ({ key: a.action, label: lower(a.action), value: a.pairs })),
    labelShare: 0.42,
    labelMax: 260,
    aria: 'Drug–target pairs by action',
    describe: (r) => {
      const a = top.find((x) => x.action === r.key);
      return tipLines(`${exact(a.pairs)} drug–target pairs`, lower(a.action), plural(a.drugs, 'approved drug'));
    },
  });
  attachData('#action-count-chart', 'actions', ['Action', 'Drug–target pairs', 'Approved drugs'], counts.map((a) => [lower(a.action), a.pairs, a.drugs]));
};

const renderDrugged = () => {
  const top = topTargets(snapshot, 25);
  const ten = topTargets(snapshot, 10).reduce((n, t) => n + t.drugs, 0);
  const perDrug = new Map();
  for (const m of TP.mechanisms) {
    if (!perDrug.has(m.drug)) perDrug.set(m.drug, new Set());
    perDrug.get(m.drug).add(m.target);
  }
  const most = [...perDrug].map(([id, s]) => ({ id, n: s.size })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id)).slice(0, 3);
  $('#drugged-dek').textContent = `The ten most-drugged targets hold ${pct(ten / pairCount)} of all ${exact(pairCount)} drug–target pairs. Among drugs, ${DRUG_NAME.get(most[0].id)} has the most targets, ${most[0].n}, then ${DRUG_NAME.get(most[1].id)}, ${most[1].n}, and ${DRUG_NAME.get(most[2].id)}, ${most[2].n}.`;
  dotplot({
    mount: $('#drugged-chart'),
    rows: top.map((t) => ({ key: t.id, label: t.name, value: t.drugs })),
    labelShare: 0.42,
    labelMax: 330,
    aria: 'The 25 targets with the most approved drugs',
    describe: (r) => {
      const t = top.find((x) => x.id === r.key);
      return tipLines(`${exact(t.drugs)} approved drugs`, t.name, t.family, `for example ${t.examples.join(', ')}`);
    },
    href: (r) => targetUrl(r.key),
    linkText: (r) => `${r.key} in ChEMBL`,
  });
  attachData('#drugged-chart', 'most-drugged-targets', ['ChEMBL ID', 'Target', 'Family', 'Approved drugs'], topTargets(snapshot, 100).map((t) => [t.id, t.name, t.family, t.drugs]));
  const bins = degreeBins(snapshot);
  for (const [sel, list, noun, file, head] of [['#per-target-chart', bins.perTarget, 'targets', 'drugs-per-target', 'Approved drugs'], ['#per-drug-chart', bins.perDrug, 'approved drugs', 'targets-per-drug', 'Targets']]) {
    columns({
      mount: $(sel),
      rows: list,
      key: (r) => r.label,
      attr: 'bin',
      label: (r) => r.label,
      value: (r) => r.n,
      aria: sel === '#per-target-chart' ? 'Targets by number of approved drugs' : 'Approved drugs by number of targets',
      describe: (r) => tipLines(`${exact(r.n)} ${noun}`, `with ${r.label} ${sel === '#per-target-chart' ? 'approved drugs' : 'targets'}`),
    });
    attachData(sel, file, [head, noun === 'targets' ? 'Targets' : 'Approved drugs'], list.map((r) => [r.label, r.n]));
  }
};

const renderNetwork = () => {
  const g = networkGraph(snapshot);
  const neighbours = g.nodes.map(() => []);
  for (const [a, b] of g.edges) {
    neighbours[a].push(b);
    neighbours[b].push(a);
  }
  const hub = g.nodes.filter((n) => n.kind === 'target').reduce((a, b) => (b.degree > a.degree ? b : a));
  const alone = g.edges.filter(([a, b]) => g.nodes[a].degree === 1 && g.nodes[b].degree === 1).length;
  const [first, second] = networkPieces(snapshot);
  const many = (f) => (f.family === 'GPCR' ? 'GPCRs' : `${lower(f.family)}s`);
  const mix = (p) => p.families.slice(0, 2).map((f) => `${exact(f.n)} ${many(f)}`).join(' and ');
  $('#network-dek').textContent = `The largest connected piece joins ${exact(first.drugs)} drugs to ${exact(first.targets)} targets, among them ${mix(first)}; the second joins ${exact(second.drugs)} drugs to ${exact(second.targets)} targets, ${exact(second.families[0].n)} of them ${many(second.families[0])}. The ${softName(hub.name)} is the largest hub, with ${exact(hub.degree)} drugs, and ${exact(alone)} drug–target pairs stand alone.`;
  const legend = [...Object.entries(FAMILY_COLORS).map(([label, color]) => ({ label, color })), { label: 'other targets', color: 'var(--ink-2)' }, { label: 'drugs', color: 'var(--muted)' }];
  network({
    mount: $('#network-chart'),
    nodes: g.nodes,
    edges: g.edges,
    legend,
    colorOf: (n) => (n.kind === 'drug' ? 'var(--muted)' : FAMILY_COLORS[n.group] ?? 'var(--ink-2)'),
    radius: (n) => (n.kind === 'drug' ? 1.7 : Math.min(9, 1.9 + Math.sqrt(n.degree) * 0.95)),
    aria: 'Network of approved drugs and their targets',
    describe: (n, i) => {
      const names = neighbours[i].map((j) => g.nodes[j]).sort((a, b) => b.degree - a.degree).map((m) => m.name);
      const list = `${names.slice(0, 5).join(', ')}${names.length > 5 ? ', …' : ''}`;
      return tipLines(n.name, n.kind === 'drug' ? `approved drug${n.group ? `, ATC group ${n.group}` : ''}` : `target, ${n.group}`, `${plural(n.degree, 'link')}: ${list}`, { href: n.kind === 'drug' ? chemblUrl(n.id) : targetUrl(n.id), text: `${n.id} in ChEMBL` });
    },
  });
  attachData('#network-chart', 'drug-target-network', ['Kind', 'ChEMBL ID', 'Name', 'Group', 'Links'], g.nodes.map((n) => [n.kind, n.id, n.name, n.group ?? '', n.degree]));
};

const GTOPDB_SHORT = {
  gpcr: 'GPCR', nhr: 'NHR', lgic: 'LGIC', vgic: 'VGIC', other_ic: 'other IC', catalytic_receptor: 'catalytic', enzyme: 'enzyme', transporter: 'transporter', other_protein: 'other',
};
const nanomolar = (p) => molar(Number(pToMolar(p).toPrecision(2)));

const renderGtopdb = () => {
  const G = snapshot.gtopdb;
  const rows = gtopdbRows(snapshot);
  const sum = (list, key) => list.reduce((n, r) => n + r[key], 0);
  const tr = rows.find((r) => r.type === 'transporter');
  const all = summary(G.affinities.map((a) => a.value));
  const boxRowsOf = affinityByType(snapshot);
  const vgic = boxRowsOf.find((r) => r.type === 'vgic');
  $('#gtopdb-dek').textContent = `GtoPdb ${G.version} curates ${exact(G.interactions)} human ligand–target interactions. ${pct(sum(rows, 'none') / sum(rows, 'targets'))} of its targets have no human ligand curated${tr ? `, ${pct(tr.none / tr.targets)} of transporters` : ''}. The median approved drug binds its primary target at ${decimal(all.median, 1)}, about ${nanomolar(all.median)}${vgic ? `; at voltage-gated ion channels the median is ${decimal(vgic.median, 1)}, about ${nanomolar(vgic.median)}` : ''}.`;
  const SEG = [{ key: 'approved', label: 'approved drug among ligands', color: 'var(--s2)' }, { key: 'other', label: 'other ligands only', color: 'var(--data)' }, { key: 'none', label: 'no human ligand curated', color: 'var(--rule)' }];
  hbars({
    mount: $('#gtopdb-chart'),
    rows: rows.map((r) => ({ key: r.type, label: r.label, values: { approved: r.approved, other: r.otherLigand, none: r.none } })),
    segments: SEG,
    labelShare: 0.28,
    aria: 'GtoPdb targets by type and ligand coverage',
    describe: (r) => {
      const d = rows.find((x) => x.type === r.key);
      return tipLines(plural(d.targets, 'target'), d.label, `${exact(d.approved)} with an approved drug`, `${exact(d.otherLigand)} with other ligands only`, `${exact(d.none)} with no human ligand`, `${exact(d.orphans)} orphans, ${exact(d.endogenous)} with an endogenous ligand`);
    },
  });
  attachData('#gtopdb-chart', 'gtopdb-targets', ['Type', 'Targets', 'With an approved drug', 'Other ligands only', 'No human ligand', 'Orphans', 'With an endogenous ligand'], rows.map((r) => [r.label, r.targets, r.approved, r.otherLigand, r.none, r.orphans, r.endogenous]));
  boxes({
    mount: $('#affinity-chart'),
    rows: boxRowsOf.map((r) => ({
      key: r.type, label: GTOPDB_SHORT[r.type], n: r.n, lo: r.lo, q1: r.q1, median: r.median, q3: r.q3, hi: r.hi,
    })),
    attr: 'type',
    yFormat: (v) => decimal(v, 0),
    aria: 'Affinity of approved drugs at their primary targets by target type',
    describe: (r) => {
      const d = boxRowsOf.find((x) => x.type === r.key);
      return tipLines(`median ${decimal(d.median, 2)}, about ${nanomolar(d.median)}`, d.label, `middle half ${decimal(d.q1, 2)} to ${decimal(d.q3, 2)}`, `5th to 95th percentile ${decimal(d.lo, 2)} to ${decimal(d.hi, 2)}`, plural(d.n, 'interaction'));
    },
  });
  attachData('#affinity-chart', 'approved-drug-affinities', ['Ligand', 'Target', 'Type', 'Units', 'Value', 'Action'], G.affinities.map((a) => [a.ligand, a.target, a.type ?? '', a.units, a.value, a.action]));
};

const renderOrphans = () => {
  const G = snapshot.gtopdb;
  const byFamily = new Map();
  for (const o of G.orphans) byFamily.set(o.family, [...(byFamily.get(o.family) ?? []), o]);
  const fams = [...byFamily].map(([family, list]) => ({ family, list })).sort((a, b) => b.list.length - a.list.length || a.family.localeCompare(b.family));
  const of = (type) => G.orphans.filter((o) => o.type === type).length;
  const endo = Object.entries(G.endogenous).map(([type, n]) => ({ type, n })).sort((a, b) => b.n - a.n);
  const endoTotal = endo.reduce((n, e) => n + e.n, 0);
  const share = (type) => pct((G.endogenous[type] ?? 0) / endoTotal);
  $('#orphans-dek').textContent = `${exact(G.orphans.length)} GtoPdb targets are orphans: ${exact(of('gpcr'))} GPCRs, ${exact(of('nhr'))} nuclear receptors and ${exact(of('transporter'))} transporters. Of ${exact(endoTotal)} endogenous ligands with a curated human target, ${share('Peptide')} are peptides and ${share('Metabolite')} metabolites.`;
  dotplot({
    mount: $('#orphan-chart'),
    rows: fams.map((f) => ({ key: f.family, label: f.family, value: f.list.length })),
    scale: 'linear',
    labelShare: 0.6,
    labelMax: 340,
    aria: 'Orphan targets in GtoPdb by family',
    describe: (r) => {
      const f = fams.find((x) => x.family === r.key);
      return tipLines(plural(f.list.length, 'orphan target'), f.family, `for example ${f.list.slice(0, 4).map((o) => o.gene ?? o.name).join(', ')}`);
    },
  });
  attachData('#orphan-chart', 'orphan-targets', ['GtoPdb ID', 'Type', 'Family', 'Target', 'Gene'], G.orphans.map((o) => [o.id, o.type, o.family, o.name, o.gene ?? '']));
  dotplot({
    mount: $('#endogenous-chart'),
    rows: endo.map((e) => ({ key: e.type, label: lower(e.type), value: e.n })),
    labelShare: 0.36,
    aria: 'Endogenous ligands in GtoPdb by ligand type',
    describe: (r) => tipLines(plural(r.value, 'endogenous ligand'), r.label, pct(r.value / endoTotal)),
  });
  attachData('#endogenous-chart', 'endogenous-ligands', ['Ligand type', 'Endogenous ligands'], endo.map((e) => [lower(e.type), e.n]));
};

const classBars = (sel, list, aria, file) => {
  hbars({
    mount: $(sel),
    rows: list.map((r) => ({ key: r.name, label: r.label ?? r.name, values: { drugs: r.drugs }, targets: r.targets })),
    segments: [{ key: 'drugs', label: 'Approved drugs', color: 'var(--s1)' }],
    labelShare: 0.36,
    R: 140,
    valueText: (r) => `${exact(r.values.drugs)} drugs · ${plural(r.targets, 'target')}`,
    aria,
    describe: (r) => tipLines(plural(r.values.drugs, 'approved drug'), r.label, plural(r.targets, 'target')),
  });
  attachData(sel, file, ['Class', 'Approved drugs', 'Targets'], list.map((r) => [r.label ?? r.name, r.drugs, r.targets]));
};

const renderEnzymes = () => {
  const enz = classCounts(snapshot, ['Enzyme'], 1);
  const ec = ecCounts(snapshot);
  const of = (name) => enz.find((r) => r.name === name)?.drugs ?? 0;
  const kinasesInEc2 = TP.targets.filter((t) => t.family === 'Kinase' && t.ec.some((e) => e.startsWith('2.'))).length;
  const channels = [...classCounts(snapshot, ['Ion channel'], 2), ...classCounts(snapshot, ['Transporter'], 2)].sort((a, b) => b.drugs - a.drugs || b.targets - a.targets).slice(0, 16);
  $('#enzymes-dek').textContent = `${exact(of('Cytochrome P450'))} approved drugs act on a cytochrome P450 and ${exact(of('Phosphodiesterase'))} on a phosphodiesterase. By EC number transferases hold the most enzyme targets, ${exact(ec[1].targets)}, ${exact(kinasesInEc2)} of them kinases. Among channels and transporters, the ${softName(channels[0].name)} carry the most drugs, ${exact(channels[0].drugs)}.`;
  classBars('#enzyme-chart', enz, 'Approved drugs by enzyme class', 'enzyme-classes');
  classBars('#ec-chart', ec.map((r) => ({ ...r, name: r.ec, label: `EC ${r.ec} ${r.name}` })), 'Enzyme targets of approved drugs by EC class', 'ec-classes');
  classBars('#channel-chart', channels, 'Approved drugs by ion channel and transporter class', 'channel-classes');
};

const renderGenetics = () => {
  const G = GENETIC_SUPPORT;
  const C = snapshot.genetics;
  const [all, omim] = G.sources;
  const phase = (name) => G.phases.find((p) => p.phase === name);
  const pg = (p) => p.supported / p.total;
  $('#genetics-dek').textContent = `A drug programme whose target has human genetic support for its indication is ${all.rs.toFixed(1)} times as likely to go from phase I to launch, ${omim.rs.toFixed(1)} times with Mendelian evidence from OMIM. ${pct(pg(phase('Launched')))} of launched target–indication pairs have that support, against ${pct(pg(phase('Phase I')))} in phase I. In ClinVar, ${C.examples[0].symbol} carries the most pathogenic alleles of any gene for an approved-drug target, ${exact(C.examples[0].pathogenic)}.`;
  forest({
    mount: $('#rs-chart'),
    groups: [
      { label: 'By source of genetic evidence', rows: G.sources.map((r) => ({ ...r, key: r.label, mark: r === all })) },
      { label: 'By therapy area, all germline evidence', rows: G.areas.map((r) => ({ ...r, key: r.label })) },
    ],
    aria: 'Relative success of genetically supported drug programmes by evidence source and therapy area',
    describe: (r) => tipLines(`relative success ${r.rs.toFixed(2)}`, r.label, `95% CI ${r.lo.toFixed(2)} to ${r.hi.toFixed(2)}`, `${exact(r.launched)} of ${exact(r.supported)} supported programmes launched`),
  });
  attachData('#rs-chart', 'genetic-support', ['Group', 'Label', 'Relative success', 'Lower 95%', 'Upper 95%', 'Launched', 'Supported'], [...G.sources.map((r) => ['evidence source', r.label, r.rs, r.lo, r.hi, r.launched, r.supported]), ...G.areas.map((r) => ['therapy area', r.label, r.rs, r.lo, r.hi, r.launched, r.supported])]);
  const shares = (key) => C.binned[key].map((n) => n / C[key].genes);
  const series = [{ key: 'targets', label: `genes of approved-drug targets, ${exact(C.targets.genes)}`, color: 'var(--s1)', values: shares('targets') }, { key: 'all', label: `all protein-coding genes, ${exact(C.all.genes)}`, color: 'var(--data-2)', values: shares('all') }];
  histo({
    mount: $('#clinvar-chart'),
    bins: C.bins,
    series,
    tickLabel: (b) => b,
    tickEvery: 1,
    centered: true,
    yFormat: (v) => `${Math.round(v * 100)}%`,
    aria: 'Share of genes by number of pathogenic ClinVar alleles, drug-target genes against all genes',
    describe: (i) => tipLines(`${C.bins[i]} pathogenic or likely pathogenic alleles`, `drug-target genes ${pct(series[0].values[i])}, ${exact(C.binned.targets[i])}`, `all protein-coding genes ${pct(series[1].values[i])}, ${exact(C.binned.all[i])}`),
  });
  attachData('#clinvar-chart', 'clinvar-pathogenic-alleles', ['Pathogenic alleles', 'Drug-target genes', 'All protein-coding genes'], C.bins.map((b, i) => [b, C.binned.targets[i], C.binned.all[i]]));
};

const GROUP_SHORT = {
  'Unclassified protein kinase': 'PK', 'Lipid or other kinase': 'lipid', 'Non-human': 'non-human', Unclassified: '?',
};
const kinName = (r) => (/^[A-Z ]+$/.test(r.name) ? lower(r.name) : r.name);

const renderKinome = () => {
  const K = snapshot.kinome;
  const order = kinomeOrder(snapshot);
  const total = K.inhibitors.length * K.kinases.length;
  const measured = K.pkd.flat().filter((v) => v !== null).length;
  const approved = order.map((i) => K.inhibitors[i]).filter((r) => r.approved);
  $('#kinome-dek').textContent = `${exact(approved.length)} of the ${exact(K.inhibitors.length)} inhibitors are approved drugs. ${pct(measured / total)} of the ${exact(total)} inhibitor–kinase pairs gave a measurable Kd; the rest showed no binding at 10 µM. Of the approved drugs, ${kinName(approved[0])} is the most selective, S(3 µM) ${decimal(approved[0].s3, 3)}, and ${kinName(approved.at(-1))} the least, ${decimal(approved.at(-1).s3, 2)}.`;
  kinomeMap({
    mount: $('#kinome-chart'),
    rows: order.map((i) => ({ label: kinName(K.inhibitors[i]), mark: K.inhibitors[i].approved })),
    cols: K.kinases,
    values: order.map((i) => K.pkd[i]),
    groups: kinomeGroups(snapshot).map((g) => ({ ...g, label: GROUP_SHORT[g.key] ?? g.key })),
    side: order.map((i) => K.inhibitors[i].s3),
    legend: rampLegend(5, 9, (v) => `pKd ${decimal(v, 0)}, ${nanomolar(v)}`, 'var(--s2)'),
    aria: 'Dissociation constants of kinase inhibitors across the kinome',
    describe: (r, j) => {
      const inh = K.inhibitors[order[r]];
      const kin = K.kinases[j];
      const v = K.pkd[order[r]][j];
      return tipLines(v === null ? 'no binding at 10 µM' : `Kd ${nanomolar(v)}, pKd ${decimal(v, 2)}`, `${kinName(inh)} on ${kin.name}`, `${kin.group} group${kin.variant ? `, mutant ${kin.variant}` : ''}`, `${kinName(inh)}: S(3 µM) ${decimal(inh.s3, 3)}, ${plural(inh.hits, 'kinase')} below 3 µM${inh.approved ? ', approved drug' : ''}`);
    },
  });
  const pairs = [];
  K.inhibitors.forEach((r, i) => K.kinases.forEach((k, j) => {
    if (K.pkd[i][j] !== null) pairs.push([kinName(r), k.name, k.group, K.pkd[i][j]]);
  }));
  attachData('#kinome-chart', 'davis-kinome-kd', ['Inhibitor', 'Kinase construct', 'Group', 'pKd'], pairs);
  const named = new Set([...order.slice(-3), order[0], order.reduce((a, b) => (K.inhibitors[b].gini < K.inhibitors[a].gini ? b : a))].map((i) => K.inhibitors[i].id));
  scatter({
    mount: $('#selectivity-chart'),
    points: K.inhibitors.map((r) => ({
      key: r.id, x: r.s3, y: r.gini, hi: r.approved, label: kinName(r),
    })),
    labels: [...named],
    xDomain: [0, 1],
    yDomain: [Math.floor(Math.min(...K.inhibitors.map((r) => r.gini)) * 20) / 20, 1],
    xLabel: 'S(3 µM), share of kinases bound',
    yLabel: 'Gini coefficient',
    xFormat: (v) => decimal(v, 1),
    yFormat: (v) => decimal(v, 2),
    aria: 'Kinase inhibitors by two selectivity scores',
    describe: (p) => {
      const r = K.inhibitors.find((x) => x.id === p.key);
      return tipLines(kinName(r), r.approved ? 'approved drug' : 'not approved', `S(3 µM) ${decimal(r.s3, 3)}, ${plural(r.hits, 'kinase')} below 3 µM`, `Gini ${decimal(r.gini, 3)}`, { href: chemblUrl(r.id), text: `${r.id} in ChEMBL` });
    },
  });
  attachData('#selectivity-chart', 'kinase-selectivity', ['ChEMBL ID', 'Inhibitor', 'Approved', 'Kinases below 3 µM', 'S(3 µM)', 'Gini'], order.map((i) => {
    const r = K.inhibitors[i];
    return [r.id, kinName(r), r.approved ? 'yes' : 'no', r.hits, r.s3, r.gini];
  }));
};

const renderStructures = () => {
  const P = snapshot.structures.pdb;
  const G = snapshot.structures.gpcrdb;
  const year = lastFullYear(snapshot);
  const at = (key, y) => P.methods[key][P.years.indexOf(y)] ?? 0;
  const active = G.states.Active ?? 0;
  $('#structures-dek').textContent = `Electron microscopy gave ${exact(at('Electron microscopy', year))} structures in ${year}, against ${exact(at('Electron microscopy', year - 10))} in ${year - 10}; X-ray crystallography gave ${exact(at('X-ray', year))}. GPCRdb holds ${exact(G.total)} GPCR structures of ${exact(G.receptors)} receptors, ${pct(active / G.total)} in an active state and ${exact(G.signalling['G protein'] ?? 0)} with a G protein bound.`;
  const METHODS = [['X-ray', 'var(--s2)'], ['Electron microscopy', 'var(--s1)'], ['NMR', 'var(--s4)'], ['Other', 'var(--data-2)']];
  stackedArea({
    mount: $('#pdb-chart'),
    years: P.years,
    series: METHODS.map(([key, color]) => ({
      key, label: key, color, values: P.methods[key],
    })),
    aria: 'PDB structures released per year by method',
  });
  attachData('#pdb-chart', 'pdb-releases', ['Year', ...METHODS.map(([k]) => k)], P.years.map((y, i) => [y, ...METHODS.map(([k]) => P.methods[k][i])]));
  const STATES = [['Active', 'var(--s1)'], ['Intermediate', 'var(--s3)'], ['Inactive', 'var(--s2)'], ['Other', 'var(--rule)']];
  const classes = Object.entries(G.classes).sort((a, b) => b[1] - a[1]);
  hbars({
    mount: $('#gpcr-chart'),
    rows: classes.map(([c]) => ({ key: c, label: c, values: G.byClass[c] })),
    segments: STATES.map(([key, color]) => ({ key, label: lower(key), color })),
    labelShare: 0.4,
    aria: 'GPCR structures by receptor class and state',
    describe: (r) => tipLines(plural(G.classes[r.key], 'structure'), r.key, ...STATES.map(([s]) => (G.byClass[r.key][s] ? `${lower(s)} ${exact(G.byClass[r.key][s])}` : null))),
  });
  attachData('#gpcr-chart', 'gpcr-structures-by-class', ['Class', ...STATES.map(([s]) => s)], classes.map(([c]) => [c, ...STATES.map(([s]) => G.byClass[c][s] ?? 0)]));
  const years = Array.from({ length: G.years.at(-1) - G.years[0] + 1 }, (_, i) => G.years[0] + i);
  const keys = Object.keys(G.methods);
  const colorOf = Object.fromEntries(METHODS);
  stackedArea({
    mount: $('#gpcr-years-chart'),
    years,
    series: keys.map((key) => ({
      key, label: key, color: colorOf[key] ?? 'var(--data-2)', values: years.map((y) => G.methods[key][G.years.indexOf(y)] ?? 0),
    })),
    aria: 'GPCR structures by year and method',
  });
  attachData('#gpcr-years-chart', 'gpcr-structures-by-year', ['Year', ...keys], years.map((y) => [y, ...keys.map((k) => G.methods[k][G.years.indexOf(y)] ?? 0)]));
};

const A3 = snapshot.activities;
const ASSAY_TYPES = {
  B: 'binding', F: 'functional', A: 'ADMET', T: 'toxicity', P: 'physicochemical', U: 'unassigned',
};
const PHANTOM = new Set(['kon', 'k_off']);

const renderRecord = () => {
  const warned = A3.validity.reduce((n, v) => n + v.n, 0);
  const whole = A3.formats.filter((f) => /cell-based|organism-based|tissue-based/.test(f.format)).reduce((n, f) => n + f.n, 0);
  const protein = A3.formats.find((f) => f.format === 'single protein format')?.n ?? 0;
  const assays = A3.assays.map((a) => `${pct(a.n / A3.total)} ${ASSAY_TYPES[a.type] ?? a.type}`).slice(0, 3).join(', ');
  $('#record-dek').textContent = `By assay type, ${assays}. ${pct(whole / A3.total)} of records come from cells, tissues or whole organisms and ${pct(protein / A3.total)} from a single purified protein. ${exact(A3.duplicates)} are flagged as potential duplicates and ${exact(warned)} carry a data-validity warning. ${exact(A3.phantomKinetics)} kon and k_off rows, from BindingDB patent records, hold no value at all.`;
  const types = A3.types.slice(0, 20);
  dotplot({
    mount: $('#type-chart'),
    rows: types.map((t) => ({
      key: t.type, label: t.type, value: t.n, hi: PHANTOM.has(t.type),
    })),
    labelShare: 0.26,
    aria: 'ChEMBL activity records by standard type',
    describe: (r) => tipLines(`${exact(r.value)} records`, r.label, pct(r.value / A3.total), PHANTOM.has(r.key) ? 'nearly all from BindingDB patent records, with no value' : null),
  });
  attachData('#type-chart', 'activity-types', ['Standard type', 'Records'], A3.types.map((t) => [t.type, t.n]));
  const years = A3.years.filter(([y]) => y >= 1970);
  const top = years.reduce((a, b) => (b[1] > a[1] ? b : a));
  columns({
    mount: $('#year-chart'),
    rows: years,
    key: (r) => r[0],
    value: (r) => r[1],
    highlight: (r) => r[0] === top[0],
    annotations: [{ key: top[0], text: `${top[0]}: ${compact(top[1])}` }],
    aria: 'ChEMBL activity records by document year',
    describe: (r) => tipLines(`${exact(r[1])} records`, `documents from ${r[0]}`),
  });
  attachData('#year-chart', 'activities-by-year', ['Year', 'Records'], years.map(([y, n]) => [y, n]));
  const sources = A3.sources.slice(0, 12);
  dotplot({
    mount: $('#source-chart'),
    rows: sources.map((s) => ({ key: String(s.id), label: s.name, value: s.n })),
    labelShare: 0.5,
    labelMax: 300,
    aria: 'ChEMBL activity records by source',
    describe: (r) => tipLines(`${exact(r.value)} records`, r.label, pct(r.value / A3.total)),
  });
  attachData('#source-chart', 'activity-sources', ['Source ID', 'Source', 'Records'], A3.sources.map((s) => [s.id, s.name, s.n]));
  hbars({
    mount: $('#format-chart'),
    rows: A3.formats.slice(0, 10).map((f) => ({ key: f.format, label: f.format.replace(/ format$/, ''), values: { n: f.n } })),
    segments: [{ key: 'n', label: 'Records', color: 'var(--s4)' }],
    labelShare: 0.34,
    tickFormat: compact,
    format: compact,
    aria: 'ChEMBL activity records by assay format',
    describe: (r) => tipLines(`${exact(r.values.n)} records`, r.label, pct(r.values.n / A3.total)),
  });
  attachData('#format-chart', 'assay-formats', ['Format', 'Records'], A3.formats.map((f) => [f.format, f.n]));
};

const POTENCY_COLORS = ['var(--s2)', 'var(--s1)', 'var(--s4)', 'var(--s3)', 'var(--s5)', 'var(--ink-2)'];
const BINS = Array.from({ length: 19 }, (_, i) => 3 + i / 2);

const renderPotency = () => {
  const median = (type) => medianBin(A3.byType.find((t) => t.type === type)?.bins ?? []);
  const [m1, m2, m3] = A3.molecules;
  $('#potency-dek').textContent = `Binding constants sit higher than screening potencies: Ki values centre on pChEMBL ${median('Ki')} to ${median('Ki') + 0.5} and IC50s on ${median('IC50')} to ${median('IC50') + 0.5}, while the “potency” values of PubChem’s quantitative screens centre on ${median('Potency')} to ${median('Potency') + 0.5}. The most-measured molecules are ${drugName(m1.name)}, ${drugName(m2.name)} and ${drugName(m3.name)}, with ${exact(m1.n)}, ${exact(m2.n)} and ${exact(m3.n)} pChEMBL values.`;
  const series = A3.byType.map((t, i) => {
    const counts = new Map(t.bins);
    const total = t.bins.reduce((n, [, c]) => n + c, 0) || 1;
    return { label: `${t.type}, ${compact(t.n)}`, color: POTENCY_COLORS[i % POTENCY_COLORS.length], points: BINS.map((x) => ({ x, y: (counts.get(x) ?? 0) / total })) };
  });
  const peak = Math.max(...series.flatMap((s) => s.points.map((p) => p.y)));
  curves({
    mount: $('#pchembl-chart'),
    series,
    xDomain: [3, 12],
    yDomain: [0, Math.ceil(peak * 10) / 10],
    xTicks: Array.from({ length: 10 }, (_, i) => 3 + i),
    yFormat: (v) => `${Math.round(v * 100)}%`,
    xLabel: 'pChEMBL',
    aria: 'Distribution of pChEMBL values by standard type',
    describe: (i) => tipLines(`pChEMBL ${BINS[i]} to ${BINS[i] + 0.5}`, `${nanomolar(BINS[i] + 0.5)} to ${nanomolar(BINS[i])}`, ...series.map((s) => `${s.label.split(',')[0]} ${pct(s.points[i].y)}`)),
  });
  attachData('#pchembl-chart', 'pchembl-by-type', ['pChEMBL from', ...A3.byType.map((t) => t.type)], BINS.map((x) => [x, ...A3.byType.map((t) => new Map(t.bins).get(x) ?? 0)]));
  const all = new Map(A3.pchembl);
  const approved = new Map();
  for (const a of snapshot.gtopdb.affinities) {
    const bin = Math.floor(a.value * 2) / 2;
    approved.set(bin, (approved.get(bin) ?? 0) + 1);
  }
  const share = (m) => {
    const total = [...m.values()].reduce((n, c) => n + c, 0) || 1;
    return BINS.map((x) => (m.get(x) ?? 0) / total);
  };
  const two = [{ key: 'all', label: 'every pChEMBL value', color: 'var(--data-2)', values: share(all) }, { key: 'approved', label: 'approved drugs at their primary targets', color: 'var(--s1)', values: share(approved) }];
  histo({
    mount: $('#approved-potency-chart'),
    bins: BINS,
    series: two,
    tickLabel: (b) => (Number.isInteger(b) ? String(b) : null),
    tickEvery: 1,
    yFormat: (v) => `${Math.round(v * 100)}%`,
    aria: 'pChEMBL values against approved-drug affinities',
    describe: (i) => tipLines(`pChEMBL ${BINS[i]} to ${BINS[i] + 0.5}`, `every value ${pct(two[0].values[i])}`, `approved drugs ${pct(two[1].values[i])}`),
  });
  attachData('#approved-potency-chart', 'approved-potency', ['pChEMBL from', 'Every pChEMBL value', 'Approved drugs'], BINS.map((x) => [x, all.get(x) ?? 0, approved.get(x) ?? 0]));
  dotplot({
    mount: $('#measured-chart'),
    rows: A3.molecules.map((m) => ({ key: m.name, label: drugName(m.name), value: m.n })),
    labelShare: 0.4,
    aria: 'The molecules with the most pChEMBL values',
    describe: (r) => tipLines(`${exact(r.value)} pChEMBL values`, r.label),
  });
  attachData('#measured-chart', 'most-measured-molecules', ['Molecule', 'pChEMBL values'], A3.molecules.map((m) => [drugName(m.name), m.n]));
};

const renderEfficiency = () => {
  const points = efficiencyPoints(snapshot);
  const heavy = summary(points.map((p) => p.heavy)).median;
  const lles = points.filter((p) => p.lle !== null);
  const lle = summary(lles.map((p) => p.lle)).median;
  $('#efficiency-dek').textContent = `${exact(points.length)} approved drug–target affinities in GtoPdb match a ChEMBL structure. The median drug has ${exact(heavy)} heavy atoms and a lipophilic ligand efficiency of ${decimal(lle, 1)}; ${pct(lles.filter((p) => p.lle >= 5).length / lles.length)} reach an LLE of 5, which Leeson and Springthorpe put forward as a goal for leads.`;
  const xd = [0, Math.max(...points.map((p) => p.heavy)) + 5];
  const yd = [3, 12];
  const refs = [0.3, 0.5].map((le) => ({ ...clipLine(le / 1.37, 0, xd, yd), label: `LE ${le}` }));
  scatter({
    mount: $('#le-chart'),
    points: points.map((p, i) => ({ key: `${i}`, x: p.heavy, y: p.p })),
    xDomain: xd,
    yDomain: yd,
    refs,
    radius: 3,
    xLabel: 'heavy atoms',
    yLabel: 'affinity, p units',
    aria: 'Affinity against heavy atoms for approved drugs',
    describe: (pt) => {
      const p = points[Number(pt.key)];
      return tipLines(`${p.units} ${p.p}, LE ${decimal(p.le, 2)}`, `${p.ligand} on ${p.target}`, `${p.heavy} heavy atoms`);
    },
  });
  attachData('#le-chart', 'ligand-efficiency', ['Drug', 'Target', 'Units', 'Affinity', 'Heavy atoms', 'ALogP', 'LE', 'LLE'], points.map((p) => [p.ligand, p.target, p.units, p.p, p.heavy, p.alogp, p.le, p.lle]));
  const ad = [Math.floor(Math.min(...lles.map((p) => p.alogp))) - 1, Math.ceil(Math.max(...lles.map((p) => p.alogp))) + 1];
  scatter({
    mount: $('#lle-chart'),
    points: lles.map((p) => ({ key: `${points.indexOf(p)}`, x: p.alogp, y: p.p })),
    xDomain: ad,
    yDomain: yd,
    refs: [3, 5, 7].map((v) => clipLine(1, v, ad, yd)).filter(Boolean).map((r, i) => ({ ...r, label: `LLE ${[3, 5, 7][i]}` })),
    radius: 3,
    xLabel: 'ALogP',
    yLabel: 'affinity, p units',
    aria: 'Affinity against calculated logP for approved drugs',
    describe: (pt) => {
      const p = points[Number(pt.key)];
      return tipLines(`${p.units} ${p.p}, LLE ${decimal(p.lle, 1)}`, `${p.ligand} on ${p.target}`, `ALogP ${decimal(p.alogp, 1)}`);
    },
  });
  attachData('#lle-chart', 'lipophilic-efficiency', ['Drug', 'Target', 'Affinity', 'ALogP', 'LLE'], lles.map((p) => [p.ligand, p.target, p.p, p.alogp, p.lle]));
};

const renderAgreement = () => {
  const s = agreementStats(snapshot, 'klaeger');
  const k = agreementStats(snapshot, 'karaman');
  const pairs = snapshot.agreement.klaeger.pairs;
  $('#agreement-dek').textContent = `KINOMEscan binds recombinant kinase domains; kinobeads compete for native kinases in cell lysate. Across ${exact(s.n)} shared pairs, KINOMEscan reads ${decimal(10 ** s.bias, 1)} times tighter on average, the limits of agreement run from ${minus(s.lo, 2)} to ${minus(s.hi, 2)} log units and Spearman’s ρ is ${decimal(s.spearman, 2)}. A caution on counting: Davis 2011 repeats ${pct(k.identical / k.n)} of the Kd values it shares with Karaman 2008 to two decimals, so ChEMBL holds those ${exact(k.identical)} measurements twice.`;
  const d = [3, 11];
  scatter({
    mount: $('#agree-chart'),
    points: pairs.map(([a, b], i) => ({ key: `${i}`, x: a, y: b })),
    xDomain: d,
    yDomain: d,
    refs: [{ ...clipLine(1, 0, d, d), label: 'agreement' }],
    radius: 2.5,
    xLabel: 'KINOMEscan pKd',
    yLabel: 'kinobeads pKd',
    aria: 'Kinase Kd values from KINOMEscan against kinobeads',
    describe: (pt) => tipLines(`KINOMEscan ${decimal(pt.x, 2)}, kinobeads ${decimal(pt.y, 2)}`, `difference ${decimal(pt.x - pt.y, 2)} log units`),
  });
  attachData('#agree-chart', 'kinobeads-kinomescan', ['KINOMEscan pKd', 'Kinobeads pKd'], pairs.map(([a, b]) => [a, b]));
  const pts = s.points;
  const xd = [Math.floor(Math.min(...pts.map((p) => p.mean))), Math.ceil(Math.max(...pts.map((p) => p.mean)))];
  const yd = [Math.floor(Math.min(...pts.map((p) => p.diff))), Math.ceil(Math.max(...pts.map((p) => p.diff)))];
  scatter({
    mount: $('#bland-chart'),
    points: pts.map((p, i) => ({ key: `${i}`, x: p.mean, y: p.diff })),
    xDomain: xd,
    yDomain: yd,
    refs: [[s.bias, `bias ${minus(s.bias, 2)}`], [s.lo, `−1.96 SD ${minus(s.lo, 2)}`], [s.hi, `+1.96 SD ${minus(s.hi, 2)}`]].map(([v, label], i) => ({ ...clipLine(0, v, xd, yd), label, soft: i > 0 })),
    radius: 2.5,
    xLabel: 'mean pKd',
    yLabel: 'KINOMEscan minus kinobeads',
    aria: 'Bland–Altman plot of KINOMEscan and kinobeads Kd values',
    describe: (pt) => tipLines(`difference ${decimal(pt.y, 2)} log units`, `mean pKd ${decimal(pt.x, 2)}`),
  });
  attachData('#bland-chart', 'bland-altman', ['Mean pKd', 'Difference'], pts.map((p) => [Number(p.mean.toFixed(3)), Number(p.diff.toFixed(3))]));
};

const minus = (v, places = 1) => (v < 0 ? `−${Math.abs(v).toFixed(places)}` : v.toFixed(places));

const K4DD_SHORT = {
  'Adenosine receptor A1': 'A1',
  'Adenosine receptor A2a': 'A2A',
  'Heat shock protein HSP 90-alpha': 'HSP90α',
  'Coagulation factor X': 'FXa',
  'Aurora kinase A': 'AurA',
  'Insulin-like growth factor 1 receptor': 'IGF1R',
  'Gonadotropin-releasing hormone receptor': 'GnRHR',
  'Substance-P receptor': 'NK1',
};

const renderKinetics = () => {
  const rows = kineticRows(snapshot);
  const targets = [...new Set(rows.map((r) => r.targetName))];
  const color = new Map(targets.map((t, i) => [t, CAT[i % CAT.length]]));
  const longest = rows.reduce((a, b) => (b.residence > a.residence ? b : a));
  const tight = rows.filter((r) => r.pkd >= 8 && r.pkd < 9);
  const spread = tight.length > 1 ? Math.max(...tight.map((r) => r.residence)) / Math.min(...tight.map((r) => r.residence)) : 1;
  $('#kinetics-dek').textContent = `Residence time, one over koff, runs from ${seconds(Math.min(...rows.map((r) => r.residence)))} to ${seconds(longest.residence)}; the longest-lived complex is ${longest.name ? drugName(longest.name) : longest.molecule} on ${softName(longest.targetName)}. Affinity does not fix it: among the ${exact(tight.length)} pairs with a pKD between 8 and 9, residence times differ ${exact(Math.round(spread))}-fold.`;
  const xd = [Math.floor(Math.min(...rows.map((r) => r.logKon))), Math.ceil(Math.max(...rows.map((r) => r.logKon)))];
  const yd = [Math.floor(Math.min(...rows.map((r) => r.logKoff))), Math.ceil(Math.max(...rows.map((r) => r.logKoff)))];
  scatter({
    mount: $('#kinetic-map'),
    points: rows.map((r, i) => ({
      key: `${i}`, x: r.logKon, y: r.logKoff, color: color.get(r.targetName),
    })),
    xDomain: xd,
    yDomain: yd,
    refs: [6, 7, 8, 9, 10, 11].map((p) => [p, clipLine(1, -p, xd, yd)]).filter(([, r]) => r).map(([p, r]) => ({ ...r, label: `pKD ${p}`, soft: true })),
    legend: targets.map((t) => ({ label: t, color: color.get(t) })),
    xFormat: (v) => pow10(v),
    yFormat: (v) => pow10(v),
    xLabel: 'kon, per molar per second',
    yLabel: 'koff, per second',
    height: 360,
    aria: 'Kinetic map of association and dissociation rate constants',
    describe: (pt) => {
      const r = rows[Number(pt.key)];
      return tipLines(`pKD ${decimal(r.pkd, 1)}, residence ${seconds(r.residence)}`, `${r.name ? drugName(r.name) : r.molecule} on ${r.targetName}`, `kon ${r.kon.toExponential(2)} M⁻¹s⁻¹, koff ${r.koff.toExponential(2)} s⁻¹`, { href: chemblUrl(r.molecule), text: `${r.molecule} in ChEMBL` });
    },
  });
  attachData('#kinetic-map', 'k4dd-kinetics', ['Molecule', 'Name', 'Target', 'kon per M per s', 'koff per s', 'pKD', 'Residence s'], rows.map((r) => [r.molecule, r.name ?? '', r.targetName, r.kon, r.koff, Number(r.pkd.toFixed(2)), Number(r.residence.toPrecision(4))]));
  const byTarget = targets.map((t) => {
    const v = rows.filter((r) => r.targetName === t).map((r) => Math.log10(r.residence)).sort((a, b) => a - b);
    const sm = summary(v);
    return {
      key: t, label: K4DD_SHORT[t] ?? t.slice(0, 12), n: v.length, lo: v[Math.floor(v.length * 0.05)], q1: sm.q1, median: sm.median, q3: sm.q3, hi: v[Math.min(v.length - 1, Math.floor(v.length * 0.95))],
    };
  }).filter((r) => r.n >= 3);
  boxes({
    mount: $('#residence-chart'),
    rows: byTarget,
    attr: 'target',
    yFormat: (v) => seconds(10 ** v),
    aria: 'Residence time by target',
    describe: (r) => tipLines(`median ${seconds(10 ** r.median)}`, r.key, `middle half ${seconds(10 ** r.q1)} to ${seconds(10 ** r.q3)}`, plural(r.n, 'compound')),
  });
  attachData('#residence-chart', 'residence-by-target', ['Target', 'Pairs', 'Median residence s'], byTarget.map((r) => [r.key, r.n, Number((10 ** r.median).toPrecision(4))]));
};

const sliderValue = (id) => Number($(`#${id}`).value);
const showValue = (id, digits = 1) => {
  const v = sliderValue(id);
  $(`#${id}-out`).textContent = v < 0 ? `−${Math.abs(v).toFixed(digits)}` : v.toFixed(digits);
};

const drawOccupancy = () => {
  for (const id of ['p-ka', 'log-tau', 'hill', 'p-kb', 'log-b']) showValue(id);
  const ka = 10 ** -sliderValue('p-ka');
  const tau = 10 ** sliderValue('log-tau');
  const n = sliderValue('hill');
  const kb = 10 ** -sliderValue('p-kb');
  const b = 10 ** sliderValue('log-b');
  const dr = doseRatio(b, kb);
  const s = operationalSummary(ka, tau, n);
  const occ = curve((c) => occupancy(c, ka), -12, -2, 101);
  const resp = curve((c) => operational(c, ka, tau, n), -12, -2, 101);
  const shifted = curve((c) => operational(c, ka * dr, tau, n), -12, -2, 101);
  curves({
    mount: $('#occupancy-chart'),
    series: [{ label: 'receptors occupied', color: 'var(--data-2)', points: occ }, { label: 'response', color: 'var(--s2)', points: resp }, { label: 'response with antagonist', alt: true, points: shifted }],
    xDomain: [-12, -2],
    xTicks: Array.from({ length: 11 }, (_, i) => -12 + i),
    xFormat: (v) => pow10(v),
    xLabel: 'agonist, molar',
    marks: [{ x: Math.log10(s.ec50), label: 'EC50' }, { x: Math.log10(ka), label: 'KA' }],
    aria: 'Receptor occupancy and response against agonist concentration',
    describe: (i) => tipLines(`agonist ${molar(10 ** occ[i].x)}`, `occupied ${pct(occ[i].y)}`, `response ${pct(resp[i].y)}`, `with antagonist ${pct(shifted[i].y)}`),
  });
  attachData('#occupancy-chart', 'operational-model', ['Log agonist', 'Occupied', 'Response', 'Response with antagonist'], occ.map((p, i) => [p.x, Number(p.y.toFixed(4)), Number(resp[i].y.toFixed(4)), Number(shifted[i].y.toFixed(4))]));
  $('#occupancy-out').textContent = `EC50 ${molar(s.ec50)}, Emax ${pct(s.emax)} of the system maximum; ${pct(s.occupancyAtEc50)} of receptors are occupied at the EC50, so ${s.occupancyAtEc50 < 0.5 ? 'the tissue has a receptor reserve' : 'there is no receptor reserve'}. With the antagonist at ${molar(b)}, the dose ratio is ${decimal(dr, 1)}, a shift of ${decimal(Math.log10(dr), 2)} log units.`;
};

const drawBinding = () => {
  for (const id of ['log-kon', 'log-koff', 'log-l']) showValue(id);
  showValue('incubation', 0);
  const kon = 10 ** sliderValue('log-kon');
  const koff = 10 ** sliderValue('log-koff');
  const c = 10 ** sliderValue('log-l');
  const inc = sliderValue('incubation');
  const points = Array.from({ length: 121 }, (_, i) => {
    const t = (2 * inc * i) / 120;
    const y = t <= inc ? association(t * 60, c, kon, koff) : washout((t - inc) * 60, association(inc * 60, c, kon, koff), koff);
    return { x: Number(t.toFixed(3)), y };
  });
  const atEnd = association(inc * 60, c, kon, koff);
  const after = washout(inc * 60, atEnd, koff);
  curves({
    mount: $('#binding-chart'),
    series: [{ label: 'receptors bound', color: 'var(--s2)', points }],
    xDomain: [0, 2 * inc],
    xLabel: 'minutes',
    marks: [{ x: inc, label: 'washout' }],
    aria: 'Receptor binding over time with washout',
    describe: (i) => tipLines(`${pct(points[i].y)} bound`, `${decimal(points[i].x, 1)} min`, points[i].x <= inc ? 'ligand present' : 'after washout'),
  });
  attachData('#binding-chart', 'binding-time-course', ['Minutes', 'Bound'], points.map((p) => [p.x, Number(p.y.toFixed(4))]));
  $('#binding-out').textContent = `KD ${molar(koff / kon)}; residence time ${seconds(1 / koff)}, half-life ${seconds(Math.LN2 / koff)}. ${pct(atEnd)} of receptors are bound after ${inc} min, against ${pct(c / (c + koff / kon))} at equilibrium, and ${pct(after)} are still bound ${inc} min after washout.`;
};

const renderTheory = () => {
  drawOccupancy();
  drawBinding();
};

const initTheory = () => {
  $('#occupancy-controls').addEventListener('input', drawOccupancy);
  $('#binding-controls').addEventListener('input', drawBinding);
  $('#pk-controls').addEventListener('input', () => drawPk());
};

const renderCombinations = () => {
  const M = snapshot.almanac;
  const m = comboMatrix(snapshot);
  const scores = M.pairs.map((p) => p[2]).sort((a, b) => a - b);
  const sm = summary(scores);
  const worst = topPairs(snapshot, 1, -1)[0];
  const traced = worst.a === 'ifosfamide' && worst.b === 'oxaliplatin';
  $('#combinations-dek').textContent = `Each score is NCI’s: a combination well’s growth against the Bliss expectation from single-drug wells on the same plate, averaged over up to ${exact(M.cells)} cell lines. The middle half of pairs score between ${minus(sm.q1)} and ${minus(sm.q3)} points, close to additive. Scores far below zero can come from one plate: ${worst.a} with ${worst.b} scores ${minus(worst.score)}${traced ? ', and on the MCF7 plate that paired them, ifosfamide’s single-drug wells grew 44 to 82% of control though the prodrug, which needs liver enzymes to act, barely slows MCF7 cells on other plates' : ''}.`;
  const scale = 20;
  heatmap({
    mount: $('#combo-chart'),
    labels: m.names,
    values: m.values,
    order: m.order,
    labelMin: 9,
    fill: (v) => (v === null ? { color: 'var(--rule)', opacity: 0.15 } : { color: v >= 0 ? 'var(--s1)' : 'var(--s2)', opacity: heatShade(Math.abs(v), scale) }),
    legend: html('ul', { class: 'legend ramp' }, [-20, -10, 0, 10, 20].map((v) => html('li', {}, html('i', { style: `background:${v >= 0 ? 'var(--s1)' : 'var(--s2)'};opacity:${heatShade(Math.abs(v), scale)}` }), v > 0 ? `+${v}` : `${v < 0 ? '−' : ''}${Math.abs(v)}`))),
    aria: 'NCI-ALMANAC mean scores for every drug pair',
    describe: (r, c) => (m.values[r][c] === null ? tipLines(m.names[r], 'the same drug') : tipLines(`${m.values[r][c] > 0 ? '+' : ''}${decimal(m.values[r][c], 1)} points`, `${m.names[r]} with ${m.names[c]}`, `${M.pairs.find((p) => (p[0] === Math.min(r, c) && p[1] === Math.max(r, c)))?.[3] ?? 0} cell lines`)),
  });
  attachData('#combo-chart', 'almanac-pairs', ['Drug', 'Drug', 'Mean score', 'Cell lines'], M.pairs.map(([i, j, sc, cells]) => [m.names[i], m.names[j], sc, cells]));
  const top = topPairs(snapshot, 20);
  dotplot({
    mount: $('#combo-top-chart'),
    rows: top.map((p) => ({ key: `${p.a}|${p.b}`, label: `${p.a} + ${p.b}`, value: p.score })),
    scale: 'linear',
    labelShare: 0.55,
    labelMax: 330,
    format: (v) => decimal(v, 1),
    aria: 'The drug pairs with the highest NCI-ALMANAC scores',
    describe: (r) => {
      const p = top.find((x) => `${x.a}|${x.b}` === r.key);
      return tipLines(`+${decimal(p.score, 1)} points`, r.label, plural(p.cells, 'cell line'));
    },
  });
  attachData('#combo-top-chart', 'almanac-top-pairs', ['Pair', 'Mean score', 'Cell lines'], top.map((p) => [`${p.a} + ${p.b}`, p.score, p.cells]));
  const edges = Array.from({ length: 25 }, (_, i) => -30 + i * 2.5);
  const counts = edges.slice(0, -1).map((lo, i) => scores.filter((v) => v >= lo && (i === edges.length - 2 ? v <= edges.at(-1) : v < edges[i + 1])).length);
  histo({
    mount: $('#combo-dist-chart'),
    bins: edges.slice(0, -1),
    series: [{ key: 'pairs', label: 'Drug pairs', color: 'var(--s4)', values: counts }],
    tickLabel: (b) => (b % 10 === 0 ? (b > 0 ? `+${b}` : String(b)) : null),
    tickEvery: 1,
    aria: 'Drug pairs by mean NCI-ALMANAC score',
    describe: (i) => tipLines(plural(counts[i], 'pair'), `score ${edges[i]} to ${edges[i + 1]}`),
  });
  attachData('#combo-dist-chart', 'almanac-score-distribution', ['Score from', 'Score to', 'Pairs'], counts.map((n, i) => [edges[i], edges[i + 1], n]));
};

const heatShade = (v, top) => Number(Math.min(1, 0.08 + 0.92 * Math.min(1, v / top)).toFixed(3));

const logBins = (values, lo, hi, perDecade) => {
  const edges = logEdges(lo, hi, perDecade);
  return { edges, counts: histogram(values.filter((v) => v > 0), edges) };
};

const renderPk = () => {
  const s = pkSummary(snapshot);
  const fs = snapshot.pk.f.map((d) => d.median);
  const longest = snapshot.pk.halfLife.reduce((a, b) => (b.median > a.median ? b : a));
  const fus = snapshot.pk.ppb.map((d) => Math.max(0.0001, 1 - d.median / 100));
  $('#pk-dek').textContent = `Half of the approved drugs with a human value in ChEMBL reach the circulation at ${decimal(s.f.median, 0)}% or more of an oral dose, and ${pct(fs.filter((v) => v < 10).length / fs.length)} at less than 10%. The middle half of half-lives run from ${duration(s.halfLife.q1)} to ${duration(s.halfLife.q3)}; the longest is ${DRUG_NAME.get(longest.id) ?? longest.id}, at ${duration(longest.median)}. ${pct(fus.filter((v) => v < 0.01).length / fus.length)} of drugs with a protein-binding value are more than 99% bound.`;
  const fEdges = linearEdges(0, 100, 10);
  const fCounts = histogram(fs, fEdges);
  histo({
    mount: $('#f-chart'),
    bins: fCounts,
    series: [{ key: 'f', label: 'Approved drugs', color: 'var(--s2)', values: fCounts }],
    tickLabel: (b, i) => `${fEdges[i]}%`,
    tickEvery: 2,
    aria: 'Approved drugs by oral bioavailability',
    describe: (i) => tipLines(plural(fCounts[i], 'approved drug'), `oral bioavailability ${fEdges[i]} to ${fEdges[i + 1]}%`),
  });
  attachData('#f-chart', 'oral-bioavailability', ['ChEMBL ID', 'Drug', 'Median F %', 'Values'], snapshot.pk.f.map((d) => [d.id, DRUG_NAME.get(d.id) ?? '', d.median, d.n]));
  const t = logBins(snapshot.pk.halfLife.map((d) => d.median), -2, 5, 2);
  const every = $('#halflife-chart').clientWidth < 520 ? 4 : 2;
  histo({
    mount: $('#halflife-chart'),
    bins: t.counts,
    series: [{ key: 't', label: 'Approved drugs', color: 'var(--s4)', values: t.counts }],
    tickLabel: (b, i) => (i % every === 0 ? duration(t.edges[i]) : null),
    tickEvery: 1,
    aria: 'Approved drugs by human half-life',
    describe: (i) => tipLines(plural(t.counts[i], 'approved drug'), `half-life ${duration(t.edges[i])} to ${duration(t.edges[i + 1])}`),
  });
  attachData('#halflife-chart', 'half-lives', ['ChEMBL ID', 'Drug', 'Median half-life h', 'Values'], snapshot.pk.halfLife.map((d) => [d.id, DRUG_NAME.get(d.id) ?? '', d.median, d.n]));
  const u = logBins(fus, -4, 0, 2);
  histo({
    mount: $('#fu-chart'),
    bins: u.counts,
    series: [{ key: 'fu', label: 'Approved drugs', color: 'var(--s5)', values: u.counts }],
    tickLabel: (b, i) => (i % 2 === 0 ? `${Number((u.edges[i] * 100).toPrecision(2))}%` : null),
    tickEvery: 1,
    aria: 'Approved drugs by fraction unbound in plasma',
    describe: (i) => tipLines(plural(u.counts[i], 'approved drug'), `unbound ${Number((u.edges[i] * 100).toPrecision(2))} to ${Number((u.edges[i + 1] * 100).toPrecision(2))}%`),
  });
  attachData('#fu-chart', 'plasma-binding', ['ChEMBL ID', 'Drug', 'Median bound %', 'Values'], snapshot.pk.ppb.map((d) => [d.id, DRUG_NAME.get(d.id) ?? '', d.median, d.n]));
};

const drawPk = () => {
  for (const id of ['pk-dose', 'pk-interval', 'pk-f']) showValue(id, 0);
  for (const id of ['pk-ka', 'pk-cl']) showValue(id, 1);
  showValue('pk-v', 0);
  const dose = sliderValue('pk-dose');
  const tau = sliderValue('pk-interval');
  const f = sliderValue('pk-f') / 100;
  const ka = sliderValue('pk-ka');
  const cl = sliderValue('pk-cl');
  const v = sliderValue('pk-v');
  const ke = cl / v;
  const p = {
    dose, f, ka, ke, v,
  };
  const half = halfLife(cl, v);
  const span = Math.min(336, Math.max(6 * half, 4 * tau));
  const points = Array.from({ length: 241 }, (_, i) => {
    const time = (span * i) / 240;
    return { x: Number(time.toFixed(3)), y: repeatedDoses(time, tau, p) };
  });
  const cavg = averageSteadyState({
    dose, f, cl, tau,
  });
  const start = Math.ceil(Math.max(20 * tau, 7 * half) / tau) * tau;
  const window = Array.from({ length: 61 }, (_, i) => repeatedDoses(start + (tau * i) / 60, tau, p));
  const top = Math.max(...points.map((pt) => pt.y), Math.max(...window)) * 1.1;
  curves({
    mount: $('#pk-chart'),
    series: [{ label: 'plasma concentration', color: 'var(--s2)', points }, { label: 'average at steady state', alt: true, points: points.map((pt) => ({ x: pt.x, y: cavg })) }],
    xDomain: [0, span],
    yDomain: [0, top],
    yFormat: (y) => decimal(y, y < 10 ? 1 : 0),
    xLabel: 'hours',
    yLabel: 'mg/L',
    marks: [],
    aria: 'Plasma concentration after repeated oral doses',
    describe: (i) => tipLines(`${decimal(points[i].y, 2)} mg/L`, `${decimal(points[i].x, 1)} h after the first dose`),
  });
  attachData('#pk-chart', 'pk-simulation', ['Hours', 'mg/L'], points.map((pt) => [pt.x, Number(pt.y.toFixed(4))]));
  $('#pk-out').textContent = `The half-life is ${duration(half)}; with a dose every ${tau} h the drug accumulates ${decimal(accumulation(ke, tau), 2)}-fold. At steady state, reached to 90% after ${duration(3.32 * half)}, the average is ${decimal(cavg, 2)} mg/L, the peak ${decimal(Math.max(...window), 2)} and the trough ${decimal(Math.min(...window), 2)} mg/L.`;
};

const renderSimulator = () => drawPk();

const CYP_SHORT = {
  'strong inhibitor': 'strong inh.', 'moderate inhibitor': 'mod. inh.', 'weak inhibitor': 'weak inh.', 'strong inducer': 'strong ind.', 'moderate inducer': 'mod. ind.', 'weak inducer': 'weak ind.', 'sensitive substrate': 'sens. sub.', 'moderate substrate': 'mod. sub.',
};

const renderDdi = () => {
  const m = ddiMatrix(snapshot);
  const t = transporterMatrix(snapshot);
  const top = perpetrators(snapshot);
  const at = (system, label) => m.counts[m.systems.indexOf(system)][m.categories.indexOf(label)];
  const cyp3a = m.categories.reduce((n, c) => n + at('3A', c), 0);
  const all = m.counts.flat().reduce((a, b) => a + b, 0);
  $('#ddi-dek').textContent = `CYP3A carries ${pct(cyp3a / all)} of the enzyme entries in FDA’s table. ${capital(top[0].drug)} has the most listed inhibition and induction, ${top[0].n} entries, then ${top[1].drug} and ${top[2].drug}. Among transporters, ${exact(t.counts[t.systems.indexOf('P-gp')][0])} drugs are listed as P-gp inhibitors and ${exact(t.counts[t.systems.indexOf('OATP1B1')][1])} as OATP1B1 substrates.`;
  grid({
    mount: $('#ddi-chart'),
    rows: m.systems.map((s) => `CYP${s}`),
    cols: m.categories.map((c) => CYP_SHORT[c] ?? c),
    values: m.counts,
    color: 'var(--s1)',
    aria: 'FDA-listed CYP inhibitors, inducers and substrates by enzyme',
    describe: (i, j) => {
      const names = snapshot.ddi.rows.filter((r) => r.links.some((l) => l.system === m.systems[i] && `${l.strength} ${l.role}` === m.categories[j])).map((r) => r.drug);
      return tipLines(exact(m.counts[i][j]), `CYP${m.systems[i]} ${m.categories[j]}s`, names.slice(0, 6).join(', ') + (names.length > 6 ? ', …' : ''));
    },
  });
  attachData('#ddi-chart', 'cyp-interactions', ['Enzyme', ...m.categories], m.systems.map((s, i) => [`CYP${s}`, ...m.counts[i]]));
  grid({
    mount: $('#transporter-chart'),
    rows: t.systems,
    cols: t.roles,
    values: t.counts,
    color: 'var(--s4)',
    aria: 'FDA-listed transporter inhibitors and substrates',
    describe: (i, j) => {
      const names = snapshot.ddi.rows.filter((r) => r.links.some((l) => l.system === t.systems[i] && l.role === t.roles[j])).map((r) => r.drug);
      return tipLines(exact(t.counts[i][j]), `${t.systems[i]} ${t.roles[j]}s`, names.slice(0, 6).join(', ') + (names.length > 6 ? ', …' : ''));
    },
  });
  attachData('#transporter-chart', 'transporter-interactions', ['Transporter', 'Inhibitors', 'Substrates'], t.systems.map((s, i) => [s, ...t.counts[i]]));
  const shown = top.slice(0, 20);
  dotplot({
    mount: $('#perpetrator-chart'),
    rows: shown.map((p) => ({ key: p.drug, label: p.drug, value: p.n })),
    scale: 'linear',
    labelShare: 0.42,
    aria: 'Drugs with the most CYP and transporter inhibition and induction',
    describe: (r) => {
      const p = shown.find((x) => x.drug === r.key);
      return tipLines(plural(p.n, 'entry', 'entries'), p.drug, p.links.map((l) => `${l.system} ${l.strength === 'transporter' ? '' : `${l.strength} `}${l.role}`).join('; '));
    },
  });
  attachData('#perpetrator-chart', 'interaction-perpetrators', ['Drug', 'Entries', 'Interactions'], top.map((p) => [p.drug, p.n, p.links.map((l) => `${l.system} ${l.strength} ${l.role}`).join('; ')]));
};

const renderCipa = () => {
  const rows = cipaSorted(snapshot);
  const currents = Object.keys(rows[0].margin);
  const lowCa = rows.filter((r) => r.risk === 'low' && r.margin.ICaL !== null).reduce((a, b) => (b.margin.ICaL < a.margin.ICaL ? b : a));
  const highHerg = rows.filter((r) => r.risk === 'high').reduce((a, b) => (b.margin.hERG < a.margin.hERG ? b : a));
  $('#cipa-dek').textContent = `CiPA judges a drug by the currents it blocks at therapeutic exposure, not by hERG alone. ${capital(lowCa.drug)} blocks the L-type calcium current at ${lowCa.margin.ICaL} times its free Cmax and is low risk despite a hERG margin of ${lowCa.margin.hERG}; ${highHerg.drug}, high risk, blocks hERG at ${highHerg.margin.hERG} times its free Cmax.`;
  const shade = (v) => heatShade(Math.max(0, 4 - Math.log10(v)), 5);
  grid({
    mount: $('#cipa-chart'),
    rows: rows.map((r) => `${r.drug}, ${r.risk}`),
    cols: currents,
    values: rows.map((r) => currents.map((c) => r.margin[c])),
    color: 'var(--s1)',
    shade,
    format: (v) => (v >= 1000 ? compact(v) : String(Number(v.toPrecision(2)))),
    aria: 'Ion channel block margins of the CiPA training drugs',
    describe: (i, j) => {
      const r = rows[i];
      const v = r.margin[currents[j]];
      return v === null ? tipLines('no block fitted', `${r.drug} on ${currents[j]}`) : tipLines(`${Number(v.toPrecision(3))} times free Cmax`, `${r.drug} on ${currents[j]}, ${r.risk} risk`, `IC50 ${molar(r.ic50[currents[j]] * 1e-9)}, free Cmax ${molar(r.cmax * 1e-9)}`);
    },
  });
  attachData('#cipa-chart', 'cipa-margins', ['Drug', 'Risk', 'Free Cmax nM', ...currents.map((c) => `${c} IC50 nM`)], rows.map((r) => [r.drug, r.risk, r.cmax, ...currents.map((c) => r.ic50[c])]));
  dotplot({
    mount: $('#herg-chart'),
    rows: rows.map((r) => ({
      key: r.drug, label: `${r.drug}, ${r.risk}`, value: r.margin.hERG, hi: r.risk === 'high',
    })),
    labelShare: 0.4,
    format: (v) => `${Number(v.toPrecision(2))}×`,
    aria: 'hERG margins of the CiPA training drugs',
    describe: (r) => {
      const d = rows.find((x) => x.drug === r.key);
      return tipLines(`hERG IC50 ${Number(d.margin.hERG.toPrecision(3))} times free Cmax`, `${d.drug}, ${d.risk} risk`);
    },
  });
  attachData('#herg-chart', 'herg-margins', ['Drug', 'Risk', 'hERG margin'], rows.map((r) => [r.drug, r.risk, r.margin.hERG]));
};

const BAND_COLORS = {
  p1: 'var(--s2)', p2: 'var(--s4)', p3: 'var(--s1)', p4: 'var(--s3)', na: 'var(--data)',
};

const plainHead = (s) => s.replaceAll(',', '');
const percentOf = (v) => Number((v * 100).toFixed(1));

const renderRegistry = () => {
  const t = snapshot.trials;
  const r = registrations(snapshot);
  const at = (year) => r.totals[r.years.indexOf(year)];
  const status = statusRows(snapshot);
  const unknown = status.find((s) => s.key === 'UNKNOWN')?.n ?? 0;
  const results = t.fields.HasResults.values.find((v) => v.value === 'true')?.n ?? 0;
  const last = r.years.at(-1);
  $('#registry-dek').textContent = `Drug and biologic trials first posted rose from ${exact(at(2004))} in 2004 to ${exact(at(2005))} in 2005, the year ICMJE journals made registration a condition of publication, and numbered ${exact(at(last))} in ${last}. ${exact(r.before)} carry first-posted dates before the registry opened to the public in February 2000. Of all ${exact(t.total)} studies, ${pct(results / t.total)} have posted results and ${pct(unknown / t.total)} have an unknown status.`;
  stackedArea({
    mount: $('#registry-chart'),
    years: r.years,
    series: r.bands.map((b) => ({
      key: b.key, label: b.label, color: BAND_COLORS[b.key], values: b.values,
    })),
    aria: 'Drug and biologic trials first posted each year, by phase',
  });
  attachData('#registry-chart', 'trial-registrations', ['Year', ...r.bands.map((b) => b.label), 'All'], r.years.map((y, i) => [y, ...r.bands.map((b) => b.values[i]), r.totals[i]]));
  dotplot({
    mount: $('#status-chart'),
    rows: status.map((s) => ({
      key: s.key, label: s.label, value: s.n, hi: s.key === 'UNKNOWN',
    })),
    labelShare: 0.42,
    aria: 'Studies on ClinicalTrials.gov by overall status',
    describe: (row) => tipLines(plural(row.value, 'study', 'studies'), row.label, `${pct(row.value / t.total)} of all studies`),
  });
  attachData('#status-chart', 'study-statuses', ['Status', 'Studies'], status.map((s) => [s.label, s.n]));
};

const renderDesign = () => {
  const d = designShares(snapshot);
  const e = enrollmentShares(snapshot);
  const gi = (k) => d.groups.findIndex((g) => g.key === k);
  const at = (g, f) => d.shares[gi(g)][d.features.findIndex((x) => x.key === f)];
  const small = (g) => e.shares[gi(g)][0] + e.shares[gi(g)][1];
  const large = (g) => e.shares[gi(g)][4] + e.shares[gi(g)][5];
  $('#design-dek').textContent = `From phase 1 to phase 3 the share randomized rises from ${pct(at('p1', 'randomized'))} to ${pct(at('p3', 'randomized'))}, and the share with a placebo arm from ${pct(at('p1', 'placebo'))} to ${pct(at('p3', 'placebo'))}. Industry leads ${pct(at('p1', 'industry'))} of phase 1 trials and ${pct(at('p4', 'industry'))} of phase 4. ${pct(small('p1'))} of phase 1 trials enrol 50 people or fewer, and ${pct(large('p3'))} of phase 3 trials more than 300. Of completed trials, ${pct(at('p3', 'results'))} in phase 3 have posted results and ${pct(at('p1', 'results'))} in phase 1, which the law does not require to report.`;
  const whole = (v) => String(Math.round(v * 100));
  grid({
    mount: $('#design-chart'),
    rows: d.groups.map((g) => g.label),
    cols: d.features.map((f) => f.label),
    values: d.shares,
    color: 'var(--s2)',
    shade: (v) => heatShade(v, 1),
    format: whole,
    aria: 'Design features of drug trials by phase',
    describe: (i, j) => {
      const row = snapshot.trials.design.find((x) => x.key === d.groups[i].key);
      return tipLines(pct(d.shares[i][j]), `${d.groups[i].label} trials: ${d.features[j].label}`, `${exact(row.features[j])} of ${exact(j === d.features.length - 1 ? row.completed : row.total)}`);
    },
  });
  attachData('#design-chart', 'trial-design', ['Phase', 'Trials', 'Completed', ...d.features.map((f) => `${plainHead(f.label)} %`)], d.groups.map((g, i) => {
    const row = snapshot.trials.design.find((x) => x.key === g.key);
    return [g.label, row.total, row.completed, ...d.shares[i].map(percentOf)];
  }));
  grid({
    mount: $('#enrollment-chart'),
    rows: d.groups.map((g) => g.label),
    cols: e.bins.map((b) => b.label),
    values: e.shares,
    color: 'var(--s4)',
    shade: (v) => heatShade(v, 0.6),
    format: whole,
    aria: 'Enrollment of drug trials by phase',
    describe: (i, j) => tipLines(pct(e.shares[i][j]), `${d.groups[i].label} trials enrolling ${e.bins[j].label}`),
  });
  attachData('#enrollment-chart', 'trial-enrollment', ['Phase', ...e.bins.map((b) => `${plainHead(b.label)} %`)], d.groups.map((g, i) => [g.label, ...e.shares[i].map(percentOf)]));
};

const SPONSOR_COLORS = {
  industry: 'var(--s2)', federal: 'var(--s4)', other: 'var(--s3)', certified: 'var(--data)',
};

const renderReporting = () => {
  const R = snapshot.reporting;
  const list = reportingCurves(snapshot, 60);
  const by = Object.fromEntries(list.map((c) => [c.key, c]));
  const cert = R.groups.find((g) => g.key === 'certified');
  const month = (m) => (m === null ? 'none yet' : String(m));
  $('#reporting-dek').textContent = `A year after primary completion, ${pct(by.industry.at12)} of industry trials had submitted results, against ${pct(by.federal.at12)} of NIH and other federal trials and ${pct(by.other.at12)} of those led by universities, hospitals and others; half had submitted by months ${month(by.industry.median)}, ${month(by.federal.median)} and ${month(by.other.median)}. The ${exact(cert.n)} trials that filed a certification or extension request to delay, ${exact(cert.sponsors.industry)} of them industry’s, are not in those shares. By ${day(R.asOf)}, ${pct(1 - by.industry.ever)} of industry trials and ${pct(1 - by.other.ever)} of academic and other trials still had none. DeVito et al. counted 40.9% on time among trials due by September 2019.`;
  curves({
    mount: $('#reporting-chart'),
    series: list.map((c) => ({ label: c.label, color: SPONSOR_COLORS[c.key], points: c.points })),
    xDomain: [0, 60],
    yDomain: [0, 1],
    xTicks: [0, 12, 24, 36, 48, 60],
    xLabel: 'months after primary completion',
    yLabel: 'submitted results',
    marks: [{ x: 12, label: 'one year' }],
    aria: 'Share of FDA-regulated drug trials that had submitted results, by months after primary completion',
    describe: (i) => tipLines(`${i} months after primary completion`, ...list.map((c) => `${c.label}: ${pct(c.points[i].y)} of ${exact(c.n)}`)),
  });
  attachData('#reporting-chart', 'results-submission', ['Months', ...list.map((c) => `${c.label} %`)], list[0].points.map((p, i) => [p.x, ...list.map((c) => percentOf(c.points[i].y))]));
};

const renderAttrition = () => {
  const A = ATTRITION;
  const w = RD_COST.wouters2020;
  const dm = RD_COST.dimasi2016;
  const onc = A.groups.find((g) => g.label === 'Oncology');
  const all = [...A.groups, A.overall, A.withoutOncology];
  const byPhase = A.estimates.find((x) => x.label === 'Wong 2019, phase by phase');
  $('#attrition-dek').textContent = `Path by path, Wong et al. estimate that ${A.overall.p1a}% of programs in phase 1 reach approval; counted phase by phase, as earlier studies did, ${byPhase.p1a}%. Oncology’s rate was ${onc.p1a}%, against ${A.oncology.prior}% in earlier studies; year by year it fell to ${A.oncology.byYear[2012]}% in 2012, then rose to ${A.oncology.byYear[2014]}% in 2014 and ${A.oncology.byYear[2015]}% in 2015. Oncology programs that chose patients by biomarker reached approval ${A.biomarker.with}% of the time, against ${A.biomarker.without}% without, in 2005 to 2015, and orphan programs ${A.orphan.overall}%. Counting the failures, a new drug cost a median $${Math.round(w.median)} million in 2018 dollars, across the ${w.withData} of ${w.approvals} FDA approvals of 2009 to 2018 with public figures, and an average $${(dm.capitalized / 1000).toFixed(2)} billion in 2013 dollars in a survey of ${dm.firms} firms.`;
  const pathsOf = (label) => all.find((g) => g.label === label)?.paths;
  forest({
    mount: $('#attrition-chart'),
    groups: attritionForest(),
    reference: A.overall.p1a,
    format: (v) => `${decimal(v, 1)}%`,
    aria: 'Probability of approval from phase 1 by therapeutic group, Wong, Siah and Lo 2019',
    describe: (r) => tipLines(`${r.rs}% reach approval`, r.label, `95% interval ${r.lo}% to ${r.hi}%`, `${exact(pathsOf(r.label))} development paths`),
  });
  attachData('#attrition-chart', 'success-rates', ['Therapeutic group', 'Paths from phase 1', 'Phase 1 to 2 %', 'Phase 2 to 3 %', 'Phase 2 to approval %', 'Phase 3 to approval %', 'Phase 1 to approval %', 'Standard error %'], all.map((g) => [g.label, g.paths, g.p12, g.p23, g.p2a, g.p3a, g.p1a, g.se]));
  const steps = [['p12', '1 to 2'], ['p23', '2 to 3'], ['p3a', '3 to approval'], ['p1a', '1 to approval']];
  grid({
    mount: $('#transitions-chart'),
    rows: all.map((g) => g.label),
    cols: steps.map(([, label]) => label),
    values: all.map((g) => steps.map(([k]) => g[k])),
    color: 'var(--s4)',
    shade: (v) => heatShade(v, 100),
    format: (v) => decimal(v, 1),
    aria: 'Phase transition probabilities by therapeutic group, Wong, Siah and Lo 2019',
    describe: (i, j) => tipLines(`${all[i][steps[j][0]]}%`, `${all[i].label}, phase ${steps[j][1]}`),
  });
  attachData('#transitions-chart', 'phase-transitions', ['Therapeutic group', ...steps.map(([, label]) => `Phase ${label} %`)], all.map((g) => [g.label, ...steps.map(([k]) => g[k])]));
  dotplot({
    mount: $('#estimates-chart'),
    rows: A.estimates.map((x) => ({
      key: x.label, label: `${x.label}, ${x.span}`, value: x.p1a, hi: x.label.startsWith('Wong'),
    })),
    scale: 'linear',
    labelShare: 0.5,
    labelMax: 300,
    format: (v) => `${decimal(v, 1)}%`,
    aria: 'Published estimates of the probability of approval from phase 1',
    describe: (row) => {
      const x = A.estimates.find((y) => y.label === row.key);
      return tipLines(`${x.p1a}% from phase 1 to approval`, `${x.label}, ${x.scope}, ${x.span}`, `phase 1 to 2 ${x.p12}%, 2 to 3 ${x.p23}%, 3 to approval ${x.p3a}%`);
    },
  });
  attachData('#estimates-chart', 'success-rate-estimates', ['Estimate', 'Scope', 'Years', 'Phase 1 to 2 %', 'Phase 2 to 3 %', 'Phase 3 to approval %', 'Phase 1 to approval %'], A.estimates.map((x) => [x.label, x.scope, x.span, x.p12, x.p23, x.p3a, x.p1a]));
};

const COMPOUND_STYLE = {
  psilocybin: { color: 'var(--s1)' },
  mdma: { color: 'var(--s2)' },
  lsd: { color: 'var(--s5)' },
  dmt: { color: 'var(--s4)', short: 'DMT, ayahuasca' },
  meodmt: { color: 'var(--s3)' },
  ibogaine: { color: 'var(--data)' },
  ketamine: { color: 'var(--ink-2)', short: 'ketamine' },
  cbd: { color: 'var(--s4)' },
  thc: { color: 'var(--s3)', short: 'THC and analogues' },
  cannabis: { color: 'var(--s1)' },
};

const peakOf = (s) => s.rows.reduce((a, b) => (b.y > a.y ? b : a));

const drawCompounds = (mountSel, name, list, aria) => {
  lines({
    mount: $(mountSel),
    series: list.map((s) => ({
      label: COMPOUND_STYLE[s.key]?.short ?? s.label, color: COMPOUND_STYLE[s.key]?.color, rows: s.rows,
    })),
    scale: 'linear',
    labelW: 124,
    aria,
    describe: (x) => tipLines(`Trials starting in ${x}`, ...list.map((s) => `${s.label}: ${s.rows.find((r) => r.x === x).y}`)),
  });
  attachData(mountSel, name, ['Year', ...list.map((s) => plainHead(s.label))], list[0].rows.map((r, i) => [r.x, ...list.map((s) => s.rows[i].y)]));
};

const renderPsychedelics = () => {
  const last = snapshot.trials.years.at(-1);
  const psy = psychoactiveSeries(snapshot, 'psychedelics', 2000, last);
  const can = psychoactiveSeries(snapshot, 'cannabinoids', 2000, last);
  const by = Object.fromEntries([...psy, ...can].map((s) => [s.key, s]));
  const late = (s) => s.phases.p3 + s.phases.p23;
  const cbd = peakOf(by.cbd);
  $('#psychedelics-dek').textContent = `ClinicalTrials.gov lists ${exact(by.psilocybin.trials)} interventional trials of psilocybin, ${exact(late(by.psilocybin))} of them in phase 3 or 2/3; ${exact(by.mdma.trials)} of MDMA, ${exact(late(by.mdma))} late-phase; and ${exact(by.lsd.trials)} of LSD, ${exact(late(by.lsd))} late-phase. Ketamine and esketamine have ${exact(by.ketamine.trials)} trials in depression. Among cannabinoids, ${exact(by.cbd.trials)} trials name cannabidiol, and the most started in ${cbd.x}, ${exact(cbd.y)} of them. The lines end with ${last}; the totals include trials planned to start later.`;
  drawCompounds('#psychedelics-chart', 'psychedelic-trials', psy, 'Psychedelic trials by start year');
  drawCompounds('#cannabinoids-chart', 'cannabinoid-trials', can, 'Cannabinoid trials by start year');
};

const decode = () => {
  const value = $('#decoder-input').value;
  if (!value.trim()) {
    fill('#decoder-out', h('p', { class: 'none' }, 'Type an identifier, or pick an example below.'));
    return;
  }
  const hit = identify(value, { atc: snapshot.chembl.atc });
  if (!hit) {
    fill('#decoder-out', h('p', { class: 'none' }, `No match for “${value.trim()}”.`));
    return;
  }
  const known = EXAMPLES.find((e) => identify(e.id)?.id === hit.id)?.is;
  fill('#decoder-out', h('dl', {},
    h('dt', {}, 'Type'), h('dd', {}, h('span', { class: 'type' }, hit.type)),
    h('dt', {}, 'ID'), h('dd', {}, h('code', {}, hit.id)),
    h('dt', {}, 'Source'), h('dd', {}, hit.db),
    h('dt', {}, 'Format'), h('dd', {}, hit.note),
    ...hit.parts.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]),
    known && h('dt', {}, 'Known as'), known && h('dd', {}, known),
    h('dt', {}, 'Open'), h('dd', {}, ext(hit.url, hit.url))));
};

const renderDecoder = () => {
  fill('#examples', ...EXAMPLES.map((e) => h('button', { type: 'button', class: 'example', 'data-id': e.id, title: e.is }, e.id)));
  $('#examples').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-id]');
    if (!btn) return;
    $('#decoder-input').value = btn.dataset.id;
    decode();
  });
  $('#decoder-input').addEventListener('input', decode);
  decode();
};

const DATA_SOURCES = [
  ['ChEMBL status API, release and counts', FILES.chemblStatus],
  ['ChEMBL approved drugs at maximum phase 4, with structures and properties', FILES.chemblApproved],
  ['ChEMBL ATC classification', FILES.chemblAtc],
  ['ChEMBL mechanisms of action of approved drugs', FILES.chemblMechanisms],
  ['ChEMBL targets, looked up by ID', FILES.chemblTargets],
  ['ChEMBL target components and their protein classes', FILES.chemblComponents],
  ['ChEMBL protein classification', FILES.chemblClasses],
  ['ChEMBL activities from Davis et al. 2011', FILES.davis],
  ['GtoPdb targets and families', FILES.gtopdbTargets],
  ['GtoPdb interactions', FILES.gtopdbInteractions],
  ['RCSB PDB search API, releases by year and method', FILES.rcsbSearch],
  ['GPCRdb structures', FILES.gpcrdb],
  ['ClinVar gene-specific summary', FILES.clinvarGenes],
  ['HGNC protein-coding genes', FILES.hgncCoding],
  ['Minikel et al. 2024 display tables', GENETIC_SUPPORT.data],
  ['ChEMBL activity search index, aggregations and document records', FILES.chemblSearch],
  ['ChEMBL data sources', FILES.chemblSources],
  ['NCI-ALMANAC combination growth data', FILES.almanac],
  ['NCI-ALMANAC compound names', FILES.almanacNames],
  ['FDA table of drugs that interact with CYP enzymes and transporter systems', FILES.fdaInteractions],
  ['CiPA IC50 values, Li et al. 2017, FDA CiPA repository', FILES.cipaIc50],
  ['CiPA training drugs, free Cmax and risk, FDA CiPA repository', FILES.cipaDrugs],
  ['ClinicalTrials.gov study count', FILES.ctSize],
  ['ClinicalTrials.gov field values across all studies', FILES.ctFields],
  ['ClinicalTrials.gov studies, counted and paged by query', FILES.ctStudies],
];

const renderSources = () => {
  const host = (url) => new URL(url).hostname.replace(/^www\./, '');
  const item = (title, url) => h('li', { 'data-search': `${title} ${url}` }, ext(url, title), ' ', h('small', {}, host(url)));
  const group = (title, items) => h('div', { class: 'srcgroup' }, h('h3', {}, title), h('ul', {}, items));
  const titled = (g) => Object.entries(SOURCES).filter(([key]) => SOURCE_TITLES[key]?.[0] === g).map(([key, url]) => item(SOURCE_TITLES[key][1], url));
  fill('#source-list',
    group('Data files', DATA_SOURCES.map(([name, url]) => item(name, url))),
    ...SOURCE_GROUPS.map((g) => [g, titled(g)]).filter(([, items]) => items.length).map(([g, items]) => group(g, items)));
  const when = day(snapshot.generated);
  fill('#data-use',
    'Every number on this page, as of ', when, ', is in ', h('a', { href: 'snapshot.json', download: '' }, 'snapshot.json'),
    '. The code and the weekly rebuild are on ', ext(REPO, 'GitHub'),
    `. Cite as: Basic & Clinical Pharmacology in Numbers, snapshot of ${when}. ${SITE}`);
  fill('#foot',
    h('p', {}, `Built from public ChEMBL, GtoPdb, PDB, GPCRdb, ClinVar, HGNC, NCI and ClinicalTrials.gov data. Snapshot ${snapshot.generated.slice(0, 16).replace('T', ' ')} UTC. Not an official FDA, NIH, EMBL-EBI or WHO site.`),
    h('p', { class: 'made' }, 'Made by a person, with help from AI tools. Every line, chart and figure was reviewed before publishing; the numbers now refresh on their own each Sunday.'));
};

const SEARCHABLE = ['#source-list li', '.fig details.data tbody tr'];

const applySearch = () => {
  for (const sel of SEARCHABLE) {
    for (const node of $$(sel)) node.hidden = !matches(node.dataset.search ?? node.textContent, state.query);
  }
};

let searchTimer;
const onSearch = (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = event.target.value;
    applySearch();
  }, 120);
};

const THEME_KEY = 'basic-clinical-pharm-theme';
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const theme = () => document.documentElement.dataset.theme || (darkQuery.matches ? 'dark' : 'light');

const store = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      return false;
    }
    return true;
  },
};

const drawCharts = () => {
  renderApproved();
  renderDruglike();
  renderProperties();
  renderExtremes();
  renderRings();
  renderAtoms();
  renderStereo();
  renderStems();
  renderFlags();
  renderAtc();
  renderClasses();
  renderActions();
  renderDrugged();
  renderNetwork();
  renderGtopdb();
  renderOrphans();
  renderEnzymes();
  renderGenetics();
  renderKinome();
  renderStructures();
  renderRecord();
  renderPotency();
  renderEfficiency();
  renderAgreement();
  renderKinetics();
  renderTheory();
  renderCombinations();
  renderPk();
  renderSimulator();
  renderDdi();
  renderCipa();
  renderRegistry();
  renderDesign();
  renderReporting();
  renderAttrition();
  renderPsychedelics();
  applySearch();
};

const paintTheme = () => {
  $('#theme').textContent = theme() === 'dark' ? 'Light' : 'Dark';
  $('#theme').setAttribute('aria-pressed', String(theme() === 'dark'));
};

const initTheme = () => {
  const saved = store.get(THEME_KEY);
  if (saved) document.documentElement.dataset.theme = saved;
  paintTheme();
  darkQuery.addEventListener('change', () => {
    paintTheme();
    drawCharts();
  });
  $('#theme').addEventListener('click', () => {
    const next = theme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set(THEME_KEY, next);
    paintTheme();
    drawCharts();
  });
};

const applyLens = (lens, push) => {
  state.lens = lens;
  $$('#lenses button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lens === lens)));
  $$('main > section.story').forEach((sec) => { sec.hidden = !inLens(sec.dataset.lens, lens); });
  for (const ch of $$('main > .chapter')) {
    const members = [];
    for (let n = ch.nextElementSibling; n && !n.classList.contains('chapter'); n = n.nextElementSibling) members.push(n);
    ch.hidden = members.every((n) => n.hidden);
  }
  $$('#jump a').forEach((a) => { a.hidden = $(`#${a.dataset.for}`).hidden; });
  $('#lens-hint').textContent = LENSES.find((l) => l.id === lens).hint;
  if (push) {
    history.replaceState(null, '', `${location.pathname}${lensSearch(location.search, lens)}${location.hash}`);
    drawCharts();
  }
};

const renderLenses = () => {
  fill('#lenses', ...LENSES.map((l) => h('button', { type: 'button', 'data-lens': l.id, 'aria-pressed': 'false', title: l.hint }, l.label)));
  fill('#jump', ...$$('main > .chapter, main > section[data-nav]').map((n) => (n.classList.contains('chapter')
    ? h('a', { href: `#${n.id}`, 'data-for': n.id, class: 'jump-ch' }, $('.chapter-title', n).textContent)
    : h('a', { href: `#${n.id}`, 'data-for': n.id }, n.dataset.nav))));
  $('#lenses').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-lens]');
    if (btn) applyLens(btn.dataset.lens, true);
  });
};

let resizeTimer;
let lastWidth = 0;
const onResize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    drawCharts();
  }, 160);
};

const init = () => {
  initTheme();
  renderLenses();
  renderHead();
  renderLede();
  renderDecoder();
  renderSources();
  initTheory();
  drawCharts();
  applyLens(readLens(location.search), false);
  observeFigures();
  lastWidth = window.innerWidth;
  window.addEventListener('resize', onResize);
  $('#q').addEventListener('input', onSearch);
};

init();

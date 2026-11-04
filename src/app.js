import snapshot from './snapshot.js';
import {
  SOURCES, SOURCE_TITLES, SOURCE_GROUPS, EXAMPLES, LANDMARKS,
} from './facts.js';
import {
  exact, compact, pct, daltons, identify, matches, LENSES, readLens, inLens, lensSearch, toCsv, longDate, soften, decimal,
} from './lib.js';
import { linearEdges, histogram, summary } from './stats.js';
import { unpackMol } from './chem.js';
import { FILES } from './queries.js';
import {
  findings, release, smallMolecules, propertyByDecade, elementShares, elementByDecade, ringCounts, chiralityByDecade, stemCounts, flagCounts, atcGroups, typeGroups, systemName, drugName,
} from './findings.js';
import {
  hbars, dotplot, stackedArea, waffle, columns, histo, lines, treemap, hexmap, boxes, molgrid, observeFigures, countUp, tipLines,
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
    items: groups.map((g, i) => ({ key: g.code, label: `${g.code} ${capital(soften(g.name))}`, sub: `${exact(g.n)} drugs`, value: g.n, color: CAT[i % CAT.length] })),
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
    h('p', {}, `Built from public ChEMBL data. Snapshot ${snapshot.generated.slice(0, 16).replace('T', ' ')} UTC. Not an official FDA, NIH, EMBL-EBI or WHO site.`),
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
  drawCharts();
  applyLens(readLens(location.search), false);
  observeFigures();
  lastWidth = window.innerWidth;
  window.addEventListener('resize', onResize);
  $('#q').addEventListener('input', onSearch);
};

init();

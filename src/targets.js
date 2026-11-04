import { exact, pct, runs } from './lib.js';
import { summary, quantile } from './stats.js';

const lower = (s) => String(s ?? '').toLowerCase();
const capital = (s) => (s ? `${s[0].toUpperCase()}${s.slice(1)}` : s);
export const softName = (s) => (s && s.length > 1 && s[1] !== s[1].toUpperCase() ? `${s[0].toLowerCase()}${s.slice(1)}` : s);
const tidy = (v) => Number(v.toPrecision(12));

export const TARGET_FAMILIES = [
  'GPCR', 'Ion channel', 'Kinase', 'Nuclear receptor', 'Protease', 'Other enzyme', 'Transporter', 'Other receptor', 'Epigenetic regulator', 'Other protein',
  'Ribosome', 'Nucleic acid', 'Non-protein molecule', 'Organism or cell', 'Unclassified',
];
const ENZYMES = new Set(['Kinase', 'Protease', 'Other enzyme']);
const OWN_BRANCH = new Set(['Ribosome', 'Nucleic acid', 'Non-protein molecule', 'Organism or cell', 'Unclassified']);

const targetsOf = (snap) => snap.targets.targets;
const mechanismsOf = (snap) => snap.targets.mechanisms;
const index = (snap) => new Map(targetsOf(snap).map((t) => [t.id, t]));
const familyOf = (snap) => {
  const ix = index(snap);
  return (id) => ix.get(id)?.family ?? 'Unclassified';
};

const sets = (pairs) => {
  const out = new Map();
  for (const [k, v] of pairs) {
    if (!out.has(k)) out.set(k, new Set());
    out.get(k).add(v);
  }
  return out;
};

export const familyCounts = (snap) => {
  const fam = familyOf(snap);
  const drugs = sets(mechanismsOf(snap).map((m) => [fam(m.target), m.drug]));
  const targets = sets(targetsOf(snap).map((t) => [t.family, t.id]));
  return [...targets.keys()].map((family) => ({ family, drugs: drugs.get(family)?.size ?? 0, targets: targets.get(family).size }))
    .sort((a, b) => b.drugs - a.drugs || a.family.localeCompare(b.family));
};

const actionOf = (m) => m.action ?? 'UNKNOWN';

export const actionCounts = (snap) => {
  const drugs = sets(mechanismsOf(snap).map((m) => [actionOf(m), m.drug]));
  const pairs = new Map();
  for (const m of mechanismsOf(snap)) pairs.set(actionOf(m), (pairs.get(actionOf(m)) ?? 0) + 1);
  return [...pairs].map(([action, n]) => ({ action, pairs: n, drugs: drugs.get(action).size })).sort((a, b) => b.pairs - a.pairs || a.action.localeCompare(b.action));
};

export const familyActions = (snap, top = 8) => {
  const actions = actionCounts(snap).slice(0, top).map((a) => a.action);
  const families = familyCounts(snap).map((f) => f.family);
  const fam = familyOf(snap);
  const counts = families.map(() => Array(actions.length + 1).fill(0));
  for (const m of mechanismsOf(snap)) {
    const a = actions.indexOf(actionOf(m));
    counts[families.indexOf(fam(m.target))][a < 0 ? actions.length : a] += 1;
  }
  return { families, actions: [...actions, 'REST'], counts };
};

export const topTargets = (snap, n = 25) => {
  const names = new Map(snap.drugs.map((d) => [d.id, lower(d.name)]));
  const ix = index(snap);
  return [...sets(mechanismsOf(snap).map((m) => [m.target, m.drug]))].map(([id, drugs]) => ({
    id, name: ix.get(id)?.name ?? id, family: ix.get(id)?.family ?? 'Unclassified', drugs: drugs.size, examples: [...drugs].slice(0, 3).map((d) => names.get(d) ?? d),
  })).sort((a, b) => b.drugs - a.drugs || a.name.localeCompare(b.name)).slice(0, n);
};

const PER_TARGET = [[1, 1, '1'], [2, 2, '2'], [3, 5, '3–5'], [6, 10, '6–10'], [11, 20, '11–20'], [21, 50, '21–50'], [51, Infinity, '51+']];
const PER_DRUG = [[1, 1, '1'], [2, 2, '2'], [3, 3, '3'], [4, 5, '4–5'], [6, 10, '6–10'], [11, Infinity, '11+']];

const binned = (sizes, edges) => edges.map(([lo, hi, label]) => ({
  label, lo, hi, n: sizes.filter((v) => v >= lo && v <= hi).length,
}));

export const degreeBins = (snap) => ({
  perTarget: binned([...sets(mechanismsOf(snap).map((m) => [m.target, m.drug])).values()].map((s) => s.size), PER_TARGET),
  perDrug: binned([...sets(mechanismsOf(snap).map((m) => [m.drug, m.target])).values()].map((s) => s.size), PER_DRUG),
});

export const targetHierarchy = (snap, depth = 4) => {
  const ix = index(snap);
  const node = (name) => ({
    name, value: 0, drugSet: new Set(), targetSet: new Set(), kids: new Map(),
  });
  const root = node('All targets');
  for (const m of mechanismsOf(snap)) {
    const t = ix.get(m.target);
    const family = t?.family ?? 'Unclassified';
    const path = (OWN_BRANCH.has(family) || !t?.path?.length ? [family] : t.path).slice(0, depth);
    const visit = (n) => {
      n.value += 1;
      n.drugSet.add(m.drug);
      n.targetSet.add(m.target);
    };
    let at = root;
    visit(at);
    for (const name of path) {
      if (!at.kids.has(name)) at.kids.set(name, node(name));
      at = at.kids.get(name);
      visit(at);
    }
  }
  const out = (n, trail) => ({
    name: n.name,
    path: trail,
    value: n.value,
    drugs: n.drugSet.size,
    targets: n.targetSet.size,
    children: [...n.kids.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).map((k) => out(k, [...trail, k.name])),
  });
  return out(root, []);
};

export const classCounts = (snap, prefix, depth) => {
  const ix = index(snap);
  const inside = (t) => t && prefix.every((p, i) => t.path[i] === p);
  const keyOf = (t) => t.path[depth] ?? `${t.path[depth - 1]}, not further classed`;
  const targets = sets(targetsOf(snap).filter(inside).map((t) => [keyOf(t), t.id]));
  const drugs = sets(mechanismsOf(snap).filter((m) => inside(ix.get(m.target))).map((m) => [keyOf(ix.get(m.target)), m.drug]));
  return [...targets].map(([name, set]) => ({ name, targets: set.size, drugs: drugs.get(name)?.size ?? 0 }))
    .sort((a, b) => b.drugs - a.drugs || b.targets - a.targets || a.name.localeCompare(b.name));
};

export const EC_CLASSES = [['1', 'oxidoreductases'], ['2', 'transferases'], ['3', 'hydrolases'], ['4', 'lyases'], ['5', 'isomerases'], ['6', 'ligases'], ['7', 'translocases']];

export const ecCounts = (snap) => {
  const ix = index(snap);
  const classesOf = (t) => new Set((t?.ec ?? []).map((e) => e.split('.')[0]));
  return EC_CLASSES.map(([ec, name]) => ({
    ec,
    name,
    targets: targetsOf(snap).filter((t) => classesOf(t).has(ec)).length,
    drugs: new Set(mechanismsOf(snap).filter((m) => classesOf(ix.get(m.target)).has(ec)).map((m) => m.drug)).size,
  }));
};

export const networkGraph = (snap) => {
  const N = snap.network;
  const ix = index(snap);
  const drugs = new Map(snap.drugs.map((d) => [d.id, d]));
  const degree = new Array(N.nodes.length).fill(0);
  for (const [a, b] of N.edges) {
    degree[a] += 1;
    degree[b] += 1;
  }
  return {
    nodes: N.nodes.map(([id, x, y], i) => (i < N.drugs
      ? {
        id, kind: 'drug', name: lower(drugs.get(id)?.name ?? id), group: drugs.get(id)?.atc?.[0]?.[0] ?? null, degree: degree[i], x, y,
      }
      : {
        id, kind: 'target', name: ix.get(id)?.name ?? id, group: ix.get(id)?.family ?? 'Unclassified', degree: degree[i], x, y,
      })),
    edges: N.edges,
  };
};

export const GTOPDB_TYPES = [
  ['gpcr', 'GPCRs'], ['nhr', 'nuclear hormone receptors'], ['lgic', 'ligand-gated ion channels'], ['vgic', 'voltage-gated ion channels'], ['other_ic', 'other ion channels'],
  ['catalytic_receptor', 'catalytic receptors'], ['enzyme', 'enzymes'], ['transporter', 'transporters'], ['other_protein', 'other proteins'],
];

export const gtopdbRows = (snap) => GTOPDB_TYPES.filter(([type]) => snap.gtopdb.types[type]).map(([type, label]) => {
  const t = snap.gtopdb.types[type];
  return {
    type, label, targets: t.targets, approved: t.approved, otherLigand: t.ligand - t.approved, none: t.targets - t.ligand, orphans: t.orphans, endogenous: t.endogenous,
  };
});

export const affinityByType = (snap, min = 10) => GTOPDB_TYPES.map(([type, label]) => {
  const values = snap.gtopdb.affinities.filter((a) => a.type === type).map((a) => a.value).sort((a, b) => a - b);
  if (values.length < min) return null;
  const s = summary(values);
  return {
    type, label, n: values.length, lo: tidy(quantile(values, 0.05)), q1: tidy(s.q1), median: tidy(s.median), q3: tidy(s.q3), hi: tidy(quantile(values, 0.95)),
  };
}).filter(Boolean);

export const kinomeGroups = (snap) => runs(snap.kinome.kinases, (k) => k.group);

export const kinomeOrder = (snap) => {
  const list = snap.kinome.inhibitors;
  return list.map((_, i) => i).sort((a, b) => list[a].s3 - list[b].s3 || list[a].name.localeCompare(list[b].name));
};

const plural = (s) => `${s}s`;

const classesFinding = (snap) => {
  const gpcr = familyCounts(snap).find((f) => f.family === 'GPCR')?.drugs ?? 0;
  const fam = familyOf(snap);
  const enzymes = new Set(mechanismsOf(snap).filter((m) => ENZYMES.has(fam(m.target))).map((m) => m.drug)).size;
  return `Approved drugs act on ${exact(targetsOf(snap).length)} ChEMBL targets; ${exact(gpcr)} drugs act on a GPCR and ${exact(enzymes)} on an enzyme`;
};

const actionsFinding = (snap) => {
  const [a, b, c] = actionCounts(snap);
  const total = mechanismsOf(snap).length;
  const share = (x) => pct(x.pairs / total);
  return `${share(a)} of approved drug–target pairs are ${plural(lower(a.action))}; ${share(b)} ${plural(lower(b.action))} and ${share(c)} ${plural(lower(c.action))}`;
};

const druggedFinding = (snap) => {
  const [top] = topTargets(snap, 1);
  const single = degreeBins(snap).perTarget[0].n;
  return `The ${softName(top.name)} is the target of ${exact(top.drugs)} approved drugs, the most; ${exact(single)} of ${exact(targetsOf(snap).length)} targets have one`;
};

const networkFinding = (snap) => {
  const g = networkGraph(snap);
  const drugs = g.nodes.filter((n) => n.kind === 'drug');
  const one = drugs.filter((n) => n.degree === 1).length;
  return `${exact(g.edges.length)} drug–target links join ${exact(drugs.length)} approved drugs to ${exact(g.nodes.length - drugs.length)} targets; ${pct(one / drugs.length)} of those drugs have one target`;
};

const gtopdbFinding = (snap) => {
  const rows = gtopdbRows(snap);
  const sum = (key) => rows.reduce((n, r) => n + r[key], 0);
  return `GtoPdb ${snap.gtopdb.version} lists ${exact(sum('targets'))} targets; ${exact(sum('approved'))} have an approved drug among their human ligands`;
};

const orphansFinding = (snap) => {
  const endo = snap.gtopdb.endogenous;
  const total = Object.values(endo).reduce((a, b) => a + b, 0);
  return `GtoPdb counts ${exact(snap.gtopdb.types.gpcr?.orphans ?? 0)} orphan GPCRs, with no confirmed endogenous ligand; ${exact(endo.Peptide ?? 0)} of ${exact(total)} endogenous ligands are peptides`;
};

const enzymesFinding = (snap) => {
  const [top] = classCounts(snap, ['Enzyme'], 1);
  return `${capital(plural(softName(top.name)))} carry the most approved drugs of any enzyme class, ${exact(top.drugs)}, across ${exact(top.targets)} ${top.targets === 1 ? 'target' : 'targets'}`;
};

const geneticsFinding = (snap) => {
  const g = snap.genetics;
  return `${pct(g.targets.pathogenic / g.targets.genes)} of genes for approved-drug targets have a pathogenic or likely pathogenic ClinVar variant; ${pct(g.all.pathogenic / g.all.genes)} of all protein-coding genes do`;
};

const kinomeFinding = (snap) => {
  const K = snap.kinome;
  const order = kinomeOrder(snap);
  const [least, most] = [K.inhibitors[order[0]], K.inhibitors[order.at(-1)]];
  const wild = K.kinases.filter((k) => !k.variant).length;
  return `In Davis 2011, ${lower(most.name)} binds ${exact(most.hits)} of ${exact(wild)} wild-type kinases with Kd below 3 µM; ${lower(least.name)} binds ${exact(least.hits)}`;
};

export const lastFullYear = (snap) => Number(String(snap.generated).slice(0, 4)) - 1;

const structuresFinding = (snap) => {
  const P = snap.structures.pdb;
  const year = lastFullYear(snap);
  const i = P.years.indexOf(year);
  const total = Object.values(P.methods).reduce((n, v) => n + v[i], 0);
  return `The PDB holds ${exact(P.total)} experimental structures; electron microscopy solved ${pct(P.methods['Electron microscopy'][i] / total)} of those released in ${year}`;
};

export const targetFindings = (snap) => ({
  classes: classesFinding(snap),
  actions: actionsFinding(snap),
  drugged: druggedFinding(snap),
  network: networkFinding(snap),
  gtopdb: gtopdbFinding(snap),
  orphans: orphansFinding(snap),
  enzymes: enzymesFinding(snap),
  genetics: geneticsFinding(snap),
  kinome: kinomeFinding(snap),
  structures: structuresFinding(snap),
});

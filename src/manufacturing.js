import { exact, pct } from './lib.js';
import { SOLVENTS, ELEMENTS } from './facts.js';

export const RECALL_LABELS = {
  sterility: 'lack of sterility assurance',
  cgmp: 'CGMP and process control',
  labeling: 'labeling and mix-ups',
  microbial: 'microbial contamination',
  potency: 'potency',
  impurity: 'other impurities',
  particulate: 'particulates and precipitates',
  cross: 'cross-contamination',
  unapproved: 'unapproved or tainted products',
  nitrosamine: 'nitrosamines',
  dissolution: 'dissolution',
  container: 'container and delivery',
  stability: 'stability and expiry',
  other: 'other',
};

const CLASSES = ['I', 'II', 'III'];

export const recallSeries = (snap) => ({
  years: snap.recalls.years,
  series: CLASSES.map((c) => ({ key: c, label: `Class ${c}`, values: snap.recalls.byClass[c] })),
});

export const recallCauses = (snap) => snap.recalls.reasons.map((r) => ({
  key: r.key, label: RECALL_LABELS[r.key] ?? r.key, n: r.n, share: Number((r.n / snap.recalls.total).toFixed(6)), I: r.I, II: r.II, III: r.III,
}));

export const NITROSAMINE_LABELS = {
  sartans: 'sartans', h2: 'ranitidine and nizatidine', metformin: 'metformin', varenicline: 'varenicline', other: 'other drugs',
};

export const nitrosamineSeries = (snap, lastYear) => {
  const by = snap.nitrosamines.recalls.byYear;
  const first = Math.min(...Object.keys(by).map(Number));
  const years = Array.from({ length: Math.max(0, lastYear - first + 1) }, (_, i) => first + i);
  return {
    years,
    series: Object.entries(NITROSAMINE_LABELS).map(([key, label]) => ({ key, label, values: years.map((y) => by[y]?.[key] ?? 0) })),
  };
};

export const CPCA = {
  1: 26.5, 2: 100, 3: 400, 4: 1500, 5: 1500,
};

export const potencyCategories = (snap) => Object.entries(CPCA).map(([category, limit]) => ({
  category: Number(category), limit, n: snap.nitrosamines.limits.filter((l) => l.category === Number(category)).length,
}));

const SEVERAL = /^multiple\b/i;

export const ndsriSources = (snap, top = 15) => {
  const m = new Map();
  for (const l of snap.nitrosamines.limits.filter((x) => !SEVERAL.test(x.source))) m.set(l.source, (m.get(l.source) ?? 0) + 1);
  return [...m].map(([source, n]) => ({ source, n })).sort((a, b) => b.n - a.n || a.source.localeCompare(b.source)).slice(0, top);
};

const INJECTABLE = /inject/i;

export const shortageView = (snap) => {
  const drugs = snap.shortages.drugs;
  const current = drugs.filter((d) => d.status === 'Current');
  const leaving = drugs.filter((d) => d.status === 'To Be Discontinued');
  const names = [...new Set([...current, ...leaving].flatMap((d) => d.categories))];
  const posted = {};
  for (const d of current) if (d.posted) posted[d.posted.slice(0, 4)] = (posted[d.posted.slice(0, 4)] ?? 0) + 1;
  return {
    current: current.length,
    injectable: current.filter((d) => d.forms.some((f) => INJECTABLE.test(f))).length,
    discontinuing: leaving.length,
    resolved: drugs.filter((d) => d.status === 'Resolved').length,
    categories: names.map((name) => ({ name, current: current.filter((d) => d.categories.includes(name)).length, discontinuing: leaving.filter((d) => d.categories.includes(name)).length }))
      .sort((a, b) => b.current - a.current || b.discontinuing - a.discontinuing || a.name.localeCompare(b.name)),
    posted,
    oldest: current.filter((d) => d.posted).sort((a, b) => a.posted.localeCompare(b.posted) || a.name.localeCompare(b.name)).slice(0, 10).map((d) => ({ name: d.name, posted: d.posted })),
  };
};

const ROUTES = ['oral', 'parenteral', 'inhalation'];

export const elementGrid = () => ({
  routes: ROUTES,
  rows: ELEMENTS.rows.map((r) => `${r.el}, ${r.name}`),
  classes: ELEMENTS.rows.map((r) => r.cls),
  values: ELEMENTS.rows.map((r) => ROUTES.map((k) => r[k])),
});

const recallsFinding = (snap) => {
  const top = recallCauses(snap)[0];
  return `openFDA lists ${exact(snap.recalls.total)} recalled drug products since ${snap.recalls.years[0]}; ${pct(top.share)} were recalled for ${top.label}`;
};

const nitrosaminesFinding = (snap) => {
  const n = snap.nitrosamines;
  const first = Math.min(...Object.keys(n.recalls.byYear).map(Number));
  return `${exact(n.recalls.total)} drug recalls since ${first} cite nitrosamines; FDA sets acceptable intakes for ${exact(n.limits.length)} drug-specific nitrosamines`;
};

const shortagesFinding = (snap) => {
  const v = shortageView(snap);
  return `${exact(v.current)} drugs are in shortage on FDA’s list, ${exact(v.injectable)} of them injectable, and ${exact(v.discontinuing)} more ${v.discontinuing === 1 ? 'is' : 'are'} being discontinued`;
};

const excipientsFinding = (snap) => {
  const e = snap.excipients;
  const oral = e.routes.find((r) => r.route === 'ORAL')?.ingredients ?? 0;
  return `FDA’s Inactive Ingredient Database lists ${exact(e.ingredients)} excipients in ${exact(e.rows)} route and dosage form limits; ${exact(oral)} are accepted orally`;
};

const limitsFinding = () => {
  const benzene = SOLVENTS.class1.find((s) => s.name === 'benzene');
  const methanol = SOLVENTS.class2.find((s) => s.name === 'methanol');
  const cd = ELEMENTS.rows.find((r) => r.el === 'Cd');
  const pb = ELEMENTS.rows.find((r) => r.el === 'Pb');
  const metals = cd.oral === pb.oral ? `oral cadmium and lead to ${exact(cd.oral)} µg a day` : `oral cadmium to ${exact(cd.oral)} and lead to ${exact(pb.oral)} µg a day`;
  return `ICH limits residual benzene to ${exact(benzene.ppm)} ppm and methanol to ${exact(methanol.ppm)} ppm, and ${metals}`;
};

export const manufacturingFindings = (snap) => ({
  recalls: recallsFinding(snap),
  nitrosamines: nitrosaminesFinding(snap),
  shortages: shortagesFinding(snap),
  excipients: excipientsFinding(snap),
  limits: limitsFinding(),
});

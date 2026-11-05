import { exact, pct } from './lib.js';
import { quantile } from './stats.js';

const share = (v) => Number(v.toFixed(6));
const sum = (list) => list.reduce((a, b) => a + b, 0);

export const NOVEL_KINDS = [
  { key: 'nda', label: 'new molecular entities, NDA' },
  { key: 'mab', label: 'antibodies, BLA' },
  { key: 'biologic', label: 'other biologics, BLA' },
];

export const novelSeries = (snap) => ({
  years: snap.approvals.years,
  series: NOVEL_KINDS.map((k) => ({ key: k.key, label: k.label, values: snap.approvals[k.key] })),
});

const totals = (a) => a.years.map((_, i) => a.nda[i] + a.mab[i] + a.biologic[i]);

export const pathShares = (snap, from) => {
  const a = snap.approvals;
  const t = totals(a);
  const at = a.years.map((y, i) => [y, i]).filter(([y]) => y >= from);
  return {
    years: at.map(([y]) => y),
    priority: at.map(([, i]) => (t[i] ? share(a.priority[i] / t[i]) : 0)),
    orphan: at.map(([, i]) => (t[i] ? share(a.orphan[i] / t[i]) : 0)),
  };
};

export const windowShare = (snap, key, from, to) => {
  const a = snap.approvals;
  const t = totals(a);
  const idx = a.years.map((y, i) => [y, i]).filter(([y]) => y >= from && y <= to).map(([, i]) => i);
  const n = sum(idx.map((i) => t[i]));
  return n ? share(sum(idx.map((i) => a[key][i])) / n) : 0;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const calendarRows = (snap) => {
  const c = snap.approvals.calendar;
  return {
    from: c.from,
    weekdays: [...[1, 2, 3, 4, 5].map((d) => ({ key: WEEKDAYS[d], n: c.weekdays[d] })), { key: 'Sat or Sun', n: c.weekdays[0] + c.weekdays[6] }],
    months: MONTHS.map((key, i) => ({ key, n: c.months[i] })),
  };
};

export const lagBins = (snap, lo = -60, hi = 120, step = 6) => {
  const edges = [-Infinity, ...Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step), Infinity];
  return edges.slice(0, -1).map((from, i) => ({ from, to: edges[i + 1], n: snap.ema.lag.lags.filter((v) => v >= from && v < edges[i + 1]).length }));
};

export const EMA_KINDS = [
  { key: 'novel', label: 'new medicines' },
  { key: 'generic', label: 'generics' },
  { key: 'biosimilar', label: 'biosimilars' },
];

export const emaSeries = (snap) => ({
  years: snap.ema.years,
  series: EMA_KINDS.map((k) => ({ key: k.key, label: k.label, values: snap.ema[k.key] })),
});

export const biosimilarYears = (snap) => {
  const ys = snap.biosimilars.rows.map((r) => Number(String(r.date).slice(0, 4))).filter(Boolean);
  const first = Math.min(...ys);
  const years = Array.from({ length: Math.max(...ys) - first + 1 }, (_, i) => first + i);
  return { years, counts: years.map((y) => ys.filter((v) => v === y).length) };
};

const innOf = (text) => String(text ?? '').match(/\(([^)]+)\)\s*$/)?.[1].trim().toLowerCase() ?? String(text ?? '').trim().toLowerCase();
const brandOf = (text) => String(text ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();

export const biosimilarReferences = (snap) => {
  const m = new Map();
  for (const r of snap.biosimilars.rows) {
    const inn = innOf(r.reference);
    const e = m.get(inn) ?? { inn, n: 0, products: new Set() };
    e.n += 1;
    e.products.add(brandOf(r.reference));
    m.set(inn, e);
  }
  return [...m.values()].map((e) => ({ inn: e.inn, n: e.n, products: [...e.products].sort() })).sort((a, b) => b.n - a.n || a.inn.localeCompare(b.inn));
};

const EXCLUSIVITY = {
  NCE: 'new chemical entity',
  ODE: 'orphan drug exclusivity',
  I: 'new indication',
  PED: 'pediatric exclusivity',
  NP: 'new product',
  NPP: 'new patient population',
  M: 'miscellaneous',
  GAIN: 'qualified infectious disease product',
  PC: 'patent challenge',
  CGT: 'competitive generic therapy',
  D: 'new dosing schedule',
  NS: 'new strength',
  NDF: 'new dosage form',
};

export const exclusivityLabel = (code) => (EXCLUSIVITY[code] ? `${EXCLUSIVITY[code]}, ${code}` : code);

export const titleCase = (s) => String(s ?? '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

const novelFinding = (snap) => {
  const a = snap.approvals;
  const i = a.years.length - 1;
  return `Drugs@FDA lists ${exact(a.nda[i] + a.mab[i] + a.biologic[i])} new molecular entities and new biologics approved in ${a.years[i]}; ${exact(a.mab[i])} are antibodies`;
};

const calendarFinding = (snap) => {
  const c = snap.approvals.calendar;
  const n = sum(c.weekdays);
  return `${pct(c.weekdays[5] / n)} of novel approvals since ${c.from} fell on a Friday, and ${pct(c.months[11] / sum(c.months))} in December`;
};

const pathsFinding = (snap) => {
  const ys = snap.approvals.years;
  const last = ys.at(-1);
  const early = Math.max(1990, ys[0]);
  return `Orphan drugs were ${pct(windowShare(snap, 'orphan', last - 4, last))} of novel approvals in ${last - 4} to ${last}, against ${pct(windowShare(snap, 'orphan', early, early + 4))} in ${early} to ${early + 4}`;
};

const emaFinding = (snap) => {
  const l = snap.ema.lag;
  return `Of ${exact(l.matched)} substances approved as new by both FDA and EMA since ${l.since}, FDA approved ${pct(l.fdaFirst / l.matched)} first; the median EU approval came ${Number(quantile(l.lags, 0.5).toFixed(1))} months later`;
};

const genericsFinding = (snap) => {
  const g = snap.approvals.generics;
  return `FDA approved ${exact(g.counts.at(-1))} generic drug applications in ${g.years.at(-1)}, and ${exact(sum(g.counts))} since ${g.years[0]}`;
};

const patentsFinding = (snap) => {
  const o = snap.orangebook;
  return `The Orange Book lists ${exact(o.patents)} patents on ${exact(o.applications)} applications; ${titleCase(o.top[0].name)} carries the most, ${exact(o.top[0].patents)}`;
};

const biosimilarsFinding = (snap) => {
  const [top, next] = biosimilarReferences(snap);
  const tail = next && next.n === top.n ? `, as many as ${next.inn}` : ', more than any other molecule';
  return `FDA has approved ${exact(snap.biosimilars.rows.length)} biosimilars since ${biosimilarYears(snap).years[0]}; ${exact(top.n)} copy ${top.inn}${tail}`;
};

export const approvalFindings = (snap) => ({
  novel: novelFinding(snap),
  calendar: calendarFinding(snap),
  paths: pathsFinding(snap),
  ema: emaFinding(snap),
  generics: genericsFinding(snap),
  patents: patentsFinding(snap),
  biosimilars: biosimilarsFinding(snap),
});

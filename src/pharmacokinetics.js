import { exact } from './lib.js';
import { summary } from './stats.js';

const tidy = (v) => Number(v.toPrecision(12));
const one = (v) => Number(v.toFixed(1));

export const CYPS = ['1A2', '2B6', '2C8', '2C9', '2C19', '2D6', '3A'];

export const CYP_CATEGORIES = [
  { role: 'inhibitor', strength: 'strong', label: 'strong inhibitor' },
  { role: 'inhibitor', strength: 'moderate', label: 'moderate inhibitor' },
  { role: 'inhibitor', strength: 'weak', label: 'weak inhibitor' },
  { role: 'inducer', strength: 'strong', label: 'strong inducer' },
  { role: 'inducer', strength: 'moderate', label: 'moderate inducer' },
  { role: 'inducer', strength: 'weak', label: 'weak inducer' },
  { role: 'substrate', strength: 'sensitive', label: 'sensitive substrate' },
  { role: 'substrate', strength: 'moderate', label: 'moderate substrate' },
];

export const TRANSPORTERS = ['P-gp', 'BCRP', 'OATP1B1', 'OATP1B3', 'OAT1', 'OAT3', 'OCT1', 'OCT2', 'MATE1', 'MATE2-K'];

const describe = (list) => {
  const v = list.map((d) => d.median);
  const s = summary(v);
  return s ? {
    n: v.length, median: tidy(s.median), q1: tidy(s.q1), q3: tidy(s.q3), values: v,
  } : {
    n: 0, median: null, q1: null, q3: null, values: [],
  };
};

export const pkSummary = (snap) => Object.fromEntries(Object.entries(snap.pk).map(([key, list]) => [key, describe(list)]));

const has = (row, system, role, strength) => row.links.some((l) => l.system === system && l.role === role && (strength === undefined || l.strength === strength));

export const ddiMatrix = (snap) => ({
  systems: CYPS,
  categories: CYP_CATEGORIES.map((c) => c.label),
  counts: CYPS.map((system) => CYP_CATEGORIES.map((c) => snap.ddi.rows.filter((r) => has(r, system, c.role, c.strength)).length)),
});

export const transporterMatrix = (snap) => ({
  systems: TRANSPORTERS,
  roles: ['inhibitor', 'substrate'],
  counts: TRANSPORTERS.map((system) => ['inhibitor', 'substrate'].map((role) => snap.ddi.rows.filter((r) => has(r, system, role)).length)),
});

export const perpetrators = (snap) => snap.ddi.rows.map((r) => {
  const acts = r.links.filter((l) => l.role !== 'substrate');
  return { drug: r.drug, n: acts.length, links: acts };
}).filter((p) => p.n).sort((a, b) => b.n - a.n || a.drug.localeCompare(b.drug));

const RISK_ORDER = { high: 0, intermediate: 1, low: 2 };

export const cipaSorted = (snap) => [...snap.cipa.rows].sort((a, b) => (RISK_ORDER[a.risk] ?? 3) - (RISK_ORDER[b.risk] ?? 3) || (a.margin.hERG ?? Infinity) - (b.margin.hERG ?? Infinity));

const pkFinding = (snap) => {
  const s = pkSummary(snap);
  return `Approved drugs in ChEMBL have a median human half-life of ${one(s.halfLife.median)} h, across ${exact(s.halfLife.n)} drugs, and oral bioavailability of ${one(s.f.median)}%, across ${exact(s.f.n)}`;
};

const ddiFinding = (snap) => {
  const rows = snap.ddi.rows;
  const strong = rows.filter((r) => has(r, '3A', 'inhibitor', 'strong')).length;
  const sensitive = rows.filter((r) => has(r, '3A', 'substrate', 'sensitive')).length;
  const first = strong === 1 ? '1 is a strong CYP3A inhibitor' : `${exact(strong)} are strong CYP3A inhibitors`;
  const second = sensitive === 1 ? '1 a sensitive CYP3A substrate' : `${exact(sensitive)} sensitive CYP3A substrates`;
  return `FDA names ${exact(rows.length)} drugs and foods in clinical CYP or transporter interactions; ${first}, ${second}`;
};

const cipaFinding = (snap) => {
  const rows = snap.cipa.rows.filter((r) => r.margin.hERG !== null);
  const low = rows.filter((r) => r.risk === 'low').reduce((a, b) => (b.margin.hERG < a.margin.hERG ? b : a));
  const high = rows.filter((r) => r.risk === 'high').reduce((a, b) => (b.margin.hERG > a.margin.hERG ? b : a));
  return `Of CiPA’s ${exact(snap.cipa.rows.length)} training drugs, ${low.drug} blocks hERG at ${low.margin.hERG} times its free Cmax yet is low risk; ${high.drug} is high risk at ${high.margin.hERG} times`;
};

export const pkFindings = (snap) => ({
  pk: pkFinding(snap),
  ddi: ddiFinding(snap),
  cipa: cipaFinding(snap),
});

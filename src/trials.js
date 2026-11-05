import { exact, pct } from './lib.js';
import { kaplanMeier } from './stats.js';
import { PHASE_GROUPS, TRIAL_FEATURES, ENROLLMENT_BINS } from './queries.js';
import { ATTRITION } from './facts.js';

const share = (v) => Number(v.toFixed(6));
const sum = (list) => list.reduce((a, b) => a + b, 0);

export const PHASE_BANDS = [
  { key: 'p1', label: 'Phase 1 and early phase 1', groups: ['early1', 'p1'] },
  { key: 'p2', label: 'Phase 1/2 and 2', groups: ['p12', 'p2'] },
  { key: 'p3', label: 'Phase 2/3 and 3', groups: ['p23', 'p3'] },
  { key: 'p4', label: 'Phase 4', groups: ['p4'] },
  { key: 'na', label: 'No phase', groups: ['na'] },
];

const byKey = (list, key) => list.find((x) => x.key === key);

export const registrations = (snap) => {
  const t = snap.trials;
  return {
    years: t.years,
    bands: PHASE_BANDS.map((b) => ({ key: b.key, label: b.label, values: t.years.map((_, i) => sum(b.groups.map((g) => byKey(t.registered, g).years[i]))) })),
    totals: t.years.map((_, i) => sum(t.registered.map((r) => r.years[i]))),
    before: sum(t.registered.map((r) => r.before)),
  };
};

export const designShares = (snap) => ({
  groups: PHASE_GROUPS.map(({ key, label }) => ({ key, label })),
  features: TRIAL_FEATURES.map(({ key, label }) => ({ key, label })),
  shares: PHASE_GROUPS.map((g) => {
    const d = byKey(snap.trials.design, g.key);
    return TRIAL_FEATURES.map((f, j) => share(d.features[j] / (f.of ? d.completed : d.total)));
  }),
});

export const enrollmentShares = (snap) => ({
  bins: ENROLLMENT_BINS.map(({ key, label }) => ({ key, label })),
  shares: PHASE_GROUPS.map((g) => {
    const bins = byKey(snap.trials.enrollment, g.key).bins;
    const n = sum(bins);
    return bins.map((v) => (n ? share(v / n) : 0));
  }),
});

export const statusLabel = (value) => value.toLowerCase().replaceAll('_', ' ');

export const statusRows = (snap) => snap.trials.fields.OverallStatus.values.map((v) => ({ key: v.value, label: statusLabel(v.value), n: v.n }));

export const SPONSOR_LABELS = {
  industry: 'Industry', federal: 'NIH and other federal', other: 'Universities, hospitals and others', certified: 'Delay certified',
};

const expand = (pairs) => pairs.flatMap(([m, c]) => Array(c).fill(m));

const curveOf = (group, months) => {
  const done = expand(group.events);
  const open = expand(group.censored);
  const km = kaplanMeier([...done, ...open], [...done.map(() => true), ...open.map(() => false)]);
  const left = (m) => km.steps.filter((p) => p.t <= m).at(-1)?.s ?? 1;
  return {
    key: group.key,
    label: SPONSOR_LABELS[group.key] ?? group.key,
    n: group.n,
    points: Array.from({ length: months + 1 }, (_, m) => ({ x: m, y: share(1 - left(m)) })),
    at12: share(1 - left(12)),
    median: km.steps.find((p) => share(p.s) <= 0.5)?.t ?? null,
    ever: group.n ? share(done.length / group.n) : 0,
  };
};

export const reportingCurves = (snap, months = 60) => snap.reporting.groups.map((g) => curveOf(g, months));

export const pooledReporting = (snap, months = 60) => {
  const groups = snap.reporting.groups.filter((g) => g.key !== 'certified');
  return curveOf({
    key: 'pooled', n: sum(groups.map((g) => g.n)), events: groups.flatMap((g) => g.events), censored: groups.flatMap((g) => g.censored),
  }, months);
};

export const psychoactiveSeries = (snap, group, from, to) => {
  const years = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return snap.psychoactive.compounds.filter((c) => c.group === group).map((c) => ({
    key: c.key, label: c.label, trials: c.trials, phases: c.phases, rows: years.map((x) => ({ x, y: c.years[x] ?? 0 })),
  }));
};

const Z = 1.96;
const two = (v) => Number(v.toFixed(2));

const posRow = (g, mark = false) => ({
  key: g.label, label: g.label, rs: g.p1a, lo: two(g.p1a - Z * g.se), hi: two(g.p1a + Z * g.se), mark,
});

export const attritionForest = () => [
  { label: 'By therapeutic group', rows: ATTRITION.groups.map((g) => posRow(g)) },
  { label: 'Pooled', rows: [posRow(ATTRITION.overall, true), posRow(ATTRITION.withoutOncology)] },
];

const direction = (a, b) => Math.sign(b - a);

const VERB = { 1: 'rose', '-1': 'fell' };

const trend = (snap) => {
  const last = snap.trials.years.at(-1);
  const first = last - 10;
  const at = (key, year) => byKey(snap.psychoactive.compounds, key)?.years[year] ?? 0;
  const [a, b, c, d] = [at('psilocybin', first), at('psilocybin', last), at('mdma', first), at('mdma', last)];
  const lead = direction(a, b) ? `${VERB[direction(a, b)]} from ${exact(a)} in ${first} to ${exact(b)} in ${last}` : `held at ${exact(a)} from ${first} to ${last}`;
  const tail = direction(c, d) === 0 ? `held at ${exact(c)}` : `${direction(c, d) === direction(a, b) ? '' : `${VERB[direction(c, d)]} `}from ${exact(c)} to ${exact(d)}`;
  return `Psilocybin trials starting each year ${lead}, and MDMA trials ${tail}`;
};

export const trialFindings = (snap) => {
  const t = snap.trials;
  const d = designShares(snap);
  const at = (g, f) => d.shares[PHASE_GROUPS.findIndex((x) => x.key === g)][TRIAL_FEATURES.findIndex((x) => x.key === f)];
  const pooled = pooledReporting(snap);
  const top = ATTRITION.groups[0];
  const onc = ATTRITION.groups.find((g) => g.label === 'Oncology');
  return {
    registry: `ClinicalTrials.gov holds ${exact(t.total)} studies; ${exact(t.drug)} are interventional trials of drugs or biologics`,
    design: `${pct(at('p3', 'randomized'))} of phase 3 drug trials are randomized and ${pct(at('p3', 'blinded'))} double-blind or more; ${pct(at('p1', 'healthy'))} of phase 1 trials accept healthy volunteers`,
    reporting: `Of ${exact(pooled.n)} FDA-regulated drug trials finished in ${snap.reporting.from.slice(0, 4)} to ${snap.reporting.to.slice(0, 4)} without a delay certificate, ${pct(pooled.at12)} submitted results within a year`,
    attrition: `Wong et al. estimate ${ATTRITION.overall.p1a}% of drug programs in phase 1 reach approval, from ${onc.p1a}% in oncology to ${top.p1a}% for ${top.label.toLowerCase()}`,
    psychedelics: trend(snap),
  };
};

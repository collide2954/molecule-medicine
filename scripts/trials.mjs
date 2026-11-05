import { PHASE_GROUPS } from '../src/queries.js';

export const ctFieldValues = (json) => Object.fromEntries(json.map((f) => [f.piece, {
  missing: f.missingStudiesCount ?? 0,
  values: (f.topValues ?? []).map((v) => ({ value: v.value, n: v.studiesCount })).sort((a, b) => b.n - a.n),
}]));

export const ctStudies = (json) => (json.studies ?? []).map((x) => {
  const p = x.protocolSection ?? {};
  const st = p.statusModule ?? {};
  return {
    nct: p.identificationModule?.nctId ?? null,
    status: st.overallStatus ?? null,
    phases: p.designModule?.phases ?? [],
    sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.class ?? null,
    start: st.startDateStruct?.date ?? null,
    completion: st.primaryCompletionDateStruct?.date ?? null,
    submitted: st.resultsFirstSubmitDate ?? null,
    posted: st.resultsFirstPostDateStruct?.date ?? null,
    certified: Boolean(st.dispFirstSubmitDate),
    interventions: (p.armsInterventionsModule?.interventions ?? []).map((i) => ({ type: i.type ?? null, names: [i.name, ...(i.otherNames ?? [])].filter(Boolean) })),
    conditions: p.conditionsModule?.conditions ?? [],
  };
});

const DAY = 86400000;

const parse = (s) => {
  const [y, m = '07', d] = String(s).split('-');
  return Date.UTC(Number(y), Number(m) - 1, d ? Number(d) : 15);
};

export const monthsBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY / 30.4375);

export const reportingTimes = (rows, asOf) => rows.filter((r) => r.completion).map((r) => ({
  months: r.submitted ? Math.max(0, monthsBetween(r.completion, r.submitted)) : monthsBetween(r.completion, asOf),
  event: Boolean(r.submitted),
  sponsor: r.sponsor,
  certified: r.certified,
}));

const FEDERAL = new Set(['NIH', 'FED']);

export const sponsorGroup = (cls) => {
  if (cls === 'INDUSTRY') return 'industry';
  return FEDERAL.has(cls) ? 'federal' : 'other';
};

const tally = (values) => [...values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map())].sort((a, b) => a[0] - b[0]);

export const reportingGroups = (times) => ['industry', 'federal', 'other'].map((key) => {
  const rows = times.filter((t) => sponsorGroup(t.sponsor) === key);
  return {
    key,
    n: rows.length,
    certified: rows.filter((t) => t.certified).length,
    events: tally(rows.filter((t) => t.event).map((t) => t.months)),
    censored: tally(rows.filter((t) => !t.event).map((t) => t.months)),
  };
});

export const startYears = (rows) => {
  const out = {};
  for (const r of rows) {
    const y = Number(String(r.start ?? '').slice(0, 4));
    if (y) out[y] = (out[y] ?? 0) + 1;
  }
  return out;
};

export const phaseGroup = (phases) => {
  const s = new Set(phases);
  if (s.has('EARLY_PHASE1')) return 'early1';
  if (s.has('PHASE1')) return s.has('PHASE2') ? 'p12' : 'p1';
  if (s.has('PHASE2')) return s.has('PHASE3') ? 'p23' : 'p2';
  if (s.has('PHASE3')) return 'p3';
  if (s.has('PHASE4')) return 'p4';
  return 'na';
};

export const phaseCounts = (rows) => {
  const out = Object.fromEntries(PHASE_GROUPS.map((g) => [g.key, 0]));
  for (const r of rows) out[phaseGroup(r.phases)] += 1;
  return out;
};

const DRUG_TYPES = new Set(['DRUG', 'BIOLOGICAL', 'COMBINATION_PRODUCT', 'DIETARY_SUPPLEMENT']);

export const matchesCompound = (row, spec) => {
  const hit = new RegExp(spec.pattern, 'i');
  const miss = spec.not ? new RegExp(spec.not, 'i') : null;
  const named = row.interventions.some((i) => DRUG_TYPES.has(i.type) && i.names.some((n) => hit.test(n) && !miss?.test(n)));
  if (!named || !spec.condition) return named;
  const want = new RegExp(spec.condition, 'i');
  const skip = spec.notCondition ? new RegExp(spec.notCondition, 'i') : null;
  return row.conditions.some((c) => want.test(c) && !skip?.test(c));
};

export const compoundTrials = (rows, spec) => {
  const hits = rows.filter((r) => matchesCompound(r, spec));
  return {
    key: spec.key, label: spec.label, group: spec.group, trials: hits.length, years: startYears(hits), phases: phaseCounts(hits),
  };
};

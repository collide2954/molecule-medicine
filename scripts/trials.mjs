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
    results: st.resultsFirstPostDateStruct?.date ?? null,
  };
});

const DAY = 86400000;

const parse = (s) => {
  const [y, m = '07', d] = String(s).split('-');
  return Date.UTC(Number(y), Number(m) - 1, d ? Number(d) : 15);
};

export const monthsBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY / 30.4375);

export const reportingTimes = (rows, asOf) => rows.filter((r) => r.completion).map((r) => (r.results
  ? { months: Math.max(0, monthsBetween(r.completion, r.results)), event: true, sponsor: r.sponsor }
  : { months: monthsBetween(r.completion, asOf), event: false, sponsor: r.sponsor }));

export const startYears = (rows) => {
  const out = {};
  for (const r of rows) {
    const y = Number(String(r.start ?? '').slice(0, 4));
    if (y) out[y] = (out[y] ?? 0) + 1;
  }
  return out;
};

const RCSB = [[/X-RAY/i, 'X-ray'], [/ELECTRON MICROSCOPY/i, 'Electron microscopy'], [/NMR/i, 'NMR']];

const groupOf = (label) => RCSB.find(([re]) => re.test(label))?.[1] ?? 'Other';

export const rcsbByYear = (json) => {
  const buckets = (json.facets ?? []).find((f) => f.name === 'year')?.buckets ?? [];
  const sorted = [...buckets].sort((a, b) => Number(a.label) - Number(b.label));
  const methods = { 'X-ray': [], 'Electron microscopy': [], NMR: [], Other: [] };
  for (const b of sorted) {
    const row = { 'X-ray': 0, 'Electron microscopy': 0, NMR: 0, Other: 0 };
    for (const m of b.facets?.find((f) => f.name === 'method')?.buckets ?? []) row[groupOf(m.label)] += m.population;
    for (const key of Object.keys(methods)) methods[key].push(row[key]);
  }
  return { years: sorted.map((b) => Number(b.label)), methods };
};

const tally = (list, key) => list.reduce((m, x) => {
  const k = key(x);
  if (k !== null && k !== undefined) m[k] = (m[k] ?? 0) + 1;
  return m;
}, {});

const GPCR_METHODS = { 'X-ray diffraction': 'X-ray', 'Electron microscopy': 'Electron microscopy', 'Electron crystallography': 'Other' };

export const gpcrdbSummary = (list) => {
  const years = [...new Set(list.map((s) => Number(String(s.publication_date).slice(0, 4))))].sort((a, b) => a - b);
  const methods = { 'X-ray': years.map(() => 0), 'Electron microscopy': years.map(() => 0) };
  for (const s of list) {
    const m = GPCR_METHODS[s.type] ?? 'Other';
    methods[m] ??= years.map(() => 0);
    methods[m][years.indexOf(Number(String(s.publication_date).slice(0, 4)))] += 1;
  }
  const byClass = {};
  for (const s of list) {
    byClass[s.class] ??= {};
    byClass[s.class][s.state] = (byClass[s.class][s.state] ?? 0) + 1;
  }
  return {
    total: list.length,
    human: list.filter((s) => s.species === 'Homo sapiens').length,
    receptors: new Set(list.map((s) => s.protein)).size,
    classes: tally(list, (s) => s.class),
    states: tally(list, (s) => s.state),
    byClass,
    signalling: tally(list.filter((s) => s.signalling_protein), (s) => s.signalling_protein.type),
    ligands: tally(list.flatMap((s) => (s.ligands ?? []).map((l) => l.function)), (f) => f),
    years,
    methods,
  };
};

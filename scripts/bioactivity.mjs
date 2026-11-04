const buckets = (agg) => agg?.buckets ?? [];
const tidy = (v) => Number(v.toPrecision(12));

export const activitySummary = (es, sourceNames = new Map()) => {
  const A = es.aggregations;
  return {
    total: es.hits.total.value,
    withPchembl: A.withp.doc_count,
    phantomKinetics: A.phantom.doc_count,
    duplicates: buckets(A.duplicates).find((b) => Number(b.key) === 1)?.doc_count ?? 0,
    types: buckets(A.types).map((b) => ({ type: b.key, n: b.doc_count })),
    assays: buckets(A.assay).map((b) => ({ type: b.key, n: b.doc_count })),
    years: buckets(A.year).map((b) => [Number(b.key), b.doc_count]),
    pchembl: buckets(A.pchembl).map((b) => [Number(b.key), b.doc_count]),
    sources: buckets(A.source).map((b) => ({ id: Number(b.key), name: sourceNames.get(Number(b.key)) ?? `source ${b.key}`, n: b.doc_count })),
    relations: buckets(A.relation).map((b) => ({ relation: b.key, n: b.doc_count })),
    validity: buckets(A.validity).map((b) => ({ comment: b.key, n: b.doc_count })),
    formats: buckets(A.formats).map((b) => ({ format: b.key, n: b.doc_count })),
    byType: buckets(A.potent.types).map((b) => ({ type: b.key, n: b.doc_count, bins: buckets(b.bins).map((x) => [Number(x.key), x.doc_count]) })),
    molecules: buckets(A.potent.molecules).map((b) => ({ name: b.key, n: b.doc_count })),
    organisms: buckets(A.potent.organisms).map((b) => ({ organism: b.key, n: b.doc_count })),
  };
};

const RATE_UNITS = [
  [/^(M-?1?[\s.-]*s-?1|Ms-1|M-1-s-1|1\/M1?\/S|M\^-1 ?s\^-1)$/i, 1],
  [/^nM\^?-1 ?min\^?-1$/i, 1e9 / 60],
  [/^10e3\* ?M-1 ?s-1$/i, 1e3],
  [/^10e6\* ?M-1 ?s-1$/i, 1e6],
  [/^(s-1|s\^-1|1-s|1\/s)$/i, 1],
  [/^(min\^?-1|min-1|1\/min)$/i, 1 / 60],
  [/^(h-1|hr-1|1\/h)$/i, 1 / 3600],
];

export const kineticRate = (value, units) => {
  if (value === null || value === undefined || value === '' || !units) return null;
  const factor = RATE_UNITS.find(([re]) => re.test(String(units).trim()))?.[1];
  return factor === undefined ? null : tidy(Number(value) * factor);
};

const ON = new Set(['kon', 'k_on', 'Kon']);
const OFF = new Set(['koff', 'k_off', 'Koff']);
const geomean = (list) => tidy(Math.exp(list.reduce((s, v) => s + Math.log(v), 0) / list.length));

export const kineticPairs = (rows) => {
  const pairs = new Map();
  for (const a of rows) {
    const kind = ON.has(a.standard_type) ? 'on' : OFF.has(a.standard_type) ? 'off' : null;
    if (!kind || a.standard_relation !== '=') continue;
    const v = kineticRate(a.standard_value, a.standard_units);
    if (!v || v <= 0) continue;
    const key = `${a.parent_molecule_chembl_id ?? a.molecule_chembl_id}|${a.target_chembl_id}`;
    if (!pairs.has(key)) {
      pairs.set(key, {
        molecule: a.parent_molecule_chembl_id ?? a.molecule_chembl_id, name: a.molecule_pref_name ?? null, target: a.target_chembl_id, targetName: a.target_pref_name, on: [], off: [],
      });
    }
    pairs.get(key)[kind].push(v);
  }
  return [...pairs.values()].filter((p) => p.on.length && p.off.length).map(({ on, off, ...p }) => ({
    ...p, kon: geomean(on), koff: geomean(off), n: Math.max(on.length, off.length),
  }));
};

const measured = (a) => (a.standard_relation === '=' && a.pchembl_value !== null && a.pchembl_value !== undefined ? Number(a.pchembl_value) : null);

export const agreementPairs = (kinome, karaman) => {
  const davis = new Map();
  const constructs = new Map();
  for (const k of kinome.kinases) {
    const site = `${k.target}|${k.variant ?? ''}`;
    constructs.set(site, (constructs.get(site) ?? 0) + 1);
  }
  kinome.inhibitors.forEach((r, i) => kinome.kinases.forEach((k, j) => {
    davis.set(`${r.parent ?? r.id}|${k.target}|${k.variant ?? ''}`, kinome.pkd[i][j]);
  }));
  const rows = karaman.filter((a) => a.standard_type === 'Kd' && a.target_chembl_id);
  const repeats = new Map();
  for (const a of rows) {
    const key = `${a.parent_molecule_chembl_id}|${a.target_chembl_id}|${a.assay_variant_mutation ?? ''}`;
    repeats.set(key, (repeats.get(key) ?? 0) + 1);
  }
  const pairs = [];
  const counts = {
    both: 0, davisOnly: 0, karamanOnly: 0, neither: 0,
  };
  const molecules = new Set();
  let ambiguous = 0;
  for (const a of rows) {
    const site = `${a.target_chembl_id}|${a.assay_variant_mutation ?? ''}`;
    const key = `${a.parent_molecule_chembl_id}|${site}`;
    if (!davis.has(key)) continue;
    if (constructs.get(site) > 1 || repeats.get(key) > 1) {
      ambiguous += 1;
      continue;
    }
    molecules.add(a.parent_molecule_chembl_id);
    const d = davis.get(key);
    const k = measured(a);
    if (d !== null && k !== null) {
      counts.both += 1;
      pairs.push([d, k]);
    } else if (d !== null) counts.davisOnly += 1;
    else if (k !== null) counts.karamanOnly += 1;
    else counts.neither += 1;
  }
  return {
    pairs, counts, ambiguous, molecules: molecules.size,
  };
};

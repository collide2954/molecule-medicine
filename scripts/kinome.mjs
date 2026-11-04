import { gini } from '../src/stats.js';

export const KINASE_GROUPS = ['TK', 'TKL', 'STE', 'CK1', 'AGC', 'CAMK', 'CMGC', 'Atypical', 'Other', 'Unclassified protein kinase', 'Lipid or other kinase', 'Non-human', 'Unclassified'];

const fromEc = (ec) => {
  if (ec.some((e) => /^2\.7\.1\./.test(e))) return 'Lipid or other kinase';
  if (ec.some((e) => /^2\.7\.1[0-2]\./.test(e))) return 'Unclassified protein kinase';
  return 'Unclassified';
};

export const kinaseGroup = (path, organism = 'Homo sapiens', ec = []) => {
  if (organism && organism !== 'Homo sapiens') return 'Non-human';
  if (path[1] === 'Kinase' && /^protein kinase$/i.test(path[2] ?? '')) {
    const group = String(path[3] ?? '').replace(/ protein kinase group$/i, '');
    if (KINASE_GROUPS.includes(group)) return group;
    return path[3] ? 'Other' : 'Unclassified protein kinase';
  }
  if (path[1] === 'Kinase') return 'Lipid or other kinase';
  return fromEc(ec);
};

const CONSTRUCT = /^Binding constant for (.+?)(?: kinase domain)?$/;

const constructName = (a) => a.assay_description?.match(CONSTRUCT)?.[1] ?? a.target_pref_name ?? a.assay_chembl_id;

const rank = (group) => {
  const i = KINASE_GROUPS.indexOf(group);
  return i < 0 ? KINASE_GROUPS.length : i;
};

export const davisMatrix = (activities, groupOf = () => 'Unclassified') => {
  const inhibitors = new Map();
  const kinases = new Map();
  const values = new Map();
  for (const a of activities) {
    inhibitors.set(a.molecule_chembl_id, { id: a.molecule_chembl_id, name: a.molecule_pref_name ?? a.molecule_chembl_id });
    if (!kinases.has(a.assay_chembl_id)) {
      kinases.set(a.assay_chembl_id, {
        id: a.assay_chembl_id, target: a.target_chembl_id, name: constructName(a), variant: a.assay_variant_mutation ?? null, group: groupOf(a.target_chembl_id) ?? 'Unclassified',
      });
    }
    const v = a.standard_relation === '>' || a.pchembl_value === null || a.pchembl_value === undefined ? null : Number(a.pchembl_value);
    values.set(`${a.molecule_chembl_id}|${a.assay_chembl_id}`, v);
  }
  const rows = [...inhibitors.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const cols = [...kinases.values()].sort((a, b) => rank(a.group) - rank(b.group) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return {
    inhibitors: rows,
    kinases: cols,
    pkd: rows.map((r) => cols.map((c) => values.get(`${r.id}|${c.id}`) ?? null)),
  };
};

const THREE_MICROMOLAR = -Math.log10(3e-6);

export const selectivity = (row) => {
  const hits = row.filter((v) => v !== null && v > THREE_MICROMOLAR).length;
  return {
    hits, s3: row.length ? hits / row.length : 0, gini: gini(row.map((v) => (v === null ? 0 : 10 ** v))),
  };
};

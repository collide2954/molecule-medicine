import { gini } from '../src/stats.js';

const byName = (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

export const davisMatrix = (activities) => {
  const inhibitors = new Map();
  const kinases = new Map();
  const values = new Map();
  for (const a of activities) {
    inhibitors.set(a.molecule_chembl_id, { id: a.molecule_chembl_id, name: a.molecule_pref_name ?? a.molecule_chembl_id });
    kinases.set(a.target_chembl_id, { id: a.target_chembl_id, name: a.target_pref_name ?? a.target_chembl_id });
    const v = a.standard_relation === '>' || a.pchembl_value === null || a.pchembl_value === undefined ? null : Number(a.pchembl_value);
    values.set(`${a.molecule_chembl_id}|${a.target_chembl_id}`, v);
  }
  const rows = [...inhibitors.values()].sort(byName);
  const cols = [...kinases.values()].sort(byName);
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

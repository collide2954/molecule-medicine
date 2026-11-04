import { readTables, readCsv, records } from './readers.mjs';

const COLUMNS = {
  'CYP Strg INH': ['inhibitor', 'strong'],
  'CYP Mod INH': ['inhibitor', 'moderate'],
  'CYP WK INH': ['inhibitor', 'weak'],
  'CYP Strg IND': ['inducer', 'strong'],
  'CYP Mod IND': ['inducer', 'moderate'],
  'CYP WK IND': ['inducer', 'weak'],
  'CYP SENS SUB': ['substrate', 'sensitive'],
  'CYP Mod SENS SUB': ['substrate', 'moderate'],
  'TRNSP INH': ['inhibitor', 'transporter'],
  'TRNSP SUB': ['substrate', 'transporter'],
};

const CYP = /2C19|2C8|2C9|1A2|2B6|2D6|3A/g;
const TRANSPORTERS = /OATP1B1|OATP1B3|OATP1B|OAT1|OAT3|OCT1|OCT2|MATE1|MATE2-K|P-gp|BCRP/g;

const systemsIn = (text, transporter) => [...new Set([...String(text).matchAll(transporter ? TRANSPORTERS : CYP)]
  .flatMap(([s]) => (s === 'OATP1B' ? ['OATP1B1', 'OATP1B3'] : [s])))];

export const ddiRows = (html) => {
  const table = readTables(html).find((t) => String(t.head[0] ?? '').startsWith('Drug or Other Substance'));
  if (!table) return [];
  const clean = (name) => {
    const s = name.replace(/[\d,\s]+$/, '').trim();
    return s.length > 1 && s[1] === s[1].toLowerCase() ? `${s[0].toLowerCase()}${s.slice(1)}` : s;
  };
  return table.rows.filter((r) => r[0]).map((r) => ({
    drug: clean(r[0]),
    links: table.head.slice(1).flatMap((h, j) => {
      const [role, strength] = COLUMNS[h] ?? [];
      if (!role || !r[j + 1]) return [];
      return systemsIn(r[j + 1], strength === 'transporter').map((system) => ({ system, role, strength }));
    }),
  }));
};

const RISK = { 0: 'low', 1: 'intermediate', 2: 'high' };
const three = (v) => Number(v.toPrecision(3));

export const cipaRows = (ic50Text, drugsText) => {
  const ic50 = records(readCsv(ic50Text));
  const currents = Object.keys(ic50[0] ?? {}).filter((k) => k.endsWith('_IC50')).map((k) => k.replace(/_IC50$/, ''));
  const byDrug = new Map(ic50.map((r) => [r.drug, r]));
  return records(readCsv(drugsText)).map((d) => {
    const r = byDrug.get(d.drug) ?? {};
    const cmax = Number(d.therapeutic);
    const values = Object.fromEntries(currents.map((c) => {
      const v = r[`${c}_IC50`];
      return [c, v === undefined || v === '' || v === 'NA' ? null : Number(v)];
    }));
    return {
      drug: d.drug, risk: RISK[d.CiPA] ?? null, cmax, ic50: values, margin: Object.fromEntries(currents.map((c) => [c, values[c] === null ? null : three(values[c] / cmax)])),
    };
  });
};

export const perDrugMedians = (es) => (es.aggregations?.drugs?.buckets ?? []).map((b) => ({
  id: b.key, median: Number(Number(b.median.values['50.0']).toPrecision(4)), n: b.doc_count,
}));

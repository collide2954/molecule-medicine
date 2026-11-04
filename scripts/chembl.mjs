import {
  parseMolfile, packMol, unpackMol, describeMol, systemKeys,
} from '../src/chem.js';

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

export const chemblStatus = (s) => ({
  release: s.chembl_db_version,
  date: s.chembl_release_date,
  activities: s.activities,
  compounds: s.disinct_compounds ?? s.distinct_compounds,
  records: s.compound_records,
  targets: s.targets,
  documents: s.publications,
});

const FLAGS = [
  ['black_box_warning', 'boxed warning'], ['natural_product', 'natural product'], ['prodrug', 'prodrug'], ['orphan', 'orphan'], ['withdrawn_flag', 'withdrawn'], ['first_in_class', 'first in class'],
];

const properties = (p) => (p ? {
  mw: num(p.full_mwt),
  alogp: num(p.alogp),
  psa: num(p.psa),
  hba: num(p.hba),
  hbd: num(p.hbd),
  rtb: num(p.rtb),
  ro5: num(p.num_ro5_violations),
  arom: num(p.aromatic_rings),
  heavy: num(p.heavy_atoms),
  qed: num(p.qed_weighted),
  np: num(p.np_likeness_score),
} : null);

export const drugRecord = (m) => {
  const s = m.molecule_structures;
  const mol = s?.molfile ? parseMolfile(s.molfile) : null;
  return {
    id: m.molecule_chembl_id,
    name: m.pref_name,
    type: m.molecule_type,
    year: m.first_approval ?? null,
    routes: ['oral', 'parenteral', 'topical'].filter((r) => m[r]),
    atc: m.atc_classifications ?? [],
    p: properties(m.molecule_properties),
    formula: m.molecule_properties?.full_molformula ?? null,
    smiles: s?.canonical_smiles ?? null,
    inchikey: s?.standard_inchi_key ?? null,
    mol: mol ? packMol(mol) : null,
    chem: mol ? describeMol(mol, s?.canonical_smiles) : null,
    chirality: m.chirality ?? null,
    availability: m.availability_type ?? null,
    flags: FLAGS.filter(([k]) => m[k] === 1 || m[k] === true).map(([, label]) => label),
    stem: m.usan_stem ? { stem: m.usan_stem, definition: m.usan_stem_definition, year: m.usan_year ?? null } : null,
  };
};

const idNumber = (id) => Number(String(id).replace(/\D/g, ''));

export const approvedDrugs = (molecules) => molecules
  .filter((m) => (m.molecule_hierarchy?.parent_chembl_id ?? m.molecule_chembl_id) === m.molecule_chembl_id)
  .map(drugRecord)
  .sort((a, b) => idNumber(a.id) - idNumber(b.id));

export const ringSystemTable = (drugs, top) => {
  const table = new Map();
  for (const d of drugs) {
    if (!d.mol) continue;
    const seen = new Set();
    for (const s of systemKeys(unpackMol(d.mol))) {
      if (seen.has(s.key)) continue;
      seen.add(s.key);
      if (!table.has(s.key)) table.set(s.key, { key: s.key, n: 0, example: d.id, atoms: s.atoms, rings: s.rings });
      table.get(s.key).n += 1;
    }
  }
  return [...table.values()].sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)).slice(0, top);
};

export const atcNames = (rows) => {
  const out = {};
  for (const r of rows) {
    for (const level of [1, 2, 3, 4]) if (r[`level${level}`]) out[r[`level${level}`]] = r[`level${level}_description`];
    if (r.level5) out[r.level5] = r.who_name;
  }
  return out;
};

export const pages = async (fetchJson, path, key) => {
  const rows = [];
  let next = path;
  while (next) {
    const data = await fetchJson(next);
    rows.push(...(data[key] ?? []));
    next = data.page_meta?.next ? data.page_meta.next.replace(/^\/chembl\/api\/data\//, '') : null;
  }
  return rows;
};

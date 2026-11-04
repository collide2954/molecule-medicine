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
      if (!table.has(s.key)) table.set(s.key, { key: s.key, n: 0, example: d.id, atoms: s.atoms, rings: s.rings, exo: s.exo });
      table.get(s.key).n += 1;
    }
  }
  return [...table.values()].sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)).slice(0, top);
};

export const mechanismRecords = (rows) => rows.filter((m) => m.target_chembl_id).map((m) => ({
  drug: m.parent_molecule_chembl_id ?? m.molecule_chembl_id, target: m.target_chembl_id, action: m.action_type, moa: m.mechanism_of_action, direct: m.direct_interaction ?? 0,
}));

const unique = (list) => [...new Set(list.filter((v) => v !== null && v !== undefined && v !== ''))];
const synonyms = (c, type) => (c.target_component_synonyms ?? []).filter((s) => s.syn_type === type).map((s) => s.component_synonym);

export const targetRecord = (t, classes = new Map()) => {
  const comps = t.target_components ?? [];
  return {
    id: t.target_chembl_id,
    name: t.pref_name,
    type: t.target_type,
    organism: t.organism,
    genes: unique(comps.flatMap((c) => synonyms(c, 'GENE_SYMBOL'))),
    accessions: unique(comps.map((c) => c.accession)),
    ec: unique(comps.flatMap((c) => synonyms(c, 'EC_NUMBER'))),
    classes: unique(comps.flatMap((c) => classes.get(c.component_id) ?? [])),
  };
};

export const classTree = (rows) => new Map(rows.map((r) => [r.protein_class_id, { name: r.pref_name, parent: r.parent_id, level: r.class_level }]));

export const classPath = (tree, id) => {
  const out = [];
  for (let node = tree.get(id); node && node.level > 0; node = tree.get(node.parent)) out.unshift(node.name);
  return out;
};

export const targetFamily = (path, type) => {
  if (!path.length) {
    if (/NUCLEIC/i.test(type ?? '')) return 'Nucleic acid';
    if (/ORGANISM|CELL|TISSUE/i.test(type ?? '')) return 'Organism or cell';
    return 'Unclassified';
  }
  const [l1, l2] = path;
  if (path.some((p) => /G protein-coupled receptor/i.test(p))) return 'GPCR';
  if (l1 === 'Ion channel') return 'Ion channel';
  if (l1 === 'Enzyme' && l2 === 'Kinase') return 'Kinase';
  if (path.some((p) => /Nuclear receptor/i.test(p))) return 'Nuclear receptor';
  if (l1 === 'Enzyme' && l2 === 'Protease') return 'Protease';
  if (l1 === 'Enzyme') return 'Other enzyme';
  if (l1 === 'Transporter') return 'Transporter';
  if (l1 === 'Membrane receptor') return 'Other receptor';
  if (l1 === 'Epigenetic regulator') return 'Epigenetic regulator';
  return 'Other protein';
};

export const targetClass = (classIds, tree, type) => {
  const path = classIds.map((id) => classPath(tree, id)).reduce((best, p) => (p.length > best.length ? p : best), []);
  return { family: targetFamily(path, type), path };
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

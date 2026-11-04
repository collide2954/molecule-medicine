import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chemblStatus, drugRecord, approvedDrugs, atcNames, pages,
} from '../../scripts/chembl.mjs';
import { molOf } from './fixtures.mjs';

const MOLFILE = molOf([['C', 0, 0], ['O', 1, 0]], [[1, 2, 2]]);

const molecule = (over = {}) => ({
  atc_classifications: ['N02BA01'],
  availability_type: 1,
  black_box_warning: 0,
  chirality: 2,
  first_approval: 1950,
  first_in_class: 0,
  inorganic_flag: 0,
  molecule_chembl_id: 'CHEMBL25',
  molecule_hierarchy: { active_chembl_id: 'CHEMBL25', molecule_chembl_id: 'CHEMBL25', parent_chembl_id: 'CHEMBL25' },
  molecule_properties: {
    alogp: '1.31', aromatic_rings: 1, full_molformula: 'C9H8O4', full_mwt: '180.16', hba: 3, hbd: 1, heavy_atoms: 13, mw_freebase: '180.16', np_likeness_score: '-0.13', num_ro5_violations: 0, psa: '63.60', qed_weighted: '0.55', ro3_pass: 'N', rtb: 2,
  },
  molecule_structures: { canonical_smiles: 'CC(=O)Oc1ccccc1C(=O)O', molfile: MOLFILE, standard_inchi_key: 'BSYNRYMUTXBXSQ-UHFFFAOYSA-N' },
  molecule_type: 'Small molecule',
  natural_product: 0,
  oral: true,
  orphan: 0,
  parenteral: false,
  polymer_flag: 0,
  pref_name: 'ASPIRIN',
  prodrug: 0,
  therapeutic_flag: true,
  topical: false,
  usan_stem: null,
  usan_stem_definition: null,
  usan_year: null,
  withdrawn_flag: false,
  ...over,
});

test('chemblStatus reads the release and the headline counts', () => {
  const s = chemblStatus({
    activities: 24527044, chembl_db_version: 'ChEMBL_37', chembl_release_date: '2026-05-01', compound_records: 3824604, disinct_compounds: 2921148, publications: 101100, status: 'UP', targets: 18552,
  });
  assert.deepEqual(s, {
    release: 'ChEMBL_37', date: '2026-05-01', activities: 24527044, compounds: 2921148, records: 3824604, targets: 18552, documents: 101100,
  });
});

test('drugRecord keeps the fields the page draws, with numbers as numbers and the structure packed', () => {
  const r = drugRecord(molecule());
  assert.equal(r.id, 'CHEMBL25');
  assert.equal(r.name, 'ASPIRIN');
  assert.equal(r.type, 'Small molecule');
  assert.equal(r.year, 1950);
  assert.deepEqual(r.routes, ['oral']);
  assert.deepEqual(r.atc, ['N02BA01']);
  assert.deepEqual(r.p, {
    mw: 180.16, alogp: 1.31, psa: 63.6, hba: 3, hbd: 1, rtb: 2, ro5: 0, arom: 1, heavy: 13, qed: 0.55, np: -0.13,
  });
  assert.equal(r.formula, 'C9H8O4');
  assert.equal(r.smiles, 'CC(=O)Oc1ccccc1C(=O)O');
  assert.equal(r.inchikey, 'BSYNRYMUTXBXSQ-UHFFFAOYSA-N');
  assert.deepEqual(r.mol.e, ['C', 'O']);
  assert.equal(r.chirality, 2);
  assert.deepEqual(r.flags, []);
});

test('drugRecord lists the flags ChEMBL sets and leaves out missing structure and properties', () => {
  const r = drugRecord(molecule({
    black_box_warning: 1, natural_product: 1, prodrug: 1, orphan: 1, withdrawn_flag: true, first_in_class: 1, molecule_structures: null, molecule_properties: null, oral: false, parenteral: true, topical: true,
    usan_stem: '-mab', usan_stem_definition: 'monoclonal antibodies', usan_year: 1998, molecule_type: 'Antibody',
  }));
  assert.deepEqual(r.flags, ['boxed warning', 'natural product', 'prodrug', 'orphan', 'withdrawn', 'first in class']);
  assert.deepEqual(r.routes, ['parenteral', 'topical']);
  assert.equal(r.mol, null);
  assert.equal(r.p, null);
  assert.deepEqual(r.stem, { stem: '-mab', definition: 'monoclonal antibodies', year: 1998 });
});

test('approvedDrugs keeps parent compounds only, in ChEMBL ID order', () => {
  const salt = molecule({ molecule_chembl_id: 'CHEMBL1200', pref_name: 'ASPIRIN SODIUM', molecule_hierarchy: { parent_chembl_id: 'CHEMBL25', molecule_chembl_id: 'CHEMBL1200' } });
  const other = molecule({ molecule_chembl_id: 'CHEMBL3', pref_name: 'NICOTINE' });
  assert.deepEqual(approvedDrugs([salt, molecule(), other]).map((d) => d.id), ['CHEMBL3', 'CHEMBL25']);
});

test('atcNames gives every level of the ATC hierarchy its name', () => {
  const names = atcNames([
    {
      level1: 'N', level1_description: 'NERVOUS SYSTEM', level2: 'N02', level2_description: 'ANALGESICS', level3: 'N02B', level3_description: 'OTHER ANALGESICS AND ANTIPYRETICS', level4: 'N02BE', level4_description: 'Anilides', level5: 'N02BE01', who_name: 'paracetamol',
    },
    {
      level1: 'N', level1_description: 'NERVOUS SYSTEM', level2: 'N02', level2_description: 'ANALGESICS', level3: 'N02B', level3_description: 'OTHER ANALGESICS AND ANTIPYRETICS', level4: 'N02BA', level4_description: 'Salicylic acid and derivatives', level5: 'N02BA01', who_name: 'acetylsalicylic acid',
    },
  ]);
  assert.deepEqual(names, {
    N: 'NERVOUS SYSTEM', N02: 'ANALGESICS', N02B: 'OTHER ANALGESICS AND ANTIPYRETICS', N02BE: 'Anilides', N02BE01: 'paracetamol', N02BA: 'Salicylic acid and derivatives', N02BA01: 'acetylsalicylic acid',
  });
});

test('pages follows ChEMBL next links until the last page', async () => {
  const seen = [];
  const fetchJson = async (path) => {
    seen.push(path);
    if (path.includes('offset=2')) return { molecules: [{ n: 3 }], page_meta: { next: null } };
    return { molecules: [{ n: 1 }, { n: 2 }], page_meta: { next: '/chembl/api/data/molecule.json?limit=2&offset=2' } };
  };
  const rows = await pages(fetchJson, 'molecule.json?limit=2', 'molecules');
  assert.deepEqual(rows.map((r) => r.n), [1, 2, 3]);
  assert.deepEqual(seen, ['molecule.json?limit=2', 'molecule.json?limit=2&offset=2']);
});

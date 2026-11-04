export const USER_AGENT = 'basic-clinical-pharm-snapshot (https://github.com/collide2954/basic-clinical-pharm)';

export const CHEMBL = 'https://www.ebi.ac.uk/chembl/api/data/';

export const DRUG_FIELDS = [
  'molecule_chembl_id', 'pref_name', 'molecule_type', 'first_approval', 'molecule_hierarchy', 'molecule_structures', 'molecule_properties', 'usan_stem', 'usan_stem_definition', 'usan_year',
  'chirality', 'oral', 'parenteral', 'topical', 'black_box_warning', 'natural_product', 'prodrug', 'orphan', 'withdrawn_flag', 'first_in_class', 'atc_classifications', 'availability_type',
];

export const FILES = {
  chemblStatus: `${CHEMBL}status.json`,
  chemblApproved: `${CHEMBL}molecule.json?${new URLSearchParams({ max_phase: '4', limit: '1000', only: DRUG_FIELDS.join(',') })}`,
  chemblAtc: `${CHEMBL}atc_class.json?limit=1000`,
};

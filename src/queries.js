export const USER_AGENT = 'basic-clinical-pharm-snapshot (https://github.com/collide2954/basic-clinical-pharm)';

export const CHEMBL = 'https://www.ebi.ac.uk/chembl/api/data/';

export const DRUG_FIELDS = [
  'molecule_chembl_id', 'pref_name', 'molecule_type', 'first_approval', 'molecule_hierarchy', 'molecule_structures', 'molecule_properties', 'usan_stem', 'usan_stem_definition', 'usan_year',
  'chirality', 'oral', 'parenteral', 'topical', 'black_box_warning', 'natural_product', 'prodrug', 'orphan', 'withdrawn_flag', 'first_in_class', 'atc_classifications', 'availability_type',
];

export const MECHANISM_FIELDS = ['molecule_chembl_id', 'parent_molecule_chembl_id', 'target_chembl_id', 'action_type', 'mechanism_of_action', 'direct_interaction', 'disease_efficacy'];

export const DAVIS_FIELDS = [
  'molecule_chembl_id', 'molecule_pref_name', 'target_chembl_id', 'target_pref_name', 'target_organism', 'assay_chembl_id', 'assay_description', 'assay_variant_mutation', 'pchembl_value', 'standard_relation', 'standard_value', 'standard_type',
];

export const DAVIS_DOCUMENT = 'CHEMBL1908390';

export const FILES = {
  chemblStatus: `${CHEMBL}status.json`,
  chemblApproved: `${CHEMBL}molecule.json?${new URLSearchParams({ max_phase: '4', limit: '1000', only: DRUG_FIELDS.join(',') })}`,
  chemblAtc: `${CHEMBL}atc_class.json?limit=1000`,
  chemblMechanisms: `${CHEMBL}mechanism.json?${new URLSearchParams({ max_phase: '4', limit: '1000', only: MECHANISM_FIELDS.join(',') })}`,
  chemblTargets: `${CHEMBL}target.json`,
  chemblComponents: `${CHEMBL}target_component.json`,
  chemblClasses: `${CHEMBL}protein_classification.json?limit=1000`,
  davis: `${CHEMBL}activity.json?${new URLSearchParams({ document_chembl_id: DAVIS_DOCUMENT, limit: '1000', only: DAVIS_FIELDS.join(',') })}`,
  gtopdbTargets: 'https://www.guidetopharmacology.org/DATA/targets_and_families.csv',
  gtopdbInteractions: 'https://www.guidetopharmacology.org/DATA/interactions.csv',
  rcsbSearch: 'https://search.rcsb.org/rcsbsearch/v2/query',
  gpcrdb: 'https://gpcrdb.org/services/structure/',
  clinvarGenes: 'https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/gene_specific_summary.txt',
  hgncCoding: 'https://storage.googleapis.com/public-download-files/hgnc/tsv/tsv/locus_types/gene_with_protein_product.txt',
};

export const RCSB_YEARS = {
  query: {
    type: 'terminal', service: 'text', parameters: { attribute: 'rcsb_entry_info.structure_determination_methodology', operator: 'exact_match', value: 'experimental' },
  },
  return_type: 'entry',
  request_options: {
    paginate: { start: 0, rows: 0 },
    results_content_type: ['experimental'],
    facets: [{
      name: 'year',
      aggregation_type: 'date_histogram',
      attribute: 'rcsb_accession_info.initial_release_date',
      interval: 'year',
      min_interval_population: 1,
      facets: [{
        name: 'method', aggregation_type: 'terms', attribute: 'exptl.method', min_interval_population: 1,
      }],
    }],
  },
};

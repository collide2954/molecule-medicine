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

export const DOCUMENTS = {
  davis: 'CHEMBL1908390', karaman: 'CHEMBL1150977', klaeger: 'CHEMBL3991601', k4dd: 'CHEMBL3885741',
};

export const DAVIS_DOCUMENT = DOCUMENTS.davis;

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
  chemblSearch: 'https://www.ebi.ac.uk/chembl/elk/es/chembl_activity/_search',
  chemblSources: `${CHEMBL}source.json?limit=1000`,
  almanac: 'https://wiki.nci.nih.gov/download/attachments/338237347/ComboDrugGrowth_Nov2017.zip',
  almanacNames: 'https://wiki.nci.nih.gov/download/attachments/338237347/ComboCompoundNames_small.txt',
  fdaInteractions: 'https://www.fda.gov/drugs/drug-interactions-labeling/healthcare-professionals-fdas-examples-drugs-interact-cyp-enzymes-and-transporter-systems',
  cipaIc50: 'https://raw.githubusercontent.com/FDA/CiPA/539ff80d6616895de5d943e7bfb77b346d195db4/Hill_fitting/data/Li2017_IC50.csv',
  cipaDrugs: 'https://raw.githubusercontent.com/FDA/CiPA/539ff80d6616895de5d943e7bfb77b346d195db4/AP_simulation/data/CiPA_training_drugs.csv',
};

export const PK_PARAMETERS = [
  {
    key: 'f', type: 'F', units: '%', targets: ['Homo sapiens'],
  },
  {
    key: 'halfLife', type: 'T1/2', units: 'hr', targets: ['Homo sapiens'],
  },
  {
    key: 'ppb', type: 'PPB', units: '%', targets: ['Homo sapiens', 'Plasma', 'Serum'],
  },
];

export const pkQuery = (parameter, ids) => ({
  size: 0,
  query: {
    bool: {
      filter: [
        { term: { standard_type: parameter.type } },
        { term: { standard_units: parameter.units } },
        { term: { assay_type: 'A' } },
        { term: { target_organism: 'Homo sapiens' } },
        { terms: { target_pref_name: parameter.targets } },
        { term: { standard_relation: '=' } },
        { terms: { parent_molecule_chembl_id: ids } },
      ],
    },
  },
  aggs: { drugs: { terms: { field: 'parent_molecule_chembl_id', size: 5000 }, aggs: { median: { percentiles: { field: 'standard_value', percents: [50] } } } } },
});

const terms = (field, size) => ({ terms: { field, size } });

export const ACTIVITY_AGGS = {
  size: 0,
  track_total_hits: true,
  aggs: {
    types: terms('standard_type', 30),
    assay: terms('assay_type', 10),
    year: { histogram: { field: 'document_year', interval: 1, min_doc_count: 1 } },
    pchembl: { histogram: { field: 'pchembl_value', interval: 0.5, min_doc_count: 1 } },
    source: terms('src_id', 100),
    relation: terms('standard_relation', 10),
    withp: { filter: { exists: { field: 'pchembl_value' } } },
    phantom: { filter: { bool: { must: [{ terms: { standard_type: ['kon', 'k_off'] } }], must_not: [{ exists: { field: 'standard_value' } }] } } },
    duplicates: terms('potential_duplicate', 5),
    validity: terms('data_validity_comment', 12),
    formats: terms('bao_label', 12),
    potent: {
      filter: { exists: { field: 'pchembl_value' } },
      aggs: {
        types: { ...terms('standard_type', 6), aggs: { bins: { histogram: { field: 'pchembl_value', interval: 0.5, min_doc_count: 1 } } } },
        molecules: terms('molecule_pref_name', 15),
        organisms: terms('target_organism', 12),
      },
    },
  },
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

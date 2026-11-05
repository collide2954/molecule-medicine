export const USER_AGENT = 'molecule-medicine-snapshot (https://github.com/collide2954/molecule-medicine)';

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

export const CTGOV = 'https://clinicaltrials.gov/api/v2/';

export const CT_FIELDS = ['Phase', 'OverallStatus', 'StudyType', 'LeadSponsorClass', 'HasResults'];

export const OPENFDA = 'https://api.fda.gov/';

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
  ctSize: `${CTGOV}stats/size`,
  ctFields: `${CTGOV}stats/field/values?${new URLSearchParams({ fields: CT_FIELDS.join(',') })}`,
  ctStudies: `${CTGOV}studies`,
  fdaEnforcement: `${OPENFDA}drug/enforcement.json`,
  fdaShortages: `${OPENFDA}drug/shortages.json`,
  nitrosamineLimits: 'https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cder-nitrosamine-impurity-acceptable-intake-limits',
  iidPage: 'https://www.fda.gov/drugs/drug-approvals-and-databases/inactive-ingredients-database-download',
  drugsAtFda: 'https://www.fda.gov/media/89850/download?attachment',
  orangeBook: 'https://www.fda.gov/media/76860/download?attachment',
  emaMedicines: 'https://www.ema.europa.eu/en/documents/report/medicines-output-medicines-report_en.xlsx',
  biosimilars: 'https://www.fda.gov/drugs/biosimilars/biosimilar-product-information',
};

export const openfdaPage = (url, skip, limit = 1000) => `${url}?${new URLSearchParams({ limit: String(limit), skip: String(skip) })}`;

export const DRUG_TRIALS = 'AREA[StudyType]INTERVENTIONAL AND AREA[InterventionType](DRUG OR BIOLOGICAL)';

export const PHASE_GROUPS = [
  { key: 'early1', label: 'Early phase 1', expr: 'AREA[Phase]EARLY_PHASE1' },
  { key: 'p1', label: 'Phase 1', expr: 'AREA[Phase]PHASE1 AND NOT AREA[Phase]PHASE2' },
  { key: 'p12', label: 'Phase 1/2', expr: 'AREA[Phase]PHASE1 AND AREA[Phase]PHASE2' },
  { key: 'p2', label: 'Phase 2', expr: 'AREA[Phase]PHASE2 AND NOT AREA[Phase]PHASE1 AND NOT AREA[Phase]PHASE3' },
  { key: 'p23', label: 'Phase 2/3', expr: 'AREA[Phase]PHASE2 AND AREA[Phase]PHASE3' },
  { key: 'p3', label: 'Phase 3', expr: 'AREA[Phase]PHASE3 AND NOT AREA[Phase]PHASE2' },
  { key: 'p4', label: 'Phase 4', expr: 'AREA[Phase]PHASE4' },
  { key: 'na', label: 'No phase', expr: 'AREA[Phase]NA' },
];

export const TRIAL_FEATURES = [
  { key: 'randomized', label: 'randomized', expr: 'AREA[DesignAllocation]RANDOMIZED' },
  { key: 'blinded', label: 'double-blind or more', expr: 'AREA[DesignMasking](DOUBLE OR TRIPLE OR QUADRUPLE)' },
  { key: 'placebo', label: 'placebo arm', expr: 'AREA[ArmGroupType]PLACEBO_COMPARATOR' },
  { key: 'healthy', label: 'healthy volunteers', expr: 'AREA[HealthyVolunteers]true' },
  { key: 'children', label: 'children', expr: 'AREA[StdAge]CHILD' },
  { key: 'industry', label: 'industry lead', expr: 'AREA[LeadSponsorClass]INDUSTRY' },
  { key: 'us', label: 'US site', expr: 'AREA[LocationCountry]"United States"' },
  { key: 'terminated', label: 'terminated', expr: 'AREA[OverallStatus]TERMINATED' },
  { key: 'withdrawn', label: 'withdrawn', expr: 'AREA[OverallStatus]WITHDRAWN' },
  {
    key: 'results', label: 'results, if completed', expr: 'AREA[HasResults]true', of: 'AREA[OverallStatus]COMPLETED',
  },
];

export const ENROLLMENT_BINS = [
  {
    key: 'e20', label: '20 or fewer', lo: 0, hi: 20,
  },
  {
    key: 'e50', label: '21 to 50', lo: 21, hi: 50,
  },
  {
    key: 'e100', label: '51 to 100', lo: 51, hi: 100,
  },
  {
    key: 'e300', label: '101 to 300', lo: 101, hi: 300,
  },
  {
    key: 'e1000', label: '301 to 1,000', lo: 301, hi: 1000,
  },
  {
    key: 'more', label: 'over 1,000', lo: 1001, hi: 'MAX',
  },
];

export const enrolled = (bin) => `AREA[EnrollmentCount]RANGE[${bin.lo},${bin.hi}]`;

export const postedIn = (year) => `AREA[StudyFirstPostDate]RANGE[${year}-01-01,${year}-12-31]`;

export const postedBefore = (year) => `AREA[StudyFirstPostDate]RANGE[MIN,${year - 1}-12-31]`;

export const ctCount = (expr) => `${FILES.ctStudies}?${new URLSearchParams({
  'filter.advanced': expr, countTotal: 'true', pageSize: '1', fields: 'NCTId',
})}`;

export const ctPage = (params, token) => `${FILES.ctStudies}?${new URLSearchParams({ ...params, pageSize: '1000', ...(token ? { pageToken: token } : {}) })}`;

const REPORTING_FROM = '2018-01-01';
const REPORTING_TO = '2021-12-31';

export const REPORTING = {
  from: REPORTING_FROM,
  to: REPORTING_TO,
  expr: `AREA[StudyType]INTERVENTIONAL AND AREA[IsFDARegulatedDrug]true AND AREA[Phase](PHASE2 OR PHASE3 OR PHASE4) AND AREA[PrimaryCompletionDateType]ACTUAL AND AREA[PrimaryCompletionDate]RANGE[${REPORTING_FROM},${REPORTING_TO}]`,
  fields: ['NCTId', 'OverallStatus', 'Phase', 'LeadSponsorClass', 'StartDate', 'PrimaryCompletionDate', 'ResultsFirstSubmitDate', 'ResultsFirstPostDate', 'DispFirstSubmitDate'],
};

export const PSYCHOACTIVE = [
  {
    key: 'psilocybin', label: 'psilocybin', group: 'psychedelics', search: 'psilocybin OR psilocin OR COMP360', pattern: 'psilocybin|psilocin|\\bCOMP ?360\\b',
  },
  {
    key: 'mdma', label: 'MDMA', group: 'psychedelics', search: 'MDMA OR midomafetamine OR methylenedioxymethamphetamine', pattern: '\\bMDMA\\b|midomafetamine|methylenedioxymethamphetamine',
  },
  {
    key: 'lsd', label: 'LSD', group: 'psychedelics', search: 'lysergic acid diethylamide OR lysergide OR LSD OR MM120', pattern: 'lysergic acid diethylamide|lysergide|\\bLSD\\b|\\b(?:MM|DT)-?120\\b',
  },
  {
    key: 'dmt', label: 'DMT and ayahuasca', group: 'psychedelics', search: 'dimethyltryptamine OR DMT OR ayahuasca OR SPL026', pattern: 'dimethyltryptamine|\\bDMT\\b|ayahuasca|\\bSPL-?026\\b', not: 'meo|methoxy|hydroxy|phosphoryl', unless: '\\bMS\\b|RRMS|sclerosis|neuromyelitis|demyelinat',
  },
  {
    key: 'meodmt', label: '5-MeO-DMT', group: 'psychedelics', search: '5-MeO-DMT OR mebufotenin OR GH001 OR BPL-003', pattern: '5[- ]?meo|methoxy[- ]?n, ?n[- ]?dimethyltryptamine|mebufotenin|\\bGH00[12]\\b|\\bBPL-?003\\b',
  },
  {
    key: 'ibogaine', label: 'ibogaine', group: 'psychedelics', search: 'ibogaine OR noribogaine', pattern: 'ibogaine',
  },
  {
    key: 'ketamine', label: 'ketamine for depression', group: 'psychedelics', search: 'ketamine OR esketamine', cond: 'depression OR depressive', pattern: 'ketamine', when: 'depress', unless: 'respiratory depression',
  },
  {
    key: 'cbd', label: 'cannabidiol', group: 'cannabinoids', search: 'cannabidiol OR CBD OR Epidiolex', pattern: 'cannabidiol|\\bCBD\\b|epidiolex', not: 'clonidine',
  },
  {
    key: 'thc', label: 'THC, dronabinol, nabilone', group: 'cannabinoids', search: 'dronabinol OR nabilone OR tetrahydrocannabinol OR THC OR nabiximols OR Sativex', pattern: 'dronabinol|nabilone|tetrahydrocannabinol|\\bTHC\\b|nabiximols|sativex|marinol|syndros|cesamet',
  },
  {
    key: 'cannabis', label: 'cannabis', group: 'cannabinoids', search: 'cannabis OR marijuana OR marihuana', pattern: 'cannabis|marijuana|marihuana',
  },
];

export const PSYCHOACTIVE_FIELDS = ['NCTId', 'OverallStatus', 'StartDate', 'Phase', 'InterventionType', 'InterventionName', 'InterventionOtherName', 'Condition'];

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

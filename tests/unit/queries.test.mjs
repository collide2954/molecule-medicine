import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FILES, USER_AGENT, CHEMBL, RCSB_YEARS, ACTIVITY_AGGS, DOCUMENTS, PK_PARAMETERS, pkQuery,
} from '../../src/queries.js';

test('the ADME queries ask ChEMBL for human in vivo values of approved drugs and read the FDA and CiPA tables', () => {
  assert.deepEqual(PK_PARAMETERS.map((p) => [p.key, p.type, p.units]), [['f', 'F', '%'], ['halfLife', 'T1/2', 'hr'], ['ppb', 'PPB', '%']]);
  const q = pkQuery(PK_PARAMETERS[0], ['CHEMBL25', 'CHEMBL3']);
  const filters = q.query.bool.filter;
  assert.ok(filters.some((f) => f.term?.standard_type === 'F'));
  assert.ok(filters.some((f) => f.term?.assay_type === 'A'));
  assert.ok(filters.some((f) => f.term?.target_organism === 'Homo sapiens'));
  assert.ok(filters.some((f) => f.term?.standard_relation === '='));
  assert.deepEqual(filters.find((f) => f.terms?.parent_molecule_chembl_id).terms.parent_molecule_chembl_id, ['CHEMBL25', 'CHEMBL3']);
  assert.deepEqual(q.aggs.drugs.aggs.median.percentiles.percents, [50]);
  assert.equal(q.size, 0);
  assert.match(FILES.fdaInteractions, /^https:\/\/www\.fda\.gov\/drugs\/drug-interactions-labeling\/healthcare-professionals-fdas-examples-drugs-interact-cyp-enzymes-and-transporter-systems$/);
  assert.match(FILES.cipaIc50, /FDA\/CiPA\/[0-9a-f]{40}\/Hill_fitting\/data\/Li2017_IC50\.csv$/);
  assert.match(FILES.cipaDrugs, /FDA\/CiPA\/[0-9a-f]{40}\/AP_simulation\/data\/CiPA_training_drugs\.csv$/);
});

test('every source file is an https URL', () => {
  assert.ok(Object.keys(FILES).length >= 3);
  for (const [key, url] of Object.entries(FILES)) {
    assert.match(url, /^https:\/\//, key);
    assert.doesNotThrow(() => new URL(url), key);
  }
});

test('the user agent names the project', () => {
  assert.match(USER_AGENT, /basic-clinical-pharm/);
  assert.match(USER_AGENT, /github\.com\/collide2954\/basic-clinical-pharm/);
});

test('the ChEMBL queries ask for approved drugs with their structures, properties and flags', () => {
  assert.equal(CHEMBL, 'https://www.ebi.ac.uk/chembl/api/data/');
  const approved = new URL(FILES.chemblApproved);
  assert.equal(approved.searchParams.get('max_phase'), '4');
  assert.equal(approved.searchParams.get('limit'), '1000');
  const only = approved.searchParams.get('only').split(',');
  for (const field of ['molecule_chembl_id', 'molecule_structures', 'molecule_properties', 'molecule_hierarchy', 'first_approval', 'usan_stem', 'orphan', 'withdrawn_flag']) assert.ok(only.includes(field), field);
  assert.match(FILES.chemblStatus, /status\.json$/);
  assert.match(FILES.chemblAtc, /atc_class\.json\?limit=1000$/);
});

test('the targets queries ask for approved-drug mechanisms, protein classes, GtoPdb, the Davis panel, structures and genes', () => {
  const mech = new URL(FILES.chemblMechanisms);
  assert.equal(mech.searchParams.get('max_phase'), '4');
  assert.equal(mech.searchParams.get('limit'), '1000');
  for (const field of ['parent_molecule_chembl_id', 'target_chembl_id', 'action_type', 'mechanism_of_action', 'direct_interaction']) assert.ok(mech.searchParams.get('only').split(',').includes(field), field);
  assert.match(FILES.chemblClasses, /protein_classification\.json\?limit=1000$/);
  const davis = new URL(FILES.davis);
  assert.equal(davis.searchParams.get('document_chembl_id'), 'CHEMBL1908390');
  for (const field of ['assay_chembl_id', 'assay_description', 'assay_variant_mutation', 'pchembl_value', 'standard_relation']) assert.ok(davis.searchParams.get('only').split(',').includes(field), field);
  assert.match(FILES.gtopdbTargets, /guidetopharmacology\.org\/DATA\/targets_and_families\.csv$/);
  assert.match(FILES.gtopdbInteractions, /guidetopharmacology\.org\/DATA\/interactions\.csv$/);
  assert.match(FILES.gpcrdb, /gpcrdb\.org\/services\/structure\/$/);
  assert.match(FILES.rcsbSearch, /search\.rcsb\.org\/rcsbsearch\/v2\/query$/);
  assert.equal(RCSB_YEARS.request_options.facets[0].attribute, 'rcsb_accession_info.initial_release_date');
  assert.equal(RCSB_YEARS.request_options.facets[0].facets[0].attribute, 'exptl.method');
  assert.match(FILES.clinvarGenes, /clinvar\/tab_delimited\/gene_specific_summary\.txt$/);
  assert.match(FILES.hgncCoding, /locus_types\/gene_with_protein_product\.txt$/);
});

test('the bioactivity queries aggregate ChEMBL activities and fetch K4DD, Karaman 2008 and NCI-ALMANAC', () => {
  assert.match(FILES.chemblSearch, /^https:\/\/www\.ebi\.ac\.uk\/chembl\/elk\/es\/chembl_activity\/_search$/);
  assert.match(FILES.chemblSources, /source\.json\?limit=1000$/);
  assert.equal(ACTIVITY_AGGS.size, 0);
  assert.equal(ACTIVITY_AGGS.track_total_hits, true);
  for (const name of ['types', 'assay', 'year', 'pchembl', 'source', 'relation', 'withp', 'phantom', 'duplicates', 'validity', 'formats', 'potent']) assert.ok(ACTIVITY_AGGS.aggs[name], name);
  assert.equal(ACTIVITY_AGGS.aggs.pchembl.histogram.interval, 0.5);
  for (const name of ['types', 'molecules', 'organisms']) assert.ok(ACTIVITY_AGGS.aggs.potent.aggs[name], name);
  assert.deepEqual(DOCUMENTS, {
    davis: 'CHEMBL1908390', karaman: 'CHEMBL1150977', klaeger: 'CHEMBL3991601', k4dd: 'CHEMBL3885741',
  });
  assert.match(FILES.almanac, /wiki\.nci\.nih\.gov\/download\/attachments\/338237347\/ComboDrugGrowth_Nov2017\.zip$/);
  assert.match(FILES.almanacNames, /ComboCompoundNames_small\.txt$/);
});

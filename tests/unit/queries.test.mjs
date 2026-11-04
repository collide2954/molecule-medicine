import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILES, USER_AGENT, CHEMBL } from '../../src/queries.js';

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

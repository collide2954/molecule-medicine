import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ctFieldValues, ctStudies, monthsBetween, reportingTimes, startYears,
} from '../../scripts/trials.mjs';

test('ctFieldValues reads value counts for each field the registry reports', () => {
  const json = [
    {
      field: 'protocolSection.designModule.phases', piece: 'Phase', missingStudiesCount: 5, topValues: [{ value: 'PHASE2', studiesCount: 90 }, { value: 'NA', studiesCount: 200 }],
    },
    {
      field: 'protocolSection.statusModule.overallStatus', piece: 'OverallStatus', missingStudiesCount: 0, topValues: [{ value: 'COMPLETED', studiesCount: 300 }],
    },
  ];
  assert.deepEqual(ctFieldValues(json), {
    Phase: { missing: 5, values: [{ value: 'NA', n: 200 }, { value: 'PHASE2', n: 90 }] },
    OverallStatus: { missing: 0, values: [{ value: 'COMPLETED', n: 300 }] },
  });
});

const study = (nct, completion, results, sponsor, phases = ['PHASE3'], start = '2015-03') => ({
  protocolSection: {
    identificationModule: { nctId: nct },
    statusModule: {
      overallStatus: 'COMPLETED', startDateStruct: { date: start }, primaryCompletionDateStruct: { date: completion }, ...(results ? { resultsFirstPostDateStruct: { date: results } } : {}),
    },
    sponsorCollaboratorsModule: { leadSponsor: { class: sponsor } },
    designModule: { phases },
  },
  hasResults: Boolean(results),
});

test('ctStudies flattens study records to the dates and classes the charts use', () => {
  assert.deepEqual(ctStudies({ studies: [study('NCT1', '2018-02-28', '2019-01-15', 'INDUSTRY'), study('NCT2', '2018-06', null, 'OTHER', ['PHASE2', 'PHASE3'])] }), [
    {
      nct: 'NCT1', status: 'COMPLETED', phases: ['PHASE3'], sponsor: 'INDUSTRY', start: '2015-03', completion: '2018-02-28', results: '2019-01-15',
    },
    {
      nct: 'NCT2', status: 'COMPLETED', phases: ['PHASE2', 'PHASE3'], sponsor: 'OTHER', start: '2015-03', completion: '2018-06', results: null,
    },
  ]);
});

test('monthsBetween measures months between registry dates, reading a bare month as its middle', () => {
  assert.equal(monthsBetween('2018-01-15', '2019-01-15'), 12);
  assert.equal(monthsBetween('2018-06', '2018-07-15'), 1);
  assert.equal(monthsBetween('2018-03-01', '2018-02-01'), -1);
});

test('reportingTimes gives months to results for reported trials and censors the rest at the snapshot date', () => {
  const rows = ctStudies({ studies: [study('NCT1', '2018-01-15', '2019-01-15', 'INDUSTRY'), study('NCT2', '2018-06', null, 'OTHER'), study('NCT3', '2018-03-15', '2017-12-15', 'OTHER')] });
  assert.deepEqual(reportingTimes(rows, '2020-06-15'), [
    { months: 12, event: true, sponsor: 'INDUSTRY' },
    { months: 24, event: false, sponsor: 'OTHER' },
    { months: 0, event: true, sponsor: 'OTHER' },
  ]);
});

test('startYears counts studies by the year they started', () => {
  const rows = ctStudies({ studies: [study('NCT1', '2018-01', null, 'OTHER', ['PHASE2'], '2019-05'), study('NCT2', '2018-01', null, 'OTHER', ['PHASE2'], '2019-11-02'), study('NCT3', '2018-01', null, 'OTHER', ['PHASE2'], '2021')] });
  assert.deepEqual(startYears(rows), { 2019: 2, 2021: 1 });
});

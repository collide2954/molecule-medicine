import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ctFieldValues, ctStudies, monthsBetween, reportingTimes, reportingGroups, sponsorGroup, startYears, phaseGroup, phaseCounts, matchesCompound, compoundTrials,
} from '../../scripts/trials.mjs';
import { PSYCHOACTIVE } from '../../src/queries.js';

test('ctFieldValues reads value counts for each field the registry reports', () => {
  const json = [
    {
      field: 'protocolSection.designModule.phases', piece: 'Phase', missingStudiesCount: 5, topValues: [{ value: 'PHASE2', studiesCount: 90 }, { value: 'NA', studiesCount: 200 }],
    },
    {
      field: 'protocolSection.statusModule.overallStatus', piece: 'OverallStatus', missingStudiesCount: 0, topValues: [{ value: 'COMPLETED', studiesCount: 300 }],
    },
    {
      type: 'BOOLEAN', piece: 'HasResults', field: 'hasResults', missingStudiesCount: 0, falseCount: 250, trueCount: 50,
    },
  ];
  assert.deepEqual(ctFieldValues(json), {
    Phase: { missing: 5, values: [{ value: 'NA', n: 200 }, { value: 'PHASE2', n: 90 }] },
    OverallStatus: { missing: 0, values: [{ value: 'COMPLETED', n: 300 }] },
    HasResults: { missing: 0, values: [{ value: 'false', n: 250 }, { value: 'true', n: 50 }] },
  });
});

const study = (nct, {
  completion = '2018-01-15', submitted = null, posted = null, certified = null, sponsor = 'OTHER', phases = ['PHASE3'], start = '2015-03', interventions = [], conditions = [],
} = {}) => ({
  protocolSection: {
    identificationModule: { nctId: nct },
    statusModule: {
      overallStatus: 'COMPLETED',
      startDateStruct: { date: start },
      primaryCompletionDateStruct: { date: completion, type: 'ACTUAL' },
      ...(submitted ? { resultsFirstSubmitDate: submitted } : {}),
      ...(posted ? { resultsFirstPostDateStruct: { date: posted } } : {}),
      ...(certified ? { dispFirstSubmitDate: certified } : {}),
    },
    sponsorCollaboratorsModule: { leadSponsor: { class: sponsor } },
    designModule: { phases },
    ...(interventions.length ? { armsInterventionsModule: { interventions } } : {}),
    ...(conditions.length ? { conditionsModule: { conditions } } : {}),
  },
});

const drug = (name, otherNames = [], type = 'DRUG') => ({ type, name, ...(otherNames.length ? { otherNames } : {}) });

test('ctStudies flattens study records to the dates, classes, interventions and conditions the charts use', () => {
  const json = {
    studies: [
      study('NCT1', {
        completion: '2018-02-28', submitted: '2018-12-20', posted: '2019-01-15', sponsor: 'INDUSTRY', interventions: [drug('GH001', ['5-MeO-DMT']), drug('Placebo', [], 'OTHER')], conditions: ['Depression'],
      }),
      study('NCT2', { completion: '2018-06', certified: '2019-05-01', phases: ['PHASE2', 'PHASE3'] }),
    ],
  };
  assert.deepEqual(ctStudies(json), [
    {
      nct: 'NCT1',
      status: 'COMPLETED',
      phases: ['PHASE3'],
      sponsor: 'INDUSTRY',
      start: '2015-03',
      completion: '2018-02-28',
      submitted: '2018-12-20',
      posted: '2019-01-15',
      certified: false,
      interventions: [{ type: 'DRUG', names: ['GH001', '5-MeO-DMT'] }, { type: 'OTHER', names: ['Placebo'] }],
      conditions: ['Depression'],
    },
    {
      nct: 'NCT2',
      status: 'COMPLETED',
      phases: ['PHASE2', 'PHASE3'],
      sponsor: 'OTHER',
      start: '2015-03',
      completion: '2018-06',
      submitted: null,
      posted: null,
      certified: true,
      interventions: [],
      conditions: [],
    },
  ]);
});

test('monthsBetween measures months between registry dates, reading a bare month as its middle', () => {
  assert.equal(monthsBetween('2018-01-15', '2019-01-15'), 12);
  assert.equal(monthsBetween('2018-06', '2018-07-15'), 1);
  assert.equal(monthsBetween('2018-03-01', '2018-02-01'), -1);
});

test('reportingTimes gives months to the first results submission and censors the rest at the snapshot date', () => {
  const rows = ctStudies({
    studies: [
      study('NCT1', { completion: '2018-01-15', submitted: '2019-01-15', posted: '2019-04-15', sponsor: 'INDUSTRY' }),
      study('NCT2', { completion: '2018-06', certified: '2018-11-02' }),
      study('NCT3', { completion: '2018-03-15', submitted: '2017-12-15' }),
      study('NCT4', { completion: null }),
    ],
  });
  assert.deepEqual(reportingTimes(rows, '2020-06-15'), [
    {
      months: 12, event: true, sponsor: 'INDUSTRY', certified: false,
    },
    {
      months: 24, event: false, sponsor: 'OTHER', certified: true,
    },
    {
      months: 0, event: true, sponsor: 'OTHER', certified: false,
    },
  ]);
});

test('sponsorGroup and reportingGroups split reporting times by sponsor, with delay certifications apart', () => {
  assert.deepEqual(['INDUSTRY', 'NIH', 'FED', 'OTHER_GOV', 'OTHER', 'NETWORK', 'UNKNOWN', null].map(sponsorGroup), ['industry', 'federal', 'federal', 'other', 'other', 'other', 'other', 'other']);
  const times = [
    {
      months: 12, event: true, sponsor: 'INDUSTRY', certified: false,
    },
    {
      months: 12, event: true, sponsor: 'INDUSTRY', certified: true,
    },
    {
      months: 3, event: true, sponsor: 'INDUSTRY', certified: false,
    },
    {
      months: 60, event: false, sponsor: 'INDUSTRY', certified: false,
    },
    {
      months: 30, event: true, sponsor: 'OTHER', certified: false,
    },
  ];
  assert.deepEqual(reportingGroups(times), [
    {
      key: 'industry', n: 3, events: [[3, 1], [12, 1]], censored: [[60, 1]],
    },
    {
      key: 'federal', n: 0, events: [], censored: [],
    },
    {
      key: 'other', n: 1, events: [[30, 1]], censored: [],
    },
    {
      key: 'certified', n: 1, events: [[12, 1]], censored: [], sponsors: { industry: 1, federal: 0, other: 0 },
    },
  ]);
});

test('startYears counts studies by the year they started', () => {
  const rows = ctStudies({ studies: [study('NCT1', { start: '2019-05' }), study('NCT2', { start: '2019-11-02' }), study('NCT3', { start: '2021' }), study('NCT4', { start: null })] });
  assert.deepEqual(startYears(rows), { 2019: 2, 2021: 1 });
});

test('phaseGroup files each study under one phase group and phaseCounts tallies them', () => {
  assert.deepEqual([['EARLY_PHASE1'], ['PHASE1'], ['PHASE1', 'PHASE2'], ['PHASE2'], ['PHASE2', 'PHASE3'], ['PHASE3'], ['PHASE4'], ['NA'], []].map(phaseGroup), ['early1', 'p1', 'p12', 'p2', 'p23', 'p3', 'p4', 'na', 'na']);
  const rows = ctStudies({ studies: [study('NCT1', { phases: ['PHASE2'] }), study('NCT2', { phases: ['PHASE2'] }), study('NCT3', { phases: ['PHASE1', 'PHASE2'] })] });
  assert.deepEqual(phaseCounts(rows), {
    early1: 0, p1: 0, p12: 1, p2: 2, p23: 0, p3: 0, p4: 0, na: 0,
  });
});

const spec = (key) => PSYCHOACTIVE.find((p) => p.key === key);
const row = (interventions, conditions = []) => ctStudies({ studies: [study('NCT9', { interventions, conditions })] })[0];

test('matchesCompound reads intervention names and other names, telling DMT from its methoxy and phosphoryl relatives', () => {
  const psilocybin = row([drug('psilocybin', ['O-phosphoryl-4-hydroxy-N,N-dimethyltryptamine'])]);
  assert.equal(matchesCompound(psilocybin, spec('psilocybin')), true);
  assert.equal(matchesCompound(psilocybin, spec('dmt')), false);
  const gh001 = row([drug('GH001', ['5-Methoxy-N,N-Dimethyltryptamine', '5-MeO-DMT', 'Mebufotenin'])]);
  assert.equal(matchesCompound(gh001, spec('meodmt')), true);
  assert.equal(matchesCompound(gh001, spec('dmt')), false);
  const spl026 = row([drug('SPL026', ['N,N-dimethyltryptamine', 'DMT'])]);
  assert.equal(matchesCompound(spl026, spec('dmt')), true);
  assert.equal(matchesCompound(spl026, spec('meodmt')), false);
  assert.equal(matchesCompound(row([drug('BPL-003')]), spec('meodmt')), true);
  assert.equal(matchesCompound(row([drug('Ayahuasca'), drug('Esketamine')]), spec('dmt')), true);
  assert.equal(matchesCompound(row([drug('DMT', [], 'DRUG')], ['Healthy Volunteers']), spec('dmt')), true);
  assert.equal(matchesCompound(row([drug('DMT continuation')], ['Multiple Sclerosis']), spec('dmt')), false);
  assert.equal(matchesCompound(row([drug('Standard MS DMT', ['Avonex'])], ['Relapsing Remitting MS']), spec('dmt')), false);
});

test('matchesCompound does not take a nerve-block cocktail abbreviated CBD for cannabidiol', () => {
  assert.equal(matchesCompound(row([drug('Bupivacaine + CBD (clonidine, buprenorphine, dexamethasone)')]), spec('cbd')), false);
  assert.equal(matchesCompound(row([drug('CBD oil')]), spec('cbd')), true);
  assert.equal(matchesCompound(row([drug('GWP42003-P', ['Cannabidiol', 'Epidiolex'])]), spec('cbd')), true);
});

test('matchesCompound keeps drug interventions only and checks conditions where a compound asks for them', () => {
  assert.equal(matchesCompound(row([drug('Low Starch Diet (LSD)', [], 'BEHAVIORAL')]), spec('lsd')), false);
  assert.equal(matchesCompound(row([drug('DT120', ['MM120', 'lysergide tartrate'])]), spec('lsd')), true);
  assert.equal(matchesCompound(row([drug('midomafetamine HCl')]), spec('mdma')), true);
  assert.equal(matchesCompound(row([drug('MDA')]), spec('mdma')), false);
  assert.equal(matchesCompound(row([drug('Noribogaine')]), spec('ibogaine')), true);
  assert.equal(matchesCompound(row([drug('Ketamine')], ['Major Depressive Disorder']), spec('ketamine')), true);
  assert.equal(matchesCompound(row([drug('Ketamine')], ['Postoperative Respiratory Depression']), spec('ketamine')), false);
  assert.equal(matchesCompound(row([drug('Ketamine')]), spec('ketamine')), false);
  const oil = row([drug('Cannabis oil with a high ratio of THC to CBD')]);
  for (const key of ['cbd', 'thc', 'cannabis']) assert.equal(matchesCompound(oil, spec(key)), true, key);
  assert.equal(matchesCompound(oil, spec('psilocybin')), false);
});

test('compoundTrials counts the matching trials by start year and phase', () => {
  const rows = ctStudies({
    studies: [
      study('NCT1', { start: '2019-02', phases: ['PHASE2'], interventions: [drug('Psilocybin')] }),
      study('NCT2', { start: '2021-07-01', phases: ['PHASE1'], interventions: [drug('COMP360', ['psilocybin'])] }),
      study('NCT3', { start: '2021-01', phases: ['PHASE2'], interventions: [drug('Escitalopram')] }),
    ],
  });
  assert.deepEqual(compoundTrials(rows, spec('psilocybin')), {
    key: 'psilocybin',
    label: 'psilocybin',
    group: 'psychedelics',
    trials: 2,
    years: { 2019: 1, 2021: 1 },
    phases: {
      early1: 0, p1: 1, p12: 0, p2: 1, p23: 0, p3: 0, p4: 0, na: 0,
    },
  });
});

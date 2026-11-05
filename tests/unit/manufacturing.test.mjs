import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  recallReason, recallRecords, recallSummary, nitrosamineGroup, nitrosamineRecalls, nitrosamineLimits, shortageRecords, shortageSummary, iidLink, iidRows, iidSummary,
} from '../../scripts/manufacturing.mjs';

test('recallReason files FDA recall reasons under one cause each, reading the category before the colon first', () => {
  const cases = [
    ['Lack of Assurance of Sterility: A recall of all compounded sterile preparations within expiry', 'sterility'],
    ['CGMP Deviations: potential N-Nitrosodimethylamine (NDMA) amounts above levels established by the FDA.', 'nitrosamine'],
    ['cGMP Deviations: recall due to not meeting the N-Nitroso Bisoprolol impurity specification limits.', 'nitrosamine'],
    ['Microbial Contamination of Non-Sterile Products: Burkholderia cepacia found', 'microbial'],
    ['Non-Sterility', 'sterility'],
    ['Penicillin Cross Contamination: the API supplier also handles penicillin', 'cross'],
    ['Marketed Without An Approved NDA/ANDA: FDA laboratory analysis found the product to contain undeclared sildenafil', 'unapproved'],
    ['Presence of Foreign Tablets/Capsules: a bottle contained another product', 'labeling'],
    ['Presence of Particulate Matter: glass particles observed', 'particulate'],
    ['Crystallization', 'particulate'],
    ['Superpotent Drug: Stability failure for assay at 6 months test time-point.', 'potency'],
    ['Failed Impurities/Degradation Specifications', 'impurity'],
    ['Failed Dissolution Specifications', 'dissolution'],
    ['Stability Data Does Not Support Expiry', 'stability'],
    ['CGMP Deviations: Products were exposed to temperatures outside of the products labeled storage conditions.', 'cgmp'],
    ['Defective Delivery System: pump does not deliver', 'container'],
    ['Labeling: Label Mixup; bottles labeled as 10 mg contain 20 mg', 'labeling'],
    ['The firm received seven reports of adverse reactions in the form of skin abscesses potentially linked to compounded methylprednisolone', 'microbial'],
    ['Discoloration: discolored tablets', 'other'],
  ];
  for (const [text, key] of cases) assert.equal(recallReason(text), key, text);
});

const enforcement = (over = {}) => ({
  recall_number: 'D-1-2020', event_id: '100', classification: 'Class II', report_date: '20200115', recall_initiation_date: '20191201', country: 'United States', recalling_firm: 'Acme', reason_for_recall: 'Failed Dissolution Specifications', voluntary_mandated: 'Voluntary: Firm initiated', status: 'Terminated', product_description: 'Metformin ER 500 mg tablets', openfda: {}, ...over,
});

test('recallRecords flattens openFDA enforcement results to the fields the charts use', () => {
  assert.deepEqual(recallRecords({ results: [enforcement({ openfda: { generic_name: ['METFORMIN HYDROCHLORIDE'] } })] }), [{
    id: 'D-1-2020', event: '100', cls: 'II', year: 2020, days: 45, country: 'United States', firm: 'Acme', reason: 'Failed Dissolution Specifications', mandated: false, product: 'Metformin ER 500 mg tablets', generic: 'METFORMIN HYDROCHLORIDE',
  }]);
});

test('recallSummary counts recalls by year and class, cause, country and firm', () => {
  const records = recallRecords({
    results: [
      enforcement(),
      enforcement({
        recall_number: 'D-2-2020', classification: 'Class I', reason_for_recall: 'Lack of Assurance of Sterility', recall_initiation_date: '20200101',
      }),
      enforcement({
        recall_number: 'D-3-2021', event_id: '101', report_date: '20210301', recall_initiation_date: '20210101', country: 'India', recalling_firm: 'Beta', reason_for_recall: 'Lack of Assurance of Sterility', voluntary_mandated: 'FDA Mandated',
      }),
      enforcement({
        recall_number: 'D-4-2022', event_id: '102', report_date: '20220301', recall_initiation_date: '20220201',
      }),
    ],
  });
  const s = recallSummary(records, 2021);
  assert.equal(s.total, 4);
  assert.equal(s.events, 3);
  assert.deepEqual(s.years, [2020, 2021]);
  assert.deepEqual(s.byClass, { I: [1, 0], II: [1, 1], III: [0, 0] });
  assert.deepEqual(s.reasons[0], {
    key: 'sterility', n: 2, I: 1, II: 1, III: 0,
  });
  assert.deepEqual(s.countries, [{ name: 'United States', n: 3 }, { name: 'India', n: 1 }]);
  assert.deepEqual(s.firms[0], { name: 'Acme', n: 3, events: 2 });
  assert.equal(s.mandated, 1);
  assert.deepEqual(s.lag, { median: 28, p90: 59 });
});

test('nitrosamineGroup sorts nitrosamine recalls by the drug recalled', () => {
  const rec = (product, generic = null) => recallRecords({ results: [enforcement({ product_description: product, openfda: generic ? { generic_name: [generic] } : {} })] })[0];
  assert.equal(nitrosamineGroup(rec('Amlodipine and Valsartan Tablets USP')), 'sartans');
  assert.equal(nitrosamineGroup(rec('Zantac 150 tablets')), 'h2');
  assert.equal(nitrosamineGroup(rec('Nizatidine capsules')), 'h2');
  assert.equal(nitrosamineGroup(rec('Riomet ER oral suspension')), 'metformin');
  assert.equal(nitrosamineGroup(rec('Chantix 1 mg tablets', 'VARENICLINE TARTRATE')), 'varenicline');
  assert.equal(nitrosamineGroup(rec('Duloxetine delayed-release capsules')), 'other');
});

test('nitrosamineRecalls counts nitrosamine recalls by year and drug group and names the drugs', () => {
  const results = [
    enforcement({ recall_number: 'D-1', report_date: '20180801', product_description: 'Valsartan tablets', reason_for_recall: 'CGMP Deviations: NDMA impurity' }),
    enforcement({ recall_number: 'D-2', report_date: '20190301', product_description: 'Losartan potassium tablets', reason_for_recall: 'CGMP Deviations: NDEA impurity' }),
    enforcement({ recall_number: 'D-3', report_date: '20190302', product_description: 'Losartan potassium and HCTZ tablets', reason_for_recall: 'CGMP Deviations: NMBA impurity' }),
    enforcement({
      recall_number: 'D-4', report_date: '20240901', product_description: 'Duloxetine capsules', reason_for_recall: 'CGMP Deviations: N-nitroso-duloxetine above the limit', openfda: { generic_name: ['DULOXETINE HYDROCHLORIDE'] },
    }),
    enforcement({ recall_number: 'D-5', report_date: '20240902', reason_for_recall: 'Failed Dissolution Specifications' }),
    enforcement({
      recall_number: 'D-6', report_date: '20220401', product_description: 'Accuretic tablets', reason_for_recall: 'CGMP Deviations: presence of N-nitroso-quinapril above the ADI', openfda: { generic_name: ['QUINAPRIL HYDROCHLORIDE AND HYDROCHLOROTHIAZIDE'] },
    }),
    enforcement({ recall_number: 'D-7', report_date: '20250401', product_description: 'Major Sleep Aid tablets', reason_for_recall: 'CGMP Deviations: N-Nitroso-desmethyl-doxylamine above the recommended limit' }),
  ];
  const n = nitrosamineRecalls(recallRecords({ results }));
  assert.equal(n.total, 6);
  assert.deepEqual(n.byYear, {
    2018: { sartans: 1 }, 2019: { sartans: 2 }, 2022: { other: 1 }, 2024: { other: 1 }, 2025: { other: 1 },
  });
  assert.deepEqual(n.drugs.map((d) => [d.name, d.group, d.n]), [['losartan', 'sartans', 2], ['doxylamine', 'other', 1], ['duloxetine', 'other', 1], ['quinapril', 'other', 1], ['valsartan', 'sartans', 1]]);
  assert.deepEqual(n.drugs[0], {
    name: 'losartan', group: 'sartans', n: 2, first: 2019, last: 2019,
  });
});

const page = `
<table><thead><tr><th>Nitrosamine Name</th><th>Source*</th><th>Potency Category</th><th>Recommended AI Limit</th></tr></thead>
<tbody><tr><td><a href="x">N-nitroso-varenicline</a></td><td>Varenicline</td><td>3</td><td>400 ng/day</td></tr>
<tr><td>NNK-like impurity</td><td>Fluoxetine</td><td>1</td><td>26.5 ng/day</td></tr>
<tr><td>N-nitroso-dalbavancin</td><td>Dalbavancin</td><td>4</td><td>1,500 ng/day</td></tr></tbody></table>
<table><thead><tr><th>Nitrosamine Name</th><th>Source</th><th>Recommended AI Limit (ng/day)</th><th>Surrogate</th><th>Date Added to Table</th></tr></thead>
<tbody><tr><td>N-nitroso-duloxetine</td><td>Duloxetine</td><td>100</td><td>NNK</td><td>8/4/2023</td></tr></tbody></table>
<table><thead><tr><th>Nitrosamine Name</th><th>Source</th><th>Recommended Interim AI Limit (ng/day)</th><th>Recommended Interim Control Limit (ppm)</th><th>Estimated Duration***</th></tr></thead>
<tbody><tr><td>N-nitroso-sertraline</td><td>Sertraline</td><td>600 ng/day</td><td>3 ppm</td><td>8/1/2027</td></tr></tbody></table>`;

test('nitrosamineLimits reads FDA’s acceptable intake tables: CPCA categories, surrogate-based limits and interim limits', () => {
  assert.deepEqual(nitrosamineLimits(page), {
    limits: [
      {
        name: 'N-nitroso-varenicline', source: 'varenicline', category: 3, limit: 400,
      },
      {
        name: 'NNK-like impurity', source: 'fluoxetine', category: 1, limit: 26.5,
      },
      {
        name: 'N-nitroso-dalbavancin', source: 'dalbavancin', category: 4, limit: 1500,
      },
    ],
    surrogate: [{ name: 'N-nitroso-duloxetine', source: 'duloxetine', limit: 100 }],
    interim: [{
      name: 'N-nitroso-sertraline', source: 'sertraline', limit: 600, until: '2027-08-01',
    }],
  });
});

const shortage = (over = {}) => ({
  generic_name: 'Bupivacaine Hydrochloride Injection', status: 'Current', availability: 'Available', therapeutic_category: ['Anesthesia'], dosage_form: 'Injection', initial_posting_date: '02/20/2018', update_date: '10/19/2026', company_name: 'Eugia US LLC', package_ndc: '1', ...over,
});

test('shortageRecords and shortageSummary fold FDA shortage presentations into drugs', () => {
  const rows = shortageRecords({
    results: [
      shortage(),
      shortage({ package_ndc: '2', company_name: 'Hospira', initial_posting_date: '01/01/2012' }),
      shortage({
        generic_name: 'Furosemide Injection', status: 'To Be Discontinued', therapeutic_category: ['Cardiovascular'], initial_posting_date: '04/28/2026', company_name: 'Gland',
      }),
      shortage({
        generic_name: 'Amoxicillin Oral Powder', status: 'Resolved', therapeutic_category: ['Anti-Infective', 'Pediatric'], dosage_form: 'Powder, for suspension', initial_posting_date: '10/01/2022',
      }),
    ],
  });
  assert.deepEqual(rows[0], {
    name: 'Bupivacaine Hydrochloride Injection', status: 'Current', availability: 'Available', categories: ['Anesthesia'], form: 'Injection', posted: '2018-02-20', company: 'Eugia US LLC',
  });
  const s = shortageSummary(rows);
  assert.equal(s.presentations, 4);
  assert.deepEqual(s.statuses, { Current: 2, 'To Be Discontinued': 1, Resolved: 1 });
  assert.deepEqual(s.drugs[0], {
    name: 'Bupivacaine Hydrochloride Injection', status: 'Current', categories: ['Anesthesia'], forms: ['Injection'], posted: '2012-01-01', companies: 2, presentations: 2,
  });
  assert.equal(s.drugs.length, 3);
});

test('iidLink finds the newest Inactive Ingredient Database download on FDA’s page', () => {
  const html = '<a href="https://www.fda.gov/drugs/x">self</a><a href="/media/195788/download?attachment">Q4</a><a href="/media/193784/download?attachment">Q3</a>';
  assert.equal(iidLink(html), 'https://www.fda.gov/media/195788/download?attachment');
});

test('iidRows and iidSummary count inactive ingredients by route and rank the most widely accepted', () => {
  const book = {
    IIR: [
      ['INGREDIENT_NAME', 'ROUTE', 'DOSAGE_FORM', 'CAS_NUMBER', 'UNII', 'POTENCY_AMOUNT', 'POTENCY_UNIT', 'MAXIMUM_DAILY_EXPOSURE', 'MAXIMUM_DAILY_EXPOSURE_UNIT', 'RECORD_UPDATED'],
      ['LACTOSE', 'ORAL', 'TABLET', 63423, 'J2B2A4N98G', 2500, 'mg', null, null, null],
      ['LACTOSE', 'ORAL', 'CAPSULE', 63423, 'J2B2A4N98G', 400, 'mg', 1200, 'mg', 'Y'],
      ['TALC', 'ORAL', 'TABLET', 14807966, '7SEV7J4R1U', 1000, 'mg', null, null, null],
      ['SODIUM CHLORIDE', 'INTRAVENOUS', 'INJECTION', 7647145, '451W47IQ8X', 0.9, '%w/v', null, null, null],
      ['SODIUM CHLORIDE', 'OPHTHALMIC', 'SOLUTION', 7647145, '451W47IQ8X', null, null, null, null, null],
    ],
  };
  const rows = iidRows(book);
  assert.deepEqual(rows[1], {
    name: 'LACTOSE', route: 'ORAL', form: 'CAPSULE', amount: 400, unit: 'mg', mde: 1200, mdeUnit: 'mg',
  });
  const s = iidSummary(rows);
  assert.equal(s.rows, 5);
  assert.equal(s.ingredients, 3);
  assert.deepEqual(s.routes[0], { route: 'ORAL', entries: 3, ingredients: 2 });
  assert.deepEqual(s.top[0], {
    name: 'LACTOSE', entries: 2, routes: 1, forms: 2,
  });
  assert.deepEqual(s.oralTablet, [{ name: 'LACTOSE', amount: 2500 }, { name: 'TALC', amount: 1000 }]);
  assert.equal(s.withMde, 1);
});

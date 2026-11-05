import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  delimited, novelApprovals, novelYears, approvalCalendar, andaApprovals, patentSummary, exclusivitySummary, teSummary, mostCopied, emaMedicines, emaYears, emaFlags, normalizeSubstance, fdaEmaLag, biosimilarRows, isAntibody,
} from '../../scripts/approvals.mjs';

const tsv = (rows) => rows.map((r) => r.join('\t')).join('\r\n');

test('delimited reads tab and tilde files into records, trimming padded fields', () => {
  assert.deepEqual(delimited(tsv([['ApplNo', 'SubmissionType'], ['000004', 'SUPPL     ']]), '\t'), [{ ApplNo: '000004', SubmissionType: 'SUPPL' }]);
  assert.deepEqual(delimited('Appl_No~Patent_No\nN~1\n', '~'), [{ Appl_No: 'N', Patent_No: '1' }]);
});

const tables = {
  applications: delimited(tsv([['ApplNo', 'ApplType', 'ApplPublicNotes', 'SponsorName'], ['021436', 'NDA', '', 'OTSUKA'], ['761269', 'BLA', '', 'EISAI INC'], ['761300', 'BLA', '', 'SANDOZ'], ['074001', 'ANDA', '', 'TEVA'], ['074002', 'ANDA', '', 'MYLAN'], ['020000', 'NDA', '', 'OLD']]), '\t'),
  classes: delimited(tsv([['SubmissionClassCodeID', 'SubmissionClassCode', 'SubmissionClassCodeDescription'], ['7', 'TYPE 1', 'New Molecular Entity'], ['8', 'TYPE 1/4', 'NME and New Combination'], ['12', 'TYPE 3', 'New Dosage Form'], ['19', 'UNKNOWN', '']]), '\t'),
  submissions: delimited(tsv([
    ['ApplNo', 'SubmissionClassCodeID', 'SubmissionType', 'SubmissionNo', 'SubmissionStatus', 'SubmissionStatusDate', 'SubmissionsPublicNotes', 'ReviewPriority'],
    ['021436', '7', 'ORIG', '1', 'AP', '2002-11-15 00:00:00', '', 'PRIORITY'],
    ['021436', '12', 'SUPPL', '2', 'AP', '2004-09-29 00:00:00', '', 'STANDARD'],
    ['761269', '7', 'ORIG', '1', 'AP', '2023-01-06 00:00:00', '', 'PRIORITY'],
    ['761300', '12', 'ORIG', '1', 'AP', '2023-03-03 00:00:00', '', 'STANDARD'],
    ['074001', '19', 'ORIG', '1', 'AP', '2023-05-01 00:00:00', '', ''],
    ['074002', '19', 'ORIG', '1', 'TA', '2023-06-01 00:00:00', '', ''],
    ['020000', '8', 'ORIG', '1', 'AP', '1995-12-29 00:00:00', '', 'STANDARD'],
  ]), '\t'),
  properties: delimited(tsv([['ApplNo', 'SubmissionType', 'SubmissionNo', 'SubmissionPropertyTypeCode', 'SubmissionPropertyTypeID'], ['761269', 'ORIG', '1', 'Orphan', '1'], ['021436', 'SUPPL', '2', 'Orphan', '1']]), '\t'),
  products: delimited(tsv([['ApplNo', 'ProductNo', 'Form', 'Strength', 'ReferenceDrug', 'DrugName', 'ActiveIngredient', 'ReferenceStandard'], ['021436', '001', 'TABLET;ORAL', '5MG', '1', 'ABILIFY', 'ARIPIPRAZOLE', '0'], ['761269', '001', 'INJECTABLE;INJECTION', '100MG', '0', 'LEQEMBI', 'LECANEMAB-IRMB', '0'], ['020000', '001', 'TABLET;ORAL', '1MG', '0', 'OLDDRUG', 'OLDINE HYDROCHLORIDE', '0']]), '\t'),
};

test('novelApprovals keeps the first approvals of new molecular entities and new biologics, with priority and orphan flags', () => {
  assert.deepEqual(novelApprovals(tables), [
    {
      appl: '020000', type: 'NDA', date: '1995-12-29', priority: false, orphan: false, name: 'OLDDRUG', ingredient: 'OLDINE HYDROCHLORIDE', sponsor: 'OLD',
    },
    {
      appl: '021436', type: 'NDA', date: '2002-11-15', priority: true, orphan: false, name: 'ABILIFY', ingredient: 'ARIPIPRAZOLE', sponsor: 'OTSUKA',
    },
    {
      appl: '761269', type: 'BLA', date: '2023-01-06', priority: true, orphan: true, name: 'LEQEMBI', ingredient: 'LECANEMAB-IRMB', sponsor: 'EISAI INC',
    },
  ]);
});

test('isAntibody tells monoclonal antibodies from other biologics by their names', () => {
  assert.deepEqual(['LECANEMAB-IRMB', 'PEMBROLIZUMAB;BERAHYALURONIDASE ALFA-PMPH', 'axatilimab-csfr', 'LETIBOTULINUMTOXINA-WLBG', 'SOTATERCEPT-CSRK', 'TEPLIZUMAB-MZWV'].map(isAntibody), [true, true, true, false, false, true]);
});

test('novelYears counts novel approvals each year by kind, with priority and orphan counts', () => {
  const y = novelYears(novelApprovals(tables), 2022, 2023);
  assert.deepEqual(y, {
    years: [2022, 2023], nda: [0, 0], mab: [0, 1], biologic: [0, 0], priority: [0, 1], orphan: [0, 1],
  });
});

test('approvalCalendar counts novel approvals by weekday and month from a start year', () => {
  const c = approvalCalendar(novelApprovals(tables), 2000);
  assert.deepEqual(c.weekdays, [0, 0, 0, 0, 0, 2, 0]);
  assert.deepEqual(c.months, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
  assert.equal(c.from, 2000);
});

test('andaApprovals counts first generic approvals each year and the tentative approvals', () => {
  assert.deepEqual(andaApprovals(tables, 2022, 2023), { years: [2022, 2023], counts: [0, 1], tentative: 1 });
});

const products = [
  {
    Ingredient: 'ARIPIPRAZOLE', 'DF;Route': 'TABLET;ORAL', Trade_Name: 'ABILIFY', Appl_Type: 'N', Appl_No: '021436', Product_No: '001', TE_Code: 'AB', RLD: 'Yes', Type: 'RX',
  },
  {
    Ingredient: 'ARIPIPRAZOLE', 'DF;Route': 'TABLET;ORAL', Trade_Name: 'ARIPIPRAZOLE', Appl_Type: 'A', Appl_No: '078583', Product_No: '001', TE_Code: 'AB', RLD: 'No', Type: 'RX',
  },
  {
    Ingredient: 'ARIPIPRAZOLE', 'DF;Route': 'TABLET;ORAL', Trade_Name: 'ARIPIPRAZOLE', Appl_Type: 'A', Appl_No: '078584', Product_No: '002', TE_Code: 'AB1,AB2', RLD: 'No', Type: 'RX',
  },
  {
    Ingredient: 'TIRZEPATIDE', 'DF;Route': 'SOLUTION;SUBCUTANEOUS', Trade_Name: 'MOUNJARO', Appl_Type: 'N', Appl_No: '215866', Product_No: '001', TE_Code: '', RLD: 'Yes', Type: 'RX',
  },
  {
    Ingredient: 'OLDINE', 'DF;Route': 'TABLET;ORAL', Trade_Name: 'OLD', Appl_Type: 'A', Appl_No: '070001', Product_No: '001', TE_Code: '', RLD: 'No', Type: 'DISCN',
  },
];
const patents = [
  {
    Appl_Type: 'N', Appl_No: '215866', Product_No: '001', Patent_No: '9474780', Patent_Expire_Date_Text: 'Jan 5, 2036', Drug_Substance_Flag: 'Y', Drug_Product_Flag: '', Patent_Use_Code: '',
  },
  {
    Appl_Type: 'N', Appl_No: '215866', Product_No: '002', Patent_No: '9474780', Patent_Expire_Date_Text: 'Jan 5, 2036', Drug_Substance_Flag: 'Y', Drug_Product_Flag: '', Patent_Use_Code: '',
  },
  {
    Appl_Type: 'N', Appl_No: '215866', Product_No: '001', Patent_No: '9474780*PED', Patent_Expire_Date_Text: 'Jul 5, 2036', Drug_Substance_Flag: '', Drug_Product_Flag: '', Patent_Use_Code: '',
  },
  {
    Appl_Type: 'N', Appl_No: '215866', Product_No: '001', Patent_No: '11000000', Patent_Expire_Date_Text: 'Mar 1, 2039', Drug_Substance_Flag: '', Drug_Product_Flag: 'Y', Patent_Use_Code: 'U-1',
  },
  {
    Appl_Type: 'N', Appl_No: '021436', Product_No: '001', Patent_No: '5006528', Patent_Expire_Date_Text: 'Oct 20, 2014', Drug_Substance_Flag: 'Y', Drug_Product_Flag: '', Patent_Use_Code: 'U-2',
  },
];

test('patentSummary counts distinct patents per application, by expiry year and by what they claim, folding pediatric extensions into their patent', () => {
  assert.deepEqual(patentSummary(products, patents, 5), {
    patents: 3,
    applications: 2,
    substance: 2,
    product: 1,
    use: 2,
    top: [{
      appl: '215866', name: 'MOUNJARO', ingredient: 'TIRZEPATIDE', patents: 2,
    }, {
      appl: '021436', name: 'ABILIFY', ingredient: 'ARIPIPRAZOLE', patents: 1,
    }],
    expiry: { 2014: 1, 2036: 1, 2039: 1 },
  });
});

test('exclusivitySummary counts each kind of exclusivity once per application', () => {
  const excl = [
    { Appl_No: '1', Product_No: '001', Exclusivity_Code: 'ODE-123' },
    { Appl_No: '1', Product_No: '002', Exclusivity_Code: 'ODE-123' },
    { Appl_No: '1', Product_No: '001', Exclusivity_Code: 'NCE' },
    { Appl_No: '2', Product_No: '001', Exclusivity_Code: 'D-193' },
    { Appl_No: '3', Product_No: '001', Exclusivity_Code: 'ODE*' },
  ];
  assert.deepEqual(exclusivitySummary(excl), [{ code: 'ODE', n: 2 }, { code: 'D', n: 1 }, { code: 'NCE', n: 1 }]);
});

test('teSummary and mostCopied read therapeutic equivalence codes and count generics per reference product', () => {
  assert.deepEqual(teSummary(products), { rx: 4, codes: [{ code: 'AB', n: 3 }, { code: 'none', n: 1 }], rld: 2 });
  assert.deepEqual(mostCopied(products, 5), [{ ingredient: 'ARIPIPRAZOLE', form: 'TABLET;ORAL', andas: 2 }]);
});

const emaBook = {
  Medicine: [
    ['Medicines output'],
    [],
    ['Category', 'Name of medicine', 'Medicine status', 'International non-proprietary name (INN) / common name', 'Active substance', 'Accelerated assessment', 'Advanced therapy', 'Biosimilar', 'Conditional approval', 'Exceptional circumstances', 'Generic', 'Orphan medicine', 'PRIME: priority medicine', 'Marketing authorisation date'],
    ['Human', 'Abilify', 'Authorised', 'aripiprazole', 'aripiprazole', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', '04/06/2004'],
    ['Human', 'Leqembi', 'Authorised', 'lecanemab', 'lecanemab', 'No', 'No', 'No', 'Yes', 'No', 'No', 'No', 'Yes', '15/04/2025'],
    ['Human', 'Aripiprazole Accord', 'Authorised', 'aripiprazole', 'aripiprazole', 'No', 'No', 'No', 'No', 'No', 'Yes', 'No', 'No', '16/11/2015'],
    ['Human', 'Refusedin', 'Refused', 'refusamab', 'refusamab', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', null],
    ['Veterinary', 'Dogdrug', 'Authorised', 'dogine', 'dogine', 'No', 'No', 'No', 'No', 'No', 'No', 'No', 'No', '01/01/2020'],
  ],
};

test('emaMedicines reads EMA’s human medicines with their flags and authorisation dates', () => {
  const rows = emaMedicines(emaBook);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[1], {
    name: 'Leqembi', inn: 'lecanemab', substance: 'lecanemab', status: 'Authorised', authorised: '2025-04-15', generic: false, biosimilar: false, orphan: false, conditional: true, exceptional: false, accelerated: false, prime: true, advanced: false,
  });
  assert.equal(rows[3].authorised, null);
});

test('emaYears and emaFlags count EU authorisations by year and kind, and the special routes', () => {
  const rows = emaMedicines(emaBook);
  assert.deepEqual(emaYears(rows, 2004, 2025).novel.filter(Boolean).length, 2);
  const y = emaYears(rows, 2015, 2015);
  assert.deepEqual(y, {
    years: [2015], novel: [0], generic: [1], biosimilar: [0],
  });
  assert.deepEqual(emaFlags(rows), {
    total: 4, authorised: 3, refused: 1, conditional: 1, exceptional: 0, accelerated: 0, prime: 1, orphan: 0, advanced: 0, generic: 1, biosimilar: 0,
  });
});

test('normalizeSubstance lines up FDA and EMA names by dropping salts, biologic suffixes and case', () => {
  assert.equal(normalizeSubstance('OLDINE HYDROCHLORIDE'), 'oldine');
  assert.equal(normalizeSubstance('LECANEMAB-IRMB'), 'lecanemab');
  assert.equal(normalizeSubstance('Sugammadex sodium'), 'sugammadex');
  assert.equal(normalizeSubstance('Imatinib mesilate'), normalizeSubstance('IMATINIB MESYLATE'));
});

test('fdaEmaLag pairs FDA novel approvals with EU authorisations of the same substance and measures the gap', () => {
  const lag = fdaEmaLag(novelApprovals(tables), emaMedicines(emaBook), 1995);
  assert.equal(lag.fda, 3);
  assert.equal(lag.matched, 2);
  assert.equal(lag.fdaFirst, 2);
  assert.deepEqual(lag.lags, [18.6, 27.3]);
});

test('biosimilarRows reads FDA’s table of biosimilars with their reference products', () => {
  const html = '<table><thead><tr><th>Biosimilar Name</th><th>Approval Date</th><th>Reference Product</th><th>More Information</th></tr></thead><tbody><tr><td>Zarxio (filgrastim-sndz)</td><td>March 6, 2015</td><td>Neupogen (filgrastim)</td><td><a href="x">Label</a></td></tr><tr><td>Amjevita (adalimumab-atto)</td><td>9/23/2016</td><td>Humira (adalimumab)</td><td></td></tr></tbody></table>';
  assert.deepEqual(biosimilarRows(html), [
    { name: 'Zarxio (filgrastim-sndz)', date: '2015-03-06', reference: 'Neupogen (filgrastim)' },
    { name: 'Amjevita (adalimumab-atto)', date: '2016-09-23', reference: 'Humira (adalimumab)' },
  ]);
});

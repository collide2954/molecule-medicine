import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  identify, casValid, luhnDigit, ndc11, inchikeyCharge,
} from '../../src/lib.js';

const part = (hit, key) => hit.parts.find(([k]) => k === key)?.[1];

test('identify returns null for empty or unknown input', () => {
  assert.equal(identify(''), null);
  assert.equal(identify('   '), null);
  assert.equal(identify('not an identifier at all'), null);
});

test('ATC codes are split into their five levels', () => {
  const hit = identify('N02BE01');
  assert.equal(hit.type, 'ATC code');
  assert.equal(hit.id, 'N02BE01');
  assert.equal(hit.url, 'https://atcddd.fhi.no/atc_ddd_index/?code=N02BE01');
  assert.equal(part(hit, 'Level'), '5, chemical substance');
  assert.equal(part(hit, 'Anatomical main group'), 'N, nervous system');
  assert.equal(part(hit, 'Therapeutic subgroup'), 'N02');
  assert.equal(part(hit, 'Chemical substance'), 'N02BE01');
  assert.equal(part(identify('c10aa'), 'Level'), '4, chemical subgroup');
  assert.equal(identify('C10AA').id, 'C10AA');
  assert.equal(part(identify('A10'), 'Level'), '2, therapeutic subgroup');
});

test('ATC levels take their names from the snapshot when they are given', () => {
  const atc = { N: 'NERVOUS SYSTEM', N02: 'ANALGESICS', N02B: 'OTHER ANALGESICS AND ANTIPYRETICS', N02BE: 'Anilides', N02BE01: 'paracetamol' };
  const hit = identify('N02BE01', { atc });
  assert.equal(part(hit, 'Therapeutic subgroup'), 'N02, analgesics');
  assert.equal(part(hit, 'Pharmacological subgroup'), 'N02B, other analgesics and antipyretics');
  assert.equal(part(hit, 'Chemical subgroup'), 'N02BE, anilides');
  assert.equal(part(hit, 'Chemical substance'), 'N02BE01, paracetamol');
});

test('CAS numbers are checked against their check digit', () => {
  assert.equal(casValid('50-78-2'), true);
  assert.equal(casValid('7732-18-5'), true);
  assert.equal(casValid('50-78-3'), false);
  const hit = identify('50-78-2');
  assert.equal(hit.type, 'CAS Registry Number');
  assert.equal(hit.url, 'https://commonchemistry.cas.org/detail?cas_rn=50-78-2');
  assert.equal(part(hit, 'Check digit'), '2, valid');
  assert.equal(part(identify('50-78-3'), 'Check digit'), '3 does not match; expected 2');
});

test('LOINC codes are checked with the mod 10 check digit', () => {
  assert.equal(luhnDigit('2160'), 0);
  assert.equal(luhnDigit('6301'), 6);
  assert.equal(luhnDigit('12345'), 5);
  const hit = identify('2160-0');
  assert.equal(hit.type, 'LOINC code');
  assert.equal(hit.url, 'https://loinc.org/2160-0');
  assert.equal(part(hit, 'Check digit'), '0, valid');
  assert.equal(part(identify('2160-1'), 'Check digit'), '1 does not match; expected 0');
});

test('NDCs in each 10-digit layout are padded to the 11-digit billing form', () => {
  assert.equal(ndc11('0002-1433-80'), '00002-1433-80');
  assert.equal(ndc11('12345-678-90'), '12345-0678-90');
  assert.equal(ndc11('50090-1234-0'), '50090-1234-00');
  assert.equal(ndc11('00002-1433-80'), '00002-1433-80');
  const hit = identify('0002-1433-80');
  assert.equal(hit.type, 'National Drug Code');
  assert.equal(part(hit, 'Layout'), '4-4-2');
  assert.equal(part(hit, 'Labeler'), '0002');
  assert.equal(part(hit, 'Product'), '1433');
  assert.equal(part(hit, 'Package'), '80');
  assert.equal(part(hit, '11-digit form'), '00002-1433-80');
  assert.equal(hit.url, 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=0002-1433-80');
  assert.equal(part(identify('NDC 00002143380'), 'Layout'), '5-4-2');
});

test('InChIKeys are split into their connectivity, stereo and charge blocks', () => {
  assert.equal(inchikeyCharge('N'), 0);
  assert.equal(inchikeyCharge('M'), -1);
  assert.equal(inchikeyCharge('O'), 1);
  const hit = identify('BSYNRYMUTXBXSQ-UHFFFAOYSA-N');
  assert.equal(hit.type, 'InChIKey');
  assert.equal(part(hit, 'Connectivity'), 'BSYNRYMUTXBXSQ');
  assert.equal(part(hit, 'Stereo and isotopes'), 'UHFFFAOY, no stereo or isotope layer');
  assert.equal(part(hit, 'Version'), 'S standard, version A');
  assert.equal(part(hit, 'Protonation'), 'N, neutral');
  assert.match(part(identify('RZVAJINKPMORJF-UHFFFAOYSA-M'), 'Protonation'), /^M, 1 proton removed/);
});

test('compound and drug database accessions are recognised', () => {
  const cases = [
    ['CHEMBL25', 'ChEMBL ID', 'https://www.ebi.ac.uk/chembl/explore/compound/CHEMBL25'],
    ['CHEBI:15365', 'ChEBI entity', 'https://www.ebi.ac.uk/chebi/CHEBI:15365'],
    ['DB00945', 'DrugBank drug', 'https://go.drugbank.com/drugs/DB00945'],
    ['D00109', 'KEGG DRUG entry', 'https://www.kegg.jp/entry/D00109'],
    ['CID 2244', 'PubChem compound', 'https://pubchem.ncbi.nlm.nih.gov/compound/2244'],
    ['SID:7847177', 'PubChem substance', 'https://pubchem.ncbi.nlm.nih.gov/substance/7847177'],
    ['RxCUI:1191', 'RxNorm concept', 'https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=1191'],
    ['UNII:R16CO5Y76E', 'FDA UNII', 'https://precision.fda.gov/uniisearch/srs/unii/R16CO5Y76E'],
    ['R16CO5Y76E', 'FDA UNII', 'https://precision.fda.gov/uniisearch/srs/unii/R16CO5Y76E'],
    ['PA448497', 'ClinPGx accession', 'https://www.clinpgx.org/search?query=PA448497'],
  ];
  for (const [input, type, url] of cases) {
    const hit = identify(input);
    assert.equal(hit?.type, type, input);
    assert.equal(hit.url, url, input);
  }
  assert.equal(identify('cid 2244').id, 'CID:2244');
  assert.equal(identify('chembl25').id, 'CHEMBL25');
});

test('trial registry numbers are recognised, with the year they encode', () => {
  const nct = identify('NCT00813020');
  assert.equal(nct.type, 'ClinicalTrials.gov study');
  assert.equal(nct.url, 'https://clinicaltrials.gov/study/NCT00813020');
  const eudract = identify('2008-004990-17');
  assert.equal(eudract.type, 'EudraCT number');
  assert.equal(part(eudract, 'Year'), '2008');
  const euct = identify('2023-503512-23-00');
  assert.equal(euct.type, 'EU CT number');
  assert.equal(part(euct, 'Year'), '2023');
  assert.equal(euct.url, 'https://euclinicaltrials.eu/search-for-clinical-trials/?lang=en&EUCT=2023-503512-23-00');
  assert.equal(identify('ISRCTN12345678').type, 'ISRCTN registration');
});

test('FDA application numbers name their pathway', () => {
  const nda = identify('NDA 021436');
  assert.equal(nda.type, 'FDA application');
  assert.equal(nda.id, 'NDA021436');
  assert.equal(part(nda, 'Pathway'), 'New Drug Application, section 505(b)');
  assert.equal(nda.url, 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=021436');
  assert.equal(part(identify('ANDA090123'), 'Pathway'), 'Abbreviated New Drug Application, a generic under section 505(j)');
  assert.equal(part(identify('bla 125514'), 'Pathway'), 'Biologics License Application, section 351 of the PHS Act');
});

test('regulatory citations, chapters and guidelines are named', () => {
  const cfr = identify('21 CFR 211.68');
  assert.equal(cfr.type, 'Code of Federal Regulations');
  assert.equal(cfr.url, 'https://www.ecfr.gov/current/title-21/section-211.68');
  assert.equal(part(cfr, 'Part'), '211, current good manufacturing practice for finished pharmaceuticals');
  assert.equal(identify('21 CFR 1308').url, 'https://www.ecfr.gov/current/title-21/part-1308');
  const usp = identify('USP <797>');
  assert.equal(usp.type, 'USP general chapter');
  assert.equal(part(usp, 'Status'), 'below 1000, so enforceable where USP–NF applies');
  assert.equal(part(usp, 'Subject'), 'pharmaceutical compounding, sterile preparations');
  assert.equal(part(identify('<1225>'), 'Status'), '1000 or above, so informational');
  const ich = identify('ICH Q3D(R2)');
  assert.equal(ich.type, 'ICH guideline');
  assert.equal(part(ich, 'Series'), 'Q, quality');
  assert.equal(part(ich, 'Subject'), 'elemental impurities');
  assert.equal(ich.url, 'https://www.ich.org/page/quality-guidelines');
  assert.equal(identify('ICH E14').url, 'https://www.ich.org/page/efficacy-guidelines');
});

test('EMA product and orphan numbers are recognised', () => {
  const epar = identify('EMEA/H/C/004174');
  assert.equal(epar.type, 'EMA product number');
  assert.equal(part(epar, 'Procedure'), 'H, human medicine; C, centralised');
  const orphan = identify('EU/3/16/1752');
  assert.equal(orphan.type, 'EU orphan designation');
  assert.equal(part(orphan, 'Year'), '2016');
});

test('NIH grant numbers are split into type, activity, institute and serial', () => {
  const hit = identify('5R01GM123456-04');
  assert.equal(hit.type, 'NIH grant');
  assert.equal(part(hit, 'Application type'), '5, non-competing continuation');
  assert.equal(part(hit, 'Activity'), 'R01, research project grant');
  assert.equal(part(hit, 'Institute'), 'GM, National Institute of General Medical Sciences');
  assert.equal(part(hit, 'Serial'), '123456');
  assert.equal(part(hit, 'Support year'), '04');
  assert.equal(hit.url, 'https://reporter.nih.gov/quickSearch/5R01GM123456-04');
  assert.equal(part(identify('R01DA012345'), 'Institute'), 'DA, National Institute on Drug Abuse');
});

test('star alleles, copy numbers and diplotypes are recognised', () => {
  const one = identify('CYP2D6*4');
  assert.equal(one.type, 'Star allele');
  assert.equal(part(one, 'Gene'), 'CYP2D6');
  assert.equal(part(one, 'Allele'), '*4');
  assert.equal(one.url, 'https://www.pharmvar.org/gene/CYP2D6');
  assert.equal(part(identify('CYP2D6*2x2'), 'Copies'), '2');
  assert.equal(part(identify('CYP2D6*1xN'), 'Copies'), 'N, more than one');
  assert.equal(part(identify('DPYD*2A'), 'Allele'), '*2A');
  assert.equal(part(identify('CYP2D6*4.001'), 'Suballele'), '001');
  const two = identify('CYP2C19*2/*17');
  assert.equal(two.type, 'Diplotype');
  assert.equal(part(two, 'First allele'), '*2');
  assert.equal(part(two, 'Second allele'), '*17');
});

test('star alleles take their function and a diplotype its activity score from the snapshot', () => {
  const alleles = {
    CYP2D6: { '*1': { fn: 'Normal function', value: 1 }, '*4': { fn: 'No function', value: 0 }, '*10': { fn: 'Decreased function', value: 0.25 }, '*2': { fn: 'Normal function', value: 1 } },
  };
  const phenotypes = {
    CYP2D6: [[0, 0, 'Poor metabolizer'], [0.25, 1, 'Intermediate metabolizer'], [1.25, 2.25, 'Normal metabolizer'], [2.5, 99, 'Ultrarapid metabolizer']],
  };
  assert.equal(part(identify('CYP2D6*4', { alleles }), 'Function'), 'No function');
  const im = identify('CYP2D6*1/*4', { alleles, phenotypes });
  assert.equal(part(im, 'Activity score'), '1');
  assert.equal(part(im, 'Phenotype'), 'Intermediate metabolizer');
  assert.equal(part(identify('CYP2D6*10/*10', { alleles, phenotypes }), 'Activity score'), '0.5');
  const um = identify('CYP2D6*1x2/*2', { alleles, phenotypes });
  assert.equal(part(um, 'Activity score'), '3');
  assert.equal(part(um, 'Phenotype'), 'Ultrarapid metabolizer');
  assert.equal(part(identify('CYP2D6*1xN/*2', { alleles, phenotypes }), 'Activity score'), undefined);
});

test('HLA alleles, rsIDs and HGVS names are recognised', () => {
  const hla = identify('HLA-B*57:01');
  assert.equal(hla.type, 'HLA allele');
  assert.equal(part(hla, 'Allele group'), '57');
  assert.equal(part(hla, 'Protein'), '01');
  assert.equal(identify('rs3892097').url, 'https://www.ncbi.nlm.nih.gov/snp/rs3892097');
  const hgvs = identify('NM_000106.6:c.506-1G>A');
  assert.equal(hgvs.type, 'HGVS variant');
  assert.equal(part(hgvs, 'Change'), 'substitution');
  assert.equal(part(hgvs, 'Region'), 'intron, next to an exon');
});

test('vocabulary and classification codes are recognised', () => {
  const mesh = identify('D000082');
  assert.equal(mesh.type, 'MeSH descriptor');
  assert.equal(mesh.url, 'https://meshb.nlm.nih.gov/record/ui?ui=D000082');
  assert.equal(identify('C000604007').type, 'MeSH supplementary concept');
  assert.equal(identify('C0004057').type, 'MedGen concept');
  const ec = identify('EC 1.14.14.1');
  assert.equal(ec.type, 'Enzyme Commission number');
  assert.equal(part(ec, 'Class'), '1, oxidoreductases');
  assert.equal(ec.url, 'https://enzyme.expasy.org/EC/1.14.14.1');
  const icd = identify('T40.4X1A');
  assert.equal(icd.type, 'ICD-10 code');
  assert.equal(part(icd, 'Category'), 'T40.4, poisoning by other synthetic narcotics, including fentanyl');
  assert.equal(part(identify('T40.1'), 'Category'), 'T40.1, poisoning by heroin');
});

test('Orange Book therapeutic equivalence codes are spelled out', () => {
  const ab = identify('AB1');
  assert.equal(ab.type, 'Orange Book TE code');
  assert.equal(part(ab, 'First letter'), 'A, therapeutically equivalent');
  assert.match(part(ab, 'Meaning'), /bioequivalence/);
  assert.equal(part(identify('BX'), 'First letter'), 'B, not considered therapeutically equivalent');
});

test('literature, patent and label identifiers are recognised', () => {
  assert.equal(identify('PMID:34672432').url, 'https://pubmed.ncbi.nlm.nih.gov/34672432/');
  assert.equal(identify('10.1038/nbt.1990').url, 'https://doi.org/10.1038/nbt.1990');
  const patent = identify('US 7,326,708');
  assert.equal(patent.type, 'US patent');
  assert.equal(patent.id, 'US7326708');
  assert.equal(patent.url, 'https://patents.google.com/patent/US7326708');
  const spl = identify('463050bd-2b1c-40f5-b3c3-0a04bb433309');
  assert.equal(spl.type, 'SPL set ID');
  assert.equal(spl.url, 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=463050bd-2b1c-40f5-b3c3-0a04bb433309');
});

test('gene and protein identifiers are recognised', () => {
  assert.equal(identify('HGNC:2625').type, 'HGNC gene');
  assert.equal(identify('GeneID:1565').url, 'https://www.ncbi.nlm.nih.gov/gene/1565');
  assert.equal(identify('ENSG00000100197').type, 'Ensembl gene');
  assert.equal(identify('P10635').type, 'UniProtKB accession');
  assert.equal(identify('DRD2_HUMAN').type, 'UniProtKB entry name');
  assert.equal(identify('6CM4').type, 'PDB entry');
});

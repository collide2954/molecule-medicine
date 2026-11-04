import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clinvarGenes, hgncCoding, geneSupport } from '../../scripts/genetics.mjs';

const CLINVAR = [
  '#Overview of data in ClinVar by gene, dated October 31, 2026',
  '#Symbol\tGeneID\tTotal_submissions\tTotal_alleles\tSubmissions_reporting_this_gene\tAlleles_reported_Pathogenic_Likely_pathogenic\tGene_MIM_number\tNumber_uncertain\tNumber_with_conflicts',
  'ADRB2\t154\t40\t35\t30\t-\t109690\t20\t1',
  'CFTR\t1080\t9000\t5000\t8000\t1200\t602421\t2000\t300',
  'GPR6\t2830\t3\t3\t-\t-\t-\t2\t0',
  'SCN5A\t6331\t4000\t3000\t3500\t45\t600163\t900\t80',
].join('\n');

const HGNC = [
  'hgnc_id\tsymbol\tname\tlocus_group\tlocus_type\tstatus\tentrez_id\tuniprot_ids',
  'HGNC:286\tADRB2\tadrenoceptor beta 2\tprotein-coding gene\tgene with protein product\tApproved\t154\tP07550',
  'HGNC:1884\tCFTR\tCF transmembrane conductance regulator\tprotein-coding gene\tgene with protein product\tApproved\t1080\tP13569',
  'HGNC:4515\tGPR6\tG protein-coupled receptor 6\tprotein-coding gene\tgene with protein product\tApproved\t2830\tP46095',
  'HGNC:9604\tPTGS1\tprostaglandin-endoperoxide synthase 1\tprotein-coding gene\tgene with protein product\tApproved\t5742\t"P23219|Q9UB01"',
  'HGNC:10593\tSCN5A\tsodium voltage-gated channel alpha subunit 5\tprotein-coding gene\tgene with protein product\tApproved\t6331\tQ14524',
].join('\n');

test('clinvarGenes reads the release date and pathogenic allele counts by gene symbol', () => {
  const g = clinvarGenes(CLINVAR);
  assert.equal(g.dated, 'October 31, 2026');
  assert.deepEqual(g.genes.get('CFTR'), { gene: '1080', pathogenic: 1200, submissions: 9000 });
  assert.deepEqual(g.genes.get('ADRB2'), { gene: '154', pathogenic: 0, submissions: 40 });
  assert.equal(g.genes.size, 4);
});

test('hgncCoding lists protein-coding genes with their UniProt accessions', () => {
  const genes = hgncCoding(HGNC);
  assert.equal(genes.length, 5);
  assert.deepEqual(genes[3], { symbol: 'PTGS1', entrez: '5742', uniprot: ['P23219', 'Q9UB01'] });
});

test('geneSupport compares the genes of drug targets with all protein-coding genes', () => {
  const s = geneSupport(hgncCoding(HGNC), clinvarGenes(CLINVAR).genes, ['P07550', 'Q9UB01', 'Q14524', 'Q99999']);
  assert.deepEqual(s.all, { genes: 5, clinvar: 4, pathogenic: 2 });
  assert.deepEqual(s.targets, { genes: 3, clinvar: 2, pathogenic: 1 });
  assert.deepEqual(s.bins, ['none', '1–9', '10–99', '100–999', '1,000+']);
  assert.deepEqual(s.binned, { all: [3, 0, 1, 0, 1], targets: [2, 0, 1, 0, 0] });
  assert.deepEqual(s.examples, [{ symbol: 'SCN5A', pathogenic: 45 }]);
});

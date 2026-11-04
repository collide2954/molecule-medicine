const tsv = (text) => String(text).split(/\r?\n/).filter((l) => l.length).map((l) => l.split('\t'));

const count = (v) => (v === '-' || v === '' || v === undefined ? 0 : Number(v));

export const clinvarGenes = (text) => {
  const rows = tsv(text);
  const dated = rows.find((r) => r[0].startsWith('#Overview'))?.[0].match(/dated (.+)$/)?.[1] ?? null;
  const head = rows.find((r) => r[0].startsWith('#Symbol')).map((h) => h.replace(/^#/, ''));
  const col = (name) => head.indexOf(name);
  const genes = new Map();
  for (const r of rows.filter((x) => !x[0].startsWith('#'))) {
    genes.set(r[col('Symbol')], { gene: r[col('GeneID')], pathogenic: count(r[col('Alleles_reported_Pathogenic_Likely_pathogenic')]), submissions: count(r[col('Total_submissions')]) });
  }
  return { dated, genes };
};

const unquote = (v) => String(v ?? '').replace(/^"|"$/g, '');

export const hgncCoding = (text) => {
  const [head, ...rows] = tsv(text);
  const col = (name) => head.indexOf(name);
  return rows.map((r) => ({
    symbol: r[col('symbol')], entrez: unquote(r[col('entrez_id')]) || null, uniprot: unquote(r[col('uniprot_ids')]).split('|').filter(Boolean),
  }));
};

const BINS = [['none', 0, 0], ['1–9', 1, 9], ['10–99', 10, 99], ['100–999', 100, 999], ['1,000+', 1000, Infinity]];

const tally = (genes, clinvar) => ({
  genes: genes.length,
  clinvar: genes.filter((g) => clinvar.has(g.symbol)).length,
  pathogenic: genes.filter((g) => (clinvar.get(g.symbol)?.pathogenic ?? 0) > 0).length,
});

const binned = (genes, clinvar) => BINS.map(([, lo, hi]) => genes.filter((g) => {
  const n = clinvar.get(g.symbol)?.pathogenic ?? 0;
  return n >= lo && n <= hi;
}).length);

export const geneSupport = (coding, clinvar, accessions, top = 12) => {
  const wanted = new Set(accessions);
  const targets = coding.filter((g) => g.uniprot.some((a) => wanted.has(a)));
  return {
    all: tally(coding, clinvar),
    targets: tally(targets, clinvar),
    bins: BINS.map(([label]) => label),
    binned: { all: binned(coding, clinvar), targets: binned(targets, clinvar) },
    examples: targets.map((g) => ({ symbol: g.symbol, pathogenic: clinvar.get(g.symbol)?.pathogenic ?? 0 })).filter((g) => g.pathogenic > 0)
      .sort((a, b) => b.pathogenic - a.pathogenic || a.symbol.localeCompare(b.symbol)).slice(0, top),
  };
};

export const almanacNames = (text) => {
  const names = new Map();
  for (const line of String(text).split(/\r?\n/)) {
    const [nsc, ...rest] = line.split('\t');
    const name = rest.join(' ').trim();
    if (nsc && name && !names.has(nsc.trim())) names.set(nsc.trim(), name);
  }
  return names;
};

const round = (v) => Math.round(v * 100) / 100;

const median = (list) => {
  const s = [...list].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const rows = function* rows(source) {
  let col = null;
  for (const line of source()) {
    if (!line) continue;
    const f = line.split(',');
    if (!col) {
      col = Object.fromEntries(f.map((h, i) => [h.trim(), i]));
      continue;
    }
    yield {
      nsc1: f[col.NSC1], nsc2: f[col.NSC2], i1: f[col.CONCINDEX1], i2: f[col.CONCINDEX2], dose1: `${f[col.CONC1]}${f[col.CONCUNIT1]}`, dose2: `${f[col.CONC2]}${f[col.CONCUNIT2]}`, growth: Number(f[col.PERCENTGROWTH]), cell: f[col.CELLNAME], lab: f[col.SCREENER],
    };
  }
};

const bliss = (g1, g2) => (g1 < 0 || g2 < 0 ? Math.min(g1, g2) : (Math.min(g1, 100) * Math.min(g2, 100)) / 100);

export const almanacScores = (source, names = new Map()) => {
  const singles = new Map();
  const add = (key, growth) => {
    if (!singles.has(key)) singles.set(key, []);
    singles.get(key).push(growth);
  };
  for (const r of rows(source)) {
    if (!Number.isFinite(r.growth)) continue;
    if (r.i1 !== '0' && r.i2 === '0') add(`${r.lab}|${r.nsc1}|${r.dose1}|${r.cell}`, r.growth);
    else if (r.i1 === '0' && r.i2 !== '0') add(`${r.lab}|${r.nsc2}|${r.dose2}|${r.cell}`, r.growth);
  }
  const base = new Map([...singles].map(([key, list]) => [key, median(list)]));
  const pairs = new Map();
  const cells = new Set();
  let wells = 0;
  for (const r of rows(source)) {
    if (r.i1 === '0' || r.i2 === '0' || !Number.isFinite(r.growth)) continue;
    const g1 = base.get(`${r.lab}|${r.nsc1}|${r.dose1}|${r.cell}`);
    const g2 = base.get(`${r.lab}|${r.nsc2}|${r.dose2}|${r.cell}`);
    if (g1 === undefined || g2 === undefined) continue;
    const [a, b] = [r.nsc1, r.nsc2].sort((x, y) => Number(x) - Number(y));
    const key = `${a}|${b}`;
    if (!pairs.has(key)) pairs.set(key, new Map());
    const acc = pairs.get(key).get(r.cell) ?? [0, 0];
    acc[0] += bliss(g1, g2) - r.growth;
    acc[1] += 1;
    pairs.get(key).set(r.cell, acc);
    cells.add(r.cell);
    wells += 1;
  }
  const nscs = [...new Set([...pairs.keys()].flatMap((k) => k.split('|')))].sort((x, y) => Number(x) - Number(y));
  const index = new Map(nscs.map((n, i) => [n, i]));
  const scored = [...pairs].map(([key, byCell]) => {
    const [a, b] = key.split('|');
    const means = [...byCell.values()].map(([sum, n]) => sum / n);
    return [index.get(a), index.get(b), round(means.reduce((s, v) => s + v, 0) / means.length), means.length];
  }).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  return {
    drugs: nscs.map((nsc) => ({ nsc, name: names.get(nsc) ?? nsc })),
    pairs: scored,
    cells: cells.size,
    wells,
  };
};

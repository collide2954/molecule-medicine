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

export const almanacScores = (lines, names = new Map()) => {
  let col = null;
  const pairs = new Map();
  const cells = new Set();
  let wells = 0;
  for (const line of lines) {
    if (!line) continue;
    const f = line.split(',');
    if (!col) {
      col = Object.fromEntries(f.map((h, i) => [h.trim(), i]));
      continue;
    }
    if (f[col.CONCINDEX1] === '0' || f[col.CONCINDEX2] === '0' || f[col.SCORE] === '' || f[col.SCORE] === undefined) continue;
    const [a, b] = [f[col.NSC1], f[col.NSC2]].sort((x, y) => Number(x) - Number(y));
    const cell = f[col.CELLNAME];
    const key = `${a}|${b}`;
    if (!pairs.has(key)) pairs.set(key, new Map());
    const byCell = pairs.get(key);
    const acc = byCell.get(cell) ?? [0, 0];
    acc[0] += Number(f[col.SCORE]);
    acc[1] += 1;
    byCell.set(cell, acc);
    cells.add(cell);
    wells += 1;
  }
  const nscs = [...new Set([...pairs.keys()].flatMap((k) => k.split('|')))].sort((x, y) => Number(x) - Number(y));
  const index = new Map(nscs.map((n, i) => [n, i]));
  const rows = [...pairs].map(([key, byCell]) => {
    const [a, b] = key.split('|');
    const means = [...byCell.values()].map(([sum, n]) => sum / n);
    return [index.get(a), index.get(b), round(means.reduce((s, v) => s + v, 0) / means.length), means.length];
  }).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  return {
    drugs: nscs.map((nsc) => ({ nsc, name: names.get(nsc) ?? nsc })),
    pairs: rows,
    cells: cells.size,
    wells,
  };
};

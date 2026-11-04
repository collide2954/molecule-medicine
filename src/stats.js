export const quantile = (sorted, q) => {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export const summary = (values) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return {
    n: s.length,
    min: s[0],
    q1: quantile(s, 0.25),
    median: quantile(s, 0.5),
    q3: quantile(s, 0.75),
    max: s.at(-1),
    mean: s.reduce((a, b) => a + b, 0) / s.length,
  };
};

const tidy = (v) => Number(v.toPrecision(12));

export const logEdges = (lo, hi, perDecade) => Array.from({ length: (hi - lo) * perDecade + 1 }, (_, i) => tidy(10 ** (lo + i / perDecade)));

export const linearEdges = (lo, hi, step) => Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => tidy(lo + i * step));

export const binIndex = (edges, v) => {
  const last = edges.length - 2;
  if (v < edges[1]) return 0;
  if (v >= edges[last]) return last;
  let lo = 1;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (edges[mid] <= v) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

export const histogram = (values, edges) => {
  const counts = new Array(edges.length - 1).fill(0);
  for (const v of values) counts[binIndex(edges, v)] += 1;
  return counts;
};

export const lorenz = (values, points = 100) => {
  const s = [...values].sort((a, b) => a - b);
  const total = s.reduce((a, b) => a + b, 0);
  const prefix = [0];
  for (const v of s) prefix.push(prefix.at(-1) + v);
  return Array.from({ length: points + 1 }, (_, k) => {
    const x = k / points;
    return [x, total ? tidy(prefix[Math.round(x * s.length)] / total) : 0];
  });
};

export const gini = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const total = s.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  const weighted = s.reduce((acc, v, i) => acc + (i + 1) * v, 0);
  return tidy((2 * weighted) / (s.length * total) - (s.length + 1) / s.length);
};

export const mergeIntervals = (intervals) => {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = [];
  for (const [start, end] of sorted) {
    const last = out.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
};

export const topBy = (rows, key, n) => [...rows].sort((a, b) => b[key] - a[key]).slice(0, n);

const moments = (xs, ys) => {
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return {
    mx, my, sxy, sxx, syy,
  };
};

export const pearson = (xs, ys) => {
  const m = moments(xs, ys);
  return m.sxx && m.syy ? tidy(m.sxy / Math.sqrt(m.sxx * m.syy)) : NaN;
};

export const linearFit = (xs, ys) => {
  const m = moments(xs, ys);
  const slope = m.sxy / m.sxx;
  return { slope: tidy(slope), intercept: tidy(m.my - slope * m.mx) };
};

export const ranks = (values) => {
  const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(values.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) out[order[k][1]] = rank;
    i = j + 1;
  }
  return out;
};

export const spearman = (xs, ys) => pearson(ranks(xs), ranks(ys));

export const clusterOrder = (matrix) => {
  const similarity = (a, b) => {
    let s = 0;
    for (const i of a) for (const j of b) s += matrix[i][j];
    return s / (a.length * b.length);
  };
  const join = (a, b) => {
    const ra = [...a].reverse();
    const rb = [...b].reverse();
    const options = [[a, b], [a, rb], [ra, b], [ra, rb]];
    const [x, y] = options.reduce((best, o) => (matrix[o[0].at(-1)][o[1][0]] > matrix[best[0].at(-1)][best[1][0]] ? o : best));
    return [...x, ...y];
  };
  let clusters = matrix.map((_, i) => [i]);
  while (clusters.length > 1) {
    let best = { i: 0, j: 1, s: -Infinity };
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const s = similarity(clusters[i], clusters[j]);
        if (s > best.s) best = { i, j, s };
      }
    }
    const merged = join(clusters[best.i], clusters[best.j]);
    clusters = clusters.filter((_, k) => k !== best.i && k !== best.j);
    clusters.splice(best.i, 0, merged);
  }
  return clusters[0] ?? [];
};

const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;

const sampleSd = (v) => {
  const m = mean(v);
  return Math.sqrt(v.reduce((n, x) => n + (x - m) ** 2, 0) / (v.length - 1));
};

export const silverman = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const spread = Math.min(sampleSd(s), (quantile(s, 0.75) - quantile(s, 0.25)) / 1.34) || sampleSd(s) || 1;
  return 0.9 * spread * s.length ** -0.2;
};

const NORMAL = 1 / Math.sqrt(2 * Math.PI);

export const kde = (values, { bandwidth, from, to, points = 64 } = {}) => {
  const h = bandwidth ?? silverman(values);
  const lo = from ?? Math.min(...values) - 3 * h;
  const hi = to ?? Math.max(...values) + 3 * h;
  return Array.from({ length: points }, (_, i) => {
    const x = tidy(lo + (i * (hi - lo)) / (points - 1));
    let sum = 0;
    for (const v of values) sum += Math.exp(-0.5 * ((x - v) / h) ** 2);
    return { x, y: (sum * NORMAL) / (values.length * h) };
  });
};

export const ecdf = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const out = [];
  s.forEach((x, i) => {
    if (out.length && out.at(-1).x === x) out.at(-1).p = (i + 1) / s.length;
    else out.push({ x, p: (i + 1) / s.length });
  });
  return out;
};

export const kaplanMeier = (times, events) => {
  const order = times.map((t, i) => [t, events[i] ? 1 : 0]).sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const steps = [{ t: 0, s: 1, atRisk: order.length, events: 0 }];
  const censored = [];
  let atRisk = order.length;
  let s = 1;
  for (let i = 0; i < order.length;) {
    const t = order[i][0];
    let d = 0;
    let c = 0;
    while (i < order.length && order[i][0] === t) {
      if (order[i][1]) d += 1;
      else c += 1;
      i += 1;
    }
    if (d) {
      s *= 1 - d / atRisk;
      steps.push({ t, s, atRisk, events: d });
    }
    if (c) censored.push(t);
    atRisk -= d + c;
  }
  return { steps, censored, median: steps.find((p) => p.s <= 0.5)?.t ?? null };
};

const Z = 1.959963984540054;

export const ror = (a, b, c, d) => {
  if (!a || !b || !c || !d) return { value: a && b && c && d ? (a * d) / (b * c) : 0, lo: NaN, hi: NaN };
  const value = (a * d) / (b * c);
  const se = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
  return { value, lo: Math.exp(Math.log(value) - Z * se), hi: Math.exp(Math.log(value) + Z * se) };
};

export const prr = (a, b, c, d) => {
  if (!a || !c) return { value: 0, lo: NaN, hi: NaN };
  const value = (a / (a + b)) / (c / (c + d));
  const se = Math.sqrt(1 / a - 1 / (a + b) + 1 / c - 1 / (c + d));
  return { value, lo: Math.exp(Math.log(value) - Z * se), hi: Math.exp(Math.log(value) + Z * se) };
};

export const chi2 = (a, b, c, d) => {
  const n = a + b + c + d;
  const den = (a + b) * (c + d) * (a + c) * (b + d);
  return den ? (n * (a * d - b * c) ** 2) / den : 0;
};

export const informationComponent = (a, b, c, d) => {
  const n = a + b + c + d;
  const expected = ((a + b) * (a + c)) / n;
  const value = Math.log2((a + 0.5) / (expected + 0.5));
  const k = a + 0.5;
  return { value, lo: value - 3.3 * k ** -0.5 - 2 * k ** -1.5, hi: value + 2.4 * k ** -0.5 - 0.5 * k ** -1.5 };
};

export const wilson = (k, n, z = Z) => {
  if (!n) return [0, 0];
  const p = k / n;
  const den = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [Math.max(0, center - half), Math.min(1, center + half)];
};

export const blandAltman = (a, b) => {
  const points = a.map((x, i) => ({ mean: (x + b[i]) / 2, diff: x - b[i] }));
  const diffs = points.map((p) => p.diff);
  const bias = mean(diffs);
  const sd = sampleSd(diffs);
  return { bias, sd, lo: bias - 1.96 * sd, hi: bias + 1.96 * sd, points };
};

export const hexbin = (points, radius) => {
  const dx = radius * 2 * Math.sin(Math.PI / 3);
  const dy = radius * 1.5;
  const bins = new Map();
  for (const [x, y] of points) {
    const py = y / dy;
    let pj = Math.round(py);
    const px = x / dx - (pj & 1) / 2;
    let pi = Math.round(px);
    const py1 = py - pj;
    if (Math.abs(py1) * 3 > 1) {
      const px1 = px - pi;
      const pi2 = pi + (px < pi ? -1 : 1) / 2;
      const pj2 = pj + (py < pj ? -1 : 1);
      const px2 = px - pi2;
      const py2 = py - pj2;
      if (px1 * px1 + py1 * py1 > px2 * px2 + py2 * py2) {
        pi = pi2 + (pj & 1 ? 1 : -1) / 2;
        pj = pj2;
      }
    }
    const key = `${pi},${pj}`;
    if (!bins.has(key)) bins.set(key, { i: pi, j: pj, x: tidy((pi + (pj & 1) / 2) * dx), y: tidy(pj * dy), n: 0 });
    bins.get(key).n += 1;
  }
  return [...bins.values()];
};

export const geomean = (values) => Math.exp(mean(values.map(Math.log)));

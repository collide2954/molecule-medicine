import {
  exact, pct, decimal, seconds,
} from './lib.js';
import {
  summary, blandAltman, spearman, clusterOrder, pearson,
} from './stats.js';

const tidy = (v) => Number(v.toPrecision(12));
const round = (v, places = 2) => Math.round(v * 10 ** places) / 10 ** places;
const lower = (s) => String(s ?? '').toLowerCase();
const release = (snap) => String(snap.chembl.release).replace('_', ' ');

export const binShares = (bins) => {
  const total = bins.reduce((n, [, c]) => n + c, 0) || 1;
  return bins.map(([x, c]) => ({ x, y: tidy(c / total) }));
};

export const medianBin = (bins) => {
  const total = bins.reduce((n, [, c]) => n + c, 0);
  let acc = 0;
  for (const [x, c] of bins) {
    acc += c;
    if (acc >= total / 2) return x;
  }
  return bins.at(-1)?.[0] ?? null;
};

export const efficiencyPoints = (snap) => {
  const byName = new Map(snap.drugs.filter((d) => d.p?.heavy).map((d) => [lower(d.name), d]));
  const best = new Map();
  for (const a of snap.gtopdb.affinities) {
    const d = byName.get(lower(a.ligand));
    if (!d) continue;
    const key = `${lower(a.ligand)}|${a.target}`;
    if (!best.has(key) || a.value > best.get(key).p) {
      best.set(key, {
        ligand: lower(a.ligand), target: a.target, units: a.units, p: a.value, heavy: d.p.heavy, alogp: d.p.alogp,
      });
    }
  }
  return [...best.values()].map((r) => ({
    ...r, le: round((1.37 * r.p) / r.heavy), lle: r.alogp === null || r.alogp === undefined ? null : round(r.p - r.alogp),
  }));
};

export const agreementStats = (snap, which = 'klaeger') => {
  const A = snap.agreement[which];
  const davis = A.pairs.map(([d]) => d);
  const other = A.pairs.map(([, k]) => k);
  const ba = blandAltman(davis, other);
  const share = (limit) => A.pairs.filter(([d, k]) => Math.abs(d - k) <= limit + 1e-9).length / (A.pairs.length || 1);
  return {
    n: A.pairs.length,
    bias: round(ba.bias),
    sd: round(ba.sd),
    lo: round(ba.lo),
    hi: round(ba.hi),
    within: share(0.5),
    withinTenfold: share(1),
    spearman: round(spearman(davis, other)),
    pearson: round(pearson(davis, other)),
    discordant: A.counts.davisOnly + A.counts.karamanOnly,
    identical: A.pairs.filter(([d, k]) => Math.abs(d - k) < 0.005).length,
    points: ba.points,
  };
};

export const kineticRows = (snap) => snap.kinetics.pairs.map((p) => ({
  ...p, pkd: tidy(-Math.log10(p.koff / p.kon)), residence: tidy(1 / p.koff), logKon: tidy(Math.log10(p.kon)), logKoff: tidy(Math.log10(p.koff)),
}));

const SALTS = new Set(['hydrochloride', 'dihydrochloride', 'mesylate', 'citrate', 'tosylate', 'ditosylate', 'sulfate', 'tartrate', 'acetate', 'maleate', 'fumarate', 'malate', 'phosphate', 'sodium', 'potassium', 'dimeglumine', 'hydrobromide', 'besylate', 'succinate', 'lactate', 'hydrate', 'bitartrate']);

export const drugBase = (name) => lower(name).split(/\s+/).filter((w) => !SALTS.has(w)).join(' ');

export const comboMatrix = (snap) => {
  const M = snap.almanac;
  const n = M.drugs.length;
  const values = Array.from({ length: n }, () => Array(n).fill(null));
  for (const [i, j, score] of M.pairs) {
    values[i][j] = score;
    values[j][i] = score;
  }
  const rowMean = values.map((row) => {
    const v = row.filter((x) => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  });
  const filled = values.map((row, i) => row.map((v) => (v === null ? rowMean[i] : v)));
  const similarity = filled.map((a) => filled.map((b) => {
    const r = pearson(a, b);
    return Number.isFinite(r) ? r : 0;
  }));
  return { names: M.drugs.map((d) => drugBase(d.name)), values, order: clusterOrder(similarity) };
};

export const topPairs = (snap, k = 20, sign = 1) => {
  const M = snap.almanac;
  return [...M.pairs].sort((p, q) => sign * (q[2] - p[2]) || p[0] - q[0] || p[1] - q[1]).slice(0, k).map(([i, j, score, cells]) => ({
    a: drugBase(M.drugs[i].name), b: drugBase(M.drugs[j].name), score, cells,
  }));
};

const recordFinding = (snap) => {
  const A = snap.activities;
  const literature = A.sources.find((s) => s.id === 1)?.n ?? 0;
  return `${release(snap)} holds ${exact(A.total)} activity records; ${pct(literature / A.total)} come from the literature and ${pct(A.withPchembl / A.total)} carry a pChEMBL value`;
};

const potencyFinding = (snap) => {
  const bin = medianBin(snap.activities.pchembl);
  const approved = summary(snap.gtopdb.affinities.map((a) => a.value)).median;
  return `Measured potencies in ChEMBL centre on pChEMBL ${bin} to ${bin + 0.5}; approved drugs bind their primary targets at a median of ${decimal(approved, 1)}`;
};

const efficiencyFinding = (snap) => {
  const points = efficiencyPoints(snap);
  if (!points.length) return 'No approved-drug affinity in GtoPdb matched a ChEMBL structure in this snapshot';
  const le = summary(points.map((p) => p.le)).median;
  const below = points.filter((p) => (1.37 * p.p) / p.heavy < 0.3).length;
  return `Approved drugs have a median ligand efficiency of ${decimal(le, 2)} kcal/mol per heavy atom at their primary targets; ${pct(below / points.length)} fall below 0.3`;
};

const agreementFinding = (snap) => {
  const s = agreementStats(snap, 'klaeger');
  return `Kinobeads and KINOMEscan agree within tenfold on ${pct(s.withinTenfold)} of ${exact(s.n)} shared kinase Kd values; ${exact(s.discordant)} pairs bind in one assay but not the other`;
};

const kineticsFinding = (snap) => {
  const rows = kineticRows(snap);
  const times = rows.map((r) => r.residence);
  return `In K4DD, residence times run from ${seconds(Math.min(...times))} to ${seconds(Math.max(...times))} across ${exact(rows.length)} compound–target pairs on ${exact(new Set(rows.map((r) => r.target)).size)} targets`;
};

const combinationsFinding = (snap) => {
  const [top] = topPairs(snap, 1);
  const pairs = snap.almanac.pairs;
  return `In NCI-ALMANAC, ${top.a} with ${top.b} beats the Bliss expectation most, by ${Number(top.score.toFixed(1))} points; ${pct(pairs.filter((p) => p[2] > 0).length / pairs.length)} of ${exact(pairs.length)} pairs score above zero`;
};

export const bioFindings = (snap) => ({
  record: recordFinding(snap),
  potency: potencyFinding(snap),
  efficiency: efficiencyFinding(snap),
  agreement: agreementFinding(snap),
  kinetics: kineticsFinding(snap),
  combinations: combinationsFinding(snap),
});

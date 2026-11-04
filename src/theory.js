const tidy = (v) => Number(v.toPrecision(12));
const r4 = (v) => Math.round(v * 10000) / 10000;

export const occupancy = (c, kd, n = 1) => (c <= 0 ? 0 : c ** n / (c ** n + kd ** n));

export const operational = (a, ka, tau, n = 1, em = 1) => {
  if (a <= 0) return 0;
  const t = (tau * a) ** n;
  return (em * t) / ((ka + a) ** n + t);
};

export const operationalSummary = (ka, tau, n = 1) => {
  const ec50 = tidy(ka / ((2 + tau ** n) ** (1 / n) - 1));
  return { ec50, emax: tidy(tau ** n / (1 + tau ** n)), occupancyAtEc50: r4(ec50 / (ec50 + ka)) };
};

export const doseRatio = (b, kb) => 1 + b / kb;

export const chengPrusoff = (ic50, s, km) => ic50 / (1 + s / km);

export const association = (t, c, kon, koff) => {
  const on = kon * c;
  return (on / (on + koff)) * (1 - Math.exp(-(on + koff) * t));
};

export const washout = (t, b0, koff) => b0 * Math.exp(-koff * t);

export const curve = (f, lo, hi, points = 61) => Array.from({ length: points }, (_, i) => {
  const x = tidy(lo + ((hi - lo) * i) / (points - 1));
  return { x, y: f(10 ** x) };
});

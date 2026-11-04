export const oralConcentration = (t, {
  dose, f, ka, ke, v,
}) => {
  if (t <= 0) return 0;
  if (Math.abs(ka - ke) < 1e-9) return ((f * dose * ka * t) / v) * Math.exp(-ke * t);
  return ((f * dose * ka) / (v * (ka - ke))) * (Math.exp(-ke * t) - Math.exp(-ka * t));
};

export const repeatedDoses = (t, tau, p) => {
  let total = 0;
  for (let k = 0; k * tau <= t + 1e-9; k += 1) total += oralConcentration(t - k * tau, p);
  return total;
};

export const averageSteadyState = ({
  dose, f, cl, tau,
}) => (f * dose) / (cl * tau);

export const accumulation = (ke, tau) => 1 / (1 - Math.exp(-ke * tau));

export const halfLife = (cl, v) => (Math.LN2 * v) / cl;

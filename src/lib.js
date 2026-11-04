export const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return NaN;
  return typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
};

export const exact = (v) => {
  const n = toNumber(v);
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—';
};

const UNITS = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

export const compact = (v) => {
  const n = toNumber(v);
  if (!Number.isFinite(n)) return '—';
  const scaledBy = (size) => Math.round((n / size) * 10) / 10;
  for (const [i, [size, unit]] of UNITS.entries()) {
    if (Math.abs(n) >= size) {
      const scaled = scaledBy(size);
      return Math.abs(scaled) >= 1000 && i > 0 ? `${scaledBy(UNITS[i - 1][0])}${UNITS[i - 1][1]}` : `${scaled}${unit}`;
    }
  }
  return Math.abs(Math.round(n)) >= 1000 ? `${scaledBy(1e3)}K` : String(Math.round(n));
};

export const pct = (ratio) => {
  const v = ratio * 100;
  const places = v !== 0 && Math.abs(v) < 0.1 ? 2 : 1;
  return `${Number(v.toFixed(places))}%`;
};

export const usd = (v) => `$${compact(v)}`;

export const decimal = (v, places = 1) => {
  const n = toNumber(v);
  return Number.isFinite(n) ? n.toFixed(places) : '—';
};

const WORD_UNITS = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];

export const wordy = (n) => {
  const unit = WORD_UNITS.find(([size]) => n >= size);
  if (!unit) return exact(n);
  const v = n / unit[0];
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${Number(v.toFixed(digits))} ${unit[1]}`;
};

export const ordinal = (n) => {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`;
};

const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

export const sci = (p) => {
  if (p === 0) return '0';
  if (p >= 0.001) return String(Number(p.toPrecision(2)));
  const power = Math.floor(Math.log10(p));
  let mantissa = Number((p / 10 ** power).toFixed(1));
  let exponent = power;
  if (mantissa >= 10) {
    mantissa = 1;
    exponent += 1;
  }
  return `${mantissa}×10${[...String(exponent)].map((c) => SUPERSCRIPT[c]).join('')}`;
};

export const mlog = (p) => -Math.log10(p);

export const signed = (v, format = exact) => {
  if (v === 0) return '0';
  return v > 0 ? `+${format(v)}` : `−${format(-v)}`;
};

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (columns, rows) => `${[columns, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;

const scaled = (units) => (v) => {
  const n = toNumber(v);
  if (!Number.isFinite(n)) return '—';
  const [size, unit] = units.find(([s]) => Math.abs(n) >= s * 0.9995) ?? units.at(-1);
  return `${Number((n / size).toPrecision(3))} ${unit}`;
};

export const molar = scaled([[1, 'M'], [1e-3, 'mM'], [1e-6, 'µM'], [1e-9, 'nM'], [1e-12, 'pM'], [1e-15, 'fM']]);

export const perMl = scaled([[1e6, 'mg/mL'], [1e3, 'µg/mL'], [1, 'ng/mL'], [1e-3, 'pg/mL']]);

const tidy = (v) => Number(v.toPrecision(12));

export const pToMolar = (p) => tidy(10 ** -p);

export const molarToP = (m) => (m > 0 ? tidy(-Math.log10(m)) : NaN);

const HOURS_PER_YEAR = 24 * 365;

const short = (v) => (v < 10 ? Number(v.toFixed(1)) : Math.round(v));

export const duration = (hours) => {
  const h = toNumber(hours);
  if (!Number.isFinite(h)) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${short(h)} h`;
  if (h < HOURS_PER_YEAR) return `${short(h / 24)} days`;
  const years = short(h / HOURS_PER_YEAR);
  return `${years} ${years === 1 ? 'year' : 'years'}`;
};

export const daltons = (v) => {
  const n = toNumber(v);
  if (!Number.isFinite(n)) return '—';
  if (n < 1000) return `${n.toFixed(1)} Da`;
  if (n < 10000) return `${exact(n)} Da`;
  return `${Number((n / 1000).toPrecision(3))} kDa`;
};

export const times = (v) => `${Number(v.toPrecision(2))}×`;

export const price = (v) => {
  const n = toNumber(v);
  if (!Number.isFinite(n)) return '—';
  if (n < 1) return `$${Number(n.toPrecision(3))}`;
  if (n < 1000) return `$${n.toFixed(2)}`;
  return `$${exact(n)}`;
};

export const yearOf = (date) => Number(String(date).slice(0, 4));

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const longDate = (text) => {
  const [y, m, d] = String(text).split('-');
  if (!m) return y;
  const month = MONTHS[Number(m) - 1];
  return d ? `${Number(d)} ${month} ${y}` : `${month} ${y}`;
};

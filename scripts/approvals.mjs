import { readTables, excelDate } from './readers.mjs';

export const delimited = (text, delimiter) => {
  const [head = [], ...rows] = String(text ?? '').split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(delimiter));
  const keys = head.map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
};

const range = (from, to) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
const yearOf = (date) => Number(String(date ?? '').slice(0, 4));
const tallyYears = (rows, dateOf) => {
  const m = new Map();
  for (const r of rows) m.set(yearOf(dateOf(r)), (m.get(yearOf(dateOf(r))) ?? 0) + 1);
  return m;
};

const NME = new Set(['TYPE 1', 'TYPE 1/4']);

export const novelApprovals = ({
  applications, classes, submissions, properties, products,
}) => {
  const apps = new Map(applications.map((a) => [a.ApplNo, a]));
  const codes = new Map(classes.map((c) => [c.SubmissionClassCodeID, c.SubmissionClassCode]));
  const orphan = new Set(properties.filter((p) => p.SubmissionPropertyTypeCode === 'Orphan').map((p) => `${p.ApplNo}|${p.SubmissionType}|${p.SubmissionNo}`));
  const first = new Map();
  for (const p of products) if (!first.has(p.ApplNo)) first.set(p.ApplNo, p);
  return submissions.filter((s) => {
    if (s.SubmissionType !== 'ORIG' || s.SubmissionStatus !== 'AP') return false;
    const type = apps.get(s.ApplNo)?.ApplType;
    const code = codes.get(s.SubmissionClassCodeID);
    return (type === 'NDA' && NME.has(code)) || (type === 'BLA' && code === 'TYPE 1');
  }).map((s) => ({
    appl: s.ApplNo,
    type: apps.get(s.ApplNo).ApplType,
    date: s.SubmissionStatusDate.slice(0, 10),
    priority: s.ReviewPriority === 'PRIORITY',
    orphan: orphan.has(`${s.ApplNo}|${s.SubmissionType}|${s.SubmissionNo}`),
    name: first.get(s.ApplNo)?.DrugName ?? null,
    ingredient: first.get(s.ApplNo)?.ActiveIngredient ?? null,
    sponsor: apps.get(s.ApplNo).SponsorName ?? null,
  })).sort((a, b) => a.date.localeCompare(b.date) || a.appl.localeCompare(b.appl));
};

export const isAntibody = (name) => /mab\b/i.test(String(name ?? ''));

export const novelYears = (novel, from, to) => {
  const years = range(from, to);
  const count = (test) => {
    const m = tallyYears(novel.filter(test), (n) => n.date);
    return years.map((y) => m.get(y) ?? 0);
  };
  return {
    years,
    nda: count((n) => n.type === 'NDA'),
    mab: count((n) => n.type === 'BLA' && isAntibody(n.ingredient)),
    biologic: count((n) => n.type === 'BLA' && !isAntibody(n.ingredient)),
    priority: count((n) => n.priority),
    orphan: count((n) => n.orphan),
  };
};

export const approvalCalendar = (novel, from) => {
  const weekdays = Array(7).fill(0);
  const months = Array(12).fill(0);
  for (const n of novel) {
    if (yearOf(n.date) < from) continue;
    const d = new Date(`${n.date}T00:00:00Z`);
    weekdays[d.getUTCDay()] += 1;
    months[d.getUTCMonth()] += 1;
  }
  return { from, weekdays, months };
};

export const andaApprovals = ({ applications, submissions }, from, to) => {
  const types = new Map(applications.map((a) => [a.ApplNo, a.ApplType]));
  const anda = submissions.filter((s) => s.SubmissionType === 'ORIG' && types.get(s.ApplNo) === 'ANDA');
  const years = range(from, to);
  const m = tallyYears(anda.filter((s) => s.SubmissionStatus === 'AP'), (s) => s.SubmissionStatusDate);
  return { years, counts: years.map((y) => m.get(y) ?? 0), tentative: anda.filter((s) => s.SubmissionStatus === 'TA').length };
};

const PED = /\*PED$/i;

export const patentSummary = (products, patents, top = 15) => {
  const byPatent = new Map();
  const byAppl = new Map();
  for (const p of patents) {
    const no = p.Patent_No.replace(PED, '');
    const e = byPatent.get(no) ?? {
      year: null, ped: null, substance: false, product: false, use: false,
    };
    const y = Number(String(p.Patent_Expire_Date_Text).match(/\d{4}$/)?.[0]) || null;
    if (PED.test(p.Patent_No)) e.ped = e.ped === null || (y && y < e.ped) ? y : e.ped;
    else if (y && (e.year === null || y < e.year)) e.year = y;
    e.substance ||= p.Drug_Substance_Flag === 'Y';
    e.product ||= p.Drug_Product_Flag === 'Y';
    e.use ||= Boolean(p.Patent_Use_Code);
    byPatent.set(no, e);
    if (!byAppl.has(p.Appl_No)) byAppl.set(p.Appl_No, new Set());
    byAppl.get(p.Appl_No).add(no);
  }
  const names = new Map();
  for (const p of products) if (p.Appl_Type === 'N' && !names.has(p.Appl_No)) names.set(p.Appl_No, p);
  const expiry = {};
  for (const e of byPatent.values()) {
    const y = e.year ?? e.ped;
    if (y) expiry[y] = (expiry[y] ?? 0) + 1;
  }
  const all = [...byPatent.values()];
  return {
    patents: byPatent.size,
    applications: byAppl.size,
    substance: all.filter((e) => e.substance).length,
    product: all.filter((e) => e.product).length,
    use: all.filter((e) => e.use).length,
    top: [...byAppl].map(([appl, set]) => ({
      appl, name: names.get(appl)?.Trade_Name ?? null, ingredient: names.get(appl)?.Ingredient ?? null, patents: set.size,
    })).sort((a, b) => b.patents - a.patents || a.appl.localeCompare(b.appl)).slice(0, top),
    expiry,
  };
};

export const exclusivitySummary = (excl) => {
  const m = new Map();
  for (const key of new Set(excl.map((e) => `${e.Appl_No}|${e.Exclusivity_Code}`))) {
    const code = key.split('|')[1].replace(/[-*].*$/, '');
    m.set(code, (m.get(code) ?? 0) + 1);
  }
  return [...m].map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n || a.code.localeCompare(b.code));
};

export const teSummary = (products) => {
  const rx = products.filter((p) => p.Type === 'RX');
  const m = new Map();
  for (const p of rx) {
    const codes = new Set(String(p.TE_Code ?? '').split(',').map((c) => c.trim().replace(/\d+$/, '')).filter(Boolean));
    if (!codes.size) codes.add('none');
    for (const c of codes) m.set(c, (m.get(c) ?? 0) + 1);
  }
  return { rx: rx.length, codes: [...m].map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n || a.code.localeCompare(b.code)), rld: rx.filter((p) => p.RLD === 'Yes').length };
};

export const mostCopied = (products, top = 15) => {
  const m = new Map();
  for (const p of products.filter((x) => x.Type === 'RX' && x.Appl_Type === 'A')) {
    const key = `${p.Ingredient}\u0000${p['DF;Route']}`;
    if (!m.has(key)) m.set(key, new Set());
    m.get(key).add(p.Appl_No);
  }
  return [...m].map(([key, set]) => {
    const [ingredient, form] = key.split('\u0000');
    return { ingredient, form, andas: set.size };
  }).sort((a, b) => b.andas - a.andas || a.ingredient.localeCompare(b.ingredient)).slice(0, top);
};

const dmy = (v) => {
  if (typeof v === 'number') return excelDate(v);
  const m = String(v ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};

const EMA_FLAGS = {
  generic: 'Generic', biosimilar: 'Biosimilar', orphan: 'Orphan medicine', conditional: 'Conditional approval', exceptional: 'Exceptional circumstances', accelerated: 'Accelerated assessment', prime: 'PRIME: priority medicine', advanced: 'Advanced therapy',
};

export const emaMedicines = (book) => {
  const sheet = book.Medicine ?? Object.values(book)[0] ?? [];
  const at = sheet.findIndex((r) => r[0] === 'Category');
  if (at < 0) return [];
  const head = sheet[at];
  const col = (name) => head.indexOf(name);
  const get = (r, name) => (col(name) >= 0 ? r[col(name)] ?? null : null);
  return sheet.slice(at + 1).filter((r) => get(r, 'Category') === 'Human').map((r) => ({
    name: get(r, 'Name of medicine'),
    inn: get(r, 'International non-proprietary name (INN) / common name'),
    substance: get(r, 'Active substance'),
    status: get(r, 'Medicine status'),
    authorised: dmy(get(r, 'Marketing authorisation date')),
    ...Object.fromEntries(Object.entries(EMA_FLAGS).map(([key, name]) => [key, get(r, name) === 'Yes'])),
  }));
};

export const emaYears = (rows, from, to) => {
  const years = range(from, to);
  const authorised = rows.filter((r) => r.authorised);
  const count = (test) => {
    const m = tallyYears(authorised.filter(test), (r) => r.authorised);
    return years.map((y) => m.get(y) ?? 0);
  };
  return {
    years, novel: count((r) => !r.generic && !r.biosimilar), generic: count((r) => r.generic), biosimilar: count((r) => r.biosimilar),
  };
};

export const emaFlags = (rows) => {
  const a = rows.filter((r) => r.authorised);
  return {
    total: rows.length,
    authorised: a.length,
    refused: rows.filter((r) => r.status === 'Refused').length,
    ...Object.fromEntries(['conditional', 'exceptional', 'accelerated', 'prime', 'orphan', 'advanced', 'generic', 'biosimilar'].map((k) => [k, a.filter((r) => r[k]).length])),
  };
};

const SALTS = /\b(hydrochloride|dihydrochloride|hydrobromide|mesylate|mesilate|sodium|disodium|potassium|dipotassium|calcium|magnesium|maleate|tartrate|bitartrate|citrate|succinate|sulfate|sulphate|hemisulfate|phosphate|acetate|fumarate|hemifumarate|besylate|besilate|tosylate|bromide|chloride|monohydrate|hemihydrate|dihydrate|trihydrate|sesquihydrate|hydrate|anhydrous|meglumine|tromethamine|hyclate|malate|oxalate|lactate|gluconate|napsylate|pamoate|embonate|nitrate|benzoate)\b/g;

export const normalizeSubstance = (s) => String(s ?? '').toLowerCase().replace(/-[a-z]{4}\b/g, '').replace(SALTS, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const MONTH = 30.4375 * 86400000;

export const fdaEmaLag = (novel, rows, since) => {
  const ema = new Map();
  for (const r of rows) {
    if (!r.authorised || r.generic || r.biosimilar) continue;
    for (const key of new Set([r.inn, r.substance].map(normalizeSubstance).filter(Boolean))) {
      if (!ema.has(key) || r.authorised < ema.get(key)) ema.set(key, r.authorised);
    }
  }
  const fda = novel.filter((n) => yearOf(n.date) >= since);
  const pairs = fda.map((n) => ({ date: n.date, ema: ema.get(normalizeSubstance(n.ingredient)) ?? null, key: normalizeSubstance(n.ingredient) })).filter((p) => p.key && p.ema);
  return {
    since,
    fda: fda.length,
    matched: pairs.length,
    fdaFirst: pairs.filter((p) => p.date < p.ema).length,
    emaFirst: pairs.filter((p) => p.ema < p.date).length,
    lags: pairs.map((p) => Number(((Date.parse(p.ema) - Date.parse(p.date)) / MONTH).toFixed(1))).sort((a, b) => a - b),
  };
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const anyDate = (s) => {
  const t = String(s ?? '').trim();
  const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const long = t.match(/^([A-Za-z]+)\.? (\d{1,2}), (\d{4})$/);
  const month = long ? MONTHS.indexOf(long[1].slice(0, 3).toLowerCase()) : -1;
  return month >= 0 ? `${long[3]}-${String(month + 1).padStart(2, '0')}-${long[2].padStart(2, '0')}` : null;
};

export const biosimilarRows = (html) => {
  const t = readTables(html).find((x) => x.head.some((h) => /biosimilar name/i.test(h)));
  if (!t) return [];
  const col = (re) => t.head.findIndex((h) => re.test(h));
  const [n, d, r] = [col(/biosimilar name/i), col(/approval date/i), col(/reference/i)];
  return t.rows.map((row) => ({ name: row[n], date: anyDate(row[d]), reference: row[r] })).filter((x) => x.name);
};

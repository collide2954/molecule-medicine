import { readTables } from './readers.mjs';

export const RECALL_REASONS = [
  { key: 'nitrosamine', test: /nitros|\bnd[em]a\b|\bnmba\b|\bndsri/i },
  { key: 'microbial', test: /microb|bacteri|fung|mou?ld\b|yeast|burkholderia|abscess/i },
  { key: 'sterility', test: /steril/i },
  { key: 'cross', test: /cross[- ]?contamin|penicillin/i },
  { key: 'unapproved', test: /without (an )?approved|unapproved|tainted|undeclared (?!excipient)|monograph/i },
  { key: 'labeling', test: /label|mix-?up|mispack|foreign tablet|foreign capsule|out of sequence|imprint|wrong/i },
  { key: 'particulate', test: /particulate|foreign|glass|precipitat|crystalli/i },
  { key: 'potency', test: /potent|potency|assay|content uniformity|out of specification for active/i },
  { key: 'impurity', test: /impurit|degradat|azido|chemical contamin/i },
  { key: 'dissolution', test: /dissolution/i },
  { key: 'stability', test: /stability|expir/i },
  { key: 'container', test: /container|delivery|closure|leak|short fill|packag|seal|crack|syringe/i },
  { key: 'cgmp', test: /c?gmp|processing control|quality assurance|inspection|temperature/i },
];

const REASON_KEYS = [...RECALL_REASONS.map((r) => r.key), 'other'];
const CAUSES = RECALL_REASONS.slice(1);

export const recallReason = (text) => {
  const s = String(text ?? '');
  if (RECALL_REASONS[0].test.test(s)) return 'nitrosamine';
  const head = s.split(':')[0];
  return (CAUSES.find((r) => r.test.test(head)) ?? CAUSES.find((r) => r.test.test(s)))?.key ?? 'other';
};

const DAY = 86400000;
const ymd = (s) => (/^\d{8}$/.test(String(s ?? '')) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : null);

export const recallRecords = (json) => (json.results ?? []).map((r) => {
  const reported = ymd(r.report_date);
  const initiated = ymd(r.recall_initiation_date);
  return {
    id: r.recall_number ?? null,
    event: r.event_id ?? null,
    cls: String(r.classification ?? '').replace(/^Class\s+/, '') || null,
    year: reported ? Number(reported.slice(0, 4)) : null,
    days: reported && initiated ? Math.round((Date.parse(reported) - Date.parse(initiated)) / DAY) : null,
    country: r.country || null,
    firm: r.recalling_firm ?? null,
    reason: r.reason_for_recall ?? '',
    mandated: /mandated/i.test(r.voluntary_mandated ?? ''),
    product: r.product_description ?? '',
    generic: r.openfda?.generic_name?.[0] ?? null,
  };
});

const tallyBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) {
    const k = key(r);
    if (k !== null && k !== undefined && k !== '') m.set(k, [...(m.get(k) ?? []), r]);
  }
  return m;
};

const nearest = (sorted, q) => (sorted.length ? sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] : null);
const CLASSES = ['I', 'II', 'III'];

export const recallSummary = (records, lastYear) => {
  const first = Math.min(...records.map((r) => r.year).filter(Boolean));
  const years = Array.from({ length: Math.max(0, lastYear - first + 1) }, (_, i) => first + i);
  const causes = records.map((r) => recallReason(r.reason));
  const lags = records.map((r) => r.days).filter((d) => d !== null && d >= 0).sort((a, b) => a - b);
  return {
    total: records.length,
    events: new Set(records.map((r) => r.event)).size,
    years,
    byClass: Object.fromEntries(CLASSES.map((c) => [c, years.map((y) => records.filter((r) => r.year === y && r.cls === c).length)])),
    reasons: REASON_KEYS.map((key) => {
      const rs = records.filter((_, i) => causes[i] === key);
      return { key, n: rs.length, ...Object.fromEntries(CLASSES.map((c) => [c, rs.filter((r) => r.cls === c).length])) };
    }).filter((r) => r.n).sort((a, b) => b.n - a.n || REASON_KEYS.indexOf(a.key) - REASON_KEYS.indexOf(b.key)),
    countries: [...tallyBy(records, (r) => r.country)].map(([name, rs]) => ({ name, n: rs.length })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 12),
    firms: [...tallyBy(records, (r) => r.firm)].map(([name, rs]) => ({ name, n: rs.length, events: new Set(rs.map((r) => r.event)).size })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 10),
    mandated: records.filter((r) => r.mandated).length,
    lag: { median: nearest(lags, 0.5), p90: nearest(lags, 0.9) },
  };
};

export const NITROSAMINE_GROUPS = [
  { key: 'sartans', test: /sartan/ },
  { key: 'h2', test: /ranitidine|nizatidine|zantac|axid/ },
  { key: 'metformin', test: /metformin|riomet|glumetza|fortamet|glucophage/ },
  { key: 'varenicline', test: /varenicline|chantix/ },
];

const drugText = (r) => `${r.product} ${r.generic ?? ''}`.toLowerCase();

export const nitrosamineGroup = (r) => NITROSAMINE_GROUPS.find((g) => g.test.test(drugText(r)))?.key ?? 'other';

const SARTAN = /(valsartan|losartan|irbesartan|olmesartan|candesartan|telmisartan|azilsartan|eprosartan)/;

const NAMED = /n-?nitroso[- ]+(?:(?:di)?desmethyl[- ]+|nor[- ]+)?([a-z]{4,})/i;
const NOT_A_DRUG = /^(impurit|drug|compound|amine|related|substance|product)/;

const drugName = (r, group) => {
  const t = drugText(r);
  if (group === 'sartans') return t.match(SARTAN)?.[1] ?? 'sartan';
  if (group === 'h2') return /nizatidine|axid/.test(t) ? 'nizatidine' : 'ranitidine';
  if (group !== 'other') return group;
  const named = r.reason.match(NAMED)?.[1]?.toLowerCase();
  if (named && !NOT_A_DRUG.test(named)) return named;
  return String(r.generic ?? r.product).toLowerCase().match(/[a-z]+/)?.[0] ?? 'unknown';
};

export const nitrosamineRecalls = (records) => {
  const hits = records.filter((r) => recallReason(r.reason) === 'nitrosamine' && r.year);
  const byYear = {};
  const drugs = new Map();
  for (const r of hits) {
    const group = nitrosamineGroup(r);
    byYear[r.year] ??= {};
    byYear[r.year][group] = (byYear[r.year][group] ?? 0) + 1;
    const name = drugName(r, group);
    const d = drugs.get(name) ?? {
      name, group, n: 0, first: r.year, last: r.year,
    };
    d.n += 1;
    d.first = Math.min(d.first, r.year);
    d.last = Math.max(d.last, r.year);
    drugs.set(name, d);
  }
  return { total: hits.length, byYear, drugs: [...drugs.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 20) };
};

const firstNumber = (s) => {
  const m = String(s ?? '').match(/\d[\d,]*(?:\.\d+)?/);
  return m ? Number(m[0].replaceAll(',', '')) : NaN;
};

const usDate = (s) => {
  const m = String(s ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
};

export const nitrosamineLimits = (html) => {
  const tables = readTables(html);
  const find = (re) => tables.find((t) => t.head.some((h) => re.test(h)));
  const col = (t, re) => t.head.findIndex((h) => re.test(h));
  const lim = find(/potency category/i);
  const sur = find(/surrogate/i);
  const int = find(/interim/i);
  const source = (s) => String(s ?? '').trim().toLowerCase();
  return {
    limits: (lim?.rows ?? []).map((r) => {
      const category = Number(r[col(lim, /potency/i)]);
      return {
        name: r[0], source: source(r[1]), category: Number.isFinite(category) ? category : null, limit: firstNumber(r[col(lim, /ai limit/i)]),
      };
    }).filter((x) => x.name && Number.isFinite(x.limit)),
    surrogate: (sur?.rows ?? []).map((r) => ({ name: r[0], source: source(r[1]), limit: firstNumber(r[col(sur, /ai limit/i)]) })).filter((x) => x.name && Number.isFinite(x.limit)),
    interim: (int?.rows ?? []).map((r) => ({
      name: r[0], source: source(r[1]), limit: firstNumber(r[col(int, /interim ai/i)]), until: usDate(r[col(int, /duration/i)]),
    })).filter((x) => x.name && Number.isFinite(x.limit)),
  };
};

export const shortageRecords = (json) => (json.results ?? []).map((r) => ({
  name: r.generic_name ?? null,
  status: r.status ?? null,
  availability: r.availability ?? null,
  categories: r.therapeutic_category ?? [],
  form: r.dosage_form ?? null,
  posted: usDate(r.initial_posting_date),
  company: r.company_name ?? null,
}));

const STATUS_ORDER = ['Current', 'To Be Discontinued', 'Resolved'];

export const shortageSummary = (rows) => {
  const statuses = {};
  for (const r of rows) statuses[r.status] = (statuses[r.status] ?? 0) + 1;
  const drugs = [...tallyBy(rows, (r) => r.name)].map(([name, rs]) => {
    const has = new Set(rs.map((r) => r.status));
    const dates = rs.map((r) => r.posted).filter(Boolean).sort();
    return {
      name,
      status: STATUS_ORDER.find((s) => has.has(s)) ?? rs[0].status,
      categories: [...new Set(rs.flatMap((r) => r.categories))].sort(),
      forms: [...new Set(rs.map((r) => r.form).filter(Boolean))].sort(),
      posted: dates[0] ?? null,
      companies: new Set(rs.map((r) => r.company).filter(Boolean)).size,
      presentations: rs.length,
    };
  }).sort((a, b) => b.presentations - a.presentations || a.name.localeCompare(b.name));
  return { presentations: rows.length, statuses, drugs };
};

export const iidLink = (html) => {
  const m = String(html ?? '').match(/href="(\/media\/\d+\/download[^"]*)"/);
  return m ? `https://www.fda.gov${m[1].replaceAll('&amp;', '&')}` : null;
};

export const iidRows = (book) => {
  const sheet = Object.values(book).find((rows) => rows[0]?.includes('INGREDIENT_NAME')) ?? [];
  const [head = [], ...rest] = sheet;
  const at = (name) => head.indexOf(name);
  const i = {
    name: at('INGREDIENT_NAME'), route: at('ROUTE'), form: at('DOSAGE_FORM'), amount: at('POTENCY_AMOUNT'), unit: at('POTENCY_UNIT'), mde: at('MAXIMUM_DAILY_EXPOSURE'), mdeUnit: at('MAXIMUM_DAILY_EXPOSURE_UNIT'),
  };
  const num = (v) => (typeof v === 'number' ? v : null);
  return rest.filter((r) => r[i.name]).map((r) => ({
    name: r[i.name], route: r[i.route] ?? null, form: r[i.form] ?? null, amount: num(r[i.amount]), unit: r[i.unit] ?? null, mde: num(r[i.mde]), mdeUnit: r[i.mdeUnit] ?? null,
  }));
};

export const iidSummary = (rows) => {
  const byName = tallyBy(rows, (r) => r.name);
  return {
    rows: rows.length,
    ingredients: byName.size,
    routes: [...tallyBy(rows, (r) => r.route)].map(([route, rs]) => ({ route, entries: rs.length, ingredients: new Set(rs.map((r) => r.name)).size })).sort((a, b) => b.entries - a.entries || a.route.localeCompare(b.route)),
    top: [...byName].map(([name, rs]) => ({
      name, entries: rs.length, routes: new Set(rs.map((r) => r.route)).size, forms: new Set(rs.map((r) => `${r.route}|${r.form}`)).size,
    })).sort((a, b) => b.entries - a.entries || a.name.localeCompare(b.name)).slice(0, 25),
    oralTablet: rows.filter((r) => r.route === 'ORAL' && r.form === 'TABLET' && r.unit === 'mg' && r.amount !== null).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)).slice(0, 10)
      .map((r) => ({ name: r.name, amount: r.amount })),
    withMde: rows.filter((r) => r.mde !== null).length,
  };
};

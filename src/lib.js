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

export const retry = async (fn, { tries = 3, wait = 1000 } = {}) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= tries) throw error;
      await new Promise((r) => setTimeout(r, wait * 2 ** (attempt - 1)));
    }
  }
};

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

const ACRONYMS = ['ACE', 'HIV', 'DNA', 'RNA', 'GABA', 'TNF', 'MAO', 'COX', 'HMG', 'CoA', 'SGLT2', 'DPP-4', 'GLP-1', 'H1', 'H2', 'BCR-ABL', 'EGFR', 'HER2', 'VEGF', 'PDE', 'CTLA-4', 'PD-1', 'PD-L1', 'ALK', 'BRAF', 'MEK', 'JAK', 'BTK', 'CDK', 'PARP', 'mTOR', 'CGRP', 'NMDA', 'PCSK9', 'RANKL', 'CFTR', 'IgE', 'IgG', 'HCV', 'HBV', 'RSV', 'B12', 'D3', 'K', 'BCG', 'ADP', 'FLT3', 'KRAS', 'IDH', 'BCL-2', 'CD20', 'CD38', 'IL'];

export const soften = (name) => {
  const s = String(name ?? '').trim();
  if (!s) return s;
  if (s === s.toUpperCase()) {
    const lower = s.toLowerCase();
    return ACRONYMS.reduce((out, a) => out.replace(new RegExp(`(^|[^a-z0-9])${a.toLowerCase()}(?=$|[^a-z0-9])`, 'g'), `$1${a}`), lower);
  }
  return /^[A-Z][a-z]/.test(s) ? `${s[0].toLowerCase()}${s.slice(1)}` : s;
};

export const casValid = (cas) => {
  const m = String(cas).match(/^(\d{2,7})-(\d{2})-(\d)$/);
  if (!m) return false;
  const digits = `${m[1]}${m[2]}`;
  const sum = [...digits].reverse().reduce((n, c, i) => n + Number(c) * (i + 1), 0);
  return sum % 10 === Number(m[3]);
};

const casCheck = (body) => [...body].reverse().reduce((n, c, i) => n + Number(c) * (i + 1), 0) % 10;

export const luhnDigit = (payload) => {
  const sum = [...String(payload)].reverse().reduce((n, c, i) => {
    const d = Number(c) * (i % 2 === 0 ? 2 : 1);
    return n + (d > 9 ? d - 9 : d);
  }, 0);
  return (10 - (sum % 10)) % 10;
};

export const ndc11 = (code) => {
  const bare = String(code).replace(/^NDC\s*/i, '');
  const [a, b, c] = /^\d{11}$/.test(bare) ? [bare.slice(0, 5), bare.slice(5, 9), bare.slice(9)] : bare.split('-');
  return `${a.padStart(5, '0')}-${b.padStart(4, '0')}-${c.padStart(2, '0')}`;
};

export const inchikeyCharge = (letter) => String(letter).toUpperCase().charCodeAt(0) - 78;

const ATC_GROUPS = {
  A: 'alimentary tract and metabolism', B: 'blood and blood forming organs', C: 'cardiovascular system', D: 'dermatologicals', G: 'genito-urinary system and sex hormones',
  H: 'systemic hormonal preparations, excluding sex hormones and insulins', J: 'antiinfectives for systemic use', L: 'antineoplastic and immunomodulating agents', M: 'musculo-skeletal system',
  N: 'nervous system', P: 'antiparasitic products, insecticides and repellents', R: 'respiratory system', S: 'sensory organs', V: 'various',
};

const ATC_LEVELS = [['Anatomical main group', 'anatomical main group'], ['Therapeutic subgroup', 'therapeutic subgroup'], ['Pharmacological subgroup', 'pharmacological subgroup'], ['Chemical subgroup', 'chemical subgroup'], ['Chemical substance', 'chemical substance']];

const atcLevels = (code) => [code.slice(0, 1), code.slice(0, 3), code.slice(0, 4), code.slice(0, 5), code.slice(0, 7)].filter((c, i, all) => c.length && (i === 0 || c !== all[i - 1]));

const CFR_PARTS = {
  11: 'electronic records and electronic signatures', 50: 'protection of human subjects', 54: 'financial disclosure by clinical investigators', 56: 'institutional review boards',
  58: 'good laboratory practice for nonclinical laboratory studies', 201: 'labeling', 202: 'prescription drug advertising', 207: 'registration of drug establishments and drug listing',
  210: 'current good manufacturing practice in manufacturing, processing, packing or holding of drugs', 211: 'current good manufacturing practice for finished pharmaceuticals',
  212: 'current good manufacturing practice for PET drugs', 216: 'human drug compounding', 300: 'general provisions for drugs', 310: 'new drugs', 312: 'investigational new drug application',
  314: 'applications for FDA approval to market a new drug', 316: 'orphan drugs', 320: 'bioavailability and bioequivalence requirements', 330: 'over-the-counter human drugs',
  600: 'biological products, general', 601: 'licensing of biological products', 610: 'general biological products standards',
  1271: 'human cells, tissues, and cellular and tissue-based products', 1300: 'controlled substances, definitions', 1301: 'registration of manufacturers, distributors and dispensers of controlled substances',
  1306: 'controlled substance prescriptions', 1308: 'schedules of controlled substances',
};

const USP_CHAPTERS = {
  1: 'injections and implanted drug products', 61: 'microbial enumeration tests for nonsterile products', 62: 'tests for specified microorganisms', 71: 'sterility tests', 85: 'bacterial endotoxins test',
  232: 'elemental impurities, limits', 233: 'elemental impurities, procedures', 467: 'residual solvents', 621: 'chromatography', 660: 'containers, glass', 701: 'disintegration', 711: 'dissolution',
  795: 'pharmaceutical compounding, nonsterile preparations', 797: 'pharmaceutical compounding, sterile preparations', 800: 'hazardous drugs, handling in healthcare settings',
  825: 'radiopharmaceuticals, preparation, compounding, dispensing and repackaging', 905: 'uniformity of dosage units', 1058: 'analytical instrument qualification',
  1092: 'the dissolution procedure, development and validation', 1151: 'pharmaceutical dosage forms', 1160: 'pharmaceutical calculations in pharmacy practice',
  1225: 'validation of compendial procedures', 1226: 'verification of compendial procedures', 1231: 'water for pharmaceutical purposes',
};

const ICH_SERIES = { Q: ['quality', 'quality-guidelines'], S: ['safety', 'safety-guidelines'], E: ['efficacy', 'efficacy-guidelines'], M: ['multidisciplinary', 'multidisciplinary-guidelines'] };

const ICH_TOPICS = {
  Q1A: 'stability testing of new drug substances and products', Q2: 'validation of analytical procedures', Q3A: 'impurities in new drug substances', Q3B: 'impurities in new drug products',
  Q3C: 'residual solvents', Q3D: 'elemental impurities', Q6A: 'specifications for new drug substances and products', Q7: 'good manufacturing practice for active pharmaceutical ingredients',
  Q8: 'pharmaceutical development', Q9: 'quality risk management', Q10: 'pharmaceutical quality system', Q11: 'development and manufacture of drug substances', Q12: 'product lifecycle management',
  Q13: 'continuous manufacturing', Q14: 'analytical procedure development', S1A: 'need for carcinogenicity studies', S2: 'genotoxicity testing', S5: 'reproductive toxicology',
  S7A: 'safety pharmacology studies', S7B: 'nonclinical evaluation of QT interval prolongation', S9: 'nonclinical evaluation for anticancer pharmaceuticals', E2A: 'clinical safety data management',
  E2B: 'individual case safety reports', E3: 'clinical study reports', E5: 'ethnic factors in foreign clinical data', E6: 'good clinical practice', E8: 'general considerations for clinical studies',
  E9: 'statistical principles for clinical trials', E11: 'clinical investigation in the paediatric population', E14: 'clinical evaluation of QT/QTc interval prolongation', E17: 'multi-regional clinical trials',
  M3: 'nonclinical safety studies for clinical trials', M4: 'the common technical document', M7: 'mutagenic impurities', M9: 'biopharmaceutics classification system-based biowaivers',
  M10: 'bioanalytical method validation', M12: 'drug interaction studies', M13A: 'bioequivalence for immediate-release solid oral dosage forms',
};

const NIH_TYPES = {
  1: 'new', 2: 'competing renewal', 3: 'supplement', 4: 'extension', 5: 'non-competing continuation', 6: 'change of organization status', 7: 'change of grantee or training institution', 8: 'change of institute or center', 9: 'change of institute, center or division',
};

const NIH_ACTIVITIES = {
  R01: 'research project grant', R03: 'small research grant', R21: 'exploratory or developmental research grant', R33: 'exploratory or developmental grant, phase II', R35: 'outstanding investigator award',
  R37: 'method to extend research in time (MERIT) award', R41: 'small business technology transfer, phase I', R42: 'small business technology transfer, phase II', R43: 'small business innovation research, phase I',
  R44: 'small business innovation research, phase II', K01: 'mentored research scientist development award', K08: 'mentored clinical scientist development award', K23: 'mentored patient-oriented research career award',
  K99: 'pathway to independence award', F30: 'individual predoctoral fellowship for MD/PhD students', F31: 'individual predoctoral fellowship', F32: 'individual postdoctoral fellowship', T32: 'institutional research training grant',
  U01: 'research project cooperative agreement', U19: 'research program cooperative agreement', U54: 'specialized center cooperative agreement', P01: 'research program project grant', P30: 'center core grant', P50: 'specialized center grant',
};

const NIH_INSTITUTES = {
  AA: 'National Institute on Alcohol Abuse and Alcoholism', AG: 'National Institute on Aging', AI: 'National Institute of Allergy and Infectious Diseases', AR: 'National Institute of Arthritis and Musculoskeletal and Skin Diseases',
  AT: 'National Center for Complementary and Integrative Health', CA: 'National Cancer Institute', DA: 'National Institute on Drug Abuse', DC: 'National Institute on Deafness and Other Communication Disorders',
  DE: 'National Institute of Dental and Craniofacial Research', DK: 'National Institute of Diabetes and Digestive and Kidney Diseases', EB: 'National Institute of Biomedical Imaging and Bioengineering',
  ES: 'National Institute of Environmental Health Sciences', EY: 'National Eye Institute', GM: 'National Institute of General Medical Sciences', HD: 'Eunice Kennedy Shriver National Institute of Child Health and Human Development',
  HG: 'National Human Genome Research Institute', HL: 'National Heart, Lung, and Blood Institute', LM: 'National Library of Medicine', MD: 'National Institute on Minority Health and Health Disparities',
  MH: 'National Institute of Mental Health', NR: 'National Institute of Nursing Research', NS: 'National Institute of Neurological Disorders and Stroke', OD: 'NIH Office of the Director',
  TR: 'National Center for Advancing Translational Sciences', TW: 'Fogarty International Center',
};

const EC_CLASSES = { 1: 'oxidoreductases', 2: 'transferases', 3: 'hydrolases', 4: 'lyases', 5: 'isomerases', 6: 'ligases', 7: 'translocases' };

const ICD_POISONING = {
  'T36.0': 'poisoning by penicillins', 'T39.0': 'poisoning by salicylates', 'T39.1': 'poisoning by 4-aminophenol derivatives, including paracetamol', 'T40.0': 'poisoning by opium', 'T40.1': 'poisoning by heroin',
  'T40.2': 'poisoning by other opioids, including oxycodone and hydrocodone', 'T40.3': 'poisoning by methadone', 'T40.4': 'poisoning by other synthetic narcotics, including fentanyl',
  'T40.5': 'poisoning by cocaine', 'T40.6': 'poisoning by other and unspecified narcotics', 'T40.7': 'poisoning by cannabis and derivatives', 'T40.8': 'poisoning by lysergide (LSD)',
  'T40.9': 'poisoning by other and unspecified psychodysleptics', 'T42.4': 'poisoning by benzodiazepines', 'T43.0': 'poisoning by tricyclic and tetracyclic antidepressants',
  'T43.2': 'poisoning by other and unspecified antidepressants', 'T43.6': 'poisoning by psychostimulants, including methamphetamine', 'T45.5': 'poisoning by anticoagulants',
};

const ICD_INTENT = { 1: 'accidental', 2: 'intentional self-harm', 3: 'assault', 4: 'undetermined', 5: 'adverse effect', 6: 'underdosing' };
const ICD_ENCOUNTER = { A: 'initial encounter', D: 'subsequent encounter', S: 'sequela' };

const TE_CODES = {
  AA: 'conventional dosage forms not presenting bioequivalence problems', AB: 'meets the necessary bioequivalence requirements', AN: 'solutions and powders for aerosolization',
  AO: 'injectable oil solutions', AP: 'injectable aqueous solutions and certain intravenous non-aqueous solutions', AT: 'topical products', BC: 'extended-release dosage forms',
  BD: 'active ingredients and dosage forms with documented bioequivalence problems', BE: 'delayed-release oral dosage forms', BN: 'aerosol-nebulizer drug delivery systems',
  BP: 'active ingredients and dosage forms with potential bioequivalence problems', BR: 'suppositories or enemas for systemic absorption', BS: 'drug standard deficiencies',
  BT: 'topical products with bioequivalence issues', BX: 'insufficient data to determine therapeutic equivalence',
};

const FDA_APPLICATIONS = {
  NDA: 'New Drug Application, section 505(b)', ANDA: 'Abbreviated New Drug Application, a generic under section 505(j)', BLA: 'Biologics License Application, section 351 of the PHS Act',
};

const ENSEMBL_FEATURES = { G: 'gene', T: 'transcript', P: 'protein', E: 'exon', R: 'regulatory feature' };

const REFSEQ_PREFIXES = {
  NC: 'RefSeq chromosome', NG: 'RefSeqGene region', NM: 'RefSeq mRNA', NR: 'RefSeq noncoding RNA', NP: 'RefSeq protein', XM: 'RefSeq model mRNA', XP: 'RefSeq model protein',
};

const HLA_EXPRESSION = {
  N: 'null, not expressed', L: 'low cell-surface expression', S: 'secreted, not on the cell surface', C: 'in the cytoplasm, not on the cell surface', A: 'aberrant expression', Q: 'expression questionable',
};

const HGVS_SYSTEMS = {
  c: 'c. coding DNA, numbered from the A of the ATG start codon', g: 'g. linear genomic DNA', m: 'm. mitochondrial DNA', n: 'n. noncoding DNA', r: 'r. RNA', p: 'p. protein',
};

const regionOf = (change) => {
  const m = change.match(/^([-*]?)(\d+)([+-]\d+)?/);
  if (!m) return 'coding sequence';
  if (m[1] === '-') return '5′ UTR, before the start codon';
  if (m[1] === '*') return '3′ UTR, after the stop codon';
  if (m[3]) return Math.abs(Number(m[3])) <= 10 ? 'intron, next to an exon' : 'intron';
  return Number(m[2]) <= 3 ? 'start codon' : 'coding sequence';
};

export const hgvsChange = (system, change) => {
  const body = change.replace(/^\((.*)\)$/, '$1');
  if (system === 'p') {
    if (/fs/.test(body)) return { kind: 'frameshift' };
    if (/=$/.test(body)) return { kind: 'synonymous' };
    if (/(Ter|\*)$/.test(body)) return { kind: 'nonsense' };
    if (/delins/.test(body)) return { kind: 'deletion-insertion' };
    if (/del/.test(body)) return { kind: 'deletion' };
    if (/dup/.test(body)) return { kind: 'duplication' };
    if (/ins/.test(body)) return { kind: 'insertion' };
    return { kind: 'missense' };
  }
  const kinds = [[/delins/, 'deletion-insertion'], [/del/, 'deletion'], [/dup/, 'duplication'], [/ins/, 'insertion'], [/inv/, 'inversion'], [/\[/, 'repeated sequence'], [/>/, 'substitution'], [/=/, 'no change']];
  const kind = kinds.find(([re]) => re.test(body))?.[1] ?? 'other';
  return system === 'c' ? { kind, region: regionOf(body) } : { kind };
};

const alleleKey = (allele) => `*${allele.replace(/x(\d+|N)$/i, '').replace(/\.\d{3}$/, '')}`;
const copiesOf = (allele) => {
  const m = allele.match(/x(\d+|N)$/i);
  if (!m) return 1;
  return m[1].toUpperCase() === 'N' ? null : Number(m[1]);
};

const tidyScore = (v) => String(Number(v.toFixed(2)));

const diplotype = (gene, a, b, ctx) => {
  const table = ctx.alleles?.[gene] ?? {};
  const one = table[alleleKey(a)];
  const two = table[alleleKey(b)];
  const parts = [['Gene', gene], ['First allele', `*${a}`], ['Second allele', `*${b}`]];
  if (one?.fn) parts.push(['First function', one.fn]);
  if (two?.fn) parts.push(['Second function', two.fn]);
  const [ca, cb] = [copiesOf(a), copiesOf(b)];
  const valued = Number.isFinite(one?.value) && Number.isFinite(two?.value) && ca !== null && cb !== null;
  if (valued) {
    const score = one.value * ca + two.value * cb;
    parts.push(['Activity score', tidyScore(score)]);
    const band = (ctx.phenotypes?.[gene] ?? []).find(([lo, hi]) => score >= lo - 1e-9 && score <= hi + 1e-9);
    if (band) parts.push(['Phenotype', band[2]]);
  }
  return parts;
};

const rule = (re, build) => ({ re, build });

const RULES = [
  rule(/^([A-Z]{2}_\d+\.\d+|ENS[GTP]\d{11}\.\d+)(?:\([A-Za-z0-9-]+\))?:([cgmnrp])\.(.+)$/, (m) => {
    const [, ref, system, change] = m;
    const found = hgvsChange(system, change);
    return {
      type: 'HGVS variant', id: m[0], db: 'HGVS sequence variant nomenclature', url: `https://mutalyzer.nl/normalizer/${encodeURIComponent(m[0])}`,
      note: 'Reference sequence, coordinate system, position and change',
      parts: [
        ['Reference', REFSEQ_PREFIXES[ref.slice(0, 2)] ? `${ref}, ${REFSEQ_PREFIXES[ref.slice(0, 2)]}` : ref],
        ['Coordinates', HGVS_SYSTEMS[system]], ['Change', found.kind], found.region ? ['Region', found.region] : null,
      ].filter(Boolean),
    };
  }),
  rule(/^21 ?CFR ?(\d{1,4})(?:\.(\d+))?$/i, (m) => {
    const [, partNo, section] = m;
    const name = CFR_PARTS[partNo];
    return {
      type: 'Code of Federal Regulations', id: `21 CFR ${partNo}${section ? `.${section}` : ''}`, db: 'Electronic Code of Federal Regulations, title 21 (Food and Drugs)',
      url: section ? `https://www.ecfr.gov/current/title-21/section-${partNo}.${section}` : `https://www.ecfr.gov/current/title-21/part-${partNo}`,
      note: 'Title, part and section', parts: [['Title', '21, food and drugs'], ['Part', name ? `${partNo}, ${name}` : partNo], section ? ['Section', `${partNo}.${section}`] : null].filter(Boolean),
    };
  }),
  rule(/^(?:USP\s*)?<(\d{1,4})>$/i, (m) => {
    const n = Number(m[1]);
    const subject = USP_CHAPTERS[n];
    return {
      type: 'USP general chapter', id: `USP <${n}>`, db: 'United States Pharmacopeia–National Formulary', url: [795, 797, 800, 825].includes(n) ? 'https://www.usp.org/compounding' : 'https://www.uspnf.com/',
      note: 'Chapters numbered below 1000 hold requirements; 1000 and above give guidance',
      parts: [['Status', n < 1000 ? 'below 1000, so enforceable where USP–NF applies' : '1000 or above, so informational'], subject ? ['Subject', subject] : null].filter(Boolean),
    };
  }),
  rule(/^ICH\s*([QSEM])(\d{1,2})([A-Z]?)(?:\((R\d)\))?$/i, (m) => {
    const series = m[1].toUpperCase();
    const key = `${series}${m[2]}${m[3].toUpperCase()}`;
    const [name, page] = ICH_SERIES[series];
    return {
      type: 'ICH guideline', id: `ICH ${key}${m[4] ? `(${m[4].toUpperCase()})` : ''}`, db: 'International Council for Harmonisation', url: `https://www.ich.org/page/${page}`,
      note: 'Series letter, topic number, revision', parts: [['Series', `${series}, ${name}`], ICH_TOPICS[key] ? ['Subject', ICH_TOPICS[key]] : null, m[4] ? ['Revision', m[4].toUpperCase()] : null].filter(Boolean),
    };
  }),
  rule(/^EMEA\/H\/C\/(\d{4,6})$/i, (m) => ({
    type: 'EMA product number', id: `EMEA/H/C/${m[1]}`, db: 'European Medicines Agency', url: `https://www.ema.europa.eu/en/search?search_api_fulltext=${encodeURIComponent(`EMEA/H/C/${m[1]}`)}`,
    note: 'Agency, procedure type, procedure and product number', parts: [['Procedure', 'H, human medicine; C, centralised'], ['Product', m[1]]],
  })),
  rule(/^EU\/3\/(\d{2})\/(\d{3,4})$/i, (m) => ({
    type: 'EU orphan designation', id: `EU/3/${m[1]}/${m[2]}`, db: 'European Commission Community Register of orphan medicinal products', url: `https://www.ema.europa.eu/en/search?search_api_fulltext=${encodeURIComponent(`EU/3/${m[1]}/${m[2]}`)}`,
    note: 'Register, year and number', parts: [['Year', `20${m[1]}`], ['Number', m[2]]],
  })),
  rule(/^(\d)?([A-Z]\d{2})([A-Z]{2})(\d{6})(?:-(\d{2})([A-Z]\d)?)?$/i, (m) => {
    const [, kind, activity, ic, serial, year, suffix] = m;
    const act = activity.toUpperCase();
    const inst = ic.toUpperCase();
    if (!NIH_INSTITUTES[inst]) return null;
    return {
      type: 'NIH grant', id: m[0].toUpperCase(), db: 'NIH RePORTER', url: `https://reporter.nih.gov/quickSearch/${m[0].toUpperCase()}`,
      note: 'Application type, activity code, institute, serial number, support year',
      parts: [
        kind ? ['Application type', `${kind}, ${NIH_TYPES[kind] ?? 'other'}`] : null, ['Activity', NIH_ACTIVITIES[act] ? `${act}, ${NIH_ACTIVITIES[act]}` : act],
        ['Institute', `${inst}, ${NIH_INSTITUTES[inst]}`], ['Serial', serial], year ? ['Support year', year] : null, suffix ? ['Suffix', suffix.toUpperCase()] : null,
      ].filter(Boolean),
    };
  }),
  rule(/^(NDA|ANDA|BLA)\s?(\d{6})$/i, (m) => {
    const kind = m[1].toUpperCase();
    return {
      type: 'FDA application', id: `${kind}${m[2]}`, db: 'Drugs@FDA', url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${m[2]}`,
      note: 'Application type and six-digit number', parts: [['Pathway', FDA_APPLICATIONS[kind]], ['Number', m[2]]],
    };
  }),
  rule(/^(?:NDC\s*)?(\d{4,5})-(\d{3,4})-(\d{1,2})$|^NDC\s*(\d{11})$/i, (m) => {
    const raw = m[4] ?? `${m[1]}-${m[2]}-${m[3]}`;
    const segs = m[4] ? [m[4].slice(0, 5), m[4].slice(5, 9), m[4].slice(9)] : [m[1], m[2], m[3]];
    const layout = segs.map((s) => s.length).join('-');
    if (!['4-4-2', '5-3-2', '5-4-1', '5-4-2'].includes(layout)) return null;
    return {
      type: 'National Drug Code', id: m[4] ? segs.join('-') : raw, db: 'FDA National Drug Code Directory', url: `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${m[4] ? segs.join('-') : raw}`,
      note: 'Labeler, product and package codes',
      parts: [['Layout', layout], ['Labeler', segs[0]], ['Product', segs[1]], ['Package', segs[2]], ['11-digit form', ndc11(segs.join('-'))]],
    };
  }),
  rule(/^(\d{2,7})-(\d{2})-(\d)$/, (m) => {
    const expected = casCheck(`${m[1]}${m[2]}`);
    const ok = expected === Number(m[3]);
    return {
      type: 'CAS Registry Number', id: m[0], db: 'CAS Common Chemistry', url: `https://commonchemistry.cas.org/detail?cas_rn=${m[0]}`,
      note: 'Up to seven digits, two digits, one check digit', parts: [['Check digit', ok ? `${m[3]}, valid` : `${m[3]} does not match; expected ${expected}`]],
    };
  }),
  rule(/^(\d{1,7})-(\d)$/, (m) => {
    const expected = luhnDigit(m[1]);
    const ok = expected === Number(m[2]);
    return {
      type: 'LOINC code', id: m[0], db: 'LOINC, Logical Observation Identifiers Names and Codes', url: `https://loinc.org/${m[0]}`,
      note: 'Code number and a mod 10 check digit', parts: [['Check digit', ok ? `${m[2]}, valid` : `${m[2]} does not match; expected ${expected}`]],
    };
  }),
  rule(/^(\d{4})-(5\d{5})-(\d{2})-(\d{2})$/, (m) => ({
    type: 'EU CT number', id: m[0], db: 'EU Clinical Trials Information System', url: `https://euclinicaltrials.eu/search-for-clinical-trials/?lang=en&EUCT=${m[0]}`,
    note: 'Year, sequence, check digits, version', parts: [['Year', m[1]]],
  })),
  rule(/^(\d{4})-(\d{6})-(\d{2})$/, (m) => ({
    type: 'EudraCT number', id: m[0], db: 'EU Clinical Trials Register', url: `https://www.clinicaltrialsregister.eu/ctr-search/search?query=${m[0]}`,
    note: 'Year, sequence and check digits', parts: [['Year', m[1]]],
  })),
  rule(/^NCT(\d{8})$/i, (m) => ({
    type: 'ClinicalTrials.gov study', id: `NCT${m[1]}`, db: 'ClinicalTrials.gov', url: `https://clinicaltrials.gov/study/NCT${m[1]}`, note: 'NCT and eight digits', parts: [],
  })),
  rule(/^ISRCTN(\d{8})$/i, (m) => ({
    type: 'ISRCTN registration', id: `ISRCTN${m[1]}`, db: 'ISRCTN registry', url: `https://www.isrctn.com/ISRCTN${m[1]}`, note: 'ISRCTN and eight digits', parts: [],
  })),
  rule(/^([ABCDGHJLMNPRSV])(\d{2})(?:([A-Z])(?:([A-Z])(\d{2})?)?)?$/i, (m, ctx) => {
    const code = m[0].toUpperCase();
    const levels = atcLevels(code);
    const named = (c, i) => {
      const name = ctx.atc?.[c] ?? (i === 0 ? ATC_GROUPS[c] : null);
      return name ? `${c}, ${soften(name)}` : c;
    };
    const [, label] = ATC_LEVELS[levels.length - 1];
    return {
      type: 'ATC code', id: code, db: 'WHO Anatomical Therapeutic Chemical classification', url: `https://atcddd.fhi.no/atc_ddd_index/?code=${code}`,
      note: 'Group letter, two digits, two letters, two digits',
      parts: [['Level', `${levels.length}, ${label}`], ...levels.map((c, i) => [ATC_LEVELS[i][0], named(c, i)])],
    };
  }),
  rule(/^([A-Z]{14})-([A-Z]{8})([SN])([A-Z])-([A-Z])$/, (m) => {
    const charge = inchikeyCharge(m[5]);
    const protons = charge === 0 ? `${m[5]}, neutral` : `${m[5]}, ${Math.abs(charge)} ${Math.abs(charge) === 1 ? 'proton' : 'protons'} ${charge < 0 ? 'removed' : 'added'}`;
    return {
      type: 'InChIKey', id: m[0], db: 'IUPAC International Chemical Identifier, hashed', url: `https://pubchem.ncbi.nlm.nih.gov/#query=${m[0]}`,
      note: 'Fourteen-letter connectivity hash, ten-letter stereo and version block, protonation letter',
      parts: [
        ['Connectivity', m[1]], ['Stereo and isotopes', m[2] === 'UHFFFAOY' ? `${m[2]}, no stereo or isotope layer` : `${m[2]}, stereo or isotope layer present`],
        ['Version', `${m[3] === 'S' ? 'S standard' : 'N non-standard'}, version ${m[4]}`], ['Protonation', protons],
      ],
    };
  }),
  rule(/^CHEMBL(\d+)$/i, (m) => ({
    type: 'ChEMBL ID', id: `CHEMBL${m[1]}`, db: 'ChEMBL, EMBL-EBI', url: `https://www.ebi.ac.uk/chembl/explore/compound/CHEMBL${m[1]}`, note: 'One prefix for compounds, targets, assays and documents', parts: [],
  })),
  rule(/^CHEBI:(\d+)$/i, (m) => ({
    type: 'ChEBI entity', id: `CHEBI:${m[1]}`, db: 'Chemical Entities of Biological Interest', url: `https://www.ebi.ac.uk/chebi/CHEBI:${m[1]}`, note: 'CHEBI and a number', parts: [],
  })),
  rule(/^DB(\d{5})$/i, (m) => ({
    type: 'DrugBank drug', id: `DB${m[1]}`, db: 'DrugBank', url: `https://go.drugbank.com/drugs/DB${m[1]}`, note: 'DB and five digits', parts: [],
  })),
  rule(/^D(\d{5})$/, (m) => ({
    type: 'KEGG DRUG entry', id: `D${m[1]}`, db: 'KEGG DRUG', url: `https://www.kegg.jp/entry/D${m[1]}`, note: 'D and five digits', parts: [],
  })),
  rule(/^(?:PubChem\s*)?(CID|SID)[:\s]?(\d+)$/i, (m) => {
    const kind = m[1].toUpperCase();
    return {
      type: kind === 'CID' ? 'PubChem compound' : 'PubChem substance', id: `${kind}:${m[2]}`, db: 'PubChem', url: `https://pubchem.ncbi.nlm.nih.gov/${kind === 'CID' ? 'compound' : 'substance'}/${m[2]}`,
      note: kind === 'CID' ? 'One record per unique chemical structure' : 'One record per depositor submission', parts: [],
    };
  }),
  rule(/^(?:RxCUI|RxNorm)[:\s]?(\d+)$/i, (m) => ({
    type: 'RxNorm concept', id: `RxCUI:${m[1]}`, db: 'RxNorm, NLM', url: `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${m[1]}`, note: 'RxNorm concept unique identifier', parts: [],
  })),
  rule(/^UNII[:\s]?([A-Z0-9]{10})$/i, (m) => ({
    type: 'FDA UNII', id: m[1].toUpperCase(), db: 'FDA Global Substance Registration System', url: `https://precision.fda.gov/uniisearch/srs/unii/${m[1].toUpperCase()}`, note: 'Ten-character Unique Ingredient Identifier', parts: [],
  })),
  rule(/^PA(\d{2,10})$/, (m) => ({
    type: 'ClinPGx accession', id: `PA${m[1]}`, db: 'ClinPGx, formerly PharmGKB', url: `https://www.clinpgx.org/search?query=PA${m[1]}`, note: 'PA and a number, for genes, drugs, diseases and variants', parts: [],
  })),
  rule(/^HLA-([A-Z0-9]+)\*(\d{2,3})(?::(\d{2,3}))?(?::(\d{2,3}))?(?::(\d{2,3}))?([NLSCAQ])?$/i, (m) => {
    const gene = `HLA-${m[1].toUpperCase()}`;
    const suffix = m[6]?.toUpperCase();
    const id = `${gene}*${[m[2], m[3], m[4], m[5]].filter(Boolean).join(':')}${suffix ?? ''}`;
    return {
      type: 'HLA allele', id, db: 'IPD-IMGT/HLA', url: 'https://hla.alleles.org/nomenclature/naming.html', note: 'Gene, allele group, protein, synonymous change, noncoding change, expression',
      parts: [
        ['Gene', gene], ['Allele group', m[2]], m[3] ? ['Protein', m[3]] : null, m[4] ? ['Synonymous', m[4]] : null, m[5] ? ['Noncoding', m[5]] : null,
        suffix ? ['Expression', `${suffix}: ${HLA_EXPRESSION[suffix]}`] : null,
      ].filter(Boolean),
    };
  }),
  rule(/^([A-Z][A-Z0-9]{1,9})\*(\d+[A-Z]?(?:\.\d{3})?(?:x(?:\d+|N))?)\/\*(\d+[A-Z]?(?:\.\d{3})?(?:x(?:\d+|N))?)$/i, (m, ctx) => {
    const gene = m[1].toUpperCase();
    return {
      type: 'Diplotype', id: `${gene}*${m[2]}/*${m[3]}`, db: 'Pharmacogene Variation Consortium and CPIC', url: `https://www.pharmvar.org/gene/${gene}`,
      note: 'Gene, then one star allele per chromosome', parts: diplotype(gene, m[2], m[3], ctx),
    };
  }),
  rule(/^([A-Z][A-Z0-9]{1,9})\*(\d+[A-Z]?)(?:\.(\d{3}))?(?:x(\d+|N))?$/i, (m, ctx) => {
    const gene = m[1].toUpperCase();
    const allele = `*${m[2].toUpperCase()}`;
    const known = ctx.alleles?.[gene]?.[allele];
    const copies = m[4] ? (m[4].toUpperCase() === 'N' ? 'N, more than one' : m[4]) : null;
    return {
      type: 'Star allele', id: `${gene}${allele}${m[3] ? `.${m[3]}` : ''}${m[4] ? `x${m[4]}` : ''}`, db: 'Pharmacogene Variation Consortium', url: `https://www.pharmvar.org/gene/${gene}`,
      note: 'Gene, star allele, suballele, copy number',
      parts: [['Gene', gene], ['Allele', allele], m[3] ? ['Suballele', m[3]] : null, copies ? ['Copies', copies] : null, known?.fn ? ['Function', known.fn] : null].filter(Boolean),
    };
  }),
  rule(/^rs(\d+)$/i, (m) => ({
    type: 'dbSNP RefSNP', id: `rs${m[1]}`, db: 'dbSNP', url: `https://www.ncbi.nlm.nih.gov/snp/rs${m[1]}`, note: 'One ID per variant position, merging every submission', parts: [],
  })),
  rule(/^D(\d{6})$/, (m) => ({
    type: 'MeSH descriptor', id: `D${m[1]}`, db: 'Medical Subject Headings, NLM', url: `https://meshb.nlm.nih.gov/record/ui?ui=D${m[1]}`, note: 'D and six digits', parts: [],
  })),
  rule(/^C(\d{6}|\d{9})$/, (m) => ({
    type: 'MeSH supplementary concept', id: `C${m[1]}`, db: 'Medical Subject Headings, NLM', url: `https://meshb.nlm.nih.gov/record/ui?ui=C${m[1]}`, note: 'C and six or nine digits, for chemicals, drugs and rare diseases', parts: [],
  })),
  rule(/^C(\d{7})$/, (m) => ({
    type: 'MedGen concept', id: `C${m[1]}`, db: 'MedGen, using UMLS concept IDs', url: `https://www.ncbi.nlm.nih.gov/medgen/C${m[1]}`, note: 'C and seven digits', parts: [],
  })),
  rule(/^(?:EC\s?)?([1-7])\.(\d+|-)\.(\d+|-)\.(n?\d+|-)$/i, (m) => ({
    type: 'Enzyme Commission number', id: `EC ${m[1]}.${m[2]}.${m[3]}.${m[4]}`, db: 'ExPASy ENZYME, from the IUBMB nomenclature', url: `https://enzyme.expasy.org/EC/${m[1]}.${m[2]}.${m[3]}.${m[4]}`,
    note: 'Class, subclass, sub-subclass, serial number', parts: [['Class', `${m[1]}, ${EC_CLASSES[m[1]]}`]],
  })),
  rule(/^([A-TV-Z])(\d{2})\.([0-9A-Z]{1,4})$/i, (m) => {
    const code = `${m[1].toUpperCase()}${m[2]}.${m[3].toUpperCase()}`;
    const category = code.slice(0, 5);
    const name = ICD_POISONING[category];
    const extra = code.slice(5);
    const intent = /^T[3-6]\d/.test(code) && extra.length >= 2 ? ICD_INTENT[extra[1]] ?? ICD_INTENT[extra[0]] : null;
    const encounter = /^T/.test(code) && extra.length === 3 ? ICD_ENCOUNTER[extra[2]] : null;
    return {
      type: 'ICD-10 code', id: code, db: 'International Classification of Diseases, 10th revision', url: `https://icd.who.int/browse10/2019/en#/${category.replace(/\.$/, '')}`,
      note: 'Letter, two digits, then subdivisions after the point',
      parts: [['Category', name ? `${category}, ${name}` : category], intent ? ['Intent', intent] : null, encounter ? ['Encounter', encounter] : null].filter(Boolean),
    };
  }),
  rule(/^(AA|AB\d{0,2}|AN|AO|AP\d?|AT\d?|BC|BD|BE|BN|BP|BR|BS|BT|BX)$/i, (m) => {
    const code = m[1].toUpperCase();
    const head = code.slice(0, 2);
    return {
      type: 'Orange Book TE code', id: code, db: 'FDA Approved Drug Products with Therapeutic Equivalence Evaluations', url: 'https://www.fda.gov/drugs/development-approval-process-drugs/orange-book-preface',
      note: 'A or B, a second letter for the kind of product, an optional number for the reference listed drug',
      parts: [['First letter', head[0] === 'A' ? 'A, therapeutically equivalent' : 'B, not considered therapeutically equivalent'], ['Meaning', TE_CODES[head]], code.length > 2 ? ['Reference drug', code.slice(2)] : null].filter(Boolean),
    };
  }),
  rule(/^PMID:?\s?(\d{1,9})$/i, (m) => ({
    type: 'PubMed record', id: `PMID:${m[1]}`, db: 'PubMed', url: `https://pubmed.ncbi.nlm.nih.gov/${m[1]}/`, note: 'PubMed identifier', parts: [],
  })),
  rule(/^(?:doi:\s*)?(10\.\d{4,9}\/\S+)$/i, (m) => ({
    type: 'DOI', id: m[1], db: 'Digital Object Identifier', url: `https://doi.org/${m[1]}`, note: '10, a registrant prefix, a slash and a suffix', parts: [],
  })),
  rule(/^US\s?(\d{1,2}),?(\d{3}),?(\d{3})(?:\s?([AB]\d))?$/i, (m) => {
    const id = `US${m[1]}${m[2]}${m[3]}`;
    return {
      type: 'US patent', id, db: 'United States Patent and Trademark Office', url: `https://patents.google.com/patent/${id}`, note: 'US, a serial number and an optional kind code', parts: m[4] ? [['Kind', m[4].toUpperCase()]] : [],
    };
  }),
  rule(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, (m) => ({
    type: 'SPL set ID', id: m[0].toLowerCase(), db: 'DailyMed structured product labeling', url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${m[0].toLowerCase()}`,
    note: 'A UUID that stays the same across a label’s versions', parts: [],
  })),
  rule(/^HGNC:(\d+)$/i, (m) => ({
    type: 'HGNC gene', id: `HGNC:${m[1]}`, db: 'HUGO Gene Nomenclature Committee', url: `https://www.genenames.org/data/gene-symbol-report/#!/hgnc_id/HGNC:${m[1]}`, note: 'Stable ID behind an approved gene symbol', parts: [],
  })),
  rule(/^(?:GeneID|NCBIGene|Entrez)[:\s]?(\d+)$/i, (m) => ({
    type: 'NCBI Gene', id: `GeneID:${m[1]}`, db: 'NCBI Gene', url: `https://www.ncbi.nlm.nih.gov/gene/${m[1]}`, note: 'Integer ID for a gene record', parts: [],
  })),
  rule(/^ENS([GTPER])(\d{11})(?:\.(\d+))?$/i, (m) => {
    const letter = m[1].toUpperCase();
    const stable = `ENS${letter}${m[2]}`;
    return {
      type: `Ensembl ${ENSEMBL_FEATURES[letter]}`, id: m[3] ? `${stable}.${m[3]}` : stable, db: 'Ensembl and GENCODE', url: `https://www.ensembl.org/id/${stable}`,
      note: 'ENS, feature letter, eleven digits, version', parts: m[3] ? [['Version', m[3]]] : [],
    };
  }),
  rule(/^(?:(?:MIM|OMIM)[:\s#*]*)(\d{6})$/i, (m) => ({
    type: 'OMIM entry', id: `MIM:${m[1]}`, db: 'Online Mendelian Inheritance in Man', url: `https://www.omim.org/entry/${m[1]}`, note: 'Six digits; the first gives the inheritance class', parts: [],
  })),
  rule(/^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})(?:-(\d+))?$/, (m) => ({
    type: 'UniProtKB accession', id: m[0], db: 'UniProtKB', url: `https://www.uniprot.org/uniprotkb/${m[1]}/entry`, note: 'Six or ten characters, then an optional isoform number', parts: m[2] ? [['Isoform', m[2]]] : [],
  })),
  rule(/^([A-Z0-9]{1,5})_HUMAN$/i, (m) => ({
    type: 'UniProtKB entry name', id: `${m[1].toUpperCase()}_HUMAN`, db: 'UniProtKB', url: `https://www.uniprot.org/uniprotkb?query=${m[1].toUpperCase()}_HUMAN`, note: 'Mnemonic, then species code', parts: [],
  })),
  rule(/^([1-9](?=[A-Z0-9]*[A-Z])[A-Z0-9]{3})$/i, (m) => ({
    type: 'PDB entry', id: m[1].toUpperCase(), db: 'Protein Data Bank', url: `https://www.rcsb.org/structure/${m[1].toUpperCase()}`, note: 'A digit then three letters or digits', parts: [],
  })),
  rule(/^(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{10}$/, (m) => ({
    type: 'FDA UNII', id: m[0], db: 'FDA Global Substance Registration System', url: `https://precision.fda.gov/uniisearch/srs/unii/${m[0]}`, note: 'Ten-character Unique Ingredient Identifier', parts: [],
  })),
];

export const identify = (input, ctx = {}) => {
  const value = String(input ?? '').trim();
  if (!value) return null;
  for (const { re, build } of RULES) {
    const m = value.match(re);
    if (m) {
      const hit = build(m, ctx);
      if (hit) return hit;
    }
  }
  return null;
};

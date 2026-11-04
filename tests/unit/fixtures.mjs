import { deflateRawSync, crc32 } from 'node:zlib';

export const zipOf = (files) => {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text);
    const packed = deflateRawSync(raw);
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, packed);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + packed.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
};

const colName = (i) => {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const xlsxOf = (sheets) => {
  const shared = [];
  const index = (s) => {
    const at = shared.indexOf(s);
    if (at >= 0) return at;
    shared.push(s);
    return shared.length - 1;
  };
  const files = {};
  const names = Object.keys(sheets);
  names.forEach((name, k) => {
    const rows = sheets[name].map((row, r) => `<row r="${r + 1}">${row.map((v, c) => {
      if (v === null || v === undefined) return '';
      const ref = `${colName(c)}${r + 1}`;
      return typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="s"><v>${index(v)}</v></c>`;
    }).join('')}</row>`).join('');
    files[`xl/worksheets/sheet${k + 1}.xml`] = `<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`;
  });
  files['xl/sharedStrings.xml'] = `<?xml version="1.0"?><sst>${shared.map((s) => `<si><t>${escapeXml(s)}</t></si>`).join('')}</sst>`;
  files['xl/workbook.xml'] = `<?xml version="1.0"?><workbook><sheets>${names.map((n, k) => `<sheet name="${escapeXml(n)}" sheetId="${k + 1}" r:id="rId${k + 1}"/>`).join('')}</sheets></workbook>`;
  files['xl/_rels/workbook.xml.rels'] = `<?xml version="1.0"?><Relationships>${names.map((n, k) => `<Relationship Id="rId${k + 1}" Target="worksheets/sheet${k + 1}.xml"/>`).join('')}</Relationships>`;
  return zipOf(files);
};

const num = (v, w) => v.toFixed(4).padStart(w, ' ');
const int = (v, w) => String(v).padStart(w, ' ');

export const molOf = (atoms, bonds, props = []) => {
  const atomLines = atoms.map(([el, x = 0, y = 0, charge = 0]) => `${num(x, 10)}${num(y, 10)}${num(0, 10)} ${el.padEnd(3, ' ')} 0${int(charge, 3)}  0  0  0  0  0  0  0  0  0  0`);
  const bondLines = bonds.map(([a, b, order = 1, stereo = 0]) => `${int(a, 3)}${int(b, 3)}${int(order, 3)}${int(stereo, 3)}`);
  return ['test', '     RDKit          2D', '', `${int(atoms.length, 3)}${int(bonds.length, 3)}  0  0  0  0  0  0  0  0999 V2000`, ...atomLines, ...bondLines, ...props, 'M  END'].join('\n');
};

export const cycle = (n, start = 1, orders = []) => Array.from({ length: n }, (_, i) => [start + i, start + ((i + 1) % n), orders[i] ?? 1]);

const monoamine = ['Membrane receptor', 'Family A G protein-coupled receptor', 'Small molecule receptor (family A GPCR)', 'Monoamine receptor'];

const target = (id, name, family, path, over = {}) => ({
  id, name, type: 'SINGLE PROTEIN', organism: 'Homo sapiens', genes: [], accessions: [], ec: [], family, path, ...over,
});

export const PART2 = {
  targets: {
    coverage: {
      approved: 7, withTarget: 5, untargeted: 1, none: 1,
    },
    mechanisms: [
      {
        drug: 'a', target: 'T1', action: 'ANTAGONIST', moa: 'Dopamine D2 receptor antagonist', direct: 1,
      },
      {
        drug: 'a', target: 'T2', action: 'ANTAGONIST', moa: 'Histamine H1 receptor antagonist', direct: 1,
      },
      {
        drug: 'b', target: 'T2', action: 'INVERSE AGONIST', moa: 'Histamine H1 receptor inverse agonist', direct: 1,
      },
      {
        drug: 'c', target: 'T3', action: 'INHIBITOR', moa: 'Tyrosine-protein kinase ABL inhibitor', direct: 1,
      },
      {
        drug: 'd', target: 'T3', action: 'INHIBITOR', moa: 'Tyrosine-protein kinase ABL inhibitor', direct: 1,
      },
      {
        drug: 'd', target: 'T4', action: 'INHIBITOR', moa: 'Cyclooxygenase inhibitor', direct: 1,
      },
      {
        drug: 'f', target: 'T5', action: 'BINDING AGENT', moa: 'Tumor necrosis factor binding agent', direct: 1,
      },
    ],
    targets: [
      target('T1', 'D(2) dopamine receptor', 'GPCR', monoamine, { genes: ['DRD2'], accessions: ['P14416'] }),
      target('T2', 'Histamine H1 receptor', 'GPCR', monoamine, { genes: ['HRH1'], accessions: ['P35367'] }),
      target('T3', 'Tyrosine-protein kinase ABL', 'Kinase', ['Enzyme', 'Kinase', 'Protein Kinase', 'TK protein kinase group', 'Tyrosine protein kinase Abl family'], { genes: ['ABL1'], ec: ['2.7.10.2'] }),
      target('T4', 'Cyclooxygenase', 'Other enzyme', ['Enzyme', 'Oxidoreductase'], { type: 'PROTEIN FAMILY', ec: ['1.14.99.1'] }),
      target('T5', 'Tumor necrosis factor', 'Other protein', ['Secreted protein']),
    ],
  },
  network: {
    drugs: 5,
    nodes: [['a', 0.1, 0.2], ['d', 0.6, 0.5], ['b', 0.2, 0.3], ['c', 0.7, 0.6], ['f', 0.9, 0.9], ['T2', 0.15, 0.25], ['T3', 0.65, 0.55], ['T1', 0.1, 0.1], ['T4', 0.5, 0.4], ['T5', 0.95, 0.95]],
    edges: [[0, 5], [0, 7], [1, 6], [1, 8], [2, 5], [3, 6], [4, 9]],
  },
  kinome: {
    document: 'CHEMBL1908390',
    inhibitors: [
      {
        id: 'K1', parent: 'K1', name: 'IMATINIB', approved: true, hits: 1, s3: 0.25, gini: 0.9,
      },
      {
        id: 'K2', parent: 'K2', name: 'STAUROSPORINE', approved: false, hits: 4, s3: 1, gini: 0.5,
      },
    ],
    kinases: [
      {
        id: 'A1', target: 'T3', name: 'ABL1', variant: null, group: 'TK', gene: 'ABL1',
      },
      {
        id: 'A2', target: 'T3', name: 'ABL1(T315I)', variant: 'T315I', group: 'TK', gene: 'ABL1',
      },
      {
        id: 'A3', target: 'T6', name: 'EGFR', variant: null, group: 'TK', gene: 'EGFR',
      },
      {
        id: 'A5', target: 'T8', name: 'AKT1', variant: null, group: 'AGC', gene: 'AKT1',
      },
      {
        id: 'A4', target: 'T7', name: 'CDK2', variant: null, group: 'CMGC', gene: 'CDK2',
      },
    ],
    pkd: [[8, null, null, null, null], [9, 8.5, 7, 8, 6]],
  },
  gtopdb: {
    version: '2026.3.1',
    types: {
      gpcr: {
        targets: 10, ligand: 8, approved: 5, endogenous: 6, orphans: 2,
      },
      enzyme: {
        targets: 20, ligand: 12, approved: 4, endogenous: 1, orphans: 0,
      },
      transporter: {
        targets: 5, ligand: 1, approved: 1, endogenous: 0, orphans: 1,
      },
    },
    endogenous: { Peptide: 6, Metabolite: 3, Inorganic: 1 },
    interactions: 100,
    orphans: [
      {
        id: '90', type: 'gpcr', family: 'Class A Orphans with no pharmacology', name: 'GPR6', gene: 'GPR6',
      },
      {
        id: '91', type: 'gpcr', family: 'Class A Orphans with emerging pharmacology', name: 'GPR3', gene: 'GPR3',
      },
      {
        id: '92', type: 'transporter', family: 'Orphan SLC38 transporters', name: 'SLC38A6', gene: 'SLC38A6',
      },
    ],
    affinities: [
      ['salbutamol', 'β2-adrenoceptor', 'gpcr', 'pKi', 5.8], ['haloperidol', 'D2 receptor', 'gpcr', 'pKi', 9], ['loratadine', 'H1 receptor', 'gpcr', 'pKi', 8.2],
      ['aspirin', 'COX-1', 'enzyme', 'pIC50', 5.3], ['imatinib', 'ABL1', 'enzyme', 'pKd', 8.1],
    ].map(([ligand, t, type, units, value]) => ({
      ligand, target: t, type, units, value, action: 'Inhibition',
    })),
  },
  genetics: {
    clinvarDated: 'October 31, 2026',
    all: { genes: 100, clinvar: 90, pathogenic: 40 },
    targets: { genes: 10, clinvar: 10, pathogenic: 7 },
    bins: ['none', '1–9', '10–99', '100–999', '1,000+'],
    binned: { all: [60, 20, 15, 4, 1], targets: [3, 3, 3, 1, 0] },
    examples: [{ symbol: 'SCN5A', pathogenic: 591 }],
  },
  structures: {
    pdb: {
      total: 1000, years: [2023, 2024, 2025, 2026], methods: { 'X-ray': [300, 280, 250, 100], 'Electron microscopy': [50, 80, 120, 60], NMR: [10, 10, 8, 2], Other: [1, 1, 1, 0] },
    },
    gpcrdb: {
      total: 40,
      human: 30,
      receptors: 12,
      classes: { 'Class A (Rhodopsin)': 30, 'Class B1 (Secretin)': 10 },
      states: { Active: 25, Inactive: 15 },
      byClass: { 'Class A (Rhodopsin)': { Active: 18, Inactive: 12 }, 'Class B1 (Secretin)': { Active: 7, Inactive: 3 } },
      signalling: { 'G protein': 20 },
      ligands: { Agonist: 20, Antagonist: 8 },
      years: [2007, 2022],
      methods: { 'X-ray': [5, 5], 'Electron microscopy': [0, 30] },
    },
  },
};

export const PART3 = {
  activities: {
    total: 1000,
    withPchembl: 300,
    phantomKinetics: 100,
    duplicates: 20,
    types: [{ type: 'Potency', n: 300 }, { type: 'IC50', n: 250 }, { type: 'Ki', n: 100 }, { type: 'k_off', n: 50 }, { type: 'kon', n: 50 }],
    assays: [{ type: 'F', n: 600 }, { type: 'B', n: 300 }, { type: 'A', n: 100 }],
    years: [[2019, 300], [2020, 700]],
    pchembl: [[5, 100], [6, 100], [7, 60], [8, 40]],
    sources: [{ id: 1, name: 'Scientific Literature', n: 400 }, { id: 7, name: 'PubChem BioAssays', n: 350 }, { id: 37, name: 'BindingDB Patent Bioactivity Data', n: 250 }],
    relations: [{ relation: '=', n: 800 }, { relation: '>', n: 200 }],
    validity: [{ comment: 'Outside typical range', n: 15 }],
    formats: [{ format: 'cell-based format', n: 500 }, { format: 'single protein format', n: 300 }],
    byType: [{ type: 'IC50', n: 200, bins: [[5, 80], [6, 70], [7, 50]] }, { type: 'Ki', n: 100, bins: [[6, 30], [7, 40], [8, 30]] }],
    molecules: [{ name: 'DOXORUBICIN', n: 9 }, { name: 'STAUROSPORINE', n: 7 }],
    organisms: [{ organism: 'Homo sapiens', n: 250 }],
  },
  agreement: {
    document: 'CHEMBL1150977',
    pairs: [[8, 7.5], [9, 9.5], [7, 6.5], [6, 6.5]],
    counts: {
      both: 4, davisOnly: 1, karamanOnly: 1, neither: 4,
    },
    ambiguous: 0,
    molecules: 2,
  },
  kinetics: {
    document: 'CHEMBL3885741',
    pairs: [
      {
        molecule: 'M1', name: 'RIVAROXABAN', target: 'T1', targetName: 'Coagulation factor X', kon: 10000000, koff: 0.01, n: 1,
      },
      {
        molecule: 'M2', name: null, target: 'T1', targetName: 'Coagulation factor X', kon: 100000, koff: 0.0001, n: 1,
      },
      {
        molecule: 'M3', name: 'ZM-241385', target: 'T2', targetName: 'Adenosine receptor A2a', kon: 1000000, koff: 0.001, n: 2,
      },
    ],
  },
  almanac: {
    drugs: [{ nsc: '740', name: 'Methotrexate' }, { nsc: '752', name: 'Thioguanine' }, { nsc: '3088', name: 'Chlorambucil' }],
    pairs: [[0, 1, 5, 60], [0, 2, -3, 58], [1, 2, 12, 60]],
    cells: 60,
    wells: 1000,
  },
};

const pad = (s, n) => String(s).padEnd(n, ' ').slice(0, n);

export const ibm = (x) => {
  const out = Buffer.alloc(8);
  if (x === null) {
    out[0] = 0x2e;
    return out;
  }
  if (x === 0) return out;
  const sign = x < 0 ? 0x80 : 0;
  let v = Math.abs(x);
  let e = 0;
  while (v >= 1) {
    v /= 16;
    e += 1;
  }
  while (v < 1 / 16) {
    v *= 16;
    e -= 1;
  }
  let frac = BigInt(Math.round(v * 2 ** 56));
  if (frac >= 1n << 56n) {
    frac >>= 4n;
    e += 1;
  }
  out[0] = sign | (e + 64);
  for (let i = 7; i >= 1; i -= 1) {
    out[i] = Number(frac & 0xffn);
    frac >>= 8n;
  }
  return out;
};

export const xptOf = (vars, rows) => {
  const rec = (s) => Buffer.from(pad(s, 80), 'latin1');
  const header = (kind, digits = '000000000000000000000000000000') => rec(`HEADER RECORD*******${pad(kind, 8)}HEADER RECORD!!!!!!!${digits}`);
  const namestr = vars.map((v, i) => {
    const b = Buffer.alloc(140);
    b.writeInt16BE(v.type === 'char' ? 2 : 1, 0);
    b.writeInt16BE(v.length, 4);
    b.writeInt16BE(i + 1, 6);
    b.write(pad(v.name, 8), 8, 'latin1');
    b.write(pad(v.label ?? '', 40), 16, 'latin1');
    b.writeInt32BE(vars.slice(0, i).reduce((n, w) => n + w.length, 0), 84);
    return b;
  });
  const names = Buffer.concat(namestr);
  const namesPadded = Buffer.concat([names, Buffer.alloc((80 - (names.length % 80)) % 80, 0x20)]);
  const obs = Buffer.concat(rows.map((row) => Buffer.concat(vars.map((v, i) => (v.type === 'char' ? Buffer.from(pad(row[i], v.length), 'latin1') : ibm(row[i]).subarray(0, v.length))))));
  const obsPadded = Buffer.concat([obs, Buffer.alloc((80 - (obs.length % 80)) % 80, 0x20)]);
  return Buffer.concat([
    header('LIBRARY'), rec('SAS     SAS     SASLIB  9.4'), rec('04JAN24:15:12:02'),
    header('MEMBER', '000000000000000001600000000140'), header('DSCRPTR'),
    rec('SAS     RXQ_RX  SASDATA 9.4'), rec('04JAN24:15:12:02'),
    header('NAMESTR', `000000${String(vars.length).padStart(4, '0')}00000000000000000000`), namesPadded,
    header('OBS'), obsPadded,
  ]);
};

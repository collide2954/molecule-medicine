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

import { unzip } from './streams.mjs';

export const readCsv = (input, { delimiter = ',', skip = 0 } = {}) => {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) endField();
    else if (c === '\n') endRow();
    else if (c !== '\r') field += c;
    i += 1;
  }
  if (field !== '' || row.length) endRow();
  return rows.slice(skip);
};

export const records = (rows, headerIndex = 0) => {
  const head = rows[headerIndex] ?? [];
  return rows.slice(headerIndex + 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
};

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', micro: 'µ', deg: '°', plusmn: '±', times: '×',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', kappa: 'κ', mu: 'μ', le: '≤', ge: '≥', reg: '®', trade: '™', copy: '©', hellip: '…', middot: '·', bull: '•', prime: '′', eacute: 'é', ouml: 'ö', uuml: 'ü', auml: 'ä', shy: '',
};

export const decodeEntities = (s) => String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
  if (code[0] === '#') return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
  return NAMED[code.toLowerCase()] ?? m;
});

export const stripTags = (html) => decodeEntities(String(html ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

const textOf = (xml) => decodeEntities([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

const column = (ref) => [...ref.replace(/\d+$/, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

export const readXlsx = (buffer) => {
  const files = unzip(buffer);
  const read = (name) => files[name]?.toString('utf8') ?? '';
  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const targets = Object.fromEntries([...read('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)]
    .map(([tag]) => [tag.match(/Id="([^"]+)"/)[1], tag.match(/Target="([^"]+)"/)[1]]));
  const book = {};
  for (const [tag] of read('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
    const name = decodeEntities(tag.match(/name="([^"]+)"/)[1]);
    const target = targets[tag.match(/r:id="([^"]+)"/)[1]];
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    const rows = [];
    for (const [, attrs, body] of read(path).matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const at = attrs.match(/\br="(\d+)"/);
      const index = at ? Number(at[1]) - 1 : rows.length;
      while (rows.length < index) rows.push([]);
      const row = [];
      for (const [, cellAttrs, inner = ''] of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = cellAttrs.match(/\br="([A-Z]+\d+)"/);
        const col = ref ? column(ref[1]) : row.length;
        while (row.length < col) row.push(null);
        const type = cellAttrs.match(/\bt="([^"]+)"/)?.[1];
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        if (type === 's') row.push(shared[Number(v)] ?? null);
        else if (type === 'inlineStr') row.push(textOf(inner));
        else if (type === 'str' || type === 'e') row.push(decodeEntities(v ?? ''));
        else if (type === 'b') row.push(v === '1');
        else row.push(v === undefined ? null : Number(v));
      }
      rows.push(row);
    }
    book[name] = rows;
  }
  return book;
};

export const excelDate = (serial) => {
  if (serial === null || serial === undefined || serial === '') return null;
  return new Date(Date.UTC(1899, 11, 30) + Number(serial) * 86400000).toISOString().slice(0, 10);
};

const MISSING = new Set([0x2e, 0x5f, ...Array.from({ length: 26 }, (_, i) => 0x41 + i)]);

export const ibmFloat = (bytes) => {
  const b = bytes.length < 8 ? Buffer.concat([bytes, Buffer.alloc(8 - bytes.length)]) : bytes;
  if (MISSING.has(b[0]) && b.subarray(1).every((x) => x === 0)) return null;
  const sign = b[0] & 0x80 ? -1 : 1;
  const exponent = (b[0] & 0x7f) - 64;
  let fraction = 0;
  for (let i = 1; i < 8; i += 1) fraction = fraction * 256 + b[i];
  return sign * (fraction / 2 ** 56) * 16 ** exponent;
};

const HEADER = 'HEADER RECORD*******';

export const readXpt = (buffer) => {
  const text = buffer.toString('latin1');
  const member = text.indexOf(`${HEADER}MEMBER  HEADER RECORD`);
  const size = Number(text.slice(member + 74, member + 78)) || 140;
  const names = text.indexOf(`${HEADER}NAMESTR HEADER RECORD`, member);
  const count = Number(text.slice(names + 54, names + 58));
  const start = names + 80;
  const vars = Array.from({ length: count }, (_, i) => {
    const o = start + i * size;
    return {
      name: text.slice(o + 8, o + 16).trim(),
      label: text.slice(o + 16, o + 56).trim(),
      type: buffer.readInt16BE(o) === 2 ? 'char' : 'num',
      length: buffer.readInt16BE(o + 4),
      position: buffer.readInt32BE(o + 84),
    };
  });
  const obs = text.indexOf(`${HEADER}OBS     HEADER RECORD`, start + count * size) + 80;
  const width = Math.max(...vars.map((v) => v.position + v.length));
  const total = Math.floor((buffer.length - obs) / width);
  const rows = [];
  let last = -1;
  for (let k = 0; k < total; k += 1) {
    const base = obs + k * width;
    const raw = buffer.subarray(base, base + width);
    if (!raw.every((x) => x === 0x20)) last = k;
    rows.push(vars.map((v) => {
      const cell = raw.subarray(v.position, v.position + v.length);
      return v.type === 'char' ? cell.toString('latin1').trimEnd() : ibmFloat(cell);
    }));
  }
  return { vars: vars.map(({ name, label, type, length }) => ({ name, label, type, length })), rows: rows.slice(0, last + 1) };
};

const span = (attrs, name) => Number(attrs.match(new RegExp(`${name}\\s*=\\s*"?(\\d+)`, 'i'))?.[1] ?? 1);

export const readTables = (html) => [...String(html).matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(([, body]) => {
  const caption = stripTags(body.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i)?.[1] ?? '');
  const head = [];
  const rows = [];
  const pending = [];
  for (const [, tr] of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr.matchAll(/<(t[hd])\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map(([, tag, attrs, inner]) => ({
      th: tag.toLowerCase() === 'th', text: stripTags(inner), rowspan: span(attrs, 'rowspan'), colspan: span(attrs, 'colspan'),
    }));
    const row = [];
    let col = 0;
    const carry = () => {
      while (pending[col]?.left > 0) {
        row[col] = pending[col].text;
        pending[col].left -= 1;
        col += 1;
      }
    };
    for (const cell of cells) {
      carry();
      for (let k = 0; k < cell.colspan; k += 1) {
        row[col] = cell.text;
        if (cell.rowspan > 1) pending[col] = { text: cell.text, left: cell.rowspan - 1 };
        col += 1;
      }
    }
    carry();
    if (cells.length && cells.every((c) => c.th) && !head.length && !rows.length) head.push(...row);
    else if (row.length) rows.push(row);
  }
  return { caption, head, rows };
});

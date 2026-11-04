import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readCsv, records, readXlsx, excelDate, readXpt, ibmFloat, readTables, decodeEntities, stripTags,
} from '../../scripts/readers.mjs';
import { xlsxOf, xptOf, ibm } from './fixtures.mjs';

test('readCsv handles quotes, doubled quotes, line breaks inside quotes and CRLF', () => {
  const text = 'drug,note\r\n"aspirin, plain","say ""hi"""\r\nwarfarin,"two\nlines"\r\n';
  assert.deepEqual(readCsv(text), [['drug', 'note'], ['aspirin, plain', 'say "hi"'], ['warfarin', 'two\nlines']]);
});

test('readCsv takes any delimiter and keeps empty fields', () => {
  assert.deepEqual(readCsv('ApplNo~ProductNo~Form\n001234~001~TABLET\n001235~~\n', { delimiter: '~' }), [['ApplNo', 'ProductNo', 'Form'], ['001234', '001', 'TABLET'], ['001235', '', '']]);
  assert.deepEqual(readCsv('a\tb\n1\t2', { delimiter: '\t' }), [['a', 'b'], ['1', '2']]);
});

test('readCsv can skip leading lines such as a version banner', () => {
  const text = '"# GtoPdb Version: 2026.3.1 - published: 2026-10-12"\n"Target","Ligand"\n"D2 receptor","haloperidol"\n';
  assert.deepEqual(readCsv(text, { skip: 1 }), [['Target', 'Ligand'], ['D2 receptor', 'haloperidol']]);
});

test('records turns rows into objects keyed by the header row', () => {
  assert.deepEqual(records([['Drug', 'Year'], ['imatinib', '2001'], ['trastuzumab', '1998', 'extra']]), [{ Drug: 'imatinib', Year: '2001' }, { Drug: 'trastuzumab', Year: '1998' }]);
  assert.deepEqual(records([['x'], ['1']], 0), [{ x: '1' }]);
});

test('readXlsx reads every sheet with shared strings and numbers', () => {
  const book = readXlsx(xlsxOf({ Medicines: [['Name', 'Year'], ['Ozempic', 2018], ['A & B', null, 3]], Notes: [['x']] }));
  assert.deepEqual(Object.keys(book), ['Medicines', 'Notes']);
  assert.deepEqual(book.Medicines, [['Name', 'Year'], ['Ozempic', 2018], ['A & B', null, 3]]);
  assert.deepEqual(book.Notes, [['x']]);
});

test('excelDate turns a serial day into an ISO date', () => {
  assert.equal(excelDate(45000), '2023-03-15');
  assert.equal(excelDate(44927), '2023-01-01');
  assert.equal(excelDate(null), null);
});

test('ibmFloat reads IBM hexadecimal floating point and SAS missing values', () => {
  for (const x of [1, -1, 0.5, 130378, 12345.678901, 1e-6, 3.0e9]) {
    const back = ibmFloat(ibm(x));
    assert.ok(Math.abs(back - x) <= Math.abs(x) * 1e-12, `${x} ${back}`);
  }
  assert.equal(ibmFloat(ibm(0)), 0);
  assert.equal(ibmFloat(ibm(null)), null);
  assert.equal(ibmFloat(Buffer.from([0x41, 0, 0, 0, 0, 0, 0, 0])), null);
});

test('readXpt reads SAS transport variables and observations', () => {
  const vars = [
    { name: 'SEQN', label: 'Respondent sequence number', type: 'num', length: 8 },
    { name: 'RXDDRUG', label: 'Generic drug name', type: 'char', length: 12 },
    { name: 'RXDCOUNT', label: 'Number of prescription medicines used', type: 'num', length: 8 },
  ];
  const file = readXpt(xptOf(vars, [[130378, 'METFORMIN', 3], [130379, 'LISINOPRIL', null], [130380, '', 0]]));
  assert.deepEqual(file.vars.map((v) => [v.name, v.type, v.length, v.label]), vars.map((v) => [v.name, v.type, v.length, v.label]));
  assert.deepEqual(file.rows, [[130378, 'METFORMIN', 3], [130379, 'LISINOPRIL', null], [130380, '', 0]]);
});

test('readXpt drops the blank padding after the last observation', () => {
  const vars = [{ name: 'A', type: 'char', length: 3 }];
  assert.deepEqual(readXpt(xptOf(vars, [['abc'], ['def']])).rows, [['abc'], ['def']]);
});

test('decodeEntities and stripTags turn markup into plain text', () => {
  assert.equal(decodeEntities('A &amp; B &lt;5&gt; &#8211; &ndash; &#x2019;s 5&nbsp;&micro;g &rsquo;'), 'A & B <5> – – ’s 5 µg ’');
  assert.equal(stripTags('<a href="x">CYP2D6</a><br>poor <sup>1</sup> <strong>metabolizer</strong>'), 'CYP2D6 poor 1 metabolizer');
});

test('readTables reads captions, header cells and body rows, expanding rowspan and colspan', () => {
  const html = `<p>x</p><table><caption>Table 2-1: <b>Index</b> substrates</caption>
    <thead><tr><th>Enzyme</th><th>Sensitive</th><th>Moderate</th></tr></thead>
    <tbody>
      <tr><td rowspan="2">CYP3A</td><td>midazolam<sup>a</sup></td><td>-</td></tr>
      <tr><td>triazolam</td><td>quetiapine</td></tr>
      <tr><td colspan="2">CYP2D6 &amp; others</td><td>&nbsp;</td></tr>
    </tbody></table>
    <table><tr><td>only</td></tr></table>`;
  const [first, second] = readTables(html);
  assert.equal(first.caption, 'Table 2-1: Index substrates');
  assert.deepEqual(first.head, ['Enzyme', 'Sensitive', 'Moderate']);
  assert.deepEqual(first.rows, [['CYP3A', 'midazolama', '-'], ['CYP3A', 'triazolam', 'quetiapine'], ['CYP2D6 & others', 'CYP2D6 & others', '']]);
  assert.equal(second.caption, '');
  assert.deepEqual(second.head, []);
  assert.deepEqual(second.rows, [['only']]);
});

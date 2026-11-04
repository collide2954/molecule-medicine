import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  exact, compact, pct, usd, decimal, wordy, ordinal, sci, mlog, signed, toCsv, molar, pToMolar, molarToP, perMl, duration, daltons, times, price, longDate, yearOf, seconds, pow10,
} from '../../src/lib.js';

test('seconds names a span in seconds, minutes, hours or days', () => {
  assert.equal(seconds(1.4), '1.4 s');
  assert.equal(seconds(42), '42 s');
  assert.equal(seconds(100), '1.7 min');
  assert.equal(seconds(1800), '30 min');
  assert.equal(seconds(10000), '2.8 h');
  assert.equal(seconds(500000), '5.8 days');
});

test('pow10 writes powers of ten with superscripts', () => {
  assert.equal(pow10(6), '10⁶');
  assert.equal(pow10(-3), '10⁻³');
  assert.equal(pow10(0), '10⁰');
  assert.equal(pow10(10), '10¹⁰');
});

test('exact groups thousands with commas', () => {
  assert.equal(exact(24527044), '24,527,044');
  assert.equal(exact(0), '0');
  assert.equal(exact(999), '999');
  assert.equal(exact('16,569'), '16,569');
});

test('exact returns a dash for missing values', () => {
  assert.equal(exact(undefined), '—');
  assert.equal(exact(null), '—');
  assert.equal(exact('n/a'), '—');
});

test('compact abbreviates with one decimal and rolls up instead of printing 1000K', () => {
  assert.equal(compact(41379710), '41.4M');
  assert.equal(compact(1500), '1.5K');
  assert.equal(compact(2_300_000_000), '2.3B');
  assert.equal(compact(4_100_000_000_000), '4.1T');
  assert.equal(compact(950), '950');
  assert.equal(compact(999_960), '1M');
  assert.equal(compact(999.6), '1K');
});

test('pct formats a ratio as a percentage', () => {
  assert.equal(pct(0.1234), '12.3%');
  assert.equal(pct(1), '100%');
  assert.equal(pct(0), '0%');
  assert.equal(pct(0.0004), '0.04%');
});

test('usd formats dollars compactly', () => {
  assert.equal(usd(95_263_072), '$95.3M');
  assert.equal(usd(525), '$525');
});

test('decimal keeps a fixed number of places', () => {
  assert.equal(decimal(0.5106, 2), '0.51');
  assert.equal(decimal(2.866), '2.9');
  assert.equal(decimal(undefined), '—');
});

test('wordy spells out large numbers', () => {
  assert.equal(wordy(21_054_159), '21.1 million');
  assert.equal(wordy(1_240_000_000), '1.24 billion');
  assert.equal(wordy(9_999), '9,999');
});

test('ordinal adds the English suffix', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th']);
});

test('sci writes small numbers with a superscript power of ten', () => {
  assert.equal(sci(5e-8), '5×10⁻⁸');
  assert.equal(sci(3.24e-12), '3.2×10⁻¹²');
  assert.equal(sci(0.0123), '0.012');
  assert.equal(sci(0), '0');
});

test('mlog gives minus log10', () => {
  assert.equal(mlog(1e-8), 8);
  assert.equal(mlog(0), Infinity);
});

test('signed puts a sign in front of changes', () => {
  assert.equal(signed(1200), '+1,200');
  assert.equal(signed(-35), '−35');
  assert.equal(signed(0), '0');
  assert.equal(signed(2.5, (v) => v.toFixed(1)), '+2.5');
});

test('toCsv quotes fields that hold commas, quotes or line breaks', () => {
  assert.equal(toCsv(['drug', 'claims'], [['metformin', 1234], ['x', null]]), 'drug,claims\r\nmetformin,1234\r\nx,\r\n');
  assert.equal(toCsv(['note'], [['a, b'], ['say "hi"'], ['two\nlines']]), 'note\r\n"a, b"\r\n"say ""hi"""\r\n"two\nlines"\r\n');
});

test('molar writes a concentration in the unit that keeps it between 1 and 1,000', () => {
  assert.equal(molar(1e-9), '1 nM');
  assert.equal(molar(2.5e-7), '250 nM');
  assert.equal(molar(3.2e-6), '3.2 µM');
  assert.equal(molar(1.234e-11), '12.3 pM');
  assert.equal(molar(0.05), '50 mM');
  assert.equal(molar(2), '2 M');
  assert.equal(molar(9.996e-7), '1 µM');
  assert.equal(molar(4e-16), '0.4 fM');
});

test('p values convert to molar and back', () => {
  assert.equal(pToMolar(9), 1e-9);
  assert.ok(Math.abs(pToMolar(7.5) - 3.1623e-8) < 1e-12);
  assert.equal(molarToP(1e-6), 6);
  assert.equal(molarToP(2.5e-9).toFixed(2), '8.60');
  assert.ok(Number.isNaN(molarToP(0)));
});

test('perMl writes a plasma concentration from ng/mL in the unit that keeps it between 1 and 1,000', () => {
  assert.equal(perMl(15), '15 ng/mL');
  assert.equal(perMl(0.25), '250 pg/mL');
  assert.equal(perMl(2500), '2.5 µg/mL');
  assert.equal(perMl(2.5e6), '2.5 mg/mL');
  assert.equal(perMl(123.456), '123 ng/mL');
  assert.equal(perMl(null), '—');
});

test('duration writes hours as minutes, hours, days or years', () => {
  assert.equal(duration(0.25), '15 min');
  assert.equal(duration(6.5), '6.5 h');
  assert.equal(duration(36), '36 h');
  assert.equal(duration(120), '5 days');
  assert.equal(duration(30), '30 h');
  assert.equal(duration(26280), '3 years');
  assert.equal(duration(24 * 400), '1.1 years');
  assert.equal(duration(null), '—');
});

test('daltons writes molecular weights in Da or kDa', () => {
  assert.equal(daltons(180.16), '180.2 Da');
  assert.equal(daltons(1450), '1,450 Da');
  assert.equal(daltons(148000), '148 kDa');
  assert.equal(daltons(null), '—');
});

test('times writes a fold change with two significant figures', () => {
  assert.equal(times(2.5), '2.5×');
  assert.equal(times(12.34), '12×');
  assert.equal(times(0.456), '0.46×');
});

test('price writes unit prices with enough digits to compare them', () => {
  assert.equal(price(0.04213), '$0.0421');
  assert.equal(price(12.5), '$12.50');
  assert.equal(price(12345.6), '$12,346');
  assert.equal(price(null), '—');
});

test('longDate and yearOf read ISO dates', () => {
  assert.equal(longDate('2026-05-01'), '1 May 2026');
  assert.equal(longDate('2026-05'), 'May 2026');
  assert.equal(longDate('2026'), '2026');
  assert.equal(yearOf('1938-06-25'), 1938);
});

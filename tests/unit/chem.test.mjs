import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMolfile, packMol, unpackMol, implicitHydrogens, rings, ringSystems, aromaticRings, ringName, fsp3, stereocentres, elementCounts, atomLabel, bondLines,
} from '../../src/chem.js';
import { molOf, cycle } from './fixtures.mjs';

const hexagon = (els, orders) => molOf(
  els.map((el, i) => [el, Math.cos((Math.PI / 3) * i), Math.sin((Math.PI / 3) * i)]),
  cycle(els.length, 1, orders),
);
const pentagon = (els, orders) => molOf(
  els.map((el, i) => [el, Math.cos(((2 * Math.PI) / 5) * i), Math.sin(((2 * Math.PI) / 5) * i)]),
  cycle(els.length, 1, orders),
);
const KEKULE = [2, 1, 2, 1, 2, 1];

test('parseMolfile reads atoms, bonds, charges and isotopes from V2000', () => {
  const mol = parseMolfile(molOf([['C', 0, 0], ['N', 1.5, 0], ['O', 2.2, 1.2], ['O', 2.2, -1.2]], [[1, 2, 1], [2, 3, 2], [2, 4, 1]], ['M  CHG  2   2   1   4  -1']));
  assert.deepEqual(mol.atoms.map((a) => a.el), ['C', 'N', 'O', 'O']);
  assert.deepEqual(mol.atoms.map((a) => a.charge), [0, 1, 0, -1]);
  assert.deepEqual(mol.bonds, [{ a: 0, b: 1, order: 1, stereo: 0 }, { a: 1, b: 2, order: 2, stereo: 0 }, { a: 1, b: 3, order: 1, stereo: 0 }]);
  assert.equal(mol.atoms[2].x, 2.2);
  const heavy = parseMolfile(molOf([['H', 0, 0], ['C', 1, 0]], [[1, 2, 1]], ['M  ISO  1   1   2']));
  assert.equal(heavy.atoms[0].mass, 2);
  assert.equal(parseMolfile('not a molfile'), null);
});

test('packMol and unpackMol round-trip a molecule at two decimals', () => {
  const mol = parseMolfile(molOf([['C', 0.123, -1.456], ['Cl', 1.5, 0, 0], ['N', 2.5, 0.5, 1]], [[1, 2, 1], [2, 3, 1, 1]]));
  const packed = packMol(mol);
  assert.deepEqual(packed.e, ['C', 'Cl', 'N']);
  assert.deepEqual(packed.x, [12, 150, 250]);
  assert.deepEqual(packed.b, [0, 1, 1, 0, 1, 2, 1, 1]);
  const back = unpackMol(packed);
  assert.deepEqual(back.atoms.map((a) => [a.el, a.x, a.y, a.charge]), [['C', 0.12, -1.46, 0], ['Cl', 1.5, 0, 0], ['N', 2.5, 0.5, 1]]);
  assert.deepEqual(back.bonds, mol.bonds);
});

test('implicitHydrogens fills each atom to its usual valence, allowing for charge', () => {
  const ethanol = parseMolfile(molOf([['C'], ['C'], ['O']], [[1, 2], [2, 3]]));
  assert.deepEqual(implicitHydrogens(ethanol), [3, 2, 1]);
  const nitro = parseMolfile(molOf([['C'], ['N', 0, 0, 3], ['O'], ['O', 0, 0, 5]], [[1, 2, 1], [2, 3, 2], [2, 4, 1]]));
  assert.deepEqual(nitro.atoms.map((a) => a.charge), [0, 1, 0, -1]);
  assert.deepEqual(implicitHydrogens(nitro), [3, 0, 0, 0]);
  const sulfonamide = parseMolfile(molOf([['C'], ['S'], ['O'], ['O'], ['N']], [[1, 2], [2, 3, 2], [2, 4, 2], [2, 5]]));
  assert.deepEqual(implicitHydrogens(sulfonamide), [3, 0, 0, 0, 2]);
  const ammonium = parseMolfile(molOf([['N', 0, 0, 3], ['C'], ['C'], ['C'], ['C']], [[1, 2], [1, 3], [1, 4], [1, 5]]));
  assert.equal(implicitHydrogens(ammonium)[0], 0);
});

test('rings finds the smallest set of smallest rings', () => {
  assert.deepEqual(rings(parseMolfile(hexagon(['C', 'C', 'C', 'C', 'C', 'C'], KEKULE))).map((r) => r.length), [6]);
  const naphthalene = parseMolfile(molOf(Array.from({ length: 10 }, () => ['C']), [
    [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 10, 2], [10, 9, 1], [9, 1, 2], [10, 5, 1], [5, 6, 2], [6, 7, 1], [7, 8, 2], [8, 9, 1],
  ]));
  assert.deepEqual(rings(naphthalene).map((r) => r.length), [6, 6]);
  const cubane = parseMolfile(molOf(Array.from({ length: 8 }, () => ['C']), [
    [1, 2], [2, 3], [3, 4], [4, 1], [5, 6], [6, 7], [7, 8], [8, 5], [1, 5], [2, 6], [3, 7], [4, 8],
  ]));
  assert.deepEqual(rings(cubane).map((r) => r.length), [4, 4, 4, 4, 4]);
  assert.deepEqual(rings(parseMolfile(molOf([['C'], ['C'], ['O']], [[1, 2], [2, 3]]))), []);
});

test('ringSystems joins fused and spiro rings and keeps linked rings apart', () => {
  const spiro = parseMolfile(molOf(Array.from({ length: 9 }, () => ['C']), [[1, 2], [2, 3], [3, 4], [4, 5], [5, 1], [1, 6], [6, 7], [7, 8], [8, 9], [9, 1]]));
  const systems = ringSystems(spiro);
  assert.equal(systems.length, 1);
  assert.equal(systems[0].atoms.length, 9);
  assert.equal(systems[0].rings.length, 2);
  const biphenyl = parseMolfile(molOf(Array.from({ length: 12 }, () => ['C']), [...cycle(6, 1, KEKULE), ...cycle(6, 7, KEKULE), [1, 7, 1]]));
  assert.equal(ringSystems(biphenyl).length, 2);
});

test('aromaticRings counts pi electrons, crediting double bonds shared across a fused system', () => {
  const naphthalene = parseMolfile(molOf(Array.from({ length: 10 }, () => ['C']), [
    [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 10, 2], [10, 9, 1], [9, 1, 2], [10, 5, 1], [5, 6, 2], [6, 7, 1], [7, 8, 2], [8, 9, 1],
  ]));
  assert.deepEqual(aromaticRings(naphthalene), [true, true]);
  assert.deepEqual(aromaticRings(parseMolfile(hexagon(['C', 'C', 'C', 'C', 'C', 'C'], [1, 1, 1, 1, 1, 1]))), [false]);
  assert.deepEqual(aromaticRings(parseMolfile(pentagon(['N', 'C', 'C', 'C', 'C'], [1, 2, 1, 2, 1]))), [true]);
});

test('ringName names the common drug rings', () => {
  const name = (molfile) => {
    const mol = parseMolfile(molfile);
    return ringName(mol, rings(mol)[0], aromaticRings(mol)[0]);
  };
  assert.equal(name(hexagon(['C', 'C', 'C', 'C', 'C', 'C'], KEKULE)), 'benzene');
  assert.equal(name(hexagon(['C', 'C', 'C', 'C', 'C', 'C'], [1, 1, 1, 1, 1, 1])), 'cyclohexane');
  assert.equal(name(hexagon(['N', 'C', 'C', 'C', 'C', 'C'], KEKULE)), 'pyridine');
  assert.equal(name(hexagon(['N', 'C', 'N', 'C', 'C', 'C'], KEKULE)), 'pyrimidine');
  assert.equal(name(hexagon(['N', 'C', 'C', 'C', 'C', 'C'], [1, 1, 1, 1, 1, 1])), 'piperidine');
  assert.equal(name(hexagon(['N', 'C', 'C', 'N', 'C', 'C'], [1, 1, 1, 1, 1, 1])), 'piperazine');
  assert.equal(name(hexagon(['O', 'C', 'C', 'N', 'C', 'C'], [1, 1, 1, 1, 1, 1])), 'morpholine');
  assert.equal(name(pentagon(['N', 'C', 'C', 'C', 'C'], [1, 2, 1, 2, 1])), 'pyrrole');
  assert.equal(name(pentagon(['S', 'C', 'C', 'C', 'C'], [1, 2, 1, 2, 1])), 'thiophene');
  assert.equal(name(pentagon(['N', 'C', 'N', 'C', 'C'], [1, 2, 1, 2, 1])), 'imidazole');
  assert.equal(name(pentagon(['N', 'C', 'C', 'C', 'C'], [1, 1, 1, 1, 1])), 'pyrrolidine');
  assert.equal(name(pentagon(['N', 'N', 'C', 'C', 'C'], [1, 1, 1, 1, 1])), '5-ring, N2, saturated');
});

test('fsp3, stereocentres and elementCounts describe a molecule', () => {
  assert.equal(fsp3(parseMolfile(molOf([['C'], ['C'], ['O']], [[1, 2], [2, 3]]))), 1);
  assert.equal(fsp3(parseMolfile(hexagon(['C', 'C', 'C', 'C', 'C', 'C'], KEKULE))), 0);
  assert.equal(stereocentres('C[C@H](N)C(=O)O'), 1);
  assert.equal(stereocentres('C[C@@H]1CC[C@H](C)CC1'), 2);
  assert.equal(stereocentres('CCO'), 0);
  assert.deepEqual(elementCounts('C20H36N2O3S'), { C: 20, H: 36, N: 2, O: 3, S: 1 });
  assert.deepEqual(elementCounts('Cl2H6N2Pt'), { Cl: 2, H: 6, N: 2, Pt: 1 });
  assert.deepEqual(elementCounts('C4H11N5.ClH'), { C: 4, H: 12, N: 5, Cl: 1 });
});

test('atomLabel writes heteroatoms with their hydrogens and charges', () => {
  const ethanol = parseMolfile(molOf([['C'], ['C'], ['O']], [[1, 2], [2, 3]]));
  assert.equal(atomLabel(ethanol, 0), '');
  assert.equal(atomLabel(ethanol, 2), 'OH');
  const methylamine = parseMolfile(molOf([['C'], ['N']], [[1, 2]]));
  assert.equal(atomLabel(methylamine, 1), 'NH₂');
  const nitro = parseMolfile(molOf([['C'], ['N', 0, 0, 3], ['O'], ['O', 0, 0, 5]], [[1, 2, 1], [2, 3, 2], [2, 4, 1]]));
  assert.equal(atomLabel(nitro, 1), 'N⁺');
  assert.equal(atomLabel(nitro, 3), 'O⁻');
  assert.equal(atomLabel(parseMolfile(molOf([['C'], ['C']], [[1, 2]])), 0), 'CH₃');
});

test('bondLines draws ring double bonds inside the ring and terminal ones on both sides', () => {
  const benzene = parseMolfile(hexagon(['C', 'C', 'C', 'C', 'C', 'C'], KEKULE));
  const segs = bondLines(benzene);
  const inner = segs.filter((s) => s.kind === 'inner');
  assert.equal(inner.length, 3);
  assert.equal(segs.filter((s) => s.kind === 'line').length, 6);
  const mid = (s) => Math.hypot((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2);
  const main = segs.find((s) => s.kind === 'line' && s.bond === inner[0].bond);
  assert.ok(mid(inner[0]) < mid(main), `${mid(inner[0])} ${mid(main)}`);
  const formaldehyde = parseMolfile(molOf([['C', 0, 0], ['O', 1, 0]], [[1, 2, 2]]));
  const pair = bondLines(formaldehyde);
  assert.deepEqual(pair.map((s) => s.kind), ['side', 'side']);
  assert.ok(Math.abs(pair[0].y1 + pair[1].y1) < 1e-9);
  const wedge = bondLines(parseMolfile(molOf([['C', 0, 0], ['C', 1, 0]], [[1, 2, 1, 1]])));
  assert.equal(wedge[0].kind, 'wedge');
});

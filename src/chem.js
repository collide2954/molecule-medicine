const CHARGE_CODES = { 1: 3, 2: 2, 3: 1, 5: -1, 6: -2, 7: -3 };

const fields = (line, from) => line.slice(from).trim().split(/\s+/).map(Number);

export const parseMolfile = (text) => {
  const lines = String(text ?? '').split(/\r?\n/);
  const counts = lines[3];
  if (!counts || !/V2000/.test(counts)) return null;
  const na = Number(counts.slice(0, 3));
  const nb = Number(counts.slice(3, 6));
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return null;
  const atoms = lines.slice(4, 4 + na).map((l) => ({
    el: l.slice(31, 34).trim(), x: Number(l.slice(0, 10)), y: Number(l.slice(10, 20)), charge: CHARGE_CODES[Number(l.slice(36, 39))] ?? 0,
  }));
  const bonds = lines.slice(4 + na, 4 + na + nb).map((l) => ({
    a: Number(l.slice(0, 3)) - 1, b: Number(l.slice(3, 6)) - 1, order: Number(l.slice(6, 9)), stereo: Number(l.slice(9, 12)) || 0,
  }));
  let charged = false;
  for (const line of lines.slice(4 + na + nb)) {
    if (line.startsWith('M  END')) break;
    if (line.startsWith('M  CHG')) {
      if (!charged) atoms.forEach((a) => { a.charge = 0; });
      charged = true;
      const f = fields(line, 6);
      for (let i = 1; i + 1 < f.length; i += 2) atoms[f[i] - 1].charge = f[i + 1];
    }
    if (line.startsWith('M  ISO')) {
      const f = fields(line, 6);
      for (let i = 1; i + 1 < f.length; i += 2) atoms[f[i] - 1].mass = f[i + 1];
    }
  }
  return { atoms, bonds };
};

export const packMol = (mol) => {
  const out = {
    e: mol.atoms.map((a) => a.el), x: mol.atoms.map((a) => Math.round(a.x * 100)), y: mol.atoms.map((a) => Math.round(a.y * 100)), b: mol.bonds.flatMap((b) => [b.a, b.b, b.order, b.stereo]),
  };
  const charges = mol.atoms.flatMap((a, i) => (a.charge ? [[i, a.charge]] : []));
  const masses = mol.atoms.flatMap((a, i) => (a.mass ? [[i, a.mass]] : []));
  if (charges.length) out.c = charges;
  if (masses.length) out.m = masses;
  return out;
};

export const unpackMol = (p) => {
  const atoms = p.e.map((el, i) => ({ el, x: p.x[i] / 100, y: p.y[i] / 100, charge: 0 }));
  for (const [i, c] of p.c ?? []) atoms[i].charge = c;
  for (const [i, m] of p.m ?? []) atoms[i].mass = m;
  const bonds = [];
  for (let k = 0; k < p.b.length; k += 4) bonds.push({ a: p.b[k], b: p.b[k + 1], order: p.b[k + 2], stereo: p.b[k + 3] });
  return { atoms, bonds };
};

const VALENCE = {
  H: [1], B: [3], C: [4], N: [3, 5], O: [2], F: [1], Si: [4], P: [3, 5], S: [2, 4, 6], Cl: [1, 3, 5, 7], Br: [1, 3, 5, 7], I: [1, 3, 5, 7], Se: [2, 4, 6], As: [3, 5],
};
const DONORS = new Set(['N', 'P', 'As', 'O', 'S', 'Se', 'F', 'Cl', 'Br', 'I']);

const adjusted = (el, charge) => VALENCE[el].map((v) => {
  if (DONORS.has(el) || el === 'H') return v + charge;
  if (el === 'B') return v - charge;
  return v - Math.abs(charge);
});

const bondSums = (mol) => {
  const sums = new Array(mol.atoms.length).fill(0);
  for (const b of mol.bonds) {
    const o = b.order === 4 ? 1.5 : b.order;
    sums[b.a] += o;
    sums[b.b] += o;
  }
  return sums;
};

export const implicitHydrogens = (mol) => {
  const sums = bondSums(mol);
  return mol.atoms.map((atom, i) => {
    if (!VALENCE[atom.el]) return 0;
    const used = Math.ceil(sums[i] - 1e-9);
    const v = adjusted(atom.el, atom.charge).find((x) => x >= used);
    return v === undefined ? 0 : Math.max(0, v - used);
  });
};

const neighbours = (mol) => {
  const adj = mol.atoms.map(() => []);
  mol.bonds.forEach((b, k) => {
    adj[b.a].push([b.b, k]);
    adj[b.b].push([b.a, k]);
  });
  return adj;
};

const componentsOf = (mol, adj) => {
  const seen = new Array(mol.atoms.length).fill(false);
  let count = 0;
  for (let s = 0; s < mol.atoms.length; s += 1) {
    if (seen[s]) continue;
    count += 1;
    const stack = [s];
    seen[s] = true;
    while (stack.length) {
      const u = stack.pop();
      for (const [v] of adj[u]) {
        if (!seen[v]) {
          seen[v] = true;
          stack.push(v);
        }
      }
    }
  }
  return count;
};

const shortestCycle = (adj, from, to, skip) => {
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const u = queue.shift();
    if (u === to) break;
    for (const [v, k] of adj[u]) {
      if (k === skip || prev.has(v)) continue;
      prev.set(v, [u, k]);
      queue.push(v);
    }
  }
  if (!prev.has(to)) return null;
  const atoms = [];
  const bonds = [skip];
  for (let at = to; at !== from; at = prev.get(at)[0]) {
    atoms.push(at);
    bonds.push(prev.get(at)[1]);
  }
  atoms.push(from);
  return { atoms: atoms.reverse(), bonds };
};

const memo = new WeakMap();

export const rings = (mol) => {
  if (memo.has(mol)) return memo.get(mol);
  const adj = neighbours(mol);
  const target = mol.bonds.length - mol.atoms.length + componentsOf(mol, adj);
  const out = [];
  if (target > 0) {
    const seen = new Set();
    const candidates = [];
    mol.bonds.forEach((b, k) => {
      const cyc = shortestCycle(adj, b.a, b.b, k);
      if (!cyc) return;
      const key = [...cyc.bonds].sort((x, y) => x - y).join(',');
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({ ...cyc, vec: cyc.bonds.reduce((v, k2) => v | (1n << BigInt(k2)), 0n) });
    });
    candidates.sort((x, y) => x.atoms.length - y.atoms.length);
    const basis = [];
    for (const c of candidates) {
      let v = c.vec;
      for (const { vec, pivot } of basis) if ((v >> pivot) & 1n) v ^= vec;
      if (v === 0n) continue;
      basis.push({ vec: v, pivot: BigInt(v.toString(2).length - 1) });
      basis.sort((x, y) => (y.pivot > x.pivot ? 1 : y.pivot < x.pivot ? -1 : 0));
      out.push(c.atoms);
      if (out.length === target) break;
    }
  }
  memo.set(mol, out);
  return out;
};

export const ringSystems = (mol) => {
  const rs = rings(mol);
  const parent = rs.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < rs.length; i += 1) {
    const set = new Set(rs[i]);
    for (let j = i + 1; j < rs.length; j += 1) if (rs[j].some((a) => set.has(a))) parent[find(j)] = find(i);
  }
  const groups = new Map();
  rs.forEach((_, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  });
  return [...groups.values()].map((idx) => ({ rings: idx, atoms: [...new Set(idx.flatMap((i) => rs[i]))].sort((a, b) => a - b) }));
};

const LONE_PAIRS = new Set(['N', 'O', 'S', 'Se', 'P']);

export const aromaticRings = (mol) => {
  const rs = rings(mol);
  const system = new Map();
  ringSystems(mol).forEach((s, k) => s.atoms.forEach((a) => system.set(a, k)));
  const adj = neighbours(mol);
  return rs.map((ring) => {
    const set = new Set(ring);
    let electrons = 0;
    for (const i of ring) {
      const bonds = adj[i].map(([j, k]) => ({ j, bond: mol.bonds[k] }));
      if (bonds.some(({ bond }) => bond.order === 4)) {
        electrons += 1;
        continue;
      }
      const doubles = bonds.filter(({ bond }) => bond.order === 2);
      const inSystem = doubles.some(({ j }) => set.has(j) || system.get(j) === system.get(i));
      const exocyclic = doubles.some(({ j }) => system.get(j) !== system.get(i));
      const atom = mol.atoms[i];
      if (inSystem) electrons += 1;
      else if (LONE_PAIRS.has(atom.el) && atom.charge <= 0) electrons += 2;
      else if (atom.el === 'C' && atom.charge === -1) electrons += 2;
      else if (!(exocyclic || (atom.el === 'C' && atom.charge === 1))) return false;
    }
    return electrons % 4 === 2;
  });
};

const PRIORITY = ['O', 'S', 'Se', 'N', 'P', 'B', 'Si'];
const rank = (el) => {
  const at = PRIORITY.indexOf(el);
  return at < 0 ? PRIORITY.length : at;
};

const RING_NAMES = {
  '6|aromatic||': 'benzene', '6|saturated||': 'cyclohexane', '6|aromatic|N|1': 'pyridine', '6|aromatic|NN|1,2': 'pyridazine', '6|aromatic|NN|1,3': 'pyrimidine', '6|aromatic|NN|1,4': 'pyrazine',
  '6|aromatic|NNN|1,3,5': '1,3,5-triazine', '6|saturated|N|1': 'piperidine', '6|saturated|NN|1,4': 'piperazine', '6|saturated|O|1': 'tetrahydropyran', '6|saturated|ON|1,4': 'morpholine',
  '6|saturated|SN|1,4': 'thiomorpholine', '6|saturated|OO|1,4': '1,4-dioxane', '6|saturated|NN|1,3': 'hexahydropyrimidine', '5|aromatic|N|1': 'pyrrole', '5|aromatic|O|1': 'furan',
  '5|aromatic|S|1': 'thiophene', '5|aromatic|NN|1,2': 'pyrazole', '5|aromatic|NN|1,3': 'imidazole', '5|aromatic|ON|1,2': 'isoxazole', '5|aromatic|ON|1,3': 'oxazole', '5|aromatic|SN|1,3': 'thiazole',
  '5|aromatic|SN|1,2': 'isothiazole', '5|aromatic|NNN|1,2,3': '1,2,3-triazole', '5|aromatic|NNN|1,2,4': '1,2,4-triazole', '5|aromatic|NNNN|1,2,3,4': 'tetrazole',
  '5|aromatic|ONN|1,3,4': '1,3,4-oxadiazole', '5|aromatic|ONN|1,2,4': '1,2,4-oxadiazole', '5|aromatic|SNN|1,3,4': '1,3,4-thiadiazole', '5|saturated||': 'cyclopentane',
  '5|saturated|N|1': 'pyrrolidine', '5|saturated|O|1': 'tetrahydrofuran', '5|saturated|S|1': 'thiolane', '5|saturated|NN|1,3': 'imidazolidine', '5|saturated|ON|1,3': 'oxazolidine',
  '5|saturated|SN|1,3': 'thiazolidine', '4|saturated||': 'cyclobutane', '4|saturated|N|1': 'azetidine', '3|saturated||': 'cyclopropane', '3|saturated|O|1': 'oxirane', '3|saturated|N|1': 'aziridine',
  '7|saturated|N|1': 'azepane', '7|saturated||': 'cycloheptane', '6|aromatic|O|1': 'pyranone', '6|partly unsaturated|SN|1,3': 'dihydrothiazine',
  '7|partly unsaturated|NN|1,4': '1,4-diazepine', '5|saturated|OO|1,3': '1,3-dioxolane',
};

const lactam = (mol, ring) => {
  const n = ring.find((i) => mol.atoms[i].el === 'N');
  const k = ring.indexOf(n);
  const besideN = [ring[(k + 1) % ring.length], ring[(k + ring.length - 1) % ring.length]];
  return besideN.some((c) => mol.bonds.some((b) => b.order === 2 && (b.a === c || b.b === c) && mol.atoms[b.a === c ? b.b : b.a].el === 'O' && !ring.includes(b.a === c ? b.b : b.a)));
};

const locants = (els, start, dir) => {
  const n = els.length;
  const out = [];
  for (let k = 0; k < n; k += 1) {
    const el = els[(((start + dir * k) % n) + n) % n];
    if (el !== 'C') out.push([rank(el), k + 1]);
  }
  return out;
};

const less = (a, b) => {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i][1] !== b[i][1]) return a[i][1] < b[i][1];
    if (a[i][0] !== b[i][0]) return a[i][0] < b[i][0];
  }
  return false;
};

export const ringName = (mol, ring, aromatic) => {
  const els = ring.map((i) => mol.atoms[i].el);
  const hetero = els.filter((e) => e !== 'C');
  const adjacent = (b) => {
    const d = Math.abs(ring.indexOf(b.a) - ring.indexOf(b.b));
    return ring.includes(b.a) && ring.includes(b.b) && (d === 1 || d === ring.length - 1);
  };
  const ringDouble = mol.bonds.some((b) => b.order === 2 && adjacent(b));
  const state = aromatic ? 'aromatic' : ringDouble ? 'partly unsaturated' : 'saturated';
  let best = null;
  if (hetero.length) {
    const top = Math.min(...hetero.map(rank));
    els.forEach((el, start) => {
      if (el === 'C' || rank(el) !== top) return;
      for (const dir of [1, -1]) {
        const loc = locants(els, start, dir);
        if (!best || less(loc, best)) best = loc;
      }
    });
  }
  const order = best ? best.map(([r]) => r) : [];
  const elementOf = (r) => PRIORITY[r] ?? hetero.find((e) => rank(e) === r);
  const formula = best ? order.map(elementOf).join('') : '';
  const positions = best ? best.map(([, p]) => p).join(',') : '';
  const key = `${ring.length}|${state}|${formula}|${positions}`;
  if (key === '4|saturated|N|1' && lactam(mol, ring)) return 'β-lactam';
  if (RING_NAMES[key]) return RING_NAMES[key];
  const counts = {};
  for (const e of hetero) counts[e] = (counts[e] ?? 0) + 1;
  const tag = Object.entries(counts).sort((a, b) => rank(a[0]) - rank(b[0])).map(([e, n]) => `${e}${n}`).join('') || 'carbocyclic';
  return `${ring.length}-ring, ${tag}, ${state}`;
};

export const fsp3 = (mol) => {
  const multiple = new Set(mol.bonds.filter((b) => b.order !== 1).flatMap((b) => [b.a, b.b]));
  const carbons = mol.atoms.map((a, i) => [a, i]).filter(([a]) => a.el === 'C');
  if (!carbons.length) return 0;
  return carbons.filter(([, i]) => !multiple.has(i)).length / carbons.length;
};

export const stereocentres = (smiles) => (String(smiles ?? '').match(/@+/g) ?? []).length;

export const elementCounts = (formula) => {
  const out = {};
  for (const part of String(formula ?? '').split('.')) {
    const m = part.match(/^(\d+)(.*)$/);
    const times = m ? Number(m[1]) : 1;
    const body = m ? m[2] : part;
    for (const [, el, n] of body.matchAll(/([A-Z][a-z]?)(\d*)/g)) out[el] = (out[el] ?? 0) + (n ? Number(n) : 1) * times;
  }
  return out;
};

const SUB = { 1: '', 2: '₂', 3: '₃', 4: '₄' };
const SUP = { 1: '⁺', 2: '²⁺', 3: '³⁺', '-1': '⁻', '-2': '²⁻', '-3': '³⁻' };

export const atomLabel = (mol, i) => {
  const atom = mol.atoms[i];
  const degree = mol.bonds.filter((b) => b.a === i || b.b === i).length;
  const heavy = mol.atoms.filter((a) => a.el !== 'H').length;
  if (atom.el === 'C' && !atom.charge && !atom.mass && degree > 0 && heavy >= 3) return '';
  const h = implicitHydrogens(mol)[i];
  const symbol = atom.el === 'H' && atom.mass === 2 ? 'D' : atom.el;
  return `${symbol}${h ? `H${SUB[h] ?? h}` : ''}${atom.charge ? SUP[atom.charge] ?? '' : ''}`;
};

const centroid = (mol, ring) => ({
  x: ring.reduce((n, i) => n + mol.atoms[i].x, 0) / ring.length,
  y: ring.reduce((n, i) => n + mol.atoms[i].y, 0) / ring.length,
});

export const bondLines = (mol, { gap = 0.18, trim = 0.15 } = {}) => {
  const rs = rings(mol);
  const degree = mol.atoms.map((_, i) => mol.bonds.filter((b) => b.a === i || b.b === i).length);
  const out = [];
  mol.bonds.forEach((bond, k) => {
    const p = mol.atoms[bond.a];
    const q = mol.atoms[bond.b];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const off = gap * len;
    const base = { a: bond.a, b: bond.b, bond: k };
    const line = (kind, s = 0, cut = 0) => ({
      ...base, kind, x1: p.x + nx * s + dx * cut, y1: p.y + ny * s + dy * cut, x2: q.x + nx * s - dx * cut, y2: q.y + ny * s - dy * cut,
    });
    if (bond.order === 1) {
      const kind = bond.stereo === 1 ? 'wedge' : bond.stereo === 6 ? 'hash' : bond.stereo === 4 ? 'wavy' : 'line';
      out.push(line(kind));
      return;
    }
    if (bond.order === 3) {
      out.push(line('line'), line('side', off), line('side', -off));
      return;
    }
    const ring = rs.filter((r) => r.includes(bond.a) && r.includes(bond.b)).sort((x, y) => x.length - y.length)[0];
    if (ring) {
      const c = centroid(mol, ring);
      const side = (c.x - p.x) * nx + (c.y - p.y) * ny > 0 ? 1 : -1;
      out.push(line('line'), line('inner', side * off, trim));
      return;
    }
    if (degree[bond.a] === 1 || degree[bond.b] === 1) {
      out.push(line('side', off / 2), line('side', -off / 2));
      return;
    }
    const others = mol.bonds.flatMap((b) => {
      if (b === bond) return [];
      const j = b.a === bond.a || b.a === bond.b ? b.b : b.b === bond.a || b.b === bond.b ? b.a : null;
      return j === null ? [] : [mol.atoms[j]];
    });
    const lean = others.reduce((n, o) => n + Math.sign((o.x - p.x) * nx + (o.y - p.y) * ny), 0);
    out.push(line('line'), line('inner', (lean >= 0 ? 1 : -1) * off, trim));
  });
  return out;
};

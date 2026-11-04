import { exact, pct, soften } from './lib.js';
import { summary } from './stats.js';

const count = (list, key) => {
  const out = new Map();
  for (const x of list) {
    const k = key(x);
    if (k !== null && k !== undefined) out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
};

const ranked = (map, name) => [...map].map(([k, n]) => ({ [name]: k, n })).sort((a, b) => b.n - a.n || String(a[name]).localeCompare(String(b[name])));

const capital = (s) => (s ? `${s[0].toUpperCase()}${s.slice(1)}` : s);

export const drugName = (name) => String(name ?? '').toLowerCase();

export const release = (snap) => String(snap.chembl.release).replace('_', ' ');

export const smallMolecules = (snap) => snap.drugs.filter((d) => d.type === 'Small molecule');

export const decadeOf = (year) => (year ? Math.floor(year / 10) * 10 : null);

const yearOfSnapshot = (snap) => Number(String(snap.generated).slice(0, 4));

export const typeGroups = (snap) => ranked(count(snap.drugs, (d) => d.type), 'type');

const enough = (snap) => Math.max(2, Math.floor(smallMolecules(snap).length / 20));

export const propertyByDecade = (snap, key, min = enough(snap)) => {
  const groups = new Map();
  for (const d of smallMolecules(snap)) {
    const v = d.p?.[key];
    const dec = decadeOf(d.year);
    if (dec === null || v === null || v === undefined) continue;
    if (!groups.has(dec)) groups.set(dec, []);
    groups.get(dec).push(v);
  }
  return [...groups].filter(([, v]) => v.length >= min).sort((a, b) => a[0] - b[0]).map(([decade, v]) => ({ decade, n: v.length, summary: summary(v) }));
};

const complete = (snap, rows) => rows.filter((r) => r.decade + 10 <= yearOfSnapshot(snap));

const described = (snap) => smallMolecules(snap).filter((d) => d.chem);

export const elementShares = (snap) => {
  const list = described(snap);
  return ranked(count(list.flatMap((d) => d.chem.elements.map((el) => ({ el }))), (x) => x.el), 'el').map((r) => ({ ...r, share: r.n / list.length }));
};

export const elementByDecade = (snap, el, min = enough(snap)) => {
  const groups = new Map();
  for (const d of described(snap)) {
    const dec = decadeOf(d.year);
    if (dec === null) continue;
    if (!groups.has(dec)) groups.set(dec, { decade: dec, n: 0, with: 0 });
    const g = groups.get(dec);
    g.n += 1;
    if (d.chem.elements.includes(el)) g.with += 1;
  }
  return [...groups.values()].filter((g) => g.n >= min).sort((a, b) => a.decade - b.decade).map((g) => ({ ...g, share: g.with / g.n }));
};

export const ringCounts = (snap) => ranked(count(described(snap).flatMap((d) => [...new Set(d.chem.rings)].map((name) => ({ name }))), (x) => x.name), 'name');

const CHIRALITY = { 0: 'racemic', 1: 'single', 2: 'achiral' };

export const chiralityByDecade = (snap, min = enough(snap)) => {
  const groups = new Map();
  for (const d of smallMolecules(snap)) {
    const dec = decadeOf(d.year);
    const kind = CHIRALITY[d.chirality];
    if (dec === null || !kind) continue;
    if (!groups.has(dec)) groups.set(dec, { decade: dec, racemic: 0, single: 0, achiral: 0, n: 0 });
    const g = groups.get(dec);
    g[kind] += 1;
    g.n += 1;
  }
  return [...groups.values()].filter((g) => g.n >= min).sort((a, b) => a.decade - b.decade);
};

const splitStems = (d) => {
  const stems = String(d.stem.stem).split(/;\s*/).map((s) => s.trim()).filter(Boolean);
  const defs = String(d.stem.definition ?? '').split(/;\s*/);
  return stems.map((stem, i) => ({ stem, definition: defs[i] ?? defs[0] ?? '' }));
};

export const stemCounts = (snap) => {
  const defs = new Map();
  const counts = new Map();
  for (const d of snap.drugs.filter((x) => x.stem)) {
    const seen = new Set();
    for (const { stem, definition } of splitStems(d)) {
      if (seen.has(stem)) continue;
      seen.add(stem);
      counts.set(stem, (counts.get(stem) ?? 0) + 1);
      if (!defs.has(stem)) defs.set(stem, definition);
    }
  }
  return ranked(counts, 'stem').map((r) => ({ ...r, definition: defs.get(r.stem) }));
};

export const flagCounts = (snap) => ranked(count(snap.drugs.flatMap((d) => d.flags.map((flag) => ({ flag }))), (x) => x.flag), 'flag');

export const atcGroups = (snap) => ranked(count(snap.drugs.flatMap((d) => [...new Set(d.atc.map((a) => a[0]))].map((code) => ({ code }))), (x) => x.code), 'code')
  .map((r) => ({ code: r.code, name: snap.chembl.atc[r.code] ?? r.code, n: r.n }));

const approved = (snap) => {
  const types = count(snap.drugs, (d) => d.type);
  const antibodies = (types.get('Antibody') ?? 0) + (types.get('Antibody drug conjugate') ?? 0);
  const noun = antibodies === 1 ? 'an antibody or antibody–drug conjugate' : 'antibodies or antibody–drug conjugates';
  return `${release(snap)} counts ${exact(snap.drugs.length)} approved drugs; ${exact(types.get('Small molecule') ?? 0)} are small molecules and ${exact(antibodies)} ${noun}`;
};

const druglike = (snap) => {
  const list = smallMolecules(snap).filter((d) => d.p && d.p.ro5 !== null);
  const none = list.filter((d) => d.p.ro5 === 0).length;
  const two = list.filter((d) => d.p.ro5 >= 2).length;
  return `${pct(none / list.length)} of approved small molecules break none of Lipinski’s four rules; ${pct(two / list.length)} break two or more`;
};

const properties = (snap) => {
  const rows = complete(snap, propertyByDecade(snap, 'mw'));
  const [first, last] = [rows[0], rows.at(-1)];
  return `The median small molecule first approved in the ${last.decade}s weighs ${exact(last.summary.median)} Da; in the ${first.decade}s, ${exact(first.summary.median)} Da`;
};

const extremes = (snap) => {
  const list = smallMolecules(snap).filter((d) => d.p?.mw).sort((a, b) => a.p.mw - b.p.mw);
  const [light, heavy] = [list[0], list.at(-1)];
  return `Approved small molecules run from ${drugName(light.name)}, ${exact(light.p.mw)} Da, to ${drugName(heavy.name)}, ${exact(heavy.p.mw)} Da`;
};

const ringsFinding = (snap) => {
  const [top, next] = ringCounts(snap);
  return `${capital(top.name)} is in ${exact(top.n)} approved small molecules, ${pct(top.n / described(snap).length)} of those with a structure; ${next.name} is in ${exact(next.n)}`;
};

const atoms = (snap) => {
  const share = elementShares(snap).find((s) => s.el === 'F')?.share ?? 0;
  const last = complete(snap, elementByDecade(snap, 'F')).at(-1);
  return `Fluorine is in ${pct(share)} of approved small molecules, and in ${pct(last.share)} of those first approved in the ${last.decade}s`;
};

const stereo = (snap) => {
  const list = smallMolecules(snap).filter((d) => d.year >= 2010 && CHIRALITY[d.chirality]);
  const share = (k) => pct(list.filter((d) => CHIRALITY[d.chirality] === k).length / list.length);
  return `Of small molecules first approved since 2010, ${share('single')} are single stereoisomers and ${share('racemic')} racemates`;
};

const stems = (snap) => {
  const [top] = stemCounts(snap);
  const total = snap.drugs.filter((d) => d.stem).length;
  return `${exact(total)} approved drugs carry a USAN stem; ${top.stem}, ${top.definition.split(':')[0]}, is the commonest, on ${exact(top.n)}`;
};

const flags = (snap) => {
  const of = (flag) => flagCounts(snap).find((f) => f.flag === flag)?.n ?? 0;
  return `ChEMBL flags ${exact(of('boxed warning'))} approved drugs with a boxed warning and ${exact(of('withdrawn'))} as withdrawn somewhere`;
};

const atc = (snap) => {
  const [top] = atcGroups(snap);
  const none = snap.drugs.filter((d) => !d.atc.length).length;
  return `${capital(soften(top.name))} is the largest ATC group, with ${exact(top.n)} drugs; ${exact(none)} approved drugs have no ATC code`;
};

export const findings = (snap) => ({
  approved: approved(snap),
  druglike: druglike(snap),
  properties: properties(snap),
  extremes: extremes(snap),
  rings: ringsFinding(snap),
  atoms: atoms(snap),
  stereo: stereo(snap),
  stems: stems(snap),
  flags: flags(snap),
  atc: atc(snap),
});

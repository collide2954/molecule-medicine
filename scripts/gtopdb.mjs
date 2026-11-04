import { readCsv, records, stripTags } from './readers.mjs';

export const gtopdbVersion = (text) => String(text).match(/GtoPdb Version:\s*([\d.]+)/)?.[1] ?? null;

const rowsOf = (text) => records(readCsv(text, { skip: 1 }));

export const gtopdbTargets = (text) => {
  const byId = new Map();
  for (const r of rowsOf(text)) {
    const id = r['Target id'];
    if (!byId.has(id)) {
      byId.set(id, {
        id, type: r.Type, family: stripTags(r['Family name']), name: stripTags(r['Target name']), genes: [], orphan: /orphan/i.test(r['Family name']),
      });
    }
    const gene = r['HGNC symbol'];
    if (gene && !byId.get(id).genes.includes(gene)) byId.get(id).genes.push(gene);
  }
  return [...byId.values()];
};

const human = (text) => rowsOf(text).filter((r) => r['Target Species'] === 'Human');

export const gtopdbSummary = (targets, interactions) => {
  const rows = human(interactions);
  const seen = { ligand: new Set(), approved: new Set(), endogenous: new Set() };
  const endogenous = new Map();
  for (const r of rows) {
    const id = r['Target ID'];
    seen.ligand.add(id);
    if (r.Approved === 'true') seen.approved.add(id);
    if (r.Endogenous === 'true') {
      seen.endogenous.add(id);
      if (!endogenous.has(r['Ligand ID'])) endogenous.set(r['Ligand ID'], r['Ligand Type']);
    }
  }
  const types = {};
  for (const t of targets) {
    types[t.type] ??= { targets: 0, ligand: 0, approved: 0, endogenous: 0, orphans: 0 };
    const g = types[t.type];
    g.targets += 1;
    if (seen.ligand.has(t.id)) g.ligand += 1;
    if (seen.approved.has(t.id)) g.approved += 1;
    if (seen.endogenous.has(t.id)) g.endogenous += 1;
    if (t.orphan) g.orphans += 1;
  }
  const byType = {};
  for (const type of endogenous.values()) byType[type] = (byType[type] ?? 0) + 1;
  return { types, endogenous: byType, interactions: rows.length };
};

const number = (v) => (v === '' || v === undefined || v === null ? null : Number(v));

export const approvedAffinities = (targets, interactions) => {
  const typeOf = new Map(targets.map((t) => [t.id, t.type]));
  return human(interactions)
    .filter((r) => r.Approved === 'true' && r['Primary Target'] === 'true' && r['Affinity Units'] && r['Affinity Units'] !== '-')
    .map((r) => {
      const median = number(r['Affinity Median']);
      const hi = number(r['Affinity High']);
      const lo = number(r['Affinity Low']);
      const value = median ?? (hi !== null && lo !== null ? (hi + lo) / 2 : hi ?? lo);
      return {
        ligand: stripTags(r.Ligand), target: stripTags(r.Target), type: typeOf.get(r['Target ID']) ?? null, units: r['Affinity Units'], value, action: r.Action,
      };
    })
    .filter((r) => r.value !== null);
};

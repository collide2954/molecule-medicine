const byDegree = (degree) => (a, b) => degree.get(b) - degree.get(a) || a.localeCompare(b, 'en', { numeric: true });

export const drugTargetNetwork = (mechanisms, drugs, targets) => {
  const pairs = new Map();
  for (const m of mechanisms) {
    if (drugs.has(m.drug) && targets.has(m.target)) pairs.set(`${m.drug}|${m.target}`, [m.drug, m.target]);
  }
  const degree = new Map();
  for (const [d, t] of pairs.values()) {
    degree.set(d, (degree.get(d) ?? 0) + 1);
    degree.set(t, (degree.get(t) ?? 0) + 1);
  }
  const drugIds = [...new Set([...pairs.values()].map(([d]) => d))].sort(byDegree(degree));
  const targetIds = [...new Set([...pairs.values()].map(([, t]) => t))].sort(byDegree(degree));
  const nodes = [
    ...drugIds.map((id) => ({ id, kind: 'drug', ...drugs.get(id), degree: degree.get(id) })),
    ...targetIds.map((id) => ({ id, kind: 'target', ...targets.get(id), degree: degree.get(id) })),
  ];
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const edges = [...pairs.values()].map(([d, t]) => [index.get(d), index.get(t)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { nodes, edges };
};

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export const forceLayout = (n, edges, { iterations = 300, gravity = 0.04 } = {}) => {
  if (!n) return [];
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const r = Math.sqrt((i + 0.5) / n);
    x[i] = r * Math.cos(i * GOLDEN);
    y[i] = r * Math.sin(i * GOLDEN);
  }
  const k = Math.sqrt(4 / n);
  const cell = 2 * k;
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  let temperature = 0.1;
  for (let it = 0; it < iterations; it += 1) {
    dx.fill(0);
    dy.fill(0);
    const grid = new Map();
    for (let i = 0; i < n; i += 1) {
      const key = `${Math.floor(x[i] / cell)},${Math.floor(y[i] / cell)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }
    for (let i = 0; i < n; i += 1) {
      const gx = Math.floor(x[i] / cell);
      const gy = Math.floor(y[i] / cell);
      for (let ox = -1; ox <= 1; ox += 1) {
        for (let oy = -1; oy <= 1; oy += 1) {
          for (const j of grid.get(`${gx + ox},${gy + oy}`) ?? []) {
            if (j === i) continue;
            let ddx = x[i] - x[j];
            let ddy = y[i] - y[j];
            let d = Math.hypot(ddx, ddy);
            if (d < 1e-9) {
              ddx = ((i - j) % 7) * 1e-4;
              ddy = ((j - i) % 5) * 1e-4;
              d = Math.hypot(ddx, ddy) || 1e-4;
            }
            if (d > cell) continue;
            const f = (k * k) / d;
            dx[i] += (ddx / d) * f;
            dy[i] += (ddy / d) * f;
          }
        }
      }
    }
    for (const [a, b] of edges) {
      const ddx = x[a] - x[b];
      const ddy = y[a] - y[b];
      const d = Math.hypot(ddx, ddy) || 1e-9;
      const f = (d * d) / k;
      dx[a] -= (ddx / d) * f;
      dy[a] -= (ddy / d) * f;
      dx[b] += (ddx / d) * f;
      dy[b] += (ddy / d) * f;
    }
    for (let i = 0; i < n; i += 1) {
      dx[i] -= x[i] * gravity;
      dy[i] -= y[i] * gravity;
      const d = Math.hypot(dx[i], dy[i]);
      if (d > 0) {
        const step = Math.min(d, temperature);
        x[i] += (dx[i] / d) * step;
        y[i] += (dy[i] / d) * step;
      }
    }
    temperature = Math.max(0.002, temperature * 0.985);
  }
  const minX = Math.min(...x);
  const maxX = Math.max(...x);
  const minY = Math.min(...y);
  const maxY = Math.max(...y);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const offX = (span - (maxX - minX)) / 2;
  const offY = (span - (maxY - minY)) / 2;
  return Array.from({ length: n }, (_, i) => [Number(((x[i] - minX + offX) / span).toFixed(4)), Number(((y[i] - minY + offY) / span).toFixed(4))]);
};

export const components = (n, edges) => {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    let at = i;
    while (parent[at] !== r) {
      const next = parent[at];
      parent[at] = r;
      at = next;
    }
    return r;
  };
  for (const [a, b] of edges) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
  const groups = new Map();
  for (let i = 0; i < n; i += 1) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(i);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length || a[0] - b[0]);
};

const blockOf = (nodes, edges, iterations) => {
  const side = Math.sqrt(nodes.length);
  if (nodes.length === 1) return { nodes, side, pts: [[0.5, 0.5]] };
  if (nodes.length === 2) return { nodes, side, pts: [[0, 0.5], [1, 0.5]] };
  const local = new Map(nodes.map((v, i) => [v, i]));
  const sub = edges.filter(([a]) => local.has(a)).map(([a, b]) => [local.get(a), local.get(b)]);
  return { nodes, side, pts: forceLayout(nodes.length, sub, { iterations }) };
};

export const packedLayout = (n, edges, { iterations = 300, gap = 0.8 } = {}) => {
  if (!n) return [];
  const blocks = components(n, edges).map((nodes) => blockOf(nodes, edges, iterations));
  const width = Math.max(blocks[0].side + gap, Math.sqrt(blocks.reduce((s, b) => s + (b.side + gap) ** 2, 0)) * 1.2);
  const rows = [];
  let row = { items: [], width: 0, height: 0 };
  for (const b of blocks) {
    const s = b.side + gap;
    if (row.items.length && row.width + s > width) {
      rows.push(row);
      row = { items: [], width: 0, height: 0 };
    }
    row.items.push(b);
    row.width += s;
    row.height = Math.max(row.height, s);
  }
  rows.push(row);
  const out = new Array(n);
  let top = 0;
  for (const r of rows) {
    let left = (width - r.width) / 2;
    for (const b of r.items) {
      const s = b.side + gap;
      const ox = left + gap / 2;
      const oy = top + (r.height - s) / 2 + gap / 2;
      b.nodes.forEach((v, i) => {
        out[v] = [ox + b.pts[i][0] * b.side, oy + b.pts[i][1] * b.side];
      });
      left += s;
    }
    top += r.height;
  }
  const xs = out.map((p) => p[0]);
  const ys = out.map((p) => p[1]);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  return out.map(([px, py]) => [Number(((px - minX) / span).toFixed(4)), Number(((py - minY) / span).toFixed(4))]);
};

import {
  exact, compact, niceTicks, scaleLinear, scaleLog, logTicks, labelStep, waffle as waffleCells, stack, easeOut, spread, squarify, heat, spanTicks,
} from './lib.js';
import { hexbin } from './stats.js';
import { bondLines, atomLabel } from './chem.js';

const NS = 'http://www.w3.org/2000/svg';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export const el = (tag, attrs = {}, ...kids) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid !== null && kid !== undefined && kid !== false) node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
};

export const html = (tag, props = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid !== null && kid !== undefined && kid !== false) node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
};

const tipNode = () => document.getElementById('tip');

const clearMarks = () => {
  document.querySelectorAll('.chart .sel').forEach((n) => n.classList.remove('sel'));
  document.querySelectorAll('.chart .cross').forEach((c) => c.setAttribute('visibility', 'hidden'));
};

const place = (node, pageX, pageY) => {
  const w = node.offsetWidth;
  const h = node.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const minX = window.scrollX + 8;
  const maxX = window.scrollX + vw - w - 8;
  const maxY = window.scrollY + window.innerHeight - h - 8;
  let left = pageX + 14;
  if (left > maxX) left = pageX - w - 14;
  let top = pageY + 14;
  if (top > maxY) top = pageY - h - 14;
  node.style.left = `${Math.max(minX, Math.min(left, maxX))}px`;
  node.style.top = `${Math.max(window.scrollY + 8, top)}px`;
};

export const tip = {
  show(lines, pageX, pageY, pinned = false) {
    const node = tipNode();
    const close = pinned ? html('button', { type: 'button', class: 'tip-close', 'aria-label': 'Close' }, '×') : null;
    close?.addEventListener('click', () => tip.hide());
    node.replaceChildren(...lines, ...(close ? [close] : []));
    node.hidden = false;
    node.dataset.pinned = String(pinned);
    place(node, pageX, pageY);
  },
  hide() {
    const node = tipNode();
    node.hidden = true;
    node.dataset.pinned = 'false';
    clearMarks();
  },
  get pinned() {
    const node = tipNode();
    return !node.hidden && node.dataset.pinned === 'true';
  },
};

const installGlobal = () => {
  if (document.body.dataset.tipReady) return;
  document.body.dataset.tipReady = '1';
  document.addEventListener('click', (event) => {
    if (tip.pinned && !event.target.closest('#tip')) tip.hide();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') tip.hide();
  });
};

const tipLink = (href, text) => html('a', { href, target: '_blank', rel: 'noopener' }, `${text ?? 'Open the source'} ↗`);

export const tipLines = (value, label, ...extra) => [
  html('b', {}, value),
  html('span', {}, label),
  ...extra.filter(Boolean).map((e) => {
    if (e.nodeType) return e;
    if (e.href) return tipLink(e.href, e.text);
    return html('span', {}, e);
  }),
];

export const nearestMark = (root, cx, cy, axis) => {
  let best = null;
  let bestD = Infinity;
  for (const m of root.querySelectorAll('[data-k]')) {
    if (m.classList.contains('hit')) continue;
    const r = m.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    const d = axis === 'x'
      ? Math.abs(r.left + r.width / 2 - cx)
      : Math.hypot(Math.max(r.left - cx, 0, cx - r.right), Math.max(r.top - cy, 0, cy - r.bottom));
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return bestD <= (axis === 'x' ? 40 : 36) ? best : null;
};

const hover = (root, lookup, { axis, steps } = {}) => {
  installGlobal();
  const resolve = (event) => {
    const direct = event.target.closest?.('[data-k]');
    if (direct && root.contains(direct)) return direct;
    return Number.isFinite(event.clientX) ? nearestMark(root, event.clientX, event.clientY, axis) : null;
  };
  const select = (mark) => {
    clearMarks();
    mark.classList.add('sel');
  };
  root.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || tip.pinned) return;
    const mark = resolve(event);
    if (!mark) {
      tip.hide();
      return;
    }
    tip.show(lookup(mark.dataset.k, event, mark), event.pageX, event.pageY);
  });
  root.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && !tip.pinned) tip.hide();
  });
  root.addEventListener('click', (event) => {
    const mark = resolve(event);
    if (!mark) return;
    event.stopPropagation();
    event.preventDefault();
    select(mark);
    tip.show(lookup(mark.dataset.k, event, mark), event.pageX, event.pageY, true);
  });
  root.setAttribute('tabindex', '0');
  root.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home End Enter');
  root.querySelectorAll('[tabindex]').forEach((n) => n !== root && n.removeAttribute('tabindex'));
  const marks = () => [...root.querySelectorAll('[data-k]')]
    .filter((m) => !m.classList.contains('hit') && !m.closest('[visibility="hidden"]') && m.getAttribute('visibility') !== 'hidden')
    .map((m, i) => ({ m, rank: Number(m.dataset.rank ?? i) }))
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.m);
  let cursor = -1;
  const showAt = (i, pinned) => {
    if (steps) {
      const hit = root.querySelector('.hit');
      const out = lookup(hit.dataset.k, { index: i }, hit);
      const cross = root.querySelector('.cross');
      const r = (cross ?? root).getBoundingClientRect();
      tip.show(out, r.left + window.scrollX, r.top + window.scrollY + r.height / 3, pinned);
      return;
    }
    const m = marks()[i];
    if (!m) return;
    select(m);
    const r = m.getBoundingClientRect();
    tip.show(lookup(m.dataset.k, { index: i }, m), r.right + window.scrollX, r.top + window.scrollY, pinned);
  };
  const MOVES = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  root.addEventListener('keydown', (event) => {
    const count = steps ?? marks().length;
    if (!count) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showAt(Math.max(cursor, 0), true);
      return;
    }
    if (event.key in MOVES) cursor = Math.max(0, Math.min(count - 1, cursor + MOVES[event.key]));
    else if (event.key === 'Home') cursor = 0;
    else if (event.key === 'End') cursor = count - 1;
    else return;
    event.preventDefault();
    showAt(cursor, tip.pinned);
  });
  root.addEventListener('focus', () => {
    cursor = Math.max(cursor, 0);
    if (!tip.pinned) showAt(cursor, false);
  });
  root.addEventListener('blur', () => {
    if (!tip.pinned) tip.hide();
  });
};

const widthOf = (mount) => Math.round(Math.min(Math.max(mount.clientWidth || 800, 280), 1120));

const measureLines = (svg) => {
  for (const path of svg.querySelectorAll('.line')) {
    const len = Math.ceil(path.getTotalLength ? path.getTotalLength() : 2000);
    path.style.setProperty('--len', `${len}`);
  }
};

const mountSvg = (mount, svg, ...before) => {
  mount.replaceChildren(...before, svg);
  measureLines(svg);
  return svg;
};

const legendOf = (items) => html('ul', { class: 'legend' }, items.map((s) => html('li', {}, html('i', { style: `background:${s.color}` }), s.label)));

const noteAt = (cx, text, W) => {
  const tw = text.length * 6.8;
  if (cx + 6 + tw <= W) return { x: cx + 6, 'text-anchor': 'start' };
  if (cx - 6 - tw >= 0) return { x: cx - 6, 'text-anchor': 'end' };
  return { x: Math.max(0, W - tw), 'text-anchor': 'start' };
};

const barPath = (x, y, w, h) => {
  const r = Math.min(3, w / 2, h);
  const b = y + h;
  return `M${x},${b}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${b}Z`;
};

const fitsIn = (text, px) => String(text).length <= Math.max(4, Math.floor(px / 6.6));

const rowLayout = (rows, labelW, rowH) => {
  const fits = rows.every((r) => fitsIn(r.label, labelW));
  return fits
    ? { L: labelW + 10, rowH, labelY: 4, markY: 0, cls: 'rows' }
    : { L: 14, rowH: rowH + 16, labelY: -8, markY: 5, cls: 'rows stacked' };
};

const axisTicks = (lo, hi) => {
  const span = Math.max(hi, -lo);
  const step = niceTicks(span, 4)[1] ?? 1;
  const out = [];
  for (let t = Math.floor(lo / step) * step; t <= Math.ceil(hi / step) * step + step / 2; t += step) out.push(Number(t.toPrecision(12)));
  return out;
};

export const columns = ({
  mount, rows, key, value, attr = 'year', label = (r) => key(r), highlight = () => false, annotations = [], aria, describe, height = 220, yFormat = compact,
}) => {
  const W = widthOf(mount);
  const T = annotations.length ? 22 + annotations.length * 18 : 12;
  const L = 46;
  const B = 24;
  const H = height + T;
  const ticks = niceTicks(Math.max(...rows.map(value)), 4);
  const top = ticks.at(-1) || 1;
  const band = (W - L) / rows.length;
  const bw = Math.max(1, Math.min(band - 2, 26));
  const y = scaleLinear([0, top], [H - B, T]);
  const xAt = (i) => L + i * band + (band - bw) / 2;
  const widest = Math.max(...rows.map((r) => String(label(r)).length));
  const step = labelStep(rows.length, W - L, Math.max(34, widest * 6.6 + 12));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    ticks.map((t) => el('g', {},
      el('line', { class: t === 0 ? 'base' : 'grid', x1: L, x2: W, y1: y(t), y2: y(t) }),
      el('text', { class: 'tick', x: L - 8, y: y(t) + 4, 'text-anchor': 'end' }, yFormat(t)))),
    rows.map((r, i) => el('path', {
      class: `bar${highlight(r) ? ' hi' : ''}`,
      d: barPath(xAt(i), y(value(r)), bw, Math.max(0, H - B - y(value(r)))),
      [`data-${attr}`]: key(r),
      'data-k': i,
      style: `--i:${i}`,
    })),
    rows.map((r, i) => (i % step === 0 ? el('text', {
      class: 'tick', x: xAt(i) + bw / 2, y: H - 6, 'text-anchor': 'middle',
    }, label(r)) : null)),
    annotations.map((a, n) => {
      const i = rows.findIndex((r) => key(r) === a.key);
      if (i < 0) return null;
      const cx = xAt(i) + bw / 2;
      const ty = 14 + n * 18;
      return el('g', {},
        el('path', { class: 'note-line', d: `M${cx},${ty + 4}V${y(value(rows[i])) - 5}` }),
        el('text', { class: 'note', y: ty + 4, ...noteAt(cx, a.text, W) }, a.text));
    }));
  hover(svg, (k) => describe(rows[Number(k)], rows[Number(k) - 1]), { axis: 'x' });
  return mountSvg(mount, svg);
};

export const dotplot = ({
  mount, rows, attr = 'row', scale = 'log', format = exact, tickFormat = compact, describe, rowH = 24, href, linkText, labelShare = 0.34, labelMax = 240, aria,
}) => {
  const W = widthOf(mount);
  const R = 70;
  const T = 22;
  const base = rowLayout(rows, Math.min(labelMax, Math.max(96, W * labelShare)), rowH);
  const room = Math.floor((W - 8) / 6.6);
  const wraps = base.cls.includes('stacked') && rows.some((r) => String(r.label).length > room);
  const lay = wraps ? {
    ...base, rowH: base.rowH + 14, labelY: base.labelY + 7, markY: base.markY + 7,
  } : base;
  const { L } = lay;
  const labelOf = (label) => {
    const text = String(label);
    if (!wraps || text.length <= room) return text;
    const cut = text.lastIndexOf(' ', room);
    const at = cut > 0 ? cut : room;
    return [el('tspan', { x: 0, dy: -14 }, text.slice(0, at)), el('tspan', { x: 0, dy: 14 }, text.slice(at).trim())];
  };
  const H = T + rows.length * lay.rowH + 6;
  const values = rows.map((r) => r.value).filter((v) => v > 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const lo = scale === 'log' ? 10 ** Math.floor(Math.log10(min)) : 0;
  const hi = scale === 'log' ? 10 ** Math.ceil(Math.log10(max)) : niceTicks(max, 4).at(-1);
  const x = scale === 'log' ? scaleLog([lo, hi], [L, W - R]) : scaleLinear([0, hi], [L, W - R]);
  const spaced = (list) => list.reduce((kept, t) => {
    if (!kept.length || x(t) - x(kept.at(-1)) >= 40) kept.push(t);
    return kept;
  }, []);
  const ticks = spaced(scale === 'log' ? logTicks(lo, hi) : niceTicks(max, 4));
  const at = (v) => (v > 0 ? x(v) : L);
  const rowTop = (rank) => T + rank * lay.rowH + lay.rowH / 2;
  const rowsG = el('g', { class: lay.cls }, rows.map((r, i) => el('g', {
    [`data-${attr}`]: r.key,
    'data-row': attr === 'row' ? r.key : null,
    'data-k': i,
    'data-rank': i,
    transform: `translate(0 ${rowTop(i)})`,
  },
  el('rect', { class: 'row-hit', x: 0, y: -lay.rowH / 2, width: W, height: lay.rowH }),
  el('text', { class: 'lab', x: 0, y: lay.labelY }, labelOf(r.label)),
  el('line', { class: 'stem', x1: L, x2: at(r.value), y1: lay.markY, y2: lay.markY, style: `--i:${i}` }),
  el('circle', { class: `dot${r.hi ? ' hi' : ''}`, cx: at(r.value), cy: lay.markY, r: 4.5, style: `--i:${i}` }),
  el('text', { class: 'val', x: at(r.value) + 9, y: lay.markY + 4 }, format(r.value)))));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    ticks.map((t) => el('g', {},
      el('line', { class: 'grid', x1: x(t), x2: x(t), y1: T - 6, y2: H }),
      el('text', { class: 'tick', x: x(t), y: 10, 'text-anchor': 'middle' }, tickFormat(t)))),
    rowsG);
  hover(svg, (k) => {
    const r = rows[Number(k)];
    const out = describe(r);
    return href ? [...out, tipLink(href(r), linkText?.(r))] : out;
  });
  return mountSvg(mount, svg);
};

export const hbars = ({
  mount, rows, segments, aria, describe, format = exact, tickFormat = compact, labelShare = 0.16, rowH = 22, showSign = false, max, valueText, R = 78,
}) => {
  const W = widthOf(mount);
  const T = 22;
  const lay = rowLayout(rows, Math.min(150, Math.max(44, W * labelShare)), rowH);
  const { L } = lay;
  const H = T + rows.length * lay.rowH + 6;
  const totals = rows.map((r) => segments.reduce((n, s) => n + (r.values[s.key] ?? 0), 0));
  const ticks = axisTicks(Math.min(0, ...totals), max ?? Math.max(0, ...totals));
  const x = scaleLinear([ticks[0], ticks.at(-1)], [L, W - R]);
  const bh = Math.min(14, lay.rowH - 8);
  const text = (v) => (showSign && v > 0 ? `+${format(v)}` : v < 0 ? `−${format(-v)}` : format(v));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    ticks.map((t) => el('g', {},
      el('line', { class: t === 0 ? 'base' : 'grid', x1: x(t), x2: x(t), y1: T - 6, y2: H }),
      el('text', { class: 'tick', x: x(t), y: 10, 'text-anchor': 'middle' }, t < 0 ? `−${tickFormat(-t)}` : tickFormat(t)))),
    el('g', { class: lay.cls }, rows.map((r, i) => {
      const mid = T + i * lay.rowH + lay.rowH / 2;
      const y = mid + lay.markY;
      let acc = 0;
      const segs = segments.map((s) => {
        const v = r.values[s.key] ?? 0;
        if (!v) return null;
        const from = v > 0 ? acc : v;
        const to = v > 0 ? acc + v : 0;
        if (v > 0) acc += v;
        return el('rect', {
          class: `seg${v < 0 ? ' neg' : ''}`, x: x(from), y: y - bh / 2, width: Math.max(0.5, x(to) - x(from)), height: bh, style: `fill:${s.color};--i:${i}`,
        });
      });
      const total = totals[i];
      return el('g', { 'data-row': r.key, 'data-k': i, 'data-rank': i },
        el('rect', { class: 'row-hit', x: 0, y: mid - lay.rowH / 2, width: W, height: lay.rowH }),
        el('text', { class: 'lab', x: 0, y: mid + lay.labelY }, r.label),
        segs,
        el('text', { class: 'val', x: total < 0 ? x(0) + 6 : x(total) + 6, y: y + 4 }, valueText ? valueText(r, total) : text(total)));
    })));
  hover(svg, (k) => describe(rows[Number(k)]));
  return segments.length > 1 ? mountSvg(mount, svg, legendOf(segments)) : mountSvg(mount, svg);
};

export const rampLegend = (lo, hi, format, color = 'var(--ink)', steps = 5) => html('ul', { class: 'legend ramp' },
  Array.from({ length: steps }, (_, i) => {
    const v = lo + ((hi - lo) * i) / (steps - 1);
    return html('li', {}, html('i', { style: `background:${color};opacity:${heat(v, lo, hi)}` }), format(v));
  }));

export const heatmap = ({
  mount, labels, values, order, lo, hi, aria, describe, legend, color = 'var(--data)', labelMin = 10,
}) => {
  const W = widthOf(mount);
  const n = order.length;
  const labelW = Math.ceil(Math.max(...labels.map((l) => String(l).length)) * 5.3) + 10;
  const roomy = (W - labelW - 4) / n >= labelMin;
  const L = roomy ? labelW : 0;
  const side = Math.min(14, (W - L - 4) / n);
  const size = L + side * n;
  const flat = [];
  const svg = el('svg', { viewBox: `0 0 ${size} ${side * n}`, role: 'img', 'aria-label': aria, style: `max-width:${size}px` },
    roomy ? order.map((r, i) => el('text', {
      class: 'lab heat-lab', x: L - 6, y: i * side + side / 2 + 3.2, 'text-anchor': 'end',
    }, labels[r])) : null,
    order.flatMap((r, i) => order.map((c, j) => {
      const k = flat.push([r, c]) - 1;
      return el('rect', {
        class: 'cell', 'data-cell': `${r}:${c}`, 'data-k': k, 'data-rank': k, x: L + j * side, y: i * side, width: side + 0.25, height: side + 0.25, style: `fill:${color};fill-opacity:${heat(values[r][c], lo, hi)};--i:${i}`,
      });
    })));
  hover(svg, (k) => describe(...flat[Number(k)]));
  return mountSvg(mount, svg, legend);
};

const logAxis = (values, lo, hi) => {
  const positive = values.filter((v) => v > 0);
  const least = positive.length ? Math.min(...positive) : 1;
  const floor = 10 ** Math.floor(Math.log10(least)) / 2;
  const top = 10 ** Math.ceil(Math.log10(Math.max(...positive, 10)));
  const scale = scaleLog([floor, top], [lo, hi]);
  return { ticks: logTicks(floor, top), y: (v) => (v > floor ? scale(v) : lo) };
};

export const histo = ({
  mount, bins, series, aria, describe, tickLabel, tickEvery = 10, height = 200, yFormat = compact, centered = false, yLog = false,
}) => {
  const W = widthOf(mount);
  const L = 46;
  const R = 10;
  const T = 12;
  const B = 24;
  const H = height + T;
  const values = series.flatMap((s) => s.values);
  const lin = niceTicks(Math.max(...values, 1e-9), 4);
  const { ticks, y } = yLog ? logAxis(values, H - B, T) : { ticks: lin, y: scaleLinear([0, lin.at(-1)], [H - B, T]) };
  const band = (W - L - R) / bins.length;
  const bw = Math.max(0.6, (band - (band > 4 ? 1 : 0)) / series.length);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    yLog ? el('line', {
      class: 'base', x1: L, x2: W - R, y1: H - B, y2: H - B,
    }) : null,
    ticks.map((t) => el('g', {},
      el('line', { class: t === 0 ? 'base' : 'grid', x1: L, x2: W - R, y1: y(t), y2: y(t) }),
      el('text', { class: 'tick', x: L - 8, y: y(t) + 4, 'text-anchor': 'end' }, yFormat(t)))),
    bins.map((b, i) => el('g', { 'data-bin': i, 'data-k': i, 'data-rank': i },
      el('rect', { class: 'row-hit', x: L + i * band, y: T, width: band, height: H - T - B }),
      series.map((s, k) => el('rect', {
        class: 'bar', x: L + i * band + k * bw, y: y(s.values[i]), width: bw, height: Math.max(0, H - B - y(s.values[i])), style: `fill:${s.color};--i:${i}`,
      })))),
    bins.map((b, i) => (i % tickEvery === 0 && tickLabel(b, i) !== null ? el('text', {
      class: 'tick', x: L + i * band + (centered ? (bw * series.length) / 2 : 0), y: H - 6, 'text-anchor': 'middle',
    }, tickLabel(b, i)) : null)));
  hover(svg, (k) => describe(Number(k)), { axis: 'x' });
  return series.length > 1 ? mountSvg(mount, svg, legendOf(series)) : mountSvg(mount, svg);
};

export const stackedArea = ({
  mount, years, series, aria, format = exact, max = null, xFormat = (v) => v, xTick = (v) => v, xTicks = null,
}) => {
  const W = widthOf(mount);
  const L = 46;
  const R = 12;
  const T = 12;
  const B = 24;
  const H = 280;
  const rows = years.map((year, i) => Object.fromEntries([['year', year], ...series.map((s) => [s.key, s.values[i]])]));
  const layers = stack(rows, series.map((s) => s.key));
  const totals = rows.map((r) => series.reduce((n, s) => n + r[s.key], 0));
  const ticks = niceTicks(max ?? Math.max(...totals), 4);
  const x = scaleLinear([years[0], years.at(-1)], [L, W - R]);
  const y = scaleLinear([0, ticks.at(-1)], [H - B, T]);
  const area = (points) => {
    const upper = points.map(([, y1], i) => `${x(years[i]).toFixed(1)},${y(y1).toFixed(1)}`);
    const lower = points.map(([y0], i) => `${x(years[i]).toFixed(1)},${y(y0).toFixed(1)}`).reverse();
    return `M${upper.join('L')}L${lower.join('L')}Z`;
  };
  const step = labelStep(years.length, W - L, 40);
  const cross = el('line', { class: 'cross', y1: T, y2: H - B, x1: 0, x2: 0, visibility: 'hidden' });
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    ticks.map((t) => el('g', {},
      el('line', { class: t === 0 ? 'base' : 'grid', x1: L, x2: W - R, y1: y(t), y2: y(t) }),
      el('text', { class: 'tick', x: L - 8, y: y(t) + 4, 'text-anchor': 'end' }, compact(t)))),
    layers.map((layer, i) => el('path', {
      class: 'area', 'data-key': layer.key, d: area(layer.points), style: `fill:${series[i].color};--i:${i * 8}`,
    })),
    (xTicks ?? years.filter((yr) => yr % step === 0)).map((yr) => el('text', {
      class: 'tick', x: x(yr), y: H - 6, 'text-anchor': 'middle',
    }, xTick(yr))),
    cross,
    el('rect', { class: 'hit', 'data-k': 0, x: L, y: T, width: W - L - R, height: H - T - B }));
  hover(svg, (k, event) => {
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX ?? box.left + box.width / 2) - box.left) * (W / box.width);
    const i = event.index ?? Math.max(0, Math.min(years.length - 1, Math.round(((px - L) / (W - L - R)) * (years.length - 1))));
    cross.setAttribute('x1', x(years[i]));
    cross.setAttribute('x2', x(years[i]));
    cross.setAttribute('visibility', 'visible');
    return [
      html('b', {}, `${xFormat(years[i])}: ${format(totals[i])}`),
      ...[...series].reverse().map((s) => html('span', {}, html('i', { style: `background:${s.color}` }), `${s.label} ${format(rows[i][s.key])}`)),
    ];
  }, { steps: years.length });
  return mountSvg(mount, svg, legendOf(series));
};

export const waffle = ({ mount, parts, aria, format = exact }) => {
  const total = parts.reduce((n, p) => n + p.value, 0);
  const cells = waffleCells(parts.map((p, i) => ({ key: i, value: p.value })));
  const side = Math.min(widthOf(mount), 300) / 10;
  const gap = 2;
  const svg = el('svg', { viewBox: `0 0 ${side * 10} ${side * 10}`, role: 'img', 'aria-label': aria, style: `max-width:${side * 10}px` },
    cells.map((k, n) => el('rect', {
      class: 'cell',
      x: (n % 10) * side,
      y: Math.floor(n / 10) * side,
      width: side - gap,
      height: side - gap,
      'data-k': k,
      style: `fill:${parts[k].color};--i:${n}`,
    })));
  hover(svg, (k) => {
    const p = parts[Number(k)];
    return tipLines(`${((p.value / total) * 100).toFixed(1)}%`, p.label, format(p.value));
  });
  mount.replaceChildren(svg, legendOf(parts.map((p) => ({ label: `${p.label} ${((p.value / total) * 100).toFixed(1)}%`, color: p.color }))));
  return svg;
};

export const treemap = ({ mount, items, height, aria, describe }) => {
  const W = widthOf(mount);
  const H = height ?? Math.round(Math.min(460, Math.max(260, W * 0.5)));
  const rects = squarify(items, W, H);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    rects.map((r, i) => el('g', { 'data-key': r.key, 'data-k': items.findIndex((it) => it.key === r.key) },
      el('rect', { class: 'cell', x: r.x, y: r.y, width: Math.max(0, r.w - 1), height: Math.max(0, r.h - 1), style: `fill:${r.color ?? 'var(--data-2)'};--i:${i * 3}` }),
      r.w > 46 && r.h > 22 ? el('text', { class: 'tile-lab', x: r.x + 7, y: r.y + 17 }, r.label) : null,
      r.w > 74 && r.h > 40 ? el('text', { class: 'tile-sub', x: r.x + 7, y: r.y + 33 }, r.sub) : null)));
  hover(svg, (k) => describe(items[Number(k)]));
  return mountSvg(mount, svg);
};

export const lines = ({
  mount, series, aria, describe, annotations = [], scale = 'log', yFormat = compact, height = 280, labelW = 92, logStep = 3,
}) => {
  const W = widthOf(mount);
  const L = 46;
  const R = labelW;
  const T = 16 + annotations.length * 18;
  const B = 24;
  const H = height;
  const xs = [...new Set(series.flatMap((s) => s.rows.map((r) => r.x)))].sort((a, b) => a - b);
  const log = scale === 'log';
  const all = series.flatMap((s) => s.rows.map((r) => r.y));
  const ys = all.filter((v) => v > 0);
  const neg = log ? 0 : Math.min(0, ...all);
  const up = niceTicks(Math.max(...ys), 4);
  const unit = up[1] ?? 1;
  const down = neg < 0 ? Array.from({ length: Math.ceil(-neg / unit) }, (_, i) => -(i + 1) * unit).reverse() : [];
  const lo = log ? 10 ** Math.floor(Math.log10(Math.min(...ys))) : (down[0] ?? 0);
  const hi = log ? 10 ** Math.ceil(Math.log10(Math.max(...ys))) : up.at(-1);
  const x = scaleLinear([xs[0], xs.at(-1)], [L, W - R]);
  const y = log ? scaleLog([lo, hi], [H - B, T]) : scaleLinear([lo, hi], [H - B, T]);
  const ticks = log ? logTicks(lo, hi).filter((t) => Math.round(Math.log10(t)) % logStep === 0) : [...down, ...up];
  const dx = xs.length > 1 ? Math.min(...xs.slice(1).map((v, k) => v - xs[k])) : 1;
  const step = labelStep(Math.round((xs.at(-1) - xs[0]) / dx) + 1, W - L - R, 40);
  const labelY = spread(series.map((s) => y(s.rows.at(-1).y)), 14, T, H - B);
  const cross = el('line', { class: 'cross', y1: T, y2: H - B, x1: 0, x2: 0, visibility: 'hidden' });
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    ticks.map((t) => el('g', {},
      el('line', { class: t === 0 && lo < 0 ? 'base' : 'grid', x1: L, x2: W - R, y1: y(t), y2: y(t) }),
      el('text', { class: 'tick', x: L - 8, y: y(t) + 4, 'text-anchor': 'end' }, yFormat(t)))),
    el('line', { class: 'base', x1: L, x2: W - R, y1: H - B, y2: H - B }),
    xs.map((v) => ((v - xs[0]) % (step * dx) === 0 ? el('text', { class: 'tick', x: x(v), y: H - 6, 'text-anchor': 'middle' }, v) : null)),
    series.map((s, n) => {
      const last = s.rows.at(-1);
      const ly = labelY[n];
      const moved = Math.abs(ly - y(last.y)) > 2;
      return el('g', {},
        el('path', { class: `line${s.alt ? ' alt' : ''}`, d: `M${s.rows.filter((r) => !log || r.y > 0).map((r) => `${x(r.x).toFixed(1)},${y(r.y).toFixed(1)}`).join('L')}`, style: s.color ? `stroke:${s.color}` : null }),
        moved ? el('path', { class: 'leader', d: `M${x(last.x) + 2},${y(last.y)}L${x(last.x) + 7},${ly}` }) : null,
        el('text', { class: 'lab', x: x(last.x) + (moved ? 10 : 8), y: ly + 4 }, s.label));
    }),
    annotations.map((a, n) => {
      const s = series[a.series ?? 0];
      const r = s.rows.find((p) => p.x === a.x);
      if (!r) return null;
      const ty = 14 + n * 18;
      return el('g', {},
        el('path', { class: 'note-line', d: `M${x(r.x)},${ty + 4}V${y(r.y) - 6}` }),
        el('text', { class: 'note', y: ty + 4, ...noteAt(x(r.x), a.text, W) }, a.text));
    }),
    cross,
    el('rect', { class: 'hit', 'data-k': 0, x: L, y: T, width: W - L - R, height: H - T - B }));
  hover(svg, (k, event) => {
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX ?? box.left + box.width / 2) - box.left) * (W / box.width);
    const i = event.index ?? Math.max(0, Math.min(xs.length - 1, Math.round(((px - L) / (W - L - R)) * (xs.length - 1))));
    cross.setAttribute('x1', x(xs[i]));
    cross.setAttribute('x2', x(xs[i]));
    cross.setAttribute('visibility', 'visible');
    return describe(xs[i]);
  }, { steps: xs.length });
  return mountSvg(mount, svg);
};

const hexPath = (cx, cy, r) => `M${Array.from({ length: 6 }, (_, k) => {
  const a = (Math.PI / 3) * k + Math.PI / 6;
  return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
}).join('L')}Z`;

export const hexmap = ({
  mount, points, xDomain, yDomain, aria, describe, xLabel, yLabel, box, boxLabel, xFormat = compact, yFormat = compact, height = 320, radius = 8,
}) => {
  const W = widthOf(mount);
  const L = 46;
  const R = 16;
  const T = 18;
  const B = 34;
  const H = height;
  const xt = spanTicks(xDomain[0], xDomain[1]);
  const yt = spanTicks(yDomain[0], yDomain[1]);
  const x = scaleLinear([xt[0], xt.at(-1)], [L + radius, W - R - radius]);
  const y = scaleLinear([yt[0], yt.at(-1)], [H - B - radius, T + radius]);
  const inside = points.filter((p) => p.x >= xDomain[0] && p.x <= xDomain[1] && p.y >= yDomain[0] && p.y <= yDomain[1]);
  const bins = hexbin(inside.map((p) => [x(p.x), y(p.y)]), radius);
  const most = Math.max(...bins.map((b) => b.n));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    yt.map((t) => el('g', {},
      el('line', { class: 'grid', x1: L, x2: W - R, y1: y(t), y2: y(t) }),
      el('text', { class: 'tick', x: L - 8, y: y(t) + 4, 'text-anchor': 'end' }, yFormat(t)))),
    xt.map((t) => el('g', {},
      el('line', { class: 'grid', x1: x(t), x2: x(t), y1: T, y2: H - B }),
      el('text', { class: 'tick', x: x(t), y: H - B + 16, 'text-anchor': 'middle' }, xFormat(t)))),
    xLabel ? el('text', { class: 'axis-lab', x: W - R, y: H - 4, 'text-anchor': 'end' }, xLabel) : null,
    yLabel ? el('text', { class: 'axis-lab', x: L, y: T - 6 }, yLabel) : null,
    bins.map((b, k) => el('g', { 'data-hex': `${b.i},${b.j}`, 'data-k': k, 'data-rank': k },
      el('path', { class: 'hex', d: hexPath(b.x, b.y, radius), style: `fill-opacity:${heat(Math.log1p(b.n), 0, Math.log1p(most))};--i:${k % 60}` }))),
    box ? el('rect', {
      class: 'ro5', x: x(xt[0]) - radius, y: y(box.y), width: x(box.x) - x(xt[0]) + radius, height: y(yt[0]) + radius - y(box.y),
    }) : null,
    box && boxLabel ? el('text', { class: 'ro5-lab', x: x(box.x) - 4, y: y(box.y) - 6, 'text-anchor': 'end' }, boxLabel) : null);
  hover(svg, (k) => describe(bins[Number(k)].members.map((m) => inside[m]), bins[Number(k)]));
  const steps = [...new Set(Array.from({ length: 5 }, (_, k) => Math.max(1, Math.round(Math.exp((Math.log(most) * k) / 4)))))];
  const legend = html('ul', { class: 'legend ramp' }, steps.map((v) => html('li', {}, html('i', { style: `background:var(--ink);opacity:${heat(Math.log1p(v), 0, Math.log1p(most))}` }), exact(v))));
  return mountSvg(mount, svg, legend);
};

export const boxes = ({
  mount, rows, aria, describe, yFormat = compact, height = 210, attr = 'decade',
}) => {
  const W = widthOf(mount);
  const L = 42;
  const R = 8;
  const T = 12;
  const B = 34;
  const H = height + T + B;
  const yt = spanTicks(Math.min(...rows.map((r) => r.lo)), Math.max(...rows.map((r) => r.hi)));
  const y = scaleLinear([yt[0], yt.at(-1)], [H - B, T]);
  const band = (W - L - R) / rows.length;
  const bw = Math.min(band * 0.6, 34);
  const step = labelStep(rows.length, W - L - R, 36);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    yt.map((t) => el('g', {},
      el('line', { class: 'grid', x1: L, x2: W - R, y1: y(t), y2: y(t) }),
      el('text', { class: 'tick', x: L - 6, y: y(t) + 4, 'text-anchor': 'end' }, yFormat(t)))),
    rows.map((r, i) => {
      const cx = L + i * band + band / 2;
      return el('g', { [`data-${attr}`]: r.key, 'data-k': i, 'data-rank': i },
        el('rect', { class: 'row-hit', x: L + i * band, y: T, width: band, height: H - T - B }),
        el('line', { class: 'whisker', x1: cx, x2: cx, y1: y(r.hi), y2: y(r.lo) }),
        el('line', { class: 'whisker', x1: cx - bw / 4, x2: cx + bw / 4, y1: y(r.hi), y2: y(r.hi) }),
        el('line', { class: 'whisker', x1: cx - bw / 4, x2: cx + bw / 4, y1: y(r.lo), y2: y(r.lo) }),
        el('rect', { class: 'box', x: cx - bw / 2, y: y(r.q3), width: bw, height: Math.max(1, y(r.q1) - y(r.q3)), style: `--i:${i}` }),
        el('line', { class: 'median', x1: cx - bw / 2, x2: cx + bw / 2, y1: y(r.median), y2: y(r.median) }),
        i % step === 0 ? el('text', { class: 'tick', x: cx, y: H - B + 15, 'text-anchor': 'middle' }, r.label) : null,
        i % step === 0 ? el('text', { class: 'n-lab', x: cx, y: H - B + 28, 'text-anchor': 'middle' }, `n ${exact(r.n)}`) : null);
    }));
  hover(svg, (k) => describe(rows[Number(k)]), { axis: 'x' });
  return mountSvg(mount, svg);
};

const molScale = (mol) => {
  const lengths = mol.bonds.map((b) => Math.hypot(mol.atoms[b.a].x - mol.atoms[b.b].x, mol.atoms[b.a].y - mol.atoms[b.b].y)).sort((a, b) => a - b);
  return lengths[Math.floor(lengths.length / 2)] || 1;
};

const subset = (mol, keep) => {
  if (!keep) return mol;
  const index = new Map(keep.map((a, i) => [a, i]));
  return {
    atoms: keep.map((a) => mol.atoms[a]),
    bonds: mol.bonds.filter((b) => index.has(b.a) && index.has(b.b)).map((b) => ({ ...b, a: index.get(b.a), b: index.get(b.b) })),
  };
};

export const drawMol = (whole, {
  x0, y0, w, h, atoms, maxBond = 22,
}) => {
  const mol = subset(whole, atoms);
  const xs = mol.atoms.map((a) => a.x);
  const ys = mol.atoms.map((a) => a.y);
  const bond = molScale(mol);
  const spanX = Math.max(Math.max(...xs) - Math.min(...xs), bond);
  const spanY = Math.max(Math.max(...ys) - Math.min(...ys), bond);
  const s = Math.min((w - 14) / spanX, (h - 14) / spanY, maxBond / bond);
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const my = (Math.max(...ys) + Math.min(...ys)) / 2;
  const px = (v) => x0 + w / 2 + (v - mx) * s;
  const py = (v) => y0 + h / 2 - (v - my) * s;
  const labels = mol.atoms.map((_, i) => atomLabel(mol, i));
  const clear = bond * 0.32;
  const trimmed = (seg) => {
    const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
    if (len < clear * 2.2) return seg;
    const ux = (seg.x2 - seg.x1) / len;
    const uy = (seg.y2 - seg.y1) / len;
    const a = labels[seg.a] ? clear : 0;
    const b = labels[seg.b] ? clear : 0;
    return { ...seg, x1: seg.x1 + ux * a, y1: seg.y1 + uy * a, x2: seg.x2 - ux * b, y2: seg.y2 - uy * b };
  };
  const shapes = bondLines(mol).map(trimmed).map((seg) => {
    if (seg.kind === 'wedge' || seg.kind === 'hash') {
      const dx = px(seg.x2) - px(seg.x1);
      const dy = py(seg.y2) - py(seg.y1);
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * 3;
      const ny = (dx / len) * 3;
      if (seg.kind === 'wedge') return el('path', { class: 'bond wedge', d: `M${px(seg.x1)},${py(seg.y1)}L${px(seg.x2) + nx},${py(seg.y2) + ny}L${px(seg.x2) - nx},${py(seg.y2) - ny}Z` });
      return el('g', { class: 'bond hash' }, Array.from({ length: 6 }, (_, k) => {
        const t = (k + 1) / 6;
        const cx = px(seg.x1) + dx * t;
        const cy = py(seg.y1) + dy * t;
        return el('line', { class: 'bond', x1: cx + nx * t, y1: cy + ny * t, x2: cx - nx * t, y2: cy - ny * t });
      }));
    }
    return el('line', { class: `bond${seg.kind === 'wavy' ? ' wavy' : ''}`, x1: px(seg.x1).toFixed(1), y1: py(seg.y1).toFixed(1), x2: px(seg.x2).toFixed(1), y2: py(seg.y2).toFixed(1) });
  });
  const texts = mol.atoms.map((a, i) => (labels[i] ? el('text', {
    class: `atom el-${a.el.toLowerCase()}`, x: px(a.x).toFixed(1), y: (py(a.y) + 4).toFixed(1), 'text-anchor': 'middle',
  }, labels[i]) : null));
  return [...shapes, ...texts];
};

export const molgrid = ({
  mount, items, aria, describe, minCell = 150,
}) => {
  const W = widthOf(mount);
  const cols = Math.max(2, Math.min(6, Math.floor(W / minCell)));
  const cw = W / cols;
  const ch = Math.round(cw * 0.78);
  const rowH = ch + 34;
  const H = Math.ceil(items.length / cols) * rowH;
  const room = Math.floor((cw - 8) / 6.4);
  const fit = (s) => (String(s).length > room ? `${String(s).slice(0, room - 1)}…` : String(s));
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    items.map((item, i) => {
      const x0 = (i % cols) * cw;
      const y0 = Math.floor(i / cols) * rowH;
      return el('g', { 'data-mol': item.key, 'data-k': i, 'data-rank': i },
        el('rect', { class: 'mol-frame', x: x0 + 3, y: y0 + 3, width: cw - 6, height: rowH - 6, rx: 3 }),
        drawMol(item.mol, { x0: x0 + 4, y0: y0 + 4, w: cw - 8, h: ch - 4, atoms: item.atoms }),
        el('text', { class: 'mol-lab', x: x0 + cw / 2, y: y0 + ch + 12, 'text-anchor': 'middle' }, fit(item.label)),
        item.sub ? el('text', { class: 'mol-sub', x: x0 + cw / 2, y: y0 + ch + 26, 'text-anchor': 'middle' }, fit(item.sub)) : null);
    }));
  hover(svg, (k) => describe(items[Number(k)]));
  return mountSvg(mount, svg);
};

export const observeFigures = () => {
  const figs = [...document.querySelectorAll('.fig')];
  if (reduced() || !('IntersectionObserver' in window)) {
    figs.forEach((f) => f.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.15 });
  figs.forEach((f) => io.observe(f));
};

export const countUp = (node, value, format = exact) => {
  if (reduced() || !('IntersectionObserver' in window)) {
    node.textContent = format(value);
    return;
  }
  node.textContent = format(0);
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 1500);
      node.textContent = format(Math.round(value * easeOut(t)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  io.observe(node);
};

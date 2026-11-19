import { h, s } from '../core/dom.js';
import { animate, stagger, DUR, EASE } from './anim.js';
// data: { rails, cols, cells: [{r,c,ch}], active?: [r,c][], caption?, pattern?: rowIndexPerColumn[] }
// Cells persist between steps (update), so new letters visibly drop onto their rail, the zigzag path
// draws forward as far as letters have been written, and a rail being read lights up left to right.
const U = 20; // SVG units per grid track (one track = 2em)

const key = (r, c) => `${r},${c}`;

/** How many zigzag segments to draw: everything for the pattern/read steps, else up to the last letter written in order. */
function drawnSegments(d) {
  const segs = Math.max(0, d.cols - 1);
  if (d.pattern) return segs;
  const filled = d.cells.filter((x) => x.ch).map((x) => x.c).sort((a, b) => a - b);
  if (!filled.length) return 0;
  const isPrefix = filled.every((c, i) => c === i);
  return isPrefix ? Math.min(segs, filled[filled.length - 1]) : segs;
}

function sync(el, d, animateChange) {
  const st = el._rf;
  const active = new Set((d.active || []).map(([r, c]) => key(r, c)));
  const dropped = [], lit = [];
  for (const cell of [...d.cells].sort((a, b) => a.c - b.c)) {
    const node = st.cells[cell.c];
    const was = st.prev[cell.c] || { ch: '', hl: false };
    const hl = active.has(key(cell.r, cell.c));
    node.className = `cell${cell.ch ? '' : ' is-slot'}${hl ? ' is-hl' : ''}`;
    node.textContent = cell.ch || '·';
    if (cell.ch && !was.ch) dropped.push(node);
    else if (hl && !was.hl) lit.push(node);
    st.prev[cell.c] = { ch: cell.ch, hl };
  }
  // Zigzag path: resting state shows `n` segments.
  const n = drawnSegments(d), total = Math.max(1, d.cols - 1);
  st.path.style.strokeDashoffset = String(total - n);
  if (animateChange && n !== st.drawn) {
    animate(st.path, [{ strokeDashoffset: total - st.drawn }, { strokeDashoffset: total - n }],
      { duration: Math.min(DUR.travel, 140 + 90 * Math.abs(n - st.drawn)), easing: EASE.inOut, reduce: 'none' });
  }
  st.drawn = n;
  if (animateChange) {
    stagger(dropped, [{ opacity: 0, transform: 'translateY(-1.6em) scale(.8)' }, { opacity: 1, transform: 'translateY(.12em)', offset: 0.75 }, { opacity: 1, transform: 'none' }],
      { duration: 450, each: 110, maxTotal: 600, easing: EASE.out });
    stagger(lit, [{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.5 }, { transform: 'scale(1)' }],
      { duration: DUR.base, each: 70, maxTotal: 800, reduce: 'none' });
  }
  const cap = el.querySelector('figcaption');
  cap.textContent = d.caption || '';
  cap.hidden = !d.caption;
}

export default {
  type: 'railFence',
  render(d) {
    const grid = h('div', { class: 'rf-grid', style: { gridTemplateColumns: `repeat(${d.cols}, 2em)`, gridTemplateRows: `repeat(${d.rails}, 2em)` } });
    const order = [...d.cells].sort((a, b) => a.c - b.c);
    const pts = order.map((x) => `${x.c * U + U / 2},${x.r * U + U / 2}`).join(' ');
    const total = Math.max(1, d.cols - 1);
    const path = s('polyline', { points: pts, class: 'rf-zigzag', pathLength: total });
    path.style.strokeDasharray = `${total} ${total}`;
    const svg = s('svg', { class: 'rf-path', viewBox: `0 0 ${d.cols * U} ${d.rails * U}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' }, path);
    grid.append(svg);
    const cells = {};
    for (const cell of d.cells) {
      cells[cell.c] = h('span', { style: { gridRow: cell.r + 1, gridColumn: cell.c + 1 } });
      grid.append(cells[cell.c]);
    }
    const el = h('figure', { class: 'v-railfence' },
      h('div', { class: 'rf-wrap' }, h('div', { class: 'rf-labels', style: { gridTemplateRows: `repeat(${d.rails}, 2em)` } }, Array.from({ length: d.rails }, (_, i) => h('span', {}, `Rail ${i + 1}`))), grid),
      h('figcaption', { class: 'mono' }));
    el._rf = { rails: d.rails, cols: d.cols, cells, path, prev: {}, drawn: 0 };
    sync(el, d, true); // first view: path draws from the left, any letters drop in
    return el;
  },
  update(el, d) {
    const st = el._rf;
    if (!st || st.rails !== d.rails || st.cols !== d.cols) return false; // different fence → fresh render
    sync(el, d, true);
    return true;
  },
};

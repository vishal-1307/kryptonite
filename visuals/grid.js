import { h, s } from '../core/dom.js';
import { animate, stagger, pop, DUR, EASE } from './anim.js';
// Letter grid (e.g. Playfair 5×5). data: { cells: string[][], primary?: [r,c][], secondary?: [r,c][], caption? }
// The grid persists between steps (update). For a digraph step (2 primary + 2 secondary cells) it plays a short
// sequence: the input pair pops → the rule shape draws (row band, column band or rectangle) → arrows draw from
// each input letter to its replacement → the output letters appear. The rule is read from the cell geometry only.
const has = (list, r, c) => (list || []).some(([a, b]) => a === r && b === c);

function ruleOf(d) {
  const p = d.primary || [], o = d.secondary || [];
  if (p.length !== 2 || o.length !== 2) return null;
  const [[r1, c1], [r2, c2]] = p;
  return r1 === r2 ? 'row' : c1 === c2 ? 'column' : 'rectangle';
}

function center(box, node) { return [node.offsetLeft + node.offsetWidth / 2, node.offsetTop + node.offsetHeight / 2]; }

/** Curved arrow from a to b (cell centres); bends to one side and starts/ends at the cell edges. */
function arrowPath(a, b, bendSign, cell) {
  const [x0, y0] = a, [x1, y1] = b;
  const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist, ny = dx / dist;
  const bend = Math.max(cell * 1.3, dist * 0.35) * bendSign;
  const cx = (x0 + x1) / 2 + nx * bend, cy = (y0 + y1) / 2 + ny * bend;
  const toward = (x, y, tx, ty, r) => { const l = Math.hypot(tx - x, ty - y) || 1; return [x + ((tx - x) / l) * r, y + ((ty - y) / l) * r]; };
  const r = cell * 0.55;
  const [sx, sy] = toward(x0, y0, cx, cy, r), [ex, ey] = toward(x1, y1, cx, cy, r + 3);
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

function drawOverlay(el, d, animated) {
  const st = el._g;
  const box = st.box;
  st.under.replaceChildren(); st.over.replaceChildren();
  const W = box.clientWidth, H = box.clientHeight;
  if (!W) return;
  st.size = `${W}x${H}`;
  for (const svg of [st.under, st.over]) svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  st.over.append(s('defs', {}, s('marker', { id: st.markerId, viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' },
    s('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'pf-arrowhead' }))));
  const rule = ruleOf(d);
  if (!rule) return;
  const node = (r, c) => st.nodes[r][c];
  const cell = node(0, 0).offsetWidth;
  const pad = 5;
  const [[r1, c1], [r2, c2]] = d.primary;
  let shape;
  if (rule === 'row') {
    const a = node(r1, 0), b = node(r1, 4);
    shape = s('rect', { x: a.offsetLeft - pad, y: a.offsetTop - pad, width: b.offsetLeft + b.offsetWidth - a.offsetLeft + 2 * pad, height: a.offsetHeight + 2 * pad, rx: 12, class: 'pf-band', pathLength: 1 });
  } else if (rule === 'column') {
    const a = node(0, c1), b = node(4, c1);
    shape = s('rect', { x: a.offsetLeft - pad, y: a.offsetTop - pad, width: a.offsetWidth + 2 * pad, height: b.offsetTop + b.offsetHeight - a.offsetTop + 2 * pad, rx: 12, class: 'pf-band', pathLength: 1 });
  } else {
    const [xa, ya] = center(box, node(Math.min(r1, r2), Math.min(c1, c2)));
    const [xb, yb] = center(box, node(Math.max(r1, r2), Math.max(c1, c2)));
    shape = s('rect', { x: xa, y: ya, width: xb - xa, height: yb - ya, rx: 4, class: 'pf-rect', pathLength: 1 });
  }
  st.under.append(shape);
  const arrows = d.primary.map(([r, c], i) => {
    const [or, oc] = d.secondary[i];
    const bend = rule === 'column' ? (i ? -1 : 1) : (rule === 'row' ? -1 : (i ? 1 : -1));
    return s('path', { d: arrowPath(center(box, node(r, c)), center(box, node(or, oc)), bend, cell), class: 'pf-arrow', pathLength: 1, 'marker-end': `url(#${st.markerId})` });
  });
  st.over.append(...arrows);
  if (!animated) return;
  // Sequence (all delays; settle() jumps straight to the end state).
  const tShape = 220, tArrow = tShape + DUR.base, tOut = tArrow + DUR.slow;
  const draw = [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }];
  animate(shape, draw, { duration: DUR.slow, delay: tShape, easing: EASE.inOut });
  arrows.forEach((a, i) => animate(a, draw, { duration: DUR.slow, delay: tArrow + i * 120, easing: EASE.inOut }));
  d.primary.forEach(([r, c]) => pop(node(r, c)));
  d.secondary.forEach(([r, c], i) => animate(node(r, c), [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.12)', offset: 0.7 }, { opacity: 1, transform: 'none' }],
    { duration: DUR.base, delay: tOut + i * 120 }));
  animate(el.querySelector('figcaption'), [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: DUR.base, delay: tShape });
}

let uid = 0;
function sync(el, d) {
  const st = el._g;
  const rule = ruleOf(d);
  const lit = [];
  d.cells.forEach((row, r) => row.forEach((ch, c) => {
    const n = st.nodes[r][c];
    const hl = has(d.primary, r, c), out = has(d.secondary, r, c);
    if (hl && !n.classList.contains('is-hl')) lit.push(n);
    n.className = `cell${hl ? ' is-hl' : ''}${out ? ' is-out' : ''}`;
    n.textContent = ch === 'I' ? 'I/J' : ch;
  }));
  const cap = el.querySelector('figcaption');
  cap.textContent = d.caption ? (rule ? `Rule: ${d.caption}` : d.caption) : '';
  cap.hidden = !d.caption;
  cap.className = rule ? `pf-rule rule-${rule}` : '';
  return { rule, lit };
}

export default {
  type: 'grid',
  render(d) {
    const nodes = d.cells.map((row) => row.map(() => h('span', { class: 'cell' })));
    const under = s('svg', { class: 'pf-layer pf-under', 'aria-hidden': 'true' });
    const over = s('svg', { class: 'pf-layer pf-over', 'aria-hidden': 'true' });
    const box = h('div', { class: 'grid-box', style: { gridTemplateColumns: `repeat(${d.cells[0].length}, 1fr)` } }, under, nodes.flat(), over);
    const el = h('figure', { class: 'v-grid' }, box, h('figcaption'));
    el._g = { nodes, under, over, box, rows: d.cells.length, cols: d.cells[0].length, markerId: `pf-ah-${++uid}`, data: d, size: '' };
    const { lit } = sync(el, d);
    // Needs layout for the overlay → drawn once the app has attached the element.
    el.afterMount = () => {
      drawOverlay(el, el._g.data, true);
      if (!ruleOf(d)) stagger(lit, [{ transform: 'scale(.7)', opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: DUR.base, each: 45, maxTotal: 600 });
    };
    if (typeof ResizeObserver === 'function') {
      // Projector toggle / window resize → redraw the overlay statically (no replay) at the new size.
      new ResizeObserver(() => { const g = el._g; if (g.size && g.size !== `${box.clientWidth}x${box.clientHeight}`) drawOverlay(el, g.data, false); }).observe(box);
    }
    return el;
  },
  update(el, d) {
    const st = el._g;
    if (!st || st.rows !== d.cells.length || st.cols !== d.cells[0].length) return false;
    st.data = d;
    const { rule, lit } = sync(el, d);
    drawOverlay(el, d, true);
    if (!rule) stagger(lit, [{ transform: 'scale(.7)', opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: DUR.base, each: 45, maxTotal: 600 });
    return true;
  },
};

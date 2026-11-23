import { h } from '../core/dom.js';
import { animate, pop, reduced, DUR, EASE } from './anim.js';
import { keyProgress } from './teach.js';
// Aligned rows of characters. data: { rows: [{ label, cells: string[] }], active?: column index }
// Teaching extras (presentation only, derived from the rows the method sends):
//  • A row labelled "Key…" is drawn in the key colour (blue). With an active column, the key letter in use is
//    solid blue, earlier key letters are dimmed, and a keyword ribbon above shows which letter of the keyword
//    is in use ("key letter 3 of 5"), so the repeating key's progression is visible step by step.
//  • The active column has a marker frame that slides from the previous column on the next step.
//  • Playfair (ctx.teach.fillers): inserted filler / padding letters are marked (dashed, "filler" legend).
const isKey = (label) => /^key/i.test(String(label || ''));

function cellEl(v, ri, nRows, row, ctx, colIndex) {
  const last = ri === nRows - 1 && nRows > 1;
  const cls = `cell${v === '' ? ' is-empty' : ''}${last && !isKey(row.label) ? ' cell-out' : ''}${v === ' ' ? ' is-space' : ''}${isKey(row.label) ? ' cell-key' : ''}`;
  const f = ctx && ctx.teach && ctx.teach.fillers && ctx.teach.fillerLabel === row.label ? ctx.teach.fillers[colIndex] : null;
  if (f && f.some(Boolean) && v.length === f.length) {
    return h('span', { class: `${cls} has-filler` }, [...v].map((ch, k) => (f[k] ? h('span', { class: 'filler', title: 'Filler letter added by the rules' }, ch) : ch)));
  }
  return h('span', { class: cls }, v === ' ' ? '␣' : v);
}

function build(d, ctx, step) {
  const n = Math.max(...d.rows.map((r) => r.cells.length));
  const keyRow = d.rows.find((r) => isKey(r.label));
  const prog = keyRow ? keyProgress(keyRow.cells, d.active, step && step.meta, ctx && ctx.teach && ctx.teach.keyword) : null;
  const cols = [];
  for (let i = 0; i < n; i++) {
    const past = keyRow && d.active != null && i < d.active;
    cols.push(h('div', { class: `tr-col${i === d.active ? ' is-active' : ''}${past ? ' is-past' : ''}` },
      d.rows.map((r, ri) => cellEl(r.cells[i] ?? '', ri, d.rows.length, r, ctx, i))));
  }
  const colsBox = h('div', { class: 'tr-cols' }, cols);
  const cursor = d.active != null ? h('span', { class: 'tr-cursor', 'aria-hidden': 'true' }) : null;
  if (cursor) colsBox.append(cursor);
  const ribbon = prog ? h('div', { class: 'tr-keyword', 'aria-label': `Key letter ${prog.pos + 1} of ${prog.keyword.length} in the keyword ${prog.keyword.join('')}` },
    h('span', { class: 'tr-kw-label' }, 'Keyword'),
    h('span', { class: 'tr-kw-cells' }, prog.keyword.map((ch, k) => h('span', { class: `cell cell-key${k === prog.pos ? ' is-on' : ''}` }, ch))),
    h('span', { class: 'tr-kw-note' }, `letter ${prog.pos + 1} of ${prog.keyword.length} · key letter #${prog.count} overall`)) : null;
  const hasFillers = ctx && ctx.teach && ctx.teach.fillers && d.rows.some((r) => r.label === ctx.teach.fillerLabel) && ctx.teach.fillers.some((p) => p.some(Boolean));
  const el = h('div', { class: 'v-textrows-wrap' },
    ribbon,
    h('div', { class: 'v-textrows' }, h('div', { class: 'tr-labels' }, d.rows.map((r) => h('span', { class: isKey(r.label) ? 'is-key' : '' }, r.label))), colsBox),
    hasFillers ? h('p', { class: 'tr-legend' }, h('span', { class: 'filler' }, 'X'), ' = filler letter inserted between doubled letters or added to pad the last pair') : null);
  el._tr = { rows: d.rows.length, n, active: d.active, sig: d.rows.map((r) => r.label).join('|') + (prog ? `|kw${prog.keyword.join('')}` : ''), colsBox, cursor };
  return el;
}

function placeCursor(el, fromIndex) {
  const st = el._tr;
  if (!st.cursor) return;
  const col = st.colsBox.children[st.active];
  if (!col) return;
  const set = (c) => { st.cursor.style.left = `${c.offsetLeft - 3}px`; st.cursor.style.top = `${c.offsetTop - 3}px`; st.cursor.style.width = `${c.offsetWidth + 6}px`; st.cursor.style.height = `${c.offsetHeight + 6}px`; };
  set(col);
  const from = fromIndex != null ? st.colsBox.children[fromIndex] : null;
  if (from && from !== col && !reduced()) {
    const dx = from.offsetLeft - col.offsetLeft, dy = from.offsetTop - col.offsetTop;
    animate(st.cursor, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: Math.min(DUR.slow, 200 + 40 * Math.abs(fromIndex - st.active)), easing: EASE.inOut });
  }
  // Keep the active column in view when the row wraps or scrolls.
  const stage = el.closest('.stage');
  if (stage && stage.scrollHeight > stage.clientHeight) {
    const r = col.getBoundingClientRect(), s = stage.getBoundingClientRect();
    if (r.top < s.top || r.bottom > s.bottom) stage.scrollTop += r.top - s.top - s.height / 2;
  }
}

export default {
  type: 'textRows',
  render(d, step, ctx) {
    const el = build(d, ctx, step);
    el.afterMount = () => placeCursor(el, null);
    return el;
  },
  update(el, d, step, ctx) {
    const st = el._tr;
    if (!st || d.active == null || st.active == null) return false;
    const fresh = build(d, ctx, step);
    if (fresh._tr.sig !== st.sig || fresh._tr.n !== st.n || fresh._tr.rows !== st.rows) return false;
    const fromIndex = st.active;
    el.replaceChildren(...fresh.childNodes);
    el._tr = fresh._tr;
    placeCursor(el, fromIndex);
    // The newly written output letter and the key letter in use settle in.
    const col = el._tr.colsBox.children[d.active];
    if (col && fromIndex !== d.active) {
      const out = col.querySelector('.cell-out'); if (out) pop(out, { delay: 120 });
      const k = el.querySelector('.tr-kw-cells .is-on'); if (k) pop(k);
    }
    return true;
  },
};

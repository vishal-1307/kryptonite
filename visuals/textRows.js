import { h } from '../core/dom.js';
// Aligned rows of characters. data: { rows: [{ label, cells: string[] }], active?: column index }
export default {
  type: 'textRows',
  render(d) {
    const n = Math.max(...d.rows.map((r) => r.cells.length));
    const cols = [];
    for (let i = 0; i < n; i++) {
      cols.push(h('div', { class: `tr-col${i === d.active ? ' is-active' : ''}` },
        d.rows.map((r, ri) => {
          const v = r.cells[i] ?? '';
          return h('span', { class: `cell${v === '' ? ' is-empty' : ''}${ri === d.rows.length - 1 && d.rows.length > 1 ? ' cell-out' : ''}${v === ' ' ? ' is-space' : ''}` }, v === ' ' ? '␣' : v);
        })));
    }
    return h('div', { class: 'v-textrows' },
      h('div', { class: 'tr-labels' }, d.rows.map((r) => h('span', {}, r.label))),
      h('div', { class: 'tr-cols' }, cols));
  },
};

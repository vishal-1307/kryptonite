import { h } from '../core/dom.js';
// data: { rails, cols, cells: [{r,c,ch}], active?: [r,c][], caption?, pattern?: rowIndexPerColumn[] }
export default {
  type: 'railFence',
  render(d) {
    const grid = h('div', { class: 'rf-grid', style: { gridTemplateColumns: `repeat(${d.cols}, 2em)`, gridTemplateRows: `repeat(${d.rails}, 2em)` } });
    const active = new Set((d.active || []).map(([r, c]) => `${r},${c}`));
    for (const cell of d.cells) {
      grid.append(h('span', {
        class: `cell${cell.ch ? '' : ' is-slot'}${active.has(`${cell.r},${cell.c}`) ? ' is-hl' : ''}`,
        style: { gridRow: cell.r + 1, gridColumn: cell.c + 1 },
      }, cell.ch || '·'));
    }
    return h('figure', { class: 'v-railfence' },
      h('div', { class: 'rf-wrap' }, h('div', { class: 'rf-labels', style: { gridTemplateRows: `repeat(${d.rails}, 2em)` } }, Array.from({ length: d.rails }, (_, i) => h('span', {}, `Rail ${i + 1}`))), grid),
      d.caption ? h('figcaption', { class: 'mono' }, d.caption) : null);
  },
};

import { h } from '../core/dom.js';
// Letter grid (e.g. Playfair 5×5). data: { cells: string[][], primary?: [r,c][], secondary?: [r,c][], caption? }
export default {
  type: 'grid',
  render(d) {
    const has = (list, r, c) => (list || []).some(([a, b]) => a === r && b === c);
    return h('figure', { class: 'v-grid' },
      h('div', { class: 'grid-box', style: { gridTemplateColumns: `repeat(${d.cells[0].length}, 1fr)` } },
        d.cells.flatMap((row, r) => row.map((ch, c) => h('span', { class: `cell${has(d.primary, r, c) ? ' is-hl' : ''}${has(d.secondary, r, c) ? ' is-out' : ''}` }, ch === 'I' ? 'I/J' : ch)))),
      d.caption ? h('figcaption', {}, d.caption) : null);
  },
};

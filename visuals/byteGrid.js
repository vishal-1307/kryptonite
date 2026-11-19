import { h } from '../core/dom.js';
// AES-style 4×4 state(s), column-major. data: { items: [ {label, bytes:number[16], hl?:number[], tone?:'key'|'out'} | {op} ], rowShift?: 'left'|'right' }
const hex = (b) => b.toString(16).padStart(2, '0');
export default {
  type: 'byteGrid',
  render(d) {
    const grid = (it) => {
      const hl = new Set(it.hl || []);
      const cells = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const i = r + 4 * c;
        cells.push(h('span', { class: `cell${hl.has(i) ? ' is-hl' : ''}`, title: `row ${r}, col ${c}` }, hex(it.bytes[i])));
      }
      return h('figure', { class: `bg-state${it.tone ? ` tone-${it.tone}` : ''}` }, h('div', { class: 'bg-grid' }, cells), h('figcaption', {}, it.label));
    };
    const shifts = d.rowShift ? h('div', { class: 'bg-shifts' }, [0, 1, 2, 3].map((r) => h('span', {}, r === 0 ? '—' : `${d.rowShift === 'left' ? '←' : '→'} ${r}`))) : null;
    return h('div', { class: 'v-bytegrid' }, shifts, d.items.map((it) => (it.op !== undefined ? h('span', { class: 'mx-op' }, it.op) : grid(it))));
  },
};

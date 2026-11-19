import { h } from '../core/dom.js';
import { stagger } from './anim.js';
// AES-style 4×4 state(s), column-major. data: { items: [ {label, bytes:number[16], hl?:number[], tone?:'key'|'out'} | {op} ], rowShift?: 'left'|'right' }
// In an output state (tone 'out'), bytes that differ from the first state shown flip in one by one, so the class
// sees exactly which bytes SubBytes / ShiftRows / MixColumns / AddRoundKey changed.
const hex = (b) => b.toString(16).padStart(2, '0');
export default {
  type: 'byteGrid',
  render(d) {
    const first = d.items.find((it) => it.op === undefined);
    const changed = [];
    const grid = (it) => {
      const hl = new Set(it.hl || []);
      const cells = [];
      const compare = it !== first && it.tone === 'out' && first && first.bytes;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const i = r + 4 * c;
        const diff = compare && first.bytes[i] !== it.bytes[i];
        const cell = h('span', { class: `cell${hl.has(i) ? ' is-hl' : ''}${diff ? ' is-changed' : ''}`, title: `row ${r}, col ${c}` }, hex(it.bytes[i]));
        if (diff) changed.push([c, r, cell]);
        cells.push(cell);
      }
      return h('figure', { class: `bg-state${it.tone ? ` tone-${it.tone}` : ''}` }, h('div', { class: 'bg-grid' }, cells), h('figcaption', {}, it.label));
    };
    const shifts = d.rowShift ? h('div', { class: 'bg-shifts' }, [0, 1, 2, 3].map((r) => h('span', {}, r === 0 ? '—' : `${d.rowShift === 'left' ? '←' : '→'} ${r}`))) : null;
    const el = h('div', { class: 'v-bytegrid' }, shifts, d.items.map((it) => (it.op !== undefined ? h('span', { class: 'mx-op' }, it.op) : grid(it))));
    // Column-major order (how AES stores the state).
    changed.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    stagger(changed.map((x) => x[2]), [{ transform: 'rotateX(90deg)', opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 300, each: 45, maxTotal: 700, delay: 200 });
    return el;
  },
};

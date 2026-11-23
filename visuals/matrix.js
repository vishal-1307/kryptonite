import { h } from '../core/dom.js';
import { animate, pop, EASE } from './anim.js';
import { hillRows } from './teach.js';
// data: { items: [ { kind:'matrix', label, values: (string|number)[][] } | { kind:'op', text } ] }
// Hill block steps (K × vector = result): below the matrices, each output row is worked out in turn:
// the matrix row and the vector light up (yellow = being read), the products appear, then their sum, then
// the mod 26 reduction, and the result cell turns green. Numbers come from step.meta.rows when the method
// provides them (code/STEP_FIELDS.md), else from the matrices on screen. The resting DOM is the final state.
const letter = (n) => String.fromCharCode(65 + n);

export default {
  type: 'matrix',
  render(d, step) {
    const figs = [];
    const box = h('div', { class: 'v-matrix' }, d.items.map((it) => {
      if (it.kind === 'op') return h('span', { class: 'mx-op' }, it.text);
      const cols = it.values[0].length;
      const body = h('div', { class: 'mx-body' }, it.values.flatMap((row, r) => row.map((v, c) => h('span', { class: 'mx-cell', 'data-r': r, 'data-c': c }, String(v)))));
      body.style.setProperty('grid-template-columns', `repeat(${cols}, auto)`);
      const fig = h('figure', { class: 'mx' }, body, h('figcaption', {}, it.label));
      figs.push(fig);
      return fig;
    }));
    const rows = hillRows(step, d.items);
    if (!rows || figs.length < 3) return box;
    const work = h('div', { class: 'hill-work', 'aria-label': 'Matrix multiplication, row by row' }, rows.map((r, i) => {
      const terms = (r.terms || []).map(([k, x]) => `${k}×${x}`);
      const parts = {
        terms: h('span', { class: 'hw-terms mono' }, terms.join(' + ')),
        products: h('span', { class: 'hw-products mono' }, `= ${r.products.join(' + ')}`),
        sum: h('span', { class: 'hw-sum mono' }, `= ${r.sum}`),
        mod: h('span', { class: 'hw-mod mono' }, `→ ${r.sum} mod 26 = `, h('b', {}, String(r.mod))),
        out: h('span', { class: 'hw-letter mono' }, `→ ${r.letter || letter(r.mod)}`),
      };
      return h('div', { class: 'hw-row', 'data-row': i }, h('span', { class: 'hw-label' }, `Row ${i + 1}`), parts.terms, parts.products, parts.sum, parts.mod, parts.out);
    }));
    const el = h('div', { class: 'v-hill' }, box, work);
    el.afterMount = () => {
      const [K, vin, vout] = figs;
      const slot = 460;
      rows.forEach((r, i) => {
        const t0 = 120 + i * slot;
        const rowCells = [...K.querySelectorAll(`.mx-cell[data-r="${i}"]`)];
        const read = [{ backgroundColor: 'var(--hl)', color: 'var(--on-hl)' }, { backgroundColor: 'var(--hl)', color: 'var(--on-hl)', offset: 0.8 }, { backgroundColor: 'transparent' }];
        [...rowCells, ...vin.querySelectorAll('.mx-cell')].forEach((c) => animate(c, read, { duration: slot, delay: t0, fill: 'none', reduce: 'none' }));
        const line = work.children[i];
        const bits = [...line.children].slice(1);
        bits.forEach((b, k) => animate(b, [{ opacity: 0, transform: 'translateX(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 160, delay: t0 + k * 70, easing: EASE.out }));
        const outCell = vout.querySelectorAll('.mx-cell')[i];
        if (outCell) {
          animate(outCell, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: t0 + 300 });
          pop(outCell, { delay: t0 + 300 });
        }
      });
    };
    return el;
  },
};

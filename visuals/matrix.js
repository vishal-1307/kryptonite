import { h } from '../core/dom.js';
// data: { items: [ { kind:'matrix', label, values: (string|number)[][] } | { kind:'op', text } ] }
export default {
  type: 'matrix',
  render(d) {
    return h('div', { class: 'v-matrix' }, d.items.map((it) => (it.kind === 'op'
      ? h('span', { class: 'mx-op' }, it.text)
      : h('figure', { class: 'mx' },
        h('div', { class: 'mx-body', style: { gridTemplateColumns: `repeat(${it.values[0].length}, auto)` } }, it.values.flat().map((v) => h('span', { class: 'mx-cell' }, String(v)))),
        h('figcaption', {}, it.label)))));
  },
};

import { h } from '../core/dom.js';
// data: { lines: [{ expr, note?, highlight? }] }
export default {
  type: 'math',
  render(d) {
    return h('div', { class: 'v-math' }, d.lines.map((l) => h('div', { class: `m-line${l.highlight ? ' is-hl' : ''}` }, h('code', {}, l.expr), l.note ? h('span', { class: 'm-note' }, l.note) : null)));
  },
};

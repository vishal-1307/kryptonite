import { h } from '../core/dom.js';
// Column diagram (Alice | channel | Bob, key pairs…). data: { columns: [{ title, items: [{ text, highlight? }] }] }
export default {
  type: 'flow',
  render(d) {
    return h('div', { class: 'v-flow', style: { gridTemplateColumns: `repeat(${d.columns.length}, minmax(0, 1fr))` } }, d.columns.map((c) => h('div', { class: 'flow-col' },
      h('div', { class: 'flow-title' }, c.title),
      c.items.length ? c.items.map((it) => h('div', { class: `flow-item${it.highlight ? ' is-hl' : ''}` }, it.text)) : h('div', { class: 'flow-item is-empty' }, '—'))));
  },
};

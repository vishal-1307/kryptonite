import { h } from '../core/dom.js';
// Plain text labels instead of emoji pictograms (e.g. "👩 Alice", "a = 4 🔒"): the lock becomes "(secret)", other
// pictograms are dropped, so the diagram matches the rest of the UI and reads the same on every OS.
const plain = (t) => String(t).replace(/\s*\u{1F512}/gu, ' (secret)').replace(/\p{Extended_Pictographic}\uFE0F?\s*/gu, '').trim();
// Column diagram (Alice | channel | Bob, key pairs…). data: { columns: [{ title, items: [{ text, highlight? }] }] }
export default {
  type: 'flow',
  render(d) {
    return h('div', { class: 'v-flow', style: { gridTemplateColumns: `repeat(${d.columns.length}, minmax(0, 1fr))` } }, d.columns.map((c) => h('div', { class: 'flow-col' },
      h('div', { class: 'flow-title' }, plain(c.title)),
      c.items.length ? c.items.map((it) => h('div', { class: `flow-item${it.highlight ? ' is-hl' : ''}` }, plain(it.text))) : h('div', { class: 'flow-item is-empty' }, '—'))));
  },
};

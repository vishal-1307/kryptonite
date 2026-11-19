import { h } from '../core/dom.js';
// Long hex / text value. data: { label, hex, compare?: string } — chars differing from `compare` are highlighted.
export default {
  type: 'digest',
  render(d) {
    const chars = [...d.hex];
    const body = d.compare ? chars.map((c, i) => h('span', { class: c !== d.compare[i] ? 'is-diff' : '' }, c)) : d.hex;
    return h('div', { class: 'v-digest' }, h('div', { class: 'dg-label' }, d.label), h('code', { class: 'dg-value' }, body));
  },
};

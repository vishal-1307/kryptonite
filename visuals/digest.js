import { h } from '../core/dom.js';
import { stagger } from './anim.js';
// Long hex / text value. data: { label, hex, compare?: string } — chars differing from `compare` are highlighted.
export default {
  type: 'digest',
  render(d) {
    const chars = [...d.hex];
    const body = d.compare ? chars.map((c, i) => h('span', { class: c !== d.compare[i] ? 'is-diff' : '' }, c)) : d.hex;
    const el = h('div', { class: 'v-digest' }, h('div', { class: 'dg-label' }, d.label), h('code', { class: 'dg-value' }, body));
    // Avalanche effect: the changed hex digits light up one after another.
    stagger(el.querySelectorAll('.is-diff'), [{ opacity: 0.15 }, { opacity: 1 }], { duration: 200, each: 12, maxTotal: 800, delay: 150 });
    return el;
  },
};

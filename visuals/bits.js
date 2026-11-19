import { h } from '../core/dom.js';
import { stagger } from './anim.js';
// data: { groups: [{ label, items: [{ top, bottom, accent? }] }] }
export default {
  type: 'bits',
  render(d) {
    // Each group (and the arrow into it) appears in turn: the bits visibly flow from one form to the next.
    const el = h('div', { class: 'v-bits' }, d.groups.map((g, gi) => [
      gi ? h('div', { class: 'bits-arrow' }, '↓') : null,
      h('div', { class: 'bits-group' }, h('div', { class: 'bits-label' }, g.label),
        h('div', { class: 'bits-items' }, g.items.map((it) => h('div', { class: `bits-item${it.accent ? ' is-hl' : ''}` }, h('code', {}, it.top), h('small', {}, it.bottom))))),
    ]));
    stagger(el.children, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, each: 180, maxTotal: 900 });
    return el;
  },
};

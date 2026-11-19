import { h } from '../core/dom.js';
// data: { groups: [{ label, items: [{ top, bottom, accent? }] }] }
export default {
  type: 'bits',
  render(d) {
    return h('div', { class: 'v-bits' }, d.groups.map((g, gi) => [
      gi ? h('div', { class: 'bits-arrow' }, '↓') : null,
      h('div', { class: 'bits-group' }, h('div', { class: 'bits-label' }, g.label),
        h('div', { class: 'bits-items' }, g.items.map((it) => h('div', { class: `bits-item${it.accent ? ' is-hl' : ''}` }, h('code', {}, it.top), h('small', {}, it.bottom))))),
    ]));
  },
};

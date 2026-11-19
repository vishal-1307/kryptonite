import { h } from '../core/dom.js';
// data: { top: string[], bottom: string[], labelTop, labelBottom, active?: index, small?: bool }
export default {
  type: 'letterStrip',
  render(d) {
    const col = (i) => h('div', { class: `ls-col${i === d.active ? ' is-active' : ''}` },
      h('span', { class: 'cell' }, d.top[i]), h('span', { class: 'ls-arrow' }, '↓'), h('span', { class: 'cell cell-out' }, d.bottom[i]));
    return h('div', { class: `v-letterstrip${d.small ? ' is-small' : ''}` },
      h('div', { class: 'ls-labels' }, h('span', {}, d.labelTop || ''), h('span', {}, ''), h('span', {}, d.labelBottom || '')),
      h('div', { class: 'ls-cols' }, d.top.map((_, i) => col(i))));
  },
};

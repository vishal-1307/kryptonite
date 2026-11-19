import { h } from '../core/dom.js';
import { stagger } from './anim.js';
// data: { lines: [{ expr, note?, highlight? }] }
// Lines reveal one by one, and inside a line each "= …" term appears in turn (e.g. n = 61 × 53 = 3233),
// so the class can follow the derivation. The text content is unchanged.
export default {
  type: 'math',
  render(d) {
    const terms = [];
    const lines = d.lines.map((l) => {
      const parts = String(l.expr).split(' = ');
      const code = h('code', {}, parts.map((p, i) => {
        const t = h('span', { class: 'm-term' }, (i ? ' = ' : '') + p);
        terms.push(t);
        return t;
      }));
      return h('div', { class: `m-line${l.highlight ? ' is-hl' : ''}` }, code, l.note ? h('span', { class: 'm-note' }, l.note) : null);
    });
    stagger(lines, [{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, each: 140, maxTotal: 500 });
    stagger(terms, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, each: 110, maxTotal: 900, delay: 80 });
    return h('div', { class: 'v-math' }, lines);
  },
};

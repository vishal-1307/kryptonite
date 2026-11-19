import { h } from '../core/dom.js';
import { stagger, animate } from './anim.js';
// data: { groups: [{ label, items: [{ top, bottom, accent? }] }] }
// Each group (and the arrow into it) appears in turn: the bits visibly flow from one form to the next.
// Padding (Base64): when a group of bit strings is longer than the previous one and starts with the same bits,
// the extra bits are the zero bits added to finish the last 6-bit group — they are marked and called out.
// Items whose top is "=" are padding characters and are marked too. Everything is derived from the data.
const isBits = (g) => g && g.items.length && g.items.every((it) => /^[01]+$/.test(it.top));

export default {
  type: 'bits',
  render(d, step, ctx = {}) {
    const groups = d.groups;
    const decoding = ctx.action === 'decode'; // same groups both ways; only the wording changes
    let padFrom = -1, padGroup = -1;
    for (let gi = 1; gi < groups.length; gi++) {
      if (!isBits(groups[gi - 1]) || !isBits(groups[gi])) continue;
      const prev = groups[gi - 1].items.map((it) => it.top).join(''), cur = groups[gi].items.map((it) => it.top).join('');
      if (cur.length > prev.length && cur.startsWith(prev) && /^0+$/.test(cur.slice(prev.length))) { padFrom = prev.length; padGroup = gi; }
    }
    const padBits = [], padChars = [];
    const el = h('div', { class: 'v-bits' }, groups.map((g, gi) => {
      let offset = 0;
      const items = g.items.map((it) => {
        let top = it.top;
        if (gi === padGroup && offset + it.top.length > padFrom) {
          top = [...it.top].map((b, k) => {
            if (offset + k < padFrom) return b;
            const s = h('span', { class: 'bit-pad', title: decoding ? 'zero padding bit, dropped when decoding' : 'zero bit added as padding' }, b);
            padBits.push(s);
            return s;
          });
        }
        offset += it.top.length;
        const isPadChar = it.top === '=';
        const node = h('div', { class: `bits-item${it.accent ? ' is-hl' : ''}${isPadChar ? ' is-pad' : ''}` }, h('code', {}, top), h('small', {}, it.bottom));
        if (isPadChar) padChars.push(node);
        return node;
      });
      const notes = [];
      if (gi === padGroup) {
        const n = offset - padFrom;
        notes.push(h('p', { class: 'pad-note' }, h('span', { class: 'bit-pad' }, '0'), decoding
          ? ` ${n} zero padding bit${n > 1 ? 's' : ''}: left over after the last full byte, so dropped when decoding`
          : ` +${n} zero bit${n > 1 ? 's' : ''} added to fill the last 6-bit group`));
      }
      const eq = g.items.filter((it) => it.top === '=').length;
      if (eq) notes.push(h('p', { class: 'pad-note pad-note-eq' }, h('code', {}, '='.repeat(eq)), decoding
        ? ` ${eq} padding character${eq > 1 ? 's' : ''}: carry no data and are ignored when decoding`
        : ` ${eq} padding character${eq > 1 ? 's' : ''}: the output length must be a multiple of 4`));
      return [
        gi ? h('div', { class: 'bits-arrow' }, '↓') : null,
        h('div', { class: 'bits-group' }, h('div', { class: 'bits-label' }, g.label), h('div', { class: 'bits-items' }, items), notes),
      ];
    }));
    const parts = [...el.children];
    const each = 180;
    stagger(parts, [{ opacity: 0.35, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 240, each, maxTotal: 900 });
    const gap = parts.length > 1 ? Math.min(each, 900 / (parts.length - 1)) : 0;
    // Zero bits drop in after their group appears; "=" characters stamp in after the last group.
    const groupDelay = (gi) => (gi * 2) * gap; // group gi is child 2*gi (arrows sit between groups)
    if (padGroup >= 0) stagger(padBits, [{ opacity: 0, transform: 'translateY(-0.8em)' }, { opacity: 1, transform: 'none' }], { duration: 260, each: 70, delay: groupDelay(padGroup) + 220 });
    padChars.forEach((c, k) => animate(c, [{ opacity: 0, transform: 'scale(1.6)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: groupDelay(groups.length - 1) + 260 + k * 120 }));
    return el;
  },
};

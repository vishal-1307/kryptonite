import { h } from '../core/dom.js';
// data: { bytes: number[], segments: [{from,to,tone,label}], chars?: bool } — 16 bytes per row
const hex = (b) => b.toString(16).padStart(2, '0');
export default {
  type: 'hexDump',
  render(d) {
    const toneOf = (i) => (d.segments.find((s) => i >= s.from && i < s.to) || {}).tone || '';
    const rows = [];
    for (let off = 0; off < d.bytes.length; off += 16) {
      rows.push(h('div', { class: 'hd-row' },
        h('span', { class: 'hd-off' }, off.toString(16).padStart(4, '0')),
        h('span', { class: 'hd-bytes' }, d.bytes.slice(off, off + 16).map((b, k) => h('span', { class: `hd-b t-${toneOf(off + k)}` }, hex(b)))),
        d.chars ? h('span', { class: 'hd-chars' }, d.bytes.slice(off, off + 16).map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·')).join('')) : null));
      if ((off + 16) % 64 === 0 && off + 16 < d.bytes.length) rows.push(h('div', { class: 'hd-sep' }, `— end of block ${(off + 16) / 64} —`));
    }
    if (!d.bytes.length) rows.push(h('div', { class: 'hd-row muted' }, '(empty message: 0 bytes)'));
    return h('div', { class: 'v-hexdump' },
      h('div', { class: 'hd-legend' }, d.segments.filter((s) => s.to > s.from).map((s) => h('span', { class: `hd-key t-${s.tone}` }, s.label))),
      h('div', { class: 'hd-body mono' }, rows));
  },
};

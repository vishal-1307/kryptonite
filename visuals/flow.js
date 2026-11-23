import { h } from '../core/dom.js';
import { animate, EASE } from './anim.js';
// Plain text labels instead of emoji pictograms (e.g. "👩 Alice", "a = 4 🔒"): the lock becomes "(secret)", other
// pictograms are dropped, so the diagram matches the rest of the UI and reads the same on every OS.
const plain = (t) => String(t).replace(/\s*\u{1F512}/gu, ' (secret)').replace(/\p{Extended_Pictographic}\uFE0F?\s*/gu, '').trim();
// Column diagram (Alice | channel | Bob, key pairs…). data: { columns: [{ title, items: [{ text, highlight? }] }] }
export default {
  type: 'flow',
  render(d, step) {
    const cols = h('div', { class: 'v-flow', style: { gridTemplateColumns: `repeat(${d.columns.length}, minmax(0, 1fr))` } }, d.columns.map((c) => h('div', { class: 'flow-col' },
      h('div', { class: 'flow-title' }, plain(c.title)),
      c.items.length ? c.items.map((it) => h('div', { class: `flow-item${it.highlight ? ' is-hl' : ''}` }, plain(it.text))) : h('div', { class: 'flow-item is-empty' }, '—'))));
    const ex = step && step.meta && step.meta.exchange;
    const msgs = ex && Array.isArray(ex.messages) ? ex.messages : [];
    if (!msgs.length) return cols;
    // Diffie–Hellman "Swap public keys" (step.meta.exchange.messages): each public value travels across the open
    // channel to the other party. The resting DOM is the final state (value arrived); the slide is WAAPI only,
    // so Motion off / reduced motion shows the arrived values at once. Values are strings, shown as given.
    const lanes = msgs.map((m) => {
      const rtl = m.from === 'Bob';
      const token = h('span', { class: `dh-token${m.public ? ' is-public' : ''}` }, `${m.name} = ${m.value}`);
      return h('li', { class: `dh-lane${rtl ? ' is-rtl' : ''}`, 'aria-label': `${m.from} sends ${m.name} = ${m.value} to ${m.to}${m.public ? ' over the public channel' : ''}` },
        h('span', { class: 'dh-party' }, m.from),
        h('span', { class: 'dh-track', 'aria-hidden': 'true' }, token, h('span', { class: 'dh-arrow' }, rtl ? '←' : '→')),
        h('span', { class: 'dh-party' }, m.to));
    });
    const seen = (ex.public || []).map(String);
    const el = h('div', { class: 'v-dh' },
      h('p', { class: 'dh-head' }, 'Public values crossing the open channel'),
      h('ol', { class: 'dh-lanes' }, lanes),
      seen.length ? h('p', { class: 'dh-eve small' }, h('strong', {}, 'Eve sees: '), seen.join(', '), '. She never sees a or b.') : null,
      cols);
    el.afterMount = () => {
      lanes.forEach((li, i) => {
        const track = li.querySelector('.dh-track'), tok = li.querySelector('.dh-token');
        const dist = Math.max(0, track.clientWidth - tok.offsetWidth - 24);
        const from = li.classList.contains('is-rtl') ? dist : -dist;
        animate(tok, [{ transform: `translateX(${from}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: i * 320, easing: EASE.inOut || 'ease-in-out', fill: 'backwards' });
      });
    };
    return el;
  },
};

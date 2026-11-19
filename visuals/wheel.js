import { s, h } from '../core/dom.js';
// Caesar wheel. data: { shift, active?: index of plain letter }
// Supports update() so the inner ring rotates smoothly between steps.
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const STEP = 360 / 26;

function ring(r, cls, letters) {
  return letters.map((ch, i) => {
    const ang = (i * STEP - 90) * (Math.PI / 180);
    const x = 150 + r * Math.cos(ang), y = 150 + r * Math.sin(ang);
    return s('g', { class: `${cls} l${i}`, transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})` },
      s('circle', { r: 13, class: 'dot' }),
      s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, ch));
  });
}

function apply(el, d) {
  const inner = el.querySelector('.wheel-inner');
  // Inner letter (i + shift) must sit under outer letter i → rotate the ring by −shift.
  inner.style.transform = `rotate(${-d.shift * STEP}deg)`;
  inner.querySelectorAll('text').forEach((t) => { t.style.transform = `rotate(${d.shift * STEP}deg)`; });
  el.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
  if (d.active !== undefined) {
    el.querySelector(`.outer.l${d.active}`)?.classList.add('is-active');
    el.querySelector(`.inner.l${(d.active + d.shift) % 26}`)?.classList.add('is-active');
  }
  el.querySelector('.wheel-label').textContent = `shift ${d.shift}`;
}

export default {
  type: 'wheel',
  render(d) {
    const svg = s('svg', { viewBox: '0 0 300 300', class: 'wheel-svg', role: 'img', 'aria-label': `Cipher wheel shifted by ${d.shift}` },
      s('circle', { cx: 150, cy: 150, r: 140, class: 'wheel-bg' }),
      s('g', { class: 'wheel-outer' }, ring(127, 'outer', [...A])),
      s('g', { class: 'wheel-inner' }, ring(93, 'inner', [...A])),
      s('text', { x: 150, y: 150, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'wheel-label' }, ''));
    const el = h('div', { class: 'v-wheel' }, svg);
    apply(el, d);
    return el;
  },
  update(el, d) { apply(el, d); },
};

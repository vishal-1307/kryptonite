import { s, h } from '../core/dom.js';
import { animate, stagger, pop, EASE } from './anim.js';
// Caesar wheel. data: { shift, active?: index of plain letter }
// The inner ring rotates smoothly when the shift changes (CSS transition). When a letter is active, a token
// travels along the outer ring from the plain letter by the shift (shortest way round, so decryption visibly
// moves backwards) and lands on the cipher letter; every letter it passes ticks.
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const STEP = 360 / 26;
const R_OUT = 127, R_TRAIL = 145;

function ring(r, cls, letters) {
  return letters.map((ch, i) => {
    const ang = (i * STEP - 90) * (Math.PI / 180);
    const x = 150 + r * Math.cos(ang), y = 150 + r * Math.sin(ang);
    return s('g', { class: `${cls} l${i}`, transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})` },
      s('circle', { r: 13, class: 'dot' }),
      s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, ch));
  });
}

const polar = (r, deg) => { const a = (deg - 90) * (Math.PI / 180); return [150 + r * Math.cos(a), 150 + r * Math.sin(a)]; };
function arcPath(fromDeg, toDeg) {
  const [x0, y0] = polar(R_TRAIL, fromDeg), [x1, y1] = polar(R_TRAIL, toDeg);
  const sweep = toDeg > fromDeg ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R_TRAIL} ${R_TRAIL} 0 0 ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** Signed letter distance the shift represents, taking the shorter way round (e.g. shift 23 → −3). */
const signedShift = (k) => { const m = ((k % 26) + 26) % 26; return m > 13 ? m - 26 : m; };

function apply(el, d, animateTravel) {
  const inner = el.querySelector('.wheel-inner');
  // Inner letter (i + shift) must sit under outer letter i → rotate the ring by −shift.
  inner.style.transform = `rotate(${-d.shift * STEP}deg)`;
  inner.querySelectorAll('text').forEach((t) => { t.style.transform = `rotate(${d.shift * STEP}deg)`; });
  el.querySelectorAll('.is-active, .is-target').forEach((n) => n.classList.remove('is-active', 'is-target'));
  el.querySelector('.wheel-label').textContent = `shift ${d.shift}`;
  el.querySelector('svg').setAttribute('aria-label', `Cipher wheel shifted by ${d.shift}${d.active !== undefined ? `: ${A[d.active]} becomes ${A[(d.active + d.shift) % 26]}` : ''}`);

  const travel = el.querySelector('.wheel-travel');
  if (d.active === undefined) { travel.style.display = 'none'; return; }
  const delta = signedShift(d.shift);
  const target = (d.active + d.shift) % 26;
  el.querySelector(`.outer.l${d.active}`)?.classList.add('is-active');
  el.querySelector(`.inner.l${target}`)?.classList.add('is-active');
  el.querySelector(`.outer.l${target}`)?.classList.add('is-target');

  // Resting state = token parked on the cipher letter, showing the cipher letter.
  const a0 = d.active * STEP, a1 = a0 + delta * STEP;
  const token = travel.querySelector('.travel-token');
  const [tPlain, tCipher] = token.querySelectorAll('text');
  tPlain.textContent = A[d.active]; tCipher.textContent = A[target];
  travel.style.display = '';
  token.style.transform = `rotate(${a1}deg)`;
  token.querySelector('.travel-upright').style.transform = `rotate(${-a1}deg)`;
  tPlain.style.opacity = 0; tCipher.style.opacity = 1;
  const trail = travel.querySelector('.travel-trail');
  trail.setAttribute('d', delta ? arcPath(a0, a1) : '');
  el.querySelector('.travel-count').textContent = delta ? `${delta > 0 ? '+' : '−'}${Math.abs(delta)}` : '';

  if (!animateTravel || !delta) return;
  const n = Math.abs(delta);
  const duration = Math.min(1100, 320 + 55 * n);
  const opts = { duration, easing: EASE.inOut, reduce: 'none' };
  animate(token, [{ transform: `rotate(${a0}deg)` }, { transform: `rotate(${a1}deg)` }], opts);
  animate(token.querySelector('.travel-upright'), [{ transform: `rotate(${-a0}deg)` }, { transform: `rotate(${-a1}deg)` }], opts);
  animate(trail, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], opts);
  animate(tPlain, [{ opacity: 1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], opts);
  animate(tCipher, [{ opacity: 0 }, { opacity: 0, offset: 0.85 }, { opacity: 1 }], opts);
  // Tick each outer letter the token passes over (1 … n), timed with the travel.
  const passed = Array.from({ length: n }, (_, k) => el.querySelector(`.outer.l${(d.active + Math.sign(delta) * (k + 1) + 26) % 26} .dot`));
  stagger(passed, [{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.4 }, { transform: 'scale(1)' }],
    { duration: 260, each: (duration - 200) / n, maxTotal: duration, delay: 60, reduce: 'none' });
  pop(el.querySelector(`.outer.l${target} .dot`), { delay: duration - 40 });
}

export default {
  type: 'wheel',
  render(d) {
    const svg = s('svg', { viewBox: '0 0 300 300', class: 'wheel-svg', role: 'img', 'aria-label': '' },
      s('circle', { cx: 150, cy: 150, r: 140, class: 'wheel-bg' }),
      s('g', { class: 'wheel-outer' }, ring(R_OUT, 'outer', [...A])),
      s('g', { class: 'wheel-inner' }, ring(93, 'inner', [...A])),
      s('g', { class: 'wheel-travel' },
        s('path', { class: 'travel-trail', pathLength: 1 }),
        s('g', { class: 'travel-token' },
          s('g', { transform: `translate(150 ${150 - R_OUT})` },
            s('g', { class: 'travel-upright' },
              s('circle', { r: 15 }),
              s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, ''),
              s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, ''))))),
      s('text', { x: 150, y: 150, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'wheel-label' }, ''),
      s('text', { x: 150, y: 170, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'travel-count' }, ''));
    const el = h('div', { class: 'v-wheel' }, svg);
    el._last = null;
    apply(el, d, d.active !== undefined);
    el._last = { shift: d.shift, active: d.active };
    return el;
  },
  update(el, d) {
    const last = el._last || {};
    apply(el, d, d.active !== undefined && (last.active !== d.active || last.shift !== d.shift));
    el._last = { shift: d.shift, active: d.active };
  },
};

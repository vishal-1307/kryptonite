import { h } from '../core/dom.js';
import { animate, stagger, pop, DUR, EASE } from './anim.js';
// data: { headers: string[], rows: any[][], highlightRows?: number[], mono?, compact?, scroll? }
// Two SHA-256 tables get extra motion (detected from their headers; values always come from the rows):
//  • message schedule (headers contain "Wₜ"): W₀–W₁₅ (straight from the block) appear first, then W₁₆…W₆₃
//    column by column, because each later word is derived from earlier ones.
//  • 64 rounds (headers t,a…h): a compact "shift register" strip above the table shows the working variables
//    a…h moving one place each round (b←a, c←b, d←c, f←e, g←f, h←g) while new a and e are computed.
//    It plays rounds 0–3 and then jumps to 63; a slider lets the teacher show any round.
const isRounds = (d) => d.headers.join(',') === 't,a,b,c,d,e,f,g,h';
const isSchedule = (d) => d.headers.filter((x) => x === 'Wₜ').length >= 2;
const VARS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function registerStrip(d) {
  const frameFor = (row) => h('div', { class: 'reg-frame' },
    h('span', { class: 'reg-t' }, `after round t = ${row[0]}`),
    h('div', { class: 'reg-cells' }, VARS.map((v, i) => h('div', { class: `reg-cell${i === 0 || i === 4 ? ' is-new' : ''}` },
      h('span', { class: 'reg-name' }, v), h('code', {}, String(row[i + 1])),
      h('small', {}, i === 0 ? 'T1 + T2' : i === 4 ? 'd + T1' : `← ${VARS[i - 1]}`)))));
  const picks = [0, 1, 2, 3].filter((t) => t < d.rows.length);
  const lastIdx = d.rows.length - 1;
  const frames = picks.map((t) => frameFor(d.rows[t]));
  const live = frameFor(d.rows[lastIdx]); // resting frame (round 63)
  live.classList.add('is-live');
  const stack = h('div', { class: 'reg-stack' }, frames, live);
  const slider = h('input', { type: 'range', min: 0, max: lastIdx, value: lastIdx, class: 'reg-slider', 'aria-label': 'Show the working variables after round t' });
  const wrap = h('div', { class: 'v-register' },
    h('div', { class: 'reg-head' }, h('strong', {}, 'Working variables a…h'), h('span', { class: 'muted small' }, 'each round every variable moves one place; a and e get new values')),
    stack, h('label', { class: 'reg-slide-wrap' }, h('span', { class: 'small muted' }, 'Round'), slider));

  const shiftAnim = (frame, delay) => {
    const cells = [...frame.querySelectorAll('.reg-cell')];
    const rects = cells.map((c) => c.getBoundingClientRect());
    cells.forEach((c, i) => {
      if (i === 0 || i === 4) { pop(c, { delay: delay + 120, fill: 'none' }); return; }
      const dx = rects[i - 1].left - rects[i].left, dy = rects[i - 1].top - rects[i].top;
      animate(c, [{ transform: `translate(${dx}px, ${dy}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 320, delay, easing: EASE.inOut, fill: 'none' });
    });
  };
  const setLive = (t) => {
    const row = d.rows[t];
    live.querySelector('.reg-t').textContent = `after round t = ${row[0]}`;
    live.querySelectorAll('.reg-cell code').forEach((c, i) => { c.textContent = String(row[i + 1]); });
  };
  slider.addEventListener('input', () => { setLive(Number(slider.value)); shiftAnim(live, 0); });

  wrap.afterMount = () => {
    // Frames play in turn (each fades in, its variables shift, it fades out); then the live frame (round 63) stays.
    const slot = 420;
    frames.forEach((f, k) => {
      animate(f, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: slot, delay: k * slot, fill: 'none', reduce: 'none' });
      shiftAnim(f, k * slot);
    });
    animate(live, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: frames.length * slot, reduce: 'none' });
  };
  return wrap;
}

export default {
  type: 'table',
  render(d) {
    const hl = new Set(d.highlightRows || []);
    const table = h('table', { class: `v-table${d.mono ? ' mono' : ''}${d.compact ? ' is-compact' : ''}` },
      h('thead', {}, h('tr', {}, d.headers.map((x) => h('th', {}, x)))),
      h('tbody', {}, d.rows.map((r, i) => h('tr', { class: hl.has(i) ? 'is-hl' : '' }, r.map((c) => h('td', {}, String(c)))))));
    const wrap = h('div', { class: `table-wrap${d.scroll ? ' is-scroll' : ''}` }, table);
    if (!d.rows.length) wrap.append(h('p', { class: 'muted small' }, 'No rows yet.'));
    // Keep the newest highlighted row in view (e.g. brute-force progress).
    queueMicrotask(() => { const row = wrap.querySelector('tr.is-hl'); if (row && wrap.scrollHeight > wrap.clientHeight) wrap.scrollTop = row.offsetTop - wrap.clientHeight / 2; });

    if (isSchedule(d)) {
      // Column pairs (t, Wₜ): 0–15 come from the block; 16–63 are derived.
      const groups = [0, 1, 2, 3].map((g) => [...table.querySelectorAll('tbody tr')].flatMap((tr) => [tr.children[2 * g], tr.children[2 * g + 1]]));
      groups.forEach((cells, g) => cells.forEach((td) => td.classList.add(g === 0 ? 'w-block' : 'w-derived')));
      groups.forEach((cells, g) => stagger(cells.filter((_, k) => k % 2), [{ opacity: 0.25, transform: g ? 'translateX(-6px)' : 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 220, each: 18, maxTotal: 300, delay: 150 + g * 330 }));
      return h('div', { class: 'v-schedule' },
        h('p', { class: 'sched-legend small' }, h('span', { class: 'lg lg-block' }, 'W₀–W₁₅: the 16 words of the 512-bit block'), h('span', { class: 'lg lg-derived' }, 'W₁₆–W₆₃: derived from earlier words')),
        wrap);
    }
    if (isRounds(d) && d.rows.length) {
      const strip = registerStrip(d);
      const el = h('div', { class: 'v-rounds' }, strip, wrap);
      el.afterMount = () => strip.afterMount();
      return el;
    }
    return wrap;
  },
};

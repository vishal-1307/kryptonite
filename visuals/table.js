import { h } from '../core/dom.js';
import { animate, stagger, pop, DUR, EASE } from './anim.js';
import { hexDiff, registerRows } from './teach.js';
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

/** Hex value with the digits that changed since `prev` marked (a and e get new values every round). */
const diffCode = (prev, now) => { const ch = hexDiff(prev, now); return h('code', {}, [...String(now)].map((c, k) => (prev != null && ch[k] ? h('span', { class: 'hex-chg' }, c) : c))); };
function registerStrip(d, step) {
  const rows = registerRows(step, d.rows);
  const prevRow = (t) => (t > 0 ? rows[t - 1] : null);
  const frameFor = (row) => h('div', { class: 'reg-frame' },
    h('span', { class: 'reg-t' }, `after round t = ${row[0]}`),
    h('div', { class: 'reg-cells' }, VARS.map((v, i) => h('div', { class: `reg-cell${i === 0 || i === 4 ? ' is-new' : ''}` },
      h('span', { class: 'reg-name' }, v), (i === 0 || i === 4) && prevRow(Number(row[0])) ? diffCode(prevRow(Number(row[0]))[i + 1], row[i + 1]) : h('code', {}, String(row[i + 1])),
      h('small', {}, i === 0 ? 'T1 + T2' : i === 4 ? 'd + T1' : `← ${VARS[i - 1]}`)))));
  const picks = [0, 1, 2, 3].filter((t) => t < d.rows.length);
  const lastIdx = d.rows.length - 1;
  const frames = picks.map((t) => frameFor(d.rows[t]));
  const live = frameFor(d.rows[lastIdx]); // resting frame (round 63)
  live.classList.add('is-live');
  const stack = h('div', { class: 'reg-stack' }, frames, live);
  const slider = h('input', { type: 'range', min: 0, max: lastIdx, value: lastIdx, class: 'reg-slider', 'aria-label': 'Show the working variables after round t' });
  const sliderWrap = h('label', { class: 'reg-slide-wrap' }, h('span', { class: 'small muted' }, 'Round'), slider);
  const wrap = h('div', { class: 'v-register' },
    h('div', { class: 'reg-head' }, h('strong', {}, 'Working variables a…h'), h('span', { class: 'muted small' }, 'each round every variable moves one place; a and e get new values')),
    stack, sliderWrap);

  const shiftAnim = (frame, delay) => {
    const cells = [...frame.querySelectorAll('.reg-cell')];
    const rects = cells.map((c) => c.getBoundingClientRect());
    // Each value slides a short way in from the left inside its own cell (the cell clips it) while fading up, so
    // neighbouring values never overlap mid-shift and a paused frame still reads; new a and e cross-fade in. The cells and their names stay put.
    cells.forEach((c, i) => {
      const val = c.querySelector('code');
      if (i === 0 || i === 4) {
        animate(val, [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: 320, delay, fill: 'none' });
        pop(c, { delay: delay + 120, fill: 'none' });
        return;
      }
      const w = rects[i].width;
      animate(val, [{ transform: `translateX(${-w * 0.45}px)`, opacity: 0.25 }, { transform: 'none', opacity: 1 }], { duration: 320, delay, easing: EASE.out, fill: 'none' });
    });
  };
  const setLive = (t) => {
    const row = d.rows[t];
    live.querySelector('.reg-t').textContent = `after round t = ${row[0]}`;
    live.querySelectorAll('.reg-cell code').forEach((c, i) => { c.replaceWith((i === 0 || i === 4) && prevRow(t) ? diffCode(prevRow(t)[i + 1], row[i + 1]) : h('code', {}, String(row[i + 1]))); });
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
    // The slider shows the live frame's round (63), so it stays hidden while rounds 0–3 play, then fades in.
    animate(sliderWrap, [{ opacity: 0, visibility: 'hidden' }, { opacity: 1, visibility: 'visible' }], { duration: 200, delay: frames.length * slot, reduce: 'none' });
  };
  return wrap;
}

/**
 * SHA-256 "registers in selected rounds" (step.meta.rounds = [{ t, before, after, T1, T2 }]): pick a round and see,
 * register by register, the value before → after, with changed hex digits marked; a and e are new (green),
 * the other six are copies of their neighbour (b←a …), so the "shift register" is visible at a glance.
 */
function roundDiff(meta) {
  const rounds = meta.rounds;
  const newSet = new Set(meta.newRegisters || ['a', 'e']);
  const from = meta.shiftedRegisters || { b: 'a', c: 'b', d: 'c', f: 'e', g: 'f', h: 'g' };
  const pick = h('div', { class: 'segmented rd-pick', role: 'radiogroup', 'aria-label': 'Round' });
  const grid = h('div', { class: 'reg-cells rd-cells' });
  const head = h('p', { class: 'rd-head small' });
  const show = (k, animateIt) => {
    const r = rounds[k];
    pick.querySelectorAll('button').forEach((b, i) => { const on = i === k; b.classList.toggle('is-active', on); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    head.replaceChildren('Round t = ', h('b', {}, String(r.t)), ': ', h('span', { class: 'rd-new' }, 'new value'), ' · ', h('span', { class: 'rd-moved' }, 'moved from the neighbour'), ' · changed digits are underlined');
    grid.replaceChildren(...VARS.map((v) => {
      const isNew = newSet.has(v);
      const changed = String(r.before[v]) !== String(r.after[v]);
      return h('div', { class: `reg-cell rd-cell${isNew ? ' is-new' : ' is-moved'}${changed ? '' : ' is-same'}` },
        h('span', { class: 'reg-name' }, v),
        h('small', { class: 'rd-before', title: 'before this round' }, String(r.before[v])),
        diffCode(r.before[v], r.after[v]),
        h('small', {}, isNew ? (v === 'a' ? 'T1 + T2' : 'd + T1') : `← ${from[v] || '?'}`));
    }));
    if (animateIt) stagger(grid.querySelectorAll('.hex-chg'), [{ opacity: 0.2 }, { opacity: 1 }], { duration: 200, each: 8, maxTotal: 400 });
  };
  rounds.forEach((r, k) => pick.append(h('button', { type: 'button', role: 'radio', onclick: () => show(k, true) }, String(r.t))));
  pick.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    const cur = [...pick.children].findIndex((b) => b.classList.contains('is-active'));
    const n = (cur + (e.key === 'ArrowRight' ? 1 : -1) + rounds.length) % rounds.length;
    show(n, true); pick.children[n].focus();
  });
  show(0, false);
  return h('div', { class: 'v-register v-rounddiff' }, h('div', { class: 'reg-head' }, h('strong', {}, 'What changed in round'), pick), head, grid);
}

export default {
  type: 'table',
  render(d, step) {
    const hl = new Set(d.highlightRows || []);
    const hc = new Set(d.highlightCols || []);
    const table = h('table', { class: `v-table${d.mono ? ' mono' : ''}${d.compact ? ' is-compact' : ''}` },
      h('thead', {}, h('tr', {}, d.headers.map((x, j) => h('th', { class: hc.has(j) ? 'is-col-hl' : null }, x)))),
      h('tbody', {}, d.rows.map((r, i) => h('tr', { class: hl.has(i) ? 'is-hl' : '' }, r.map((c, j) => h('td', { class: hc.has(j) ? 'is-col-hl' : null }, String(c)))))));
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
    if (step && step.meta && Array.isArray(step.meta.rounds) && step.meta.rounds.length && step.meta.rounds[0].before) {
      return h('div', { class: 'v-rounds' }, roundDiff(step.meta), wrap);
    }
    if (isRounds(d) && d.rows.length) {
      const strip = registerStrip(d, step);
      const el = h('div', { class: 'v-rounds' }, strip, wrap);
      el.afterMount = () => strip.afterMount();
      return el;
    }
    return wrap;
  },
};

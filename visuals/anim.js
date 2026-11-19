// Tiny animation helper built on the Web Animations API (no libraries).
//
// Design rules that keep stepping snappy:
//  • Animations only describe the *journey*; the element's resting DOM/CSS is always the final state.
//    So finishing or cancelling an animation early can never leave the stage in a wrong state.
//  • Every animation started here is tracked. Before a new step renders, the app calls settle(), which
//    jumps all running animations to their end — rapid Next clicks never queue up or overlap.
//  • prefers-reduced-motion: movement is replaced by a short fade (or skipped entirely).

const running = new Set();
let speed = 1;
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

let userPref = 'auto'; // 'auto' (follow the OS) | 'reduce' (manual toggle in the top bar)

/** Manual preference from the in-app toggle. Combined with the OS setting: either one can turn motion down. */
export function setMotionPreference(p) { userPref = p === 'reduce' ? 'reduce' : 'auto'; if (userPref === 'reduce') settle(); }
export const motionPreference = () => userPref;
/** True when the OS asks for reduced motion OR the user switched it on in the app. */
export const reduced = () => userPref === 'reduce' || !!(mq && mq.matches);

/** Playback speed multiplier (the player's 0.5×…4×) — faster playback means shorter animations. */
export function setSpeed(x) { speed = x > 0 ? x : 1; }

/** Motion tokens (ms). Mirrors the --dur-* CSS custom properties in styles.css. */
export const DUR = { fast: 160, base: 320, slow: 560, travel: 900 };
export const EASE = {
  out: 'cubic-bezier(.2, .8, .2, 1)',
  inOut: 'cubic-bezier(.6, 0, .2, 1)',
  spring: 'cubic-bezier(.3, 1.4, .5, 1)',
};

const scale = (ms) => Math.round(ms / speed);

/**
 * Animate `el` with keyframes. Options are WAAPI options plus:
 *   reduce: 'fade' (default) → a short opacity fade when reduced motion is on; 'none' → skip entirely.
 * Durations/delays are scaled by the playback speed. Returns the Animation (or null).
 */
export function animate(el, keyframes, { reduce = 'fade', ...opts } = {}) {
  if (!el || typeof el.animate !== 'function') return null;
  let a;
  if (reduced()) {
    if (reduce === 'none') return null;
    a = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear', fill: 'backwards' });
  } else {
    a = el.animate(keyframes, {
      easing: EASE.out, fill: 'backwards', ...opts,
      duration: scale(opts.duration ?? DUR.base), delay: scale(opts.delay ?? 0),
    });
  }
  running.add(a);
  const done = () => running.delete(a);
  a.finished.then(done, done);
  return a;
}

/** Stagger helper: animate a list with an increasing delay (total spread capped so long lists stay quick). */
export function stagger(list, keyframes, { each = 60, maxTotal = 700, ...opts } = {}) {
  const items = [...list];
  const gap = items.length > 1 ? Math.min(each, maxTotal / (items.length - 1)) : 0;
  return items.map((el, i) => animate(el, keyframes, { ...opts, delay: (opts.delay || 0) + i * gap }));
}

/** Standard "appear" motion used for new visuals on a step change. Starts already readable (opacity .5, no delay)
 *  so a step change is visible on the very first frame; the motion only adds polish. */
export const enter = (el, opts = {}) => animate(el, [{ opacity: 0.5, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 200, ...opts, delay: 0 });

/** Attention pulse for something that just changed (resting state is unchanged). */
export const pop = (el, opts = {}) => animate(el, [{ transform: 'scale(.82)' }, { transform: 'scale(1.1)', offset: 0.6 }, { transform: 'none' }], { duration: DUR.base, easing: EASE.out, reduce: 'none', ...opts });

/** Jump every running animation to its end state. Called before each step renders. */
export function settle() {
  for (const a of [...running]) { try { a.finish(); } catch { a.cancel(); } }
  running.clear();
}

/** Number of animations still running (used by tests/screenshots). */
export const activeCount = () => running.size;

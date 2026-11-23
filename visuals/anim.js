// Tiny animation helper built on the Web Animations API (no libraries).
//
// Design rules that keep stepping snappy:
//  • Animations only describe the *journey*; the element's resting DOM/CSS is always the final state.
//    So finishing or cancelling an animation early can never leave the stage in a wrong state.
//  • Every animation started here is tracked. Before a new step renders, the app calls settle(), which
//    jumps all running animations to their end — rapid Next clicks never queue up or overlap.
//  • Reduced motion (OS setting or the in-app toggle): everything is shown instantly — including a
//    visual's entrance. No fades, no delays, so a step is in its final state on the first frame.

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
export function setSpeed(x) {
  const next = x > 0 ? x : 1;
  // Animations already in flight (running or paused) were timed for the old speed: rescale them, so changing the
  // speed mid-step neither restarts nor desynchronises them (their relative order and progress are kept).
  if (next !== speed) for (const a of running) { try { a.playbackRate = (a.playbackRate || 1) * (next / speed); } catch { /* gone */ } }
  speed = next;
}

/** Motion tokens (ms). Mirrors the --dur-* CSS custom properties in styles.css. */
export const DUR = { fast: 160, base: 320, slow: 560, travel: 900 };
export const EASE = {
  out: 'cubic-bezier(.2, .7, .2, 1)',
  inOut: 'cubic-bezier(.6, 0, .2, 1)',
  spring: 'cubic-bezier(.2, .7, .2, 1)', // kept for callers; no overshoot (calm motion, no bounce)
};

const scale = (ms) => Math.round(ms / speed);

/**
 * Animate `el` with keyframes. Options are WAAPI options plus:
 *   reduce: kept for callers; under reduced motion every animation is skipped (shown instantly).
 * Durations/delays are scaled by the playback speed. Returns the Animation (or null).
 */
export function animate(el, keyframes, { reduce = 'skip', ...opts } = {}) {
  if (!el || typeof el.animate !== 'function') return null;
  if (reduced()) return null;
  const a = el.animate(keyframes, {
    easing: EASE.out, fill: 'backwards', ...opts,
    duration: scale(opts.duration ?? DUR.base), delay: scale(opts.delay ?? 0),
  });
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
 *  so a step change is visible on the very first frame; the motion only adds polish. Under reduced motion this
 *  is skipped, so the visual is in its final state immediately. */
export const enter = (el, opts = {}) => animate(el, [{ opacity: 0.5, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 200, ...opts, delay: 0 });

/** Attention cue for something that just changed: a short settle from slightly smaller, no overshoot (resting state is unchanged). */
export const pop = (el, opts = {}) => animate(el, [{ transform: 'scale(.9)', opacity: 0.6 }, { transform: 'none', opacity: 1 }], { duration: DUR.base, easing: EASE.out, reduce: 'none', ...opts });

/** Jump every running animation to its end state. Called before each step renders. */
export function settle() {
  for (const a of [...running]) { try { a.finish(); } catch { a.cancel(); } }
  running.clear();
  for (const a of pausedExtra) { try { a.finish(); } catch { /* gone */ } }
  pausedExtra.clear();
}

/** Pause every running animation in place (the player's Pause). resumeAll() continues them from the same frame. */
// CSS transitions/animations inside `root` (e.g. the Caesar wheel's rotation) are paused too, so nothing on the
// stage keeps moving while the player is paused.
const pausedExtra = new Set();
export function pauseAll(root) {
  for (const a of running) { try { if (a.playState === 'running') a.pause(); } catch { /* already gone */ } }
  if (root && typeof root.getAnimations === 'function') {
    for (const a of root.getAnimations({ subtree: true })) if (!running.has(a) && a.playState === 'running') { try { a.pause(); pausedExtra.add(a); } catch { /* gone */ } }
  }
}
export function resumeAll() {
  for (const a of [...running]) { try { if (a.playState === 'paused') a.play(); } catch { running.delete(a); } }
  for (const a of pausedExtra) { try { if (a.playState === 'paused') a.play(); } catch { /* gone */ } }
  pausedExtra.clear();
}
/** Drop every tracked animation without waiting (view unmounted): finish them so nothing keeps a reference to old DOM. */
export function cancelAll() { settle(); }
export const pausedCount = () => [...running].filter((a) => a.playState === 'paused').length;

/** Longest a step's animations may take at 1× (ms); the player shows a step for 1400 ms, so ≥0.4 s stays settled. */
export const STEP_CAP = 1000;

/**
 * Settle cap: called once a step has rendered. If the animations it started would end later than STEP_CAP
 * (scaled by playback speed), they are all sped up by the same factor, so their order and sync are kept and
 * the whole step settles within the cap. Returns the factor applied (1 = unchanged).
 */
export function fitStep(cap = STEP_CAP) {
  const list = [...running];
  if (!list.length) return 1;
  const end = Math.max(...list.map((a) => {
    const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
    return t ? t.endTime - (a.currentTime || 0) : 0;
  }));
  const limit = scale(cap);
  if (!(end > limit)) return 1;
  const r = end / limit;
  for (const a of list) a.playbackRate = (a.playbackRate || 1) * r;
  return r;
}

/** Number of animations still running (used by tests/screenshots). */
export const activeCount = () => running.size;

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as anim from '../visuals/anim.js';

// Minimal stand-in for an Element with the Web Animations API (Node has no DOM).
function fakeEl() {
  const calls = [];
  return {
    calls,
    animate(keyframes, opts) {
      const a = { keyframes, opts, finished: new Promise(() => {}), finishedCalled: false, finish() { this.finishedCalled = true; }, cancel() {} };
      calls.push(a);
      return a;
    },
  };
}

test('reduce-motion toggle: manual preference combines with the OS setting', () => {
  anim.setMotionPreference('auto');
  assert.equal(anim.reduced(), false, 'no OS preference in Node, toggle off → full motion');
  anim.setMotionPreference('reduce');
  assert.equal(anim.motionPreference(), 'reduce');
  assert.equal(anim.reduced(), true);
  anim.setMotionPreference('anything-else');
  assert.equal(anim.motionPreference(), 'auto');
  assert.equal(anim.reduced(), false);
});

test('reduced motion: animations are skipped; only a visual\'s entrance keeps one ≤120 ms fade', () => {
  anim.setMotionPreference('reduce');
  const el = fakeEl();
  assert.equal(anim.animate(el, [{ transform: 'translateX(40px)' }, { transform: 'none' }], { duration: 800, delay: 300 }), null, 'default: skipped, shown instantly');
  assert.equal(anim.animate(el, [{ opacity: 0 }, { opacity: 1 }], { reduce: 'none' }), null);
  assert.equal(anim.stagger([el, el, el], [{ opacity: 0 }, { opacity: 1 }], { each: 200 }).filter(Boolean).length, 0, 'nested reveals never stack');
  assert.equal(el.calls.length, 0);
  anim.enter(el);
  assert.equal(el.calls.length, 1, 'enter() still fades the whole visual');
  assert.deepEqual(el.calls[0].keyframes, [{ opacity: 0 }, { opacity: 1 }]);
  assert.ok(el.calls[0].opts.duration <= 120 && !el.calls[0].opts.delay, 'at most 120 ms, no delay');
  anim.settle();
  anim.setMotionPreference('auto');
  const el2 = fakeEl();
  anim.setSpeed(2);
  anim.animate(el2, [{ transform: 'scale(.5)' }, { transform: 'none' }], { duration: 800, delay: 100 });
  assert.equal(el2.calls[0].opts.duration, 400, 'durations scale with playback speed');
  assert.equal(el2.calls[0].opts.delay, 50);
  anim.setSpeed(1);
  anim.settle();
  assert.equal(el2.calls[0].finishedCalled, true, 'settle() finishes running animations');
  assert.equal(anim.activeCount(), 0);
});

test('switching reduce-motion on settles animations already running', () => {
  anim.setMotionPreference('auto');
  const el = fakeEl();
  anim.animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 1000 });
  assert.equal(anim.activeCount(), 1);
  anim.setMotionPreference('reduce');
  assert.equal(el.calls[0].finishedCalled, true);
  assert.equal(anim.activeCount(), 0);
  anim.setMotionPreference('auto');
});

// Fake animation with real-looking timing, for the settle cap.
function timedAnim(delay, duration) {
  return { playbackRate: 1, currentTime: 0, effect: { getComputedTiming: () => ({ endTime: delay + duration }) }, finished: new Promise(() => {}), finish() {}, cancel() {} };
}
function timedEl(delay, duration) { return { animate: () => timedAnim(delay, duration) }; }

test('settle cap: a step longer than 1.0 s is sped up uniformly; shorter steps are untouched', () => {
  anim.setMotionPreference('auto'); anim.setSpeed(1); anim.settle();
  assert.equal(anim.STEP_CAP, 1000);
  const a = anim.animate(timedEl(0, 400), [{}, {}]), b = anim.animate(timedEl(1100, 400), [{}, {}]); // ends at 1500 ms
  const r = anim.fitStep();
  assert.equal(r, 1.5);
  assert.equal(a.playbackRate, 1.5); assert.equal(b.playbackRate, 1.5, 'same factor for all keeps them in sync');
  anim.settle();
  const c = anim.animate(timedEl(200, 600), [{}, {}]); // ends at 800 ms
  assert.equal(anim.fitStep(), 1);
  assert.equal(c.playbackRate, 1);
  anim.settle();
  anim.setSpeed(2); // at 2× the cap is 500 ms
  const d = anim.animate(timedEl(0, 1000), [{}, {}]);
  assert.equal(anim.fitStep(), 2);
  assert.equal(d.playbackRate, 2);
  anim.settle(); anim.setSpeed(1);
  assert.equal(anim.fitStep(), 1, 'nothing running → nothing to do');
});

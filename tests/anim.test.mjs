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

test('reduced motion: movement becomes a short fade, or nothing for reduce:"none"', () => {
  anim.setMotionPreference('reduce');
  const el = fakeEl();
  anim.animate(el, [{ transform: 'translateX(40px)' }, { transform: 'none' }], { duration: 800 });
  assert.equal(el.calls.length, 1);
  assert.deepEqual(el.calls[0].keyframes, [{ opacity: 0 }, { opacity: 1 }]);
  assert.ok(el.calls[0].opts.duration <= 150);
  assert.equal(anim.animate(el, [{ opacity: 0 }, { opacity: 1 }], { reduce: 'none' }), null);
  assert.equal(el.calls.length, 1, 'reduce:"none" skips the animation entirely');
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

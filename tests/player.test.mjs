import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { StepPlayer } from '../core/player.js';

const steps = (n) => Array.from({ length: n }, (_, i) => ({ title: `s${i}` }));

test('player: 1× autoplay advances every 1400 ms, and Play advances one step immediately', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const p = new StepPlayer();
    assert.equal(p.baseDelay, 1400);
    p.load(steps(5));
    p.play();
    assert.equal(p.index, 1, 'Play moves to the next step right away');
    assert.equal(p.playing, true);
    mock.timers.tick(1399); assert.equal(p.index, 1);
    mock.timers.tick(1); assert.equal(p.index, 2);
    mock.timers.tick(1400); assert.equal(p.index, 3);
    mock.timers.tick(1400); assert.equal(p.index, 4);
    mock.timers.tick(1400); assert.equal(p.playing, false, 'stops at the last step');
    assert.equal(p.index, 4);
  } finally { mock.timers.reset(); }
});

test('player: speed divides the delay; Play at the end restarts from step 1; last-step advance pauses', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const p = new StepPlayer();
    p.load(steps(6));
    p.setSpeed(2);
    p.play(); assert.equal(p.index, 1);
    mock.timers.tick(700); assert.equal(p.index, 2);
    p.pause(); mock.timers.tick(5000); assert.equal(p.index, 2, 'paused player does not advance');
    p.last(); p.play(); assert.equal(p.index, 0, 'restart from the beginning');
    p.pause(); p.go(4); p.play();
    assert.equal(p.index, 5); assert.equal(p.playing, false, 'reaching the last step immediately pauses');
  } finally { mock.timers.reset(); }
});

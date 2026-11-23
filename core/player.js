// Step player: holds the step list and the playback state. UI-agnostic; the app subscribes via onChange.
// Pause during autoplay is resumable: Play then continues the same step for the time that was left (and the
// app resumes the paused animations through onResume) instead of jumping ahead. Any manual navigation
// (go/next/prev/first/last/load) drops the resume point, so Play after that behaves as before.
export class StepPlayer {
  constructor({ onChange, onPause, onResume, baseDelay = 1400, now = () => Date.now() } = {}) { // ms per step at 1× (delay = baseDelay / speed)
    this.steps = [];
    this.index = 0;
    this.playing = false;
    this.speed = 1;
    this.baseDelay = baseDelay;
    this.onChange = onChange || (() => {});
    this.onPause = onPause || (() => {});
    this.onResume = onResume || (() => {});
    this.now = now;
    this.timer = null;
    this.stepStarted = 0; // when the current autoplay delay started
    this.stepDelay = 0; // length of the current autoplay delay
    this.resumeIn = null; // ms left on the step when autoplay was paused (null = nothing to resume)
  }
  get delay() { return this.baseDelay / this.speed; }
  get resumable() { return this.resumeIn !== null; }
  load(steps) { this.pause(false); this.resumeIn = null; this.steps = steps; this.index = 0; this.emit(); }
  get current() { return this.steps[this.index]; }
  get atEnd() { return this.index >= this.steps.length - 1; }
  go(i) { this.resumeIn = null; this.index = Math.max(0, Math.min(this.steps.length - 1, i)); this.emit(); }
  next() { if (!this.atEnd) this.go(this.index + 1); else this.pause(); }
  prev() { this.go(this.index - 1); }
  first() { this.go(0); }
  last() { this.go(this.steps.length - 1); }
  setSpeed(x) {
    const next = x > 0 ? x : 1;
    if (next === this.speed) return;
    const ratio = this.speed / next;
    this.speed = next;
    // Keep the progress through the current step: the time that is left shrinks/grows with the new speed.
    // The index never changes here, and a paused step stays paused (only its resume time is rescaled).
    if (this.playing) this.schedule(Math.max(0, this.stepDelay - (this.now() - this.stepStarted)) * ratio);
    else if (this.resumeIn !== null) this.resumeIn *= ratio;
    this.emit();
  }
  play() {
    if (!this.steps.length) return;
    if (this.resumeIn !== null && !this.atEnd) { // continue the paused step where it stopped
      const left = this.resumeIn;
      this.resumeIn = null;
      this.playing = true;
      this.onResume(this);
      this.schedule(left);
      this.emit();
      return;
    }
    this.resumeIn = null;
    this.playing = true;
    if (this.atEnd) { this.index = 0; this.emit(); } // restart from the first step
    else { this.index += 1; this.emit(); } // advance immediately so pressing Play gives instant feedback
    if (this.atEnd) { this.pause(); return; }
    this.schedule();
  }
  pause(emit = true) {
    const wasPlaying = this.playing;
    this.playing = false;
    clearTimeout(this.timer); this.timer = null;
    if (wasPlaying && emit && !this.atEnd) {
      this.resumeIn = Math.max(0, this.stepDelay - (this.now() - this.stepStarted));
      this.onPause(this);
    }
    if (emit) this.emit();
  }
  toggle() { this.playing ? this.pause() : this.play(); }
  schedule(ms = this.delay) {
    clearTimeout(this.timer);
    this.stepStarted = this.now(); this.stepDelay = ms;
    this.timer = setTimeout(() => {
      if (!this.playing) return;
      if (this.atEnd) { this.pause(); return; }
      this.index += 1; this.emit();
      this.schedule();
    }, ms);
  }
  /** Stop for good (view unmounted): no timer, no more callbacks. */
  dispose() { this.playing = false; clearTimeout(this.timer); this.timer = null; this.resumeIn = null; this.onChange = this.onPause = this.onResume = () => {}; }
  emit() { this.onChange(this); }
}

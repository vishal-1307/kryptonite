// Step player: holds the step list and the playback state. UI-agnostic; the app subscribes via onChange.
export class StepPlayer {
  constructor({ onChange, baseDelay = 1400 } = {}) { // ms per step at 1× (delay = baseDelay / speed)
    this.steps = [];
    this.index = 0;
    this.playing = false;
    this.speed = 1;
    this.baseDelay = baseDelay;
    this.onChange = onChange || (() => {});
    this.timer = null;
  }
  load(steps) { this.pause(false); this.steps = steps; this.index = 0; this.emit(); }
  get current() { return this.steps[this.index]; }
  get atEnd() { return this.index >= this.steps.length - 1; }
  go(i) { this.index = Math.max(0, Math.min(this.steps.length - 1, i)); this.emit(); }
  next() { if (!this.atEnd) this.go(this.index + 1); else this.pause(); }
  prev() { this.go(this.index - 1); }
  first() { this.go(0); }
  last() { this.go(this.steps.length - 1); }
  setSpeed(x) { this.speed = x; if (this.playing) this.schedule(); this.emit(); }
  play() {
    if (!this.steps.length) return;
    this.playing = true;
    if (this.atEnd) { this.index = 0; this.emit(); } // restart from the first step
    else this.go(this.index + 1); // advance immediately so pressing Play gives instant feedback
    if (this.atEnd) { this.pause(); return; }
    this.schedule();
  }
  pause(emit = true) { this.playing = false; clearTimeout(this.timer); if (emit) this.emit(); }
  toggle() { this.playing ? this.pause() : this.play(); }
  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.playing) return;
      if (this.atEnd) { this.pause(); return; }
      this.go(this.index + 1);
      this.schedule();
    }, this.baseDelay / this.speed);
  }
  emit() { this.onChange(this); }
}

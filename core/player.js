// Step player: holds the step list and the playback state. UI-agnostic; the app subscribes via onChange.
export class StepPlayer {
  constructor({ onChange, baseDelay = 2200 } = {}) {
    this.steps = [];
    this.index = 0;
    this.prevIndex = -1; // index shown before the current one (-1 after load) — lets visuals animate forward vs back
    this.playing = false;
    this.speed = 1;
    this.baseDelay = baseDelay;
    this.onChange = onChange || (() => {});
    this.timer = null;
  }
  load(steps) { this.pause(false); this.steps = steps; this.prevIndex = -1; this.index = 0; this.emit(); }
  get current() { return this.steps[this.index]; }
  /** +1 when moving forward, −1 when moving back, 0 on a fresh load or re-render of the same step. */
  get direction() { return this.prevIndex < 0 ? 0 : Math.sign(this.index - this.prevIndex); }
  get atEnd() { return this.index >= this.steps.length - 1; }
  go(i) { this.prevIndex = this.index; this.index = Math.max(0, Math.min(this.steps.length - 1, i)); this.emit(); }
  next() { if (!this.atEnd) this.go(this.index + 1); else this.pause(); }
  prev() { this.go(this.index - 1); }
  first() { this.go(0); }
  last() { this.go(this.steps.length - 1); }
  setSpeed(x) { this.speed = x; if (this.playing) this.schedule(); this.emit(); }
  play() {
    if (!this.steps.length) return;
    if (this.atEnd) this.index = 0;
    this.playing = true; this.emit(); this.schedule();
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

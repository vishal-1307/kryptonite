// A Scope owns everything asynchronous that belongs to one view: timeouts, intervals, animation frames,
// observers, event listeners and an AbortSignal for fetches. dispose() cancels all of it at once, and
// `alive` / `guard(fn)` let late callbacks (e.g. a resolved fetch) check that their view is still current.
// The app creates one Scope per rendered method view and disposes it on route change and before a re-render.
export class Scope {
  constructor(name = '') {
    this.name = name;
    this.alive = true;
    this.controller = typeof AbortController === 'function' ? new AbortController() : null;
    this._timeouts = new Set();
    this._intervals = new Set();
    this._frames = new Set();
    this._cleanups = [];
  }
  get signal() { return this.controller ? this.controller.signal : undefined; }
  setTimeout(fn, ms) {
    if (!this.alive) return null;
    const id = setTimeout(() => { this._timeouts.delete(id); if (this.alive) fn(); }, ms);
    this._timeouts.add(id);
    return id;
  }
  clearTimeout(id) { if (id == null) return; clearTimeout(id); this._timeouts.delete(id); }
  setInterval(fn, ms) {
    if (!this.alive) return null;
    const id = setInterval(() => { if (this.alive) fn(); }, ms);
    this._intervals.add(id);
    return id;
  }
  requestAnimationFrame(fn) {
    if (!this.alive || typeof requestAnimationFrame !== 'function') return null;
    const id = requestAnimationFrame((t) => { this._frames.delete(id); if (this.alive) fn(t); });
    this._frames.add(id);
    return id;
  }
  /** Register any cleanup (observer.disconnect, removeEventListener, …). */
  add(cleanup) { if (typeof cleanup !== 'function') return; if (this.alive) this._cleanups.push(cleanup); else cleanup(); }
  listen(target, type, fn, opts) { target.addEventListener(type, fn, opts); this.add(() => target.removeEventListener(type, fn, opts)); }
  observe(observer, ...targets) { targets.forEach((t) => observer.observe(t)); this.add(() => observer.disconnect()); return observer; }
  /** Wrap a callback so it silently does nothing once this scope is disposed. */
  guard(fn) { return (...args) => (this.alive ? fn(...args) : undefined); }
  dispose() {
    if (!this.alive) return;
    this.alive = false;
    this._timeouts.forEach((id) => clearTimeout(id));
    this._intervals.forEach((id) => clearInterval(id));
    if (typeof cancelAnimationFrame === 'function') this._frames.forEach((id) => cancelAnimationFrame(id));
    this._timeouts.clear(); this._intervals.clear(); this._frames.clear();
    for (const c of this._cleanups.splice(0)) { try { c(); } catch { /* keep disposing */ } }
    if (this.controller) this.controller.abort();
  }
}

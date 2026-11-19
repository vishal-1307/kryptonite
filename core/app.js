import { h } from './dom.js';
import { methods, categoryOrder } from '../registry.js';
import { visuals } from '../visuals/index.js';
import { getActions, validate, runAction, defaultValues } from './contract.js';
import { buildForm } from './form.js';
import { StepPlayer } from './player.js';
import * as anim from '../visuals/anim.js';

const $ = (sel, root = document) => root.querySelector(sel);
const byId = Object.fromEntries(methods.map((m) => [m.id, m]));

// ------------------------------------------------------------ categories
function grouped() {
  const cats = [...categoryOrder];
  for (const m of methods) if (!cats.includes(m.category)) cats.push(m.category);
  return cats.map((c) => [c, methods.filter((m) => m.category === c)]).filter(([, list]) => list.length);
}
const catSlug = (c) => c.toLowerCase().replace(/[^a-z]+/g, '-');
// Teacher-facing groups (registry categories stay as they are; unknown categories get their own group).
const GROUPS = [
  ['Classical ciphers', ['Classical']],
  ['Modern cryptography', ['Symmetric', 'Asymmetric', 'Key Exchange']],
  ['Hashing & encoding', ['Hashing', 'Encoding']],
];
function groups() {
  const known = new Set(GROUPS.flatMap(([, c]) => c));
  const extra = grouped().filter(([c]) => !known.has(c)).map(([c, list]) => [c, list]);
  return [...GROUPS.map(([name, cats]) => [name, methods.filter((m) => cats.includes(m.category))]), ...extra].filter(([, list]) => list.length);
}
const firstSentence = (t) => (t.match(/^.*?[.!?](?=\s|$)/) || [t])[0];

// ------------------------------------------------------------ preferences
const prefs = {
  get(k, d) { try { return localStorage.getItem(`cv-${k}`) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`cv-${k}`, v); } catch { /* private mode */ } },
};
function applyPrefs() {
  // Light is the default; dark only when the user picked it (the OS preference is deliberately ignored).
  const dark = prefs.get('theme', 'light') === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('large', prefs.get('large', '0') === '1');
  const tt = $('#theme-toggle');
  tt.removeAttribute('aria-pressed');
  tt.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  tt.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  tt.querySelector('.theme-label').textContent = dark ? 'Light' : 'Dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#000000' : '#ffffff';
  $('#large-toggle').setAttribute('aria-pressed', prefs.get('large', '0') === '1');
}
$('#theme-toggle').addEventListener('click', () => { prefs.set('theme', document.documentElement.classList.contains('dark') ? 'light' : 'dark'); applyPrefs(); });
// Presentation mode (big text + high contrast for projectors). Toggle with the top-bar button or the P key.
function togglePresentation() { prefs.set('large', prefs.get('large', '0') === '1' ? '0' : '1'); applyPrefs(); }
$('#large-toggle').addEventListener('click', togglePresentation);
$('#large-toggle').title = 'Projector mode: big text, high contrast (P)';

// Reduce-motion toggle (stored in localStorage; combined with the OS prefers-reduced-motion setting).
const motionBtn = h('button', { id: 'motion-toggle', class: 'icon-btn', type: 'button', title: 'Turn animations off (M)', 'aria-label': 'Reduce motion', 'aria-pressed': 'false',
  html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg><span class="icon-label">Motion</span>' });
$('.top-actions').prepend(motionBtn);
function applyMotion() {
  const on = prefs.get('motion', 'auto') === 'reduce';
  anim.setMotionPreference(on ? 'reduce' : 'auto');
  document.documentElement.classList.toggle('reduce-motion', on);
  motionBtn.setAttribute('aria-pressed', on);
  motionBtn.querySelector('.icon-label').textContent = on ? 'Motion off' : 'Motion';
  motionBtn.title = on ? 'Turn animations back on (M)' : 'Turn animations off (M)';
}
function toggleMotion() { prefs.set('motion', prefs.get('motion', 'auto') === 'reduce' ? 'auto' : 'reduce'); applyMotion(); }
motionBtn.addEventListener('click', toggleMotion);
applyMotion();
applyPrefs();

// ------------------------------------------------------------ views
const main = $('#main');

function renderHome() {
  document.title = 'Kryptonite — see how ciphers work, step by step';
  setCrumb(null);
  main.className = 'view-home';
  main.replaceChildren(
    h('section', { class: 'home-head' },
      h('h1', {}, 'Choose a method'),
      h('p', { class: 'lead' }, 'Type a message and a key, press Run, then step through what the method does.')),
    ...groups().map(([name, list]) => h('section', { class: 'group', 'aria-labelledby': `g-${catSlug(name)}` },
      h('h2', { class: 'group-title', id: `g-${catSlug(name)}` }, name),
      h('ul', { class: 'method-list' }, list.map((m) => h('li', {},
        h('a', { class: 'method-row', href: `#/${m.id}` },
          h('span', { class: 'mr-name' }, m.name),
          h('span', { class: 'mr-desc' }, firstSentence(m.description)),
          new Set(list.map((x) => x.category)).size > 1 ? h('span', { class: 'mr-cat' }, m.category) : null,
          arrowIcon())))))),
  );
}
const arrowIcon = () => { const t = document.createElement('template'); t.innerHTML = '<svg class="mr-go" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'; return t.content.firstChild; };
function setCrumb(text) { const c = $('#crumb'); c.hidden = !text; c.textContent = text || ''; }

function sidebar(active) {
  return h('nav', { class: 'sidebar', 'aria-label': 'Methods' },
    h('a', { class: 'side-home', href: '#/' }, '← All methods'),
    groups().map(([cat, list]) => h('div', { class: 'side-group' },
      h('div', { class: 'side-cat' }, cat),
      list.map((m) => h('a', { href: `#/${m.id}`, class: m.id === active ? 'is-active' : '', 'aria-current': m.id === active ? 'page' : null }, m.name)))));
}

const svgIcon = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">${d}</svg>`;
const ICONS = {
  first: svgIcon('<rect x="5" y="5" width="2.5" height="14" rx="1"/><path d="M19 5.5v13a.8.8 0 0 1-1.2.7L8.6 12.7a.8.8 0 0 1 0-1.4l9.2-6.5a.8.8 0 0 1 1.2.7z"/>'),
  prev: svgIcon('<path d="M15.5 5.5v13a.8.8 0 0 1-1.3.6L6 12.6a.8.8 0 0 1 0-1.2l8.2-6.5a.8.8 0 0 1 1.3.6z"/>'),
  play: svgIcon('<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.5-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z"/>'),
  pause: svgIcon('<rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/>'),
  next: svgIcon('<path d="M8.5 5.5v13a.8.8 0 0 0 1.3.6l8.2-6.5a.8.8 0 0 0 0-1.2L9.8 4.9a.8.8 0 0 0-1.3.6z"/>'),
  last: svgIcon('<rect x="16.5" y="5" width="2.5" height="14" rx="1"/><path d="M5 5.5v13a.8.8 0 0 0 1.2.7l9.2-6.5a.8.8 0 0 0 0-1.4L6.2 4.8A.8.8 0 0 0 5 5.5z"/>'),
};

let player = null;
function renderMethod(method, actionId) {
  document.title = `${method.name} · Kryptonite`;
  setCrumb(method.name);
  main.className = 'view-method';
  const actions = getActions(method);
  let action = actions.find((a) => a.id === actionId) || actions[0];

  // --- input card
  const formErr = h('div', { class: 'form-error' }); // announced via the stage's role=alert panel (avoids double announcements)
  const form = buildForm(method, { onInput: () => scheduleRun() });
  const actionBar = h('div', { class: 'segmented mode-switch', role: 'tablist', 'aria-label': 'What to do', hidden: actions.length < 2 }, actions.map((a) => h('button', {
    type: 'button', role: 'tab', 'data-action': a.id, onclick: () => setAction(a.id, true),
  }, a.label)));
  const examples = method.examples ? h('div', { class: 'examples' }, h('span', { class: 'examples-label' }, 'Try:'), method.examples.map((ex) => h('button', { type: 'button', class: 'chip', onclick: () => { form.setValues(ex.values); run(); } }, ex.label))) : null;
  const runBtn = h('button', { type: 'button', class: 'btn btn-primary btn-run', onclick: () => run(), html: `${ICONS.play}<span>Run</span>` });
  const resetBtn = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { form.setValues(defaultValues(method)); run(); } }, 'Reset');

  // --- output card
  const outLabel = h('div', { class: 'out-label' });
  const outValue = h('output', { class: 'out-value mono' });
  const copyBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: async () => {
    try { await navigator.clipboard.writeText(outValue.textContent); copyBtn.textContent = 'Copied'; } catch { copyBtn.textContent = 'Copy failed'; }
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1200);
  } }, 'Copy');
  const chainBtn = h('button', { type: 'button', class: 'btn btn-link' });

  // --- visualizer
  const stepCount = h('span', { class: 'step-count', 'aria-hidden': 'true' });
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' }); // announces step changes
  const stepTitle = h('h3', { class: 'step-title' });
  const stage = h('div', { class: 'stage', role: 'group', 'aria-label': 'Visualization of the current step' });
  const explain = h('p', { class: 'explain' });
  const btn = (icon, title, fn, cls = '', label = '') => h('button', { type: 'button', class: `ctrl ${cls}`, title, 'aria-label': title, onclick: fn,
    html: ICONS[icon] + (label ? `<span class="ctrl-label">${label}</span>` : '') });
  const playBtn = btn('play', 'Play / pause (Space)', () => player.toggle(), 'ctrl-play', 'Play');
  const prevBtn = btn('prev', 'Previous step (←)', () => player.prev(), 'ctrl-step', 'Back');
  const nextBtn = btn('next', 'Next step (→)', () => player.next(), 'ctrl-step ctrl-next', 'Next');
  const firstBtn = btn('first', 'First step (Home)', () => player.first(), 'ctrl-edge');
  const lastBtn = btn('last', 'Last step (End)', () => player.last(), 'ctrl-edge');
  const scrub = h('input', { type: 'range', min: 0, max: 0, value: 0, class: 'scrub', 'aria-label': 'Step', oninput: (e) => player.go(Number(e.target.value)) });
  const speed = h('select', { class: 'speed', id: 'speed', onchange: (e) => { anim.setSpeed(Number(e.target.value)); player.setSpeed(Number(e.target.value)); } },
    [0.5, 1, 1.5, 2, 4].map((x) => h('option', { value: x, selected: x === 1 }, `${x}×`)));
  const kbd = (k) => h('kbd', {}, k);
  const legend = h('p', { class: 'kbd-legend' },
    h('span', {}, kbd('←'), kbd('→'), ' step'), h('span', {}, kbd('Space'), ' play'),
    h('span', {}, kbd('Home'), kbd('End'), ' first / last'), h('span', {}, kbd('P'), ' projector'), h('span', {}, kbd('M'), ' motion'));
  const stepList = h('ol', { class: 'step-list' });
  const progress = h('div', { class: 'progress' }, h('span'));

  main.replaceChildren(
    sidebar(method.id),
    h('div', { class: 'content' },
      h('header', { class: 'method-head' },
        h('div', { class: 'mh-text' },
          h('p', { class: 'mh-cat' }, method.category),
          h('h1', {}, method.name),
          h('p', { class: 'lead' }, method.description)),
        h('label', { class: 'method-switch-wrap' }, h('span', { class: 'sr-only' }, 'Switch method'),
          h('select', { class: 'method-switch', 'aria-label': 'Switch method', onchange: (e) => { location.hash = `#/${e.target.value}`; } },
            groups().map(([cat, list]) => h('optgroup', { label: cat }, list.map((m) => h('option', { value: m.id, selected: m.id === method.id }, m.name))))))),
      h('div', { class: 'io panel' },
        h('section', { class: 'io-in', 'aria-label': 'Input' }, actionBar, examples, form.el, formErr,
          h('div', { class: 'actions' }, runBtn, resetBtn, h('span', { class: 'kbd-hint' }, kbd('Ctrl'), '+', kbd('Enter')))),
        h('section', { class: 'io-out', 'aria-label': 'Output' },
          h('div', { class: 'out-head' }, outLabel, h('div', { class: 'out-tools' }, copyBtn)),
          outValue, chainBtn)),
      h('section', { class: 'viz', 'aria-label': 'Steps' },
        h('div', { class: 'viz-head' }, stepCount, stepTitle),
        progress,
        stage,
        explain,
        h('div', { class: 'controls', role: 'toolbar', 'aria-label': 'Step controls' },
          h('div', { class: 'ctrl-main' }, firstBtn, prevBtn, playBtn, nextBtn, lastBtn),
          h('div', { class: 'ctrl-aux' },
            h('label', { class: 'speed-wrap', for: 'speed' }, h('span', {}, 'Speed'), speed),
            scrub)),
        h('div', { class: 'viz-foot' },
          h('details', { class: 'all-steps' }, h('summary', {}, 'All steps'), stepList),
          legend),
        live)),
  );

  // --- player wiring
  let nodes = []; // [{type, el}] for in-place updates (smooth animations)
  if (player) player.pause(false);
  anim.setSpeed(1);
  let shown = null; // the step object currently on stage (so play/pause/speed changes don't re-animate it)
  let shownIndex = -1, shownList = null, stepsAction = null; // stepsAction: the action (e.g. encode/decode) that produced the steps
  player = new StepPlayer({ onChange: (p) => {
    const step = p.current;
    const n = p.steps.length;
    stepCount.replaceChildren(...(n ? ['Step ', h('b', {}, String(p.index + 1)), ` / ${n}`] : []));
    stepTitle.textContent = step ? step.title : '';
    renderExplanation(step ? step.explanation : '');
    playBtn.innerHTML = (p.playing ? ICONS.pause : ICONS.play) + `<span class="ctrl-label">${p.playing ? 'Pause' : 'Play'}</span>`;
    playBtn.classList.toggle('is-playing', p.playing);
    playBtn.setAttribute('aria-pressed', p.playing);
    prevBtn.disabled = firstBtn.disabled = !n || p.index === 0;
    nextBtn.disabled = lastBtn.disabled = !n || p.index >= n - 1;
    scrub.max = Math.max(0, n - 1); scrub.value = p.index;
    scrub.setAttribute('aria-valuetext', n ? `Step ${p.index + 1} of ${n}` : 'No steps');
    progress.firstChild.style.width = n > 1 ? `${(p.index / (n - 1)) * 100}%` : n ? '100%' : '0%';
    [...stepList.children].forEach((li, i) => li.classList.toggle('is-current', i === p.index));
    if (step !== shown) {
      const direction = shownList === p.steps ? Math.sign(p.index - shownIndex) : 0; // +1 forward, −1 back, 0 fresh run
      shown = step; shownIndex = p.index; shownList = p.steps;
      renderStage(step, { direction, action: stepsAction });
      live.textContent = step ? `Step ${p.index + 1} of ${n}: ${step.title}. ${step.explanation}` : '';
    }
  } });

  // Method text may say where the worked example sits ("worked out below"). Whether it is below or beside the
  // grids depends on how the stage wraps, so both words are rendered and the stage's real layout picks one.
  function renderExplanation(text) {
    const parts = text.split(/\b(worked out below)\b/);
    explain.replaceChildren(...parts.map((p) => (p === 'worked out below'
      ? h('span', {}, 'worked out ', h('span', { class: 'where-below' }, 'below'), h('span', { class: 'where-right' }, 'on the right'))
      : p)));
  }
  const syncStageLayout = () => {
    // Side by side = some visual starts above the bottom of the one before it (the flex row did not wrap).
    const kids = [...stage.children].map((c) => c.getBoundingClientRect());
    const side = kids.some((r, i) => i > 0 && r.top < kids[i - 1].bottom - 4);
    explain.classList.toggle('layout-side', side);
  };
  new ResizeObserver(syncStageLayout).observe(stage);

  function renderStage(step, ctx = {}) {
    anim.settle(); // finish the previous step's animations instantly so rapid clicks never pile up
    if (!step) { stage.replaceChildren(); nodes = []; return; }
    const list = [].concat(step.visual || []);
    const fresh = [];
    const next = list.map((v, i) => {
      const r = visuals[v.type];
      if (!r) return { type: v.type, el: h('div', { class: 'v-missing' }, `Unknown visual type "${v.type}". Add it to visuals/index.js.`) };
      const prev = nodes[i];
      // update() may return false to ask for a fresh render (e.g. the layout changed size).
      if (prev && prev.type === v.type && r.update && r.update(prev.el, v.data, step, ctx) !== false) return prev;
      const el = r.render(v.data, step, ctx);
      el.classList.add('v');
      fresh.push(el);
      return { type: v.type, el };
    });
    stage.replaceChildren(...next.map((x) => x.el));
    stage.dataset.count = next.length;
    nodes = next;
    syncStageLayout();
    fresh.forEach((el) => anim.enter(el)); // no delay: the new step must be visible immediately
    // Renderers that animate after being attached (they need layout) expose el.afterMount(ctx).
    for (const el of fresh) if (typeof el.afterMount === 'function') el.afterMount(ctx);
    anim.fitStep(); // settle cap: every step finishes animating within ~1.0 s at 1×
  }

  let lastRun = null; // { action, output } of the last successful run
  function setAction(id, rerun) {
    const prevAction = action;
    action = actions.find((a) => a.id === id) || actions[0];
    // Switching Encrypt → Decrypt (or back) carries the result over, so a round trip is one click.
    if (rerun && method.ioField && lastRun && action.inverse === lastRun.action && prevAction.id === lastRun.action) {
      form.setValues({ [method.ioField]: lastRun.output });
    }
    actionBar.querySelectorAll('button').forEach((b) => { const on = b.dataset.action === action.id; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on); });
    form.setAction(action.id);
    const inv = action.inverse && actions.find((a) => a.id === action.inverse);
    chainBtn.hidden = !(inv && method.ioField);
    if (inv) chainBtn.textContent = `${inv.label} this result →`;
    history.replaceState(null, '', `#/${method.id}${action.id !== actions[0].id ? `?a=${action.id}` : ''}`);
    if (rerun) run();
  }
  chainBtn.addEventListener('click', () => {
    if (!outValue.dataset.raw) return;
    setAction(action.inverse, true);
  });

  let timer;
  function scheduleRun() { clearTimeout(timer); timer = setTimeout(run, 450); }

  function run() {
    clearTimeout(timer);
    const values = form.read();
    const { fieldErrors, formError } = validate(method, action.id, values);
    form.showErrors(fieldErrors);
    formErr.textContent = formError || '';
    if (Object.keys(fieldErrors).length || formError) { showFailed(formError || Object.values(fieldErrors).join(' ')); return; }
    try {
      const res = runAction(method, action.id, values);
      outLabel.textContent = res.outputLabel || (action.label === 'Encrypt' ? 'Ciphertext' : action.label === 'Decrypt' ? 'Plaintext' : 'Result');
      outValue.classList.remove('is-error');
      outValue.textContent = res.output || '(empty)';
      outValue.dataset.raw = res.output;
      outValue.classList.remove('flash'); void outValue.offsetWidth; outValue.classList.add('flash');
      stepList.replaceChildren(...res.steps.map((s, i) => h('li', {}, h('button', { type: 'button', onclick: () => player.go(i) }, s.title))));
      stepsAction = action.id; // set before load(): load() renders the first step
      player.load(res.steps);
      lastRun = { action: action.id, output: res.output };
    } catch (e) {
      formErr.textContent = e.message;
      showFailed(e.message);
    }
  }
  function showFailed(message) {
    const msg = message || 'The input is not valid.';
    lastRun = null;
    outLabel.textContent = 'Fix the input to see a result';
    outValue.textContent = msg;
    outValue.classList.add('is-error');
    delete outValue.dataset.raw;
    stepList.replaceChildren();
    player.load([]);
    // Same message in the stage, as an accessible alert (screen readers announce it once).
    stepTitle.textContent = 'Can’t run yet';
    const panel = h('div', { class: 'stage-error', role: 'alert' },
      h('span', { class: 'stage-error-icon', 'aria-hidden': 'true' }, '!'),
      h('div', {}, h('strong', {}, 'Input problem'), h('p', {}, msg)));
    stage.replaceChildren(panel);
    nodes = [];
    anim.enter(panel);
  }

  setAction(action.id, false);
  run();
}

// ------------------------------------------------------------ routing
function route() {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const method = byId[path];
  if (player) player.pause(false);
  if (method) renderMethod(method, new URLSearchParams(query || '').get('a'));
  else renderHome();
  window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', route);
route();

// ------------------------------------------------------------ keyboard
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { $('.io-in .btn-primary')?.click(); e.preventDefault(); return; }
  if (!player || !main.classList.contains('view-method')) return;
  if (e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.key === ' ' && e.target.closest('button, a, summary')) return;
  // PageDown/PageUp are what most presentation clickers send.
  const map = { ArrowRight: () => player.next(), ArrowLeft: () => player.prev(), PageDown: () => player.next(), PageUp: () => player.prev(),
    ' ': () => player.toggle(), Home: () => player.first(), End: () => player.last(), p: togglePresentation, P: togglePresentation, m: toggleMotion, M: toggleMotion };
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (map[e.key]) { map[e.key](); e.preventDefault(); }
});

import { h } from './dom.js';
import { methods, categoryOrder } from '../registry.js';
import { visuals } from '../visuals/index.js';
import { getActions, validate, runAction, defaultValues } from './contract.js';
import { buildForm } from './form.js';
import { StepPlayer } from './player.js';

const $ = (sel, root = document) => root.querySelector(sel);
const byId = Object.fromEntries(methods.map((m) => [m.id, m]));

// ------------------------------------------------------------ categories
function grouped() {
  const cats = [...categoryOrder];
  for (const m of methods) if (!cats.includes(m.category)) cats.push(m.category);
  return cats.map((c) => [c, methods.filter((m) => m.category === c)]).filter(([, list]) => list.length);
}
const catSlug = (c) => c.toLowerCase().replace(/[^a-z]+/g, '-');

// ------------------------------------------------------------ preferences
const prefs = {
  get(k, d) { try { return localStorage.getItem(`cv-${k}`) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`cv-${k}`, v); } catch { /* private mode */ } },
};
function applyPrefs() {
  const dark = prefs.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('large', prefs.get('large', '0') === '1');
  $('#theme-toggle').setAttribute('aria-pressed', dark);
  $('#large-toggle').setAttribute('aria-pressed', prefs.get('large', '0') === '1');
}
$('#theme-toggle').addEventListener('click', () => { prefs.set('theme', document.documentElement.classList.contains('dark') ? 'light' : 'dark'); applyPrefs(); });
$('#large-toggle').addEventListener('click', () => { prefs.set('large', prefs.get('large', '0') === '1' ? '0' : '1'); applyPrefs(); });
applyPrefs();

// ------------------------------------------------------------ views
const main = $('#main');

function renderHome() {
  document.title = 'Crypto Visualizer';
  const all = grouped().flatMap(([, list]) => list);
  const cats = ['All', ...grouped().map(([c]) => c)];
  const cards = h('div', { class: 'cards' }, all.map((m) => h('a', { class: `card method-card cat-${catSlug(m.category)}`, href: `#/${m.id}`, 'data-cat': m.category },
    h('span', { class: 'badge' }, m.category),
    h('h3', {}, m.name),
    h('p', {}, m.description),
    h('span', { class: 'open' }, 'Open →'))));
  const filterBar = h('div', { class: 'filters', role: 'toolbar', 'aria-label': 'Filter by category' }, cats.map((c) => h('button', { type: 'button', class: 'chip', 'data-cat': c, onclick: () => setFilter(c) }, c)));
  function setFilter(c) {
    filterBar.querySelectorAll('.chip').forEach((b) => b.classList.toggle('is-active', b.dataset.cat === c));
    cards.querySelectorAll('.method-card').forEach((el) => { el.hidden = c !== 'All' && el.dataset.cat !== c; });
  }
  main.className = 'view-home';
  main.replaceChildren(
    h('section', { class: 'hero' },
      h('p', { class: 'eyebrow' }, 'Classroom tool'),
      h('h1', {}, 'See cryptography happen, step by step.'),
      h('p', { class: 'lead' }, `${methods.length} methods in one place. Pick one, type your own message and key, and watch every step with an explanation.`),
      h('ol', { class: 'how' }, ['Pick a method', 'Enter text & key', 'Play the steps'].map((t, i) => h('li', {}, h('span', {}, i + 1), t)))),
    filterBar,
    cards,
  );
  setFilter('All');
}

function sidebar(active) {
  return h('nav', { class: 'sidebar', 'aria-label': 'Methods' },
    h('a', { class: 'side-home', href: '#/' }, '← All methods'),
    grouped().map(([cat, list]) => h('div', { class: 'side-group' },
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
  document.title = `${method.name} · Crypto Visualizer`;
  main.className = 'view-method';
  const actions = getActions(method);
  let action = actions.find((a) => a.id === actionId) || actions[0];

  // --- input card
  const formErr = h('div', { class: 'form-error', role: 'alert' });
  const form = buildForm(method, { onInput: () => scheduleRun() });
  const actionBar = h('div', { class: 'segmented', role: 'tablist' }, actions.map((a) => h('button', {
    type: 'button', role: 'tab', 'data-action': a.id, onclick: () => setAction(a.id, true),
  }, a.label)));
  const examples = method.examples ? h('div', { class: 'examples' }, h('span', { class: 'muted small' }, 'Examples:'), method.examples.map((ex) => h('button', { type: 'button', class: 'chip', onclick: () => { form.setValues(ex.values); run(); } }, ex.label))) : null;
  const runBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => run() }, 'Run');
  const resetBtn = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { form.setValues(defaultValues(method)); run(); } }, 'Reset');

  // --- output card
  const outLabel = h('div', { class: 'out-label' });
  const outValue = h('output', { class: 'out-value mono' });
  const copyBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: async () => {
    try { await navigator.clipboard.writeText(outValue.textContent); copyBtn.textContent = 'Copied ✓'; } catch { copyBtn.textContent = 'Copy failed'; }
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1200);
  } }, 'Copy');
  const chainBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' });

  // --- visualizer
  const stepCount = h('span', { class: 'step-count' });
  const stepTitle = h('h3', { class: 'step-title' });
  const stage = h('div', { class: 'stage', 'aria-live': 'polite' });
  const explain = h('p', { class: 'explain' });
  const btn = (label, title, fn, cls = '') => h('button', { type: 'button', class: `ctrl ${cls}`, title, 'aria-label': title, onclick: fn, html: ICONS[label] });
  const playBtn = btn('play', 'Play / pause (Space)', () => player.toggle(), 'ctrl-play');
  const scrub = h('input', { type: 'range', min: 0, max: 0, value: 0, class: 'scrub', 'aria-label': 'Step', oninput: (e) => player.go(Number(e.target.value)) });
  const speed = h('select', { class: 'speed', 'aria-label': 'Speed', onchange: (e) => player.setSpeed(Number(e.target.value)) },
    [0.5, 1, 1.5, 2, 4].map((x) => h('option', { value: x, selected: x === 1 }, `${x}×`)));
  const stepList = h('ol', { class: 'step-list' });
  const progress = h('div', { class: 'progress' }, h('span'));

  main.replaceChildren(
    sidebar(method.id),
    h('div', { class: 'content' },
      h('header', { class: 'method-head' },
        h('div', {},
          h('span', { class: `badge cat-${catSlug(method.category)}` }, method.category),
          h('h1', {}, method.name),
          h('p', { class: 'lead' }, method.description)),
        h('select', { class: 'method-switch', 'aria-label': 'Switch method', onchange: (e) => { location.hash = `#/${e.target.value}`; } },
          grouped().map(([cat, list]) => h('optgroup', { label: cat }, list.map((m) => h('option', { value: m.id, selected: m.id === method.id }, m.name)))))),
      h('div', { class: 'io' },
        h('section', { class: 'card io-in' }, h('div', { class: 'card-head' }, h('h2', {}, 'Input'), actionBar), examples, form.el, formErr,
          h('div', { class: 'actions' }, runBtn, resetBtn, h('span', { class: 'muted small kbd-hint' }, 'Ctrl + Enter to run'))),
        h('section', { class: 'card io-out' }, h('div', { class: 'card-head' }, h('h2', {}, 'Output'), h('div', { class: 'out-tools' }, chainBtn, copyBtn)), outLabel, outValue)),
      h('section', { class: 'card viz' },
        h('div', { class: 'viz-head' }, stepCount, stepTitle),
        progress,
        stage,
        explain,
        h('div', { class: 'controls' },
          btn('first', 'First step (Home)', () => player.first()),
          btn('prev', 'Previous (←)', () => player.prev()),
          playBtn,
          btn('next', 'Next (→)', () => player.next()),
          btn('last', 'Last step (End)', () => player.last()),
          scrub, speed),
        h('details', { class: 'all-steps' }, h('summary', {}, 'All steps'), stepList))),
  );

  // --- player wiring
  let nodes = []; // [{type, el}] for in-place updates (smooth animations)
  if (player) player.pause(false);
  player = new StepPlayer({ onChange: (p) => {
    const step = p.current;
    const n = p.steps.length;
    stepCount.textContent = n ? `Step ${p.index + 1} / ${n}` : '';
    stepTitle.textContent = step ? step.title : '';
    explain.textContent = step ? step.explanation : '';
    playBtn.innerHTML = p.playing ? ICONS.pause : ICONS.play;
    playBtn.classList.toggle('is-playing', p.playing);
    scrub.max = Math.max(0, n - 1); scrub.value = p.index;
    progress.firstChild.style.width = n > 1 ? `${(p.index / (n - 1)) * 100}%` : '100%';
    [...stepList.children].forEach((li, i) => li.classList.toggle('is-current', i === p.index));
    renderStage(step);
  } });

  function renderStage(step) {
    if (!step) { stage.replaceChildren(); nodes = []; return; }
    const list = [].concat(step.visual || []);
    const next = list.map((v, i) => {
      const r = visuals[v.type];
      if (!r) return { type: v.type, el: h('div', { class: 'v-missing' }, `Unknown visual type "${v.type}". Add it to visuals/index.js.`) };
      const prev = nodes[i];
      if (prev && prev.type === v.type && r.update) { r.update(prev.el, v.data, step); return prev; }
      const el = r.render(v.data, step);
      el.classList.add('v', 'enter');
      return { type: v.type, el };
    });
    stage.replaceChildren(...next.map((x) => x.el));
    stage.dataset.count = next.length;
    nodes = next;
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
    if (inv) chainBtn.textContent = `Use output → ${inv.label}`;
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
    if (Object.keys(fieldErrors).length || formError) { showFailed(); return; }
    try {
      const res = runAction(method, action.id, values);
      outLabel.textContent = res.outputLabel || (action.label === 'Encrypt' ? 'Ciphertext' : action.label === 'Decrypt' ? 'Plaintext' : 'Result');
      outValue.textContent = res.output || '(empty)';
      outValue.dataset.raw = res.output;
      outValue.classList.remove('flash'); void outValue.offsetWidth; outValue.classList.add('flash');
      stepList.replaceChildren(...res.steps.map((s, i) => h('li', {}, h('button', { type: 'button', onclick: () => player.go(i) }, s.title))));
      player.load(res.steps);
      lastRun = { action: action.id, output: res.output };
    } catch (e) {
      formErr.textContent = e.message;
      showFailed();
    }
  }
  function showFailed() {
    lastRun = null;
    outLabel.textContent = 'Fix the input to see a result';
    outValue.textContent = '—';
    delete outValue.dataset.raw;
    stepList.replaceChildren();
    player.load([]);
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
  const map = { ArrowRight: () => player.next(), ArrowLeft: () => player.prev(), ' ': () => player.toggle(), Home: () => player.first(), End: () => player.last() };
  if (map[e.key]) { map[e.key](); e.preventDefault(); }
});

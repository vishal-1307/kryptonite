import { h } from './dom.js';
import { methods, categoryOrder } from '../registry.js';
import { visuals } from '../visuals/index.js';
import { getActions, validate, runAction, defaultValues } from './contract.js';
import { buildForm } from './form.js';
import { StepPlayer } from './player.js';
import { Scope } from './lifecycle.js';
import { parseHash, methodHash, TABS } from './router.js';
import { groupMethods, groupOf } from './groups.js';
import { createSidebar } from './sidebar.js';
import { copyText, copyableOutput } from './clipboard.js';
import { renderExplanation } from './explain.js';
import { renderExamples } from './examples.js';
import { renderCodeTab, loadManifest, codeBase } from './code-tab.js';
import { methodInfo } from './code-manifest.js';
import { enhanceScrollers } from './scrollers.js';
import { iconFor } from './icons.js';
import { teachContext, extraVisuals } from '../visuals/enhance.js';
import { hillRows } from '../visuals/teach.js';
import * as anim from '../visuals/anim.js';

const $ = (sel, root = document) => root.querySelector(sel);
const byId = Object.fromEntries(methods.map((m) => [m.id, m]));
const ids = methods.map((m) => m.id);
const GROUPS = groupMethods(methods, categoryOrder);
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
  const tt = $('#theme-toggle');
  tt.removeAttribute('aria-pressed');
  tt.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  tt.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  tt.querySelector('.theme-label').textContent = dark ? 'Light' : 'Dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#000000' : '#ffffff';
}
$('#theme-toggle').addEventListener('click', () => { prefs.set('theme', document.documentElement.classList.contains('dark') ? 'light' : 'dark'); applyPrefs(); });

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

const sidebar = createSidebar({ groups: GROUPS, total: methods.length, prefs });
const main = $('#main');

// Skip link: focus the main region without touching the hash (the hash is the router's).
$('.skip').addEventListener('click', (e) => { e.preventDefault(); focusMain(); });
function focusMain() { main.focus({ preventScroll: true }); main.scrollIntoView({ block: 'start' }); }

// ------------------------------------------------------------ home
function setCrumb(text) { const c = $('#crumb'); c.hidden = !text; c.textContent = text || ''; }
const arrowIcon = () => { const t = document.createElement('template'); t.innerHTML = '<svg class="mr-go" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'; return t.content.firstChild; };

function renderHome(categorySlug) {
  const only = GROUPS.find((g) => g.slug === categorySlug) || null;
  document.title = only ? `${only.name} · Kryptonite` : 'Kryptonite — see how ciphers work, step by step';
  setCrumb(only ? only.name : null);
  sidebar.setActive({ groupSlug: only ? only.slug : null, home: !only });
  main.className = 'view-home';
  const list = only ? [only] : GROUPS;
  main.replaceChildren(
    h('section', { class: 'home-head' },
      h('h1', {}, only ? only.name : 'Choose a method'),
      h('p', { class: 'lead' }, only
        ? `${only.methods.length} method${only.methods.length === 1 ? '' : 's'}. Pick one, type a message and a key, press Run, then step through it.`
        : 'Type a message and a key, press Run, then step through what the method does.'),
      only ? h('p', {}, h('a', { href: '#/', class: 'btn-link' }, `All methods (${methods.length})`)) : null),
    ...list.map((g) => h('section', { class: 'group', 'aria-labelledby': `g-${g.slug}` },
      h('h2', { class: 'group-title', id: `g-${g.slug}` }, `${g.name} (${g.methods.length})`),
      h('ul', { class: 'method-list' }, g.methods.map((m) => h('li', {},
        h('a', { class: 'method-row', href: `#/${m.id}` },
          h('span', { class: 'mr-icon', html: iconFor(m.id) }),
          h('span', { class: 'mr-name' }, m.name),
          h('span', { class: 'mr-desc' }, firstSentence(m.description)),
          new Set(g.methods.map((x) => x.category)).size > 1 ? h('span', { class: 'mr-cat' }, m.category) : null,
          arrowIcon())))))),
  );
}

// ------------------------------------------------------------ method view
const svgIcon = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">${d}</svg>`;
const ICONS = {
  first: svgIcon('<rect x="5" y="5" width="2.5" height="14" rx="1"/><path d="M19 5.5v13a.8.8 0 0 1-1.2.7L8.6 12.7a.8.8 0 0 1 0-1.4l9.2-6.5a.8.8 0 0 1 1.2.7z"/>'),
  prev: svgIcon('<path d="M15.5 5.5v13a.8.8 0 0 1-1.3.6L6 12.6a.8.8 0 0 1 0-1.2l8.2-6.5a.8.8 0 0 1 1.3.6z"/>'),
  play: svgIcon('<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.5-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z"/>'),
  pause: svgIcon('<rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/>'),
  next: svgIcon('<path d="M8.5 5.5v13a.8.8 0 0 0 1.3.6l8.2-6.5a.8.8 0 0 0 0-1.2L9.8 4.9a.8.8 0 0 0-1.3.6z"/>'),
  last: svgIcon('<rect x="16.5" y="5" width="2.5" height="14" rx="1"/><path d="M5 5.5v13a.8.8 0 0 0 1.2.7l9.2-6.5a.8.8 0 0 0 0-1.4L6.2 4.8A.8.8 0 0 0 5 5.5z"/>'),
};
const TAB_LABEL = { visualizer: 'Visualizer', explanation: 'Explanation', code: 'Code', examples: 'Examples' };

/** The current view. Everything asynchronous it starts belongs to view.scope and dies with it. */
let view = null;
function disposeView() {
  if (!view) return;
  view.scope.dispose();
  view.player.dispose();
  anim.cancelAll();
  anim.setSpeed(1);
  view = null;
}

function renderMethod(method, initial) {
  const scope = new Scope(method.id);
  document.title = `${method.name} · Kryptonite`;
  setCrumb(method.name);
  sidebar.setActive({ methodId: method.id });
  main.className = 'view-method';
  const group = groupOf(GROUPS, method.id);
  const actions = getActions(method);
  let action = actions.find((a) => a.id === initial.action) || actions[0];
  let tab = initial.tab || 'visualizer';

  // --- tabs (ARIA tablist; each tab is also a deep link #/<id>/<tab>)
  const tabBtns = {};
  const panels = {};
  const tablist = h('div', { class: 'tabs', role: 'tablist', 'aria-label': `${method.name} sections` }, TABS.map((t) => {
    tabBtns[t] = h('a', { role: 'tab', id: `tab-${t}`, class: 'tab', href: methodHash(method.id, { tab: t, action: action.id !== actions[0].id ? action.id : null }), 'aria-controls': `panel-${t}` }, TAB_LABEL[t]);
    return tabBtns[t];
  }));
  tablist.addEventListener('keydown', (e) => {
    const i = TABS.indexOf(document.activeElement?.id?.replace('tab-', ''));
    if (i < 0) return;
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length; else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = TABS.length - 1;
    else if (e.key === ' ') { e.preventDefault(); tabBtns[TABS[i]].click(); return; }
    if (n === null) return;
    e.preventDefault(); e.stopPropagation();
    tabBtns[TABS[n]].focus();
    tabBtns[TABS[n]].click(); // automatic activation (cheap panels)
  });

  // --- input column
  const formErr = h('div', { class: 'form-error', role: 'alert', id: `form-err-${method.id}` });
  const form = buildForm(method, { onInput: () => scheduleRun() });
  const actionBar = h('div', { class: 'segmented mode-switch', role: 'radiogroup', 'aria-label': 'What to do', hidden: actions.length < 2 }, actions.map((a) => h('button', {
    type: 'button', role: 'radio', 'data-action': a.id, onclick: () => setAction(a.id, true),
  }, a.label)));
  actionBar.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    const i = actions.indexOf(action), n = (i + (e.key === 'ArrowRight' ? 1 : -1) + actions.length) % actions.length;
    setAction(actions[n].id, true); actionBar.querySelector(`[data-action="${actions[n].id}"]`).focus();
  });
  const presets = method.examples ? h('div', { class: 'examples' }, h('span', { class: 'examples-label' }, 'Try:'), method.examples.map((ex) => h('button', { type: 'button', class: 'chip', onclick: () => { form.setValues(ex.values); run(); } }, ex.label))) : null;
  const runBtn = h('button', { type: 'button', class: 'btn btn-primary btn-run', onclick: () => { run(); revealViz(); }, html: `${ICONS.play}<span>Run</span>` });
  const resetBtn = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { form.setValues(defaultValues(method), { demo: true }); run(); } }, 'Reset');
  // Educational-use notice near the inputs: the method's own warning (method.warning or the code manifest's
  // per-method warning) when present, otherwise a short generic line.
  const GENERIC_NOTICE = 'For learning only: these demos show how the algorithm works and must not be used to protect real data.';
  const notice = h('p', { class: 'edu-note small', role: 'note' }, typeof method.warning === 'string' && method.warning ? method.warning : GENERIC_NOTICE);
  if (!method.warning) loadManifest(codeBase(prefs)).then(scope.guard((m) => { const w = m && methodInfo(m, method.id).warning; if (w) notice.textContent = w; }));

  const outLabel = h('div', { class: 'out-label', id: `out-label-${method.id}` });
  const outValue = h('output', { class: 'out-value mono', 'aria-labelledby': `out-label-${method.id}` });
  const copyLabel = h('span', {}, 'Copy');
  const copyBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-copy' }, copyLabel);
  const copyStatus = h('span', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const chainBtn = h('button', { type: 'button', class: 'btn btn-link' });

  // --- visualizer column
  const stepCount = h('span', { class: 'step-count', 'aria-hidden': 'true' });
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const stepTitle = h('h2', { class: 'step-title' });
  const stage = h('div', { class: 'stage', role: 'group', 'aria-label': 'Visualization of the current step' });
  const btn = (icon, title, fn, cls = '', label = '') => h('button', { type: 'button', class: `ctrl ${cls}`, title, 'aria-label': title, onclick: fn,
    html: ICONS[icon] + (label ? `<span class="ctrl-label">${label}</span>` : '') });
  const playBtn = btn('play', 'Play / pause (Space)', () => player.toggle(), 'ctrl-play', 'Play');
  const prevBtn = btn('prev', 'Previous step (←)', () => player.prev(), 'ctrl-step', 'Back');
  const nextBtn = btn('next', 'Next step (→)', () => player.next(), 'ctrl-step ctrl-next', 'Next');
  const firstBtn = btn('first', 'First step (Home)', () => player.first(), 'ctrl-edge');
  const lastBtn = btn('last', 'Last step (End)', () => player.last(), 'ctrl-edge');
  const scrub = h('input', { type: 'range', min: 0, max: 0, value: 0, step: 1, class: 'scrub', 'aria-label': 'Timeline: step', oninput: (e) => player.go(Number(e.target.value)) });
  const ticks = h('div', { class: 'ticks', 'aria-hidden': 'true' });
  const speed = h('select', { class: 'speed', id: `speed-${method.id}`, 'aria-label': 'Playback speed', onchange: (e) => { anim.setSpeed(Number(e.target.value)); player.setSpeed(Number(e.target.value)); } },
    [0.5, 1, 1.5, 2, 4].map((x) => h('option', { value: x, selected: x === 1 }, `${x}×`)));

  // --- explanation column
  const explain = h('p', { class: 'explain' });
  const details = h('div', { class: 'details', role: 'group', 'aria-label': 'Maths for this step' });
  const stepList = h('ol', { class: 'step-list' });
  const kbd = (k) => h('kbd', {}, k);
  const legend = h('p', { class: 'kbd-legend' },
    h('span', {}, kbd('←'), kbd('→'), ' step'), h('span', {}, kbd('Space'), ' play'),
    h('span', {}, kbd('Home'), kbd('End'), ' first / last'), h('span', {}, kbd('M'), ' motion'));

  const vizSection = h('section', { class: 'ws-viz', 'aria-labelledby': `viz-h-${method.id}` },
    h('div', { class: 'viz-head' }, h('span', { class: 'viz-kicker', id: `viz-h-${method.id}` }, 'Visualization'), stepCount),
    stepTitle,
    stage,
    h('div', { class: 'player', role: 'toolbar', 'aria-label': 'Step controls' },
      h('div', { class: 'timeline' }, h('div', { class: 'scrub-wrap' }, ticks, scrub),
        h('label', { class: 'speed-wrap', for: `speed-${method.id}` }, h('span', {}, 'Speed'), speed)),
      h('div', { class: 'ctrl-row' },
        h('div', { class: 'ctrl-main' }, firstBtn, prevBtn, playBtn, nextBtn, lastBtn))),
    live);

  panels.visualizer = h('div', { class: 'ws', id: 'panel-visualizer', role: 'tabpanel', 'aria-labelledby': 'tab-visualizer' },
    h('section', { class: 'ws-inputs', 'aria-label': 'Input' },
      actionBar, notice, presets, form.el, formErr,
      h('div', { class: 'actions' }, runBtn, resetBtn, h('span', { class: 'kbd-hint' }, kbd('Ctrl'), '+', kbd('Enter'))),
      h('div', { class: 'result' },
        h('div', { class: 'out-head' }, outLabel, h('div', { class: 'out-tools' }, copyBtn)),
        outValue, copyStatus, chainBtn)),
    vizSection,
    h('aside', { class: 'ws-explain', 'aria-labelledby': `ex-h-${method.id}` },
      h('h2', { class: 'panel-kicker', id: `ex-h-${method.id}` }, 'What is happening'),
      explain, details,
      h('details', { class: 'all-steps', open: true }, h('summary', {}, 'All steps'), stepList),
      legend));
  for (const t of ['explanation', 'code', 'examples']) panels[t] = h('div', { class: `doc-panel doc-${t}`, id: `panel-${t}`, role: 'tabpanel', 'aria-labelledby': `tab-${t}`, tabindex: '0', hidden: true });

  main.replaceChildren(
    h('header', { class: 'mhead' },
      h('div', { class: 'mh-text' },
        h('p', { class: 'mh-cat' }, group ? group.name : method.category, group && group.name !== method.category ? h('span', { class: 'mh-sub' }, ` · ${method.category}`) : null),
        h('h1', {}, method.name),
        h('p', { class: 'mh-desc' }, method.description)),
      tablist),
    panels.visualizer, panels.explanation, panels.code, panels.examples,
  );

  function showTab(t) {
    tab = TABS.includes(t) ? t : 'visualizer';
    for (const k of TABS) {
      const on = k === tab;
      tabBtns[k].setAttribute('aria-selected', String(on));
      tabBtns[k].tabIndex = on ? 0 : -1;
      tabBtns[k].classList.toggle('is-active', on);
      panels[k].hidden = !on;
    }
    main.dataset.tab = tab;
    if (tab !== 'visualizer' && player.playing) player.pause();
    if (tab === 'explanation' && !panels.explanation.childElementCount) panels.explanation.append(renderExplanation(method));
    if (tab === 'code' && !panels.code.childElementCount) panels.code.append(renderCodeTab(method, { scope, prefs }));
    if (tab === 'examples' && !panels.examples.childElementCount) panels.examples.append(renderExamples(method, { onLoad: loadExample }));
    document.title = `${method.name}${tab !== 'visualizer' ? ` · ${TAB_LABEL[tab]}` : ''} · Kryptonite`;
  }
  function loadExample(ex) {
    form.setValues(ex.values);
    setAction(ex.action.id, false);
    run();
    location.hash = methodHash(method.id, { action: action.id !== actions[0].id ? action.id : null });
    scope.requestAnimationFrame(() => { stage.focus?.(); tabBtns.visualizer.focus({ preventScroll: true }); });
  }
  function updateTabLinks() {
    for (const t of TABS) tabBtns[t].href = methodHash(method.id, { tab: t, action: action.id !== actions[0].id ? action.id : null });
  }

  // --- player
  let stageNodes = [], detailNodes = [];
  anim.setSpeed(1);
  let shown = null, shownIndex = -1, shownList = null, stepsAction = null, runValues = null;
  const player = new StepPlayer({
    onPause: () => anim.pauseAll(vizSection),
    onResume: () => anim.resumeAll(),
    onChange: (p) => {
      const step = p.current;
      const n = p.steps.length;
      stepCount.replaceChildren(...(n ? ['Step ', h('b', {}, String(p.index + 1)), ` / ${n}`] : []));
      stepTitle.textContent = step ? step.title : '';
      playBtn.innerHTML = (p.playing ? ICONS.pause : ICONS.play) + `<span class="ctrl-label">${p.playing ? 'Pause' : (p.resumable ? 'Resume' : 'Play')}</span>`;
      playBtn.classList.toggle('is-playing', p.playing);
      playBtn.setAttribute('aria-pressed', String(p.playing));
      playBtn.disabled = n < 2;
      prevBtn.disabled = firstBtn.disabled = !n || p.index === 0;
      nextBtn.disabled = lastBtn.disabled = !n || p.index >= n - 1;
      scrub.disabled = n < 2;
      scrub.max = String(Math.max(0, n - 1)); scrub.value = String(p.index);
      scrub.setAttribute('aria-valuetext', n ? `Step ${p.index + 1} of ${n}${step ? `: ${step.title}` : ''}` : 'No steps');
      scrub.style.setProperty('--fill', n > 1 ? `${(p.index / (n - 1)) * 100}%` : n ? '100%' : '0%');
      [...stepList.children].forEach((li, i) => { const on = i === p.index; li.classList.toggle('is-current', on); const b = li.firstChild; if (on) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      if (step !== shown) {
        const direction = shownList === p.steps ? Math.sign(p.index - shownIndex) : 0; // +1 forward, −1 back, 0 fresh run
        shown = step; shownIndex = p.index; shownList = p.steps;
        renderStep(step, { direction });
        live.textContent = step ? `Step ${p.index + 1} of ${n}: ${step.title}. ${step.explanation}` : '';
        const cur = stepList.children[p.index];
        if (cur && stepList.scrollHeight > stepList.clientHeight) stepList.scrollTop = Math.max(0, cur.offsetTop - stepList.clientHeight / 2);
      }
    },
  });

  function renderExplanationText(text) {
    const parts = String(text || '').split(/\b(worked out below)\b/);
    explain.replaceChildren(...parts.map((p) => (p === 'worked out below'
      ? h('span', {}, 'worked out ', h('span', { class: 'where-below' }, 'below'), h('span', { class: 'where-right' }, 'on the right'))
      : p)));
  }
  const syncWording = () => {
    // "worked out below": true when the maths sits under the text (details panel) or the stage wraps; "on the right" otherwise.
    const kids = [...stage.children].map((c) => c.getBoundingClientRect());
    const side = !details.childElementCount && kids.some((r, i) => i > 0 && r.top < kids[i - 1].bottom - 4);
    explain.classList.toggle('layout-side', side);
  };
  scope.observe(new ResizeObserver(scope.guard(syncWording)), stage);

  /** Render a list of visuals into `box`, reusing nodes in place when the renderer supports update(). */
  function renderInto(box, list, nodes, ctx, step) {
    const fresh = [];
    const next = list.map((v, i) => {
      const r = visuals[v.type];
      if (!r) return { type: v.type, el: h('div', { class: 'v-missing' }, `Unknown visual type "${v.type}". Add it to visuals/index.js.`) };
      const prev = nodes[i];
      if (prev && prev.type === v.type && r.update && r.update(prev.el, v.data, step, ctx) !== false) return prev;
      const el = r.render(v.data, step, ctx);
      el.classList.add('v');
      fresh.push(el);
      return { type: v.type, el };
    });
    box.replaceChildren(...next.map((x) => x.el));
    box.dataset.count = next.length;
    return { next, fresh };
  }
  function renderStep(step, ctx = {}) {
    anim.settle(); // finish the previous step's animations instantly so rapid clicks never pile up
    renderExplanationText(step ? step.explanation : '');
    if (!step) { stage.replaceChildren(); details.replaceChildren(); stageNodes = []; detailNodes = []; return; }
    const all = [].concat(step.visual || []);
    // Maths lines go to the explanation column when the step also has a picture; otherwise they are the picture.
    const pictures = all.filter((v) => v.type !== 'math');
    const toStage = pictures.length ? pictures : all;
    // Hill block steps: the stage already works the multiplication row by row, so the one-line summary is dropped.
    const rowByRow = method.id === 'hill' && pictures.some((v) => v.type === 'matrix' && hillRows(step, v.data.items));
    const toDetails = [...(pictures.length && !rowByRow ? all.filter((v) => v.type === 'math') : []), ...extraVisuals(method.id, step)];
    const fullCtx = { ...ctx, action: stepsAction, methodId: method.id, values: runValues, scope, isPaused: () => !player.playing && player.resumable,
      teach: teachContext(method.id, stepsAction, runValues, step, player.steps) };
    const a = renderInto(stage, toStage, stageNodes, fullCtx, step);
    const b = renderInto(details, toDetails, detailNodes, fullCtx, step);
    stageNodes = a.next; detailNodes = b.next;
    details.hidden = !toDetails.length;
    syncWording();
    const fresh = [...a.fresh, ...b.fresh];
    fresh.forEach((el) => anim.enter(el));
    for (const el of fresh) if (typeof el.afterMount === 'function') el.afterMount(fullCtx);
    anim.fitStep(anim.STEP_CAP - 40); // settle cap: ≤ 1.0 s at 1× measured from the click (40 ms left for the render frame)
  }

  // --- running
  let lastRun = null; // { action, input, output } of the last successful run
  const ioValue = () => (method.ioField ? form.read()[method.ioField] : undefined);
  function setAction(id, rerun) {
    const prevAction = action;
    action = actions.find((a) => a.id === id) || actions[0];
    // Round trip: switching Encrypt → Decrypt carries the result over, but ONLY if the message box still holds
    // exactly what produced that result. Text typed or pasted since then (even before the auto-run fired) is kept.
    if (rerun && method.ioField && lastRun && action.inverse === lastRun.action && prevAction.id === lastRun.action && ioValue() === lastRun.input) {
      form.setValues({ [method.ioField]: lastRun.output });
    }
    actionBar.querySelectorAll('button').forEach((b) => { const on = b.dataset.action === action.id; b.classList.toggle('is-active', on); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
    form.setAction(action.id);
    const inv = action.inverse && actions.find((a) => a.id === action.inverse);
    chainBtn.hidden = !(inv && method.ioField);
    if (inv) chainBtn.textContent = `${inv.label} this result →`;
    history.replaceState(null, '', methodHash(method.id, { tab, action: action.id !== actions[0].id ? action.id : null }));
    updateTabLinks();
    if (rerun) run();
  }
  chainBtn.addEventListener('click', () => {
    if (pending !== null) run(); // the user typed and the auto-run has not fired yet: use the current text
    if (!lastRun || lastRun.action !== action.id) return;
    form.setValues({ [method.ioField]: lastRun.output });
    const inv = action.inverse;
    setAction(inv, false);
    run();
  });

  let pending = null;
  function scheduleRun() { scope.clearTimeout(pending); pending = scope.setTimeout(() => { pending = null; run(); }, 450); }

  let output = { raw: null, isError: true };
  function setOutput(text, { raw = null, isError = false } = {}) {
    output = { raw, isError };
    outValue.textContent = text;
    outValue.classList.toggle('is-error', isError);
    outValue.classList.toggle('is-placeholder', !isError && raw === '');
    const can = copyableOutput(output) !== null;
    copyBtn.setAttribute('aria-disabled', String(!can));
    copyBtn.title = can ? 'Copy the result' : 'Nothing to copy';
    copyLabel.textContent = 'Copy';
  }
  let copyTimer = null;
  copyBtn.addEventListener('click', async () => {
    const text = copyableOutput(output);
    const r = text === null ? { ok: false, reason: 'Nothing to copy' } : await copyText(text);
    if (!scope.alive) return;
    copyLabel.textContent = r.ok ? 'Copied' : text === null ? 'Nothing to copy' : 'Copy failed';
    copyStatus.textContent = r.ok ? 'Result copied.' : r.reason || 'Copy failed.';
    scope.clearTimeout(copyTimer);
    copyTimer = scope.setTimeout(() => { copyLabel.textContent = 'Copy'; }, 1400);
  });

  function run() {
    scope.clearTimeout(pending); pending = null;
    if (!scope.alive) return;
    const values = form.read();
    const { fieldErrors, formError } = validate(method, action.id, values);
    form.showErrors(fieldErrors);
    formErr.textContent = formError || '';
    if (Object.keys(fieldErrors).length || formError) { showFailed(formError || Object.values(fieldErrors).join(' ')); return; }
    try {
      const res = runAction(method, action.id, values);
      outLabel.textContent = res.outputLabel || (action.label === 'Encrypt' ? 'Ciphertext' : action.label === 'Decrypt' ? 'Plaintext' : 'Result');
      setOutput(res.output || '(empty)', { raw: res.output, isError: false });
      outValue.classList.remove('flash'); void outValue.offsetWidth; outValue.classList.add('flash');
      stepList.replaceChildren(...res.steps.map((s, i) => h('li', {}, h('button', { type: 'button', onclick: () => player.go(i) }, s.title))));
      ticks.replaceChildren(...(res.steps.length > 1 && res.steps.length <= 60 ? res.steps.map(() => h('span')) : []));
      stepsAction = action.id; runValues = values; // set before load(): load() renders the first step
      player.load(res.steps);
      lastRun = { action: action.id, input: method.ioField ? values[method.ioField] : undefined, output: res.output };
    } catch (e) {
      formErr.textContent = e.message;
      showFailed(e.message);
    }
  }
  function showFailed(message) {
    const msg = message || 'The input is not valid.';
    lastRun = null;
    outLabel.textContent = 'Fix the input to see a result';
    setOutput(msg, { isError: true });
    stepList.replaceChildren(); ticks.replaceChildren();
    player.load([]);
    stepTitle.textContent = 'Can’t run yet';
    const panel = h('div', { class: 'stage-error', role: 'alert' },
      h('span', { class: 'stage-error-icon', 'aria-hidden': 'true' }, '!'),
      h('div', {}, h('strong', {}, 'Input problem'), h('p', {}, msg)));
    stage.replaceChildren(panel);
    stageNodes = [];
    anim.enter(panel);
  }
  /** On narrow layouts the visualization sits below the inputs: bring it into view after an explicit Run. */
  function revealViz() {
    if (matchMedia('(min-width: 1100px)').matches) return;
    const top = vizSection.getBoundingClientRect().top;
    if (top > window.innerHeight * 0.6) vizSection.scrollIntoView({ block: 'start', behavior: anim.reduced() ? 'auto' : 'smooth' });
  }

  setAction(action.id, false);
  showTab(tab);
  run();

  return {
    methodId: method.id, scope, player,
    get action() { return action.id; },
    get tab() { return tab; },
    showTab, setAction, run: () => runBtn.click(),
  };
}

// ------------------------------------------------------------ routing
function route() {
  const r = parseHash(location.hash, ids);
  if (r.view === 'anchor') { // in-page anchor (e.g. "#main" typed or bookmarked): keep the current view
    if (!view && !main.childElementCount) renderHome(null);
    if (r.anchor === 'main') focusMain();
    return;
  }
  sidebar.closeDrawer();
  if (r.view === 'method' && view && view.methodId === r.id) {
    if (r.action && r.action !== view.action) view.setAction(r.action, true);
    if (r.tab !== view.tab) view.showTab(r.tab);
    return;
  }
  disposeView();
  if (r.view === 'method') view = renderMethod(byId[r.id], r);
  else renderHome(r.category);
  window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', route);
route();

// ------------------------------------------------------------ keyboard
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { if (view) { view.run(); e.preventDefault(); } return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (sidebar.isOpen()) return;
  const global = { m: toggleMotion, M: toggleMotion };
  if (global[e.key]) { global[e.key](); e.preventDefault(); return; }
  if (!view || view.tab !== 'visualizer') return;
  if (e.target.closest('[role="tablist"], [role="radiogroup"]')) return;
  if (e.key === ' ' && e.target.closest('button, a, summary')) return;
  const player = view.player;
  // PageDown/PageUp are what most presentation clickers send.
  const map = { ArrowRight: () => player.next(), ArrowLeft: () => player.prev(), PageDown: () => player.next(), PageUp: () => player.prev(),
    ' ': () => player.toggle(), Home: () => player.first(), End: () => player.last() };
  if (map[e.key]) { map[e.key](); e.preventDefault(); }
});

// Scrollable boxes: focusable + labelled + edge fades only while they overflow (re-checked after any render or resize).
{
  const mainEl = document.getElementById('main');
  let queued = false;
  const queue = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; enhanceScrollers(mainEl); }); };
  new MutationObserver(queue).observe(mainEl, { childList: true, subtree: true });
  window.addEventListener('resize', queue);
  queue();
}

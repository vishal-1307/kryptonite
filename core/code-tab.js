import { h } from './dom.js';
import { ICON } from './icons.js';
import { LANGS, entriesFor, sourceUrl, looksLikeCommand, methodInfo } from './code-manifest.js';
import { tokenize, toLines } from './highlight.js';
import { copyText } from './clipboard.js';

// Code tab: Python 3 / C++17 programs for the method, listed in code/manifest.json (schema: docs/code-manifest.md).
// All async work is tied to the view's Scope: leaving the page aborts the fetches and late results are ignored.
// Missing manifest / entry / file → a calm "Code coming soon" state (a 404 shows in the Network panel, no JS error).
// For local testing the base folder can be pointed at the test fixture: localStorage cv-code-base = "tests/fixtures/code/".
const manifestCache = new Map();

export function codeBase(prefs) {
  const b = prefs.get('code-base', 'code/');
  return /^[a-z0-9_\-/]+\/$/i.test(b) && !b.includes('..') && !b.startsWith('/') ? b : 'code/';
}

async function loadManifest(base, signal) {
  if (!manifestCache.has(base)) {
    manifestCache.set(base, fetch(`${base}manifest.json`, { signal, cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((m) => { if (!m) manifestCache.delete(base); return m; }));
  }
  return manifestCache.get(base);
}

function copyButton(scope, getText, label = 'Copy', aria = label) {
  const text = h('span', {}, label);
  const b = h('button', { type: 'button', class: 'btn btn-sm btn-copy', 'aria-label': aria, html: ICON.copy }, text);
  const status = h('span', { class: 'copy-status', role: 'status', 'aria-live': 'polite' });
  let t = null;
  b.addEventListener('click', async () => {
    const r = await copyText(getText());
    if (!scope.alive) return;
    text.textContent = r.ok ? 'Copied' : 'Copy failed';
    b.classList.toggle('is-ok', r.ok); b.classList.toggle('is-bad', !r.ok);
    status.textContent = r.ok ? 'Copied to the clipboard.' : r.reason || 'Copy failed.';
    status.classList.toggle('is-error', !r.ok);
    scope.clearTimeout(t);
    t = scope.setTimeout(() => { text.textContent = label; b.classList.remove('is-ok', 'is-bad'); if (r.ok) status.textContent = ''; }, r.ok ? 1600 : 4000);
  });
  return [b, status];
}

export function codeBlock(source, lang) {
  const lines = toLines(tokenize(source, lang));
  if (lines.length > 1 && !lines[lines.length - 1].length) lines.pop(); // trailing newline
  const lineEl = (ln) => h('span', { class: 'ln' }, ln.length ? ln.map((tk) => (tk.t === 'txt' ? tk.v : h('span', { class: `tk-${tk.t}` }, tk.v))) : '\u200b', '\n');
  return h('pre', { class: `code lang-${lang}`, tabindex: '0', 'aria-label': `${lang === 'cpp' ? 'C++' : 'Python'} source code` },
    h('code', {}, lines.map(lineEl)));
}

export function renderCodeTab(method, { scope, prefs }) {
  const root = h('div', { class: 'code-doc', 'aria-busy': 'true' }, h('p', { class: 'muted' }, 'Loading code…'));
  const base = codeBase(prefs);
  const soon = (why) => root.replaceChildren(h('div', { class: 'code-soon' },
    h('h2', {}, 'Code coming soon'),
    h('p', { class: 'muted' }, `Python 3 and C++17 programs for ${method.name} will appear here.`),
    why ? h('p', { class: 'muted small' }, why) : null));

  loadManifest(base, scope.signal).then(scope.guard((manifest) => {
    root.removeAttribute('aria-busy');
    if (!manifest) { soon(); return; }
    const entries = entriesFor(manifest, method.id);
    const langs = LANGS.filter((l) => entries[l.id]);
    const info = methodInfo(manifest, method.id);
    if (!langs.length) { soon(); return; }
    let lang = langs.find((l) => l.id === prefs.get('code-lang', 'python')) || langs[0];
    const tabs = h('div', { class: 'segmented code-langs', role: 'radiogroup', 'aria-label': 'Language' });
    const body = h('div', { class: 'code-body' });
    const pick = (l) => {
      lang = l; prefs.set('code-lang', l.id);
      tabs.querySelectorAll('button').forEach((b) => { const on = b.dataset.lang === l.id; b.classList.toggle('is-active', on); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
      show();
    };
    LANGS.filter((l) => !l.optional || entries[l.id]).forEach((l) => tabs.append(h('button', { type: 'button', role: 'radio', 'data-lang': l.id, disabled: !entries[l.id], title: entries[l.id] ? l.label : `${l.label}: coming soon`, onclick: () => pick(l) }, l.label)));
    tabs.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      const i = langs.indexOf(lang);
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? langs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + langs.length) % langs.length;
      pick(langs[n]); tabs.querySelector(`[data-lang="${langs[n].id}"]`).focus();
    });
    let gen = 0;
    function show() {
      const my = ++gen;
      const e = entries[lang.id];
      const url = sourceUrl(e.file, base);
      body.replaceChildren(h('p', { class: 'muted' }, 'Loading source…'));
      const fail = () => body.replaceChildren(h('div', { class: 'code-soon' }, h('h2', {}, 'Code coming soon'), h('p', { class: 'muted' }, `${e.file} is not available yet.`)));
      if (!url) { fail(); return; }
      fetch(url, { signal: scope.signal, cache: 'no-cache' }).then((r) => (r.ok ? r.text() : null)).catch(() => null).then(scope.guard((src) => {
        if (my !== gen) return; // a newer language pick won
        if (src == null) { fail(); return; }
        const [copyBtn, copyStatus] = copyButton(scope, () => src, 'Copy code', `Copy ${e.file.split('/').pop()}`);
        const cmdRow = (c) => { const [b, st] = copyButton(scope, () => c, 'Copy', `Copy command: ${c}`); return h('li', { class: 'cmd' }, h('code', {}, c), b, st); };
        const sec = (title, ...kids) => h('section', { class: 'code-sec' }, h('h3', {}, title), ...kids);
        body.replaceChildren(
          h('div', { class: 'code-file' },
            h('div', { class: 'code-file-head' }, h('span', { class: 'code-filename mono' }, e.file.split('/').pop()), h('span', { class: 'muted small' }, lang.label), h('span', { class: 'spacer' }), copyBtn),
            copyStatus,
            codeBlock(src, lang.syntax || lang.id)),
          h('div', { class: 'code-meta' },
            info.warning ? h('p', { class: 'code-warning' }, info.warning) : null,
            sec('Dependencies',
              e.deps.length ? h('ul', { class: 'deps' }, e.deps.map((d) => h('li', { class: 'mono' }, d))) : h('p', { class: 'muted small' }, 'No extra packages.'),
              e.install.length ? h('ul', { class: 'cmds' }, e.install.map((c) => (looksLikeCommand(c) ? cmdRow(c) : h('li', { class: 'cmd-note small' }, c)))) : null),
            e.run.length ? sec(lang.syntax === 'cpp' ? 'Compile and run' : 'Run', h('p', { class: 'muted small' }, 'From the method folder (', h('code', {}, `code/${e.file.split('/').slice(0, -1).join('/') || '.'}`), '):'), h('ul', { class: 'cmds' }, e.run.map(cmdRow))) : null,
            e.usage ? sec('Usage', h('ul', { class: 'cmds' }, cmdRow(e.usage))) : null,
            e.sampleFields.length ? sec('Sample input', h('dl', { class: 'kv' }, e.sampleFields.map(([k, v]) => [h('dt', {}, k), h('dd', { class: 'mono' }, v === '' ? h('span', { class: 'muted' }, '(empty)') : v)])))
              : e.sampleInput ? sec('Sample input', h('pre', { class: 'io-block' }, e.sampleInput)) : null,
            e.expectedOutput ? sec('Expected output', h('pre', { class: 'io-block' }, e.expectedOutput)) : null,
            e.notes.length ? sec('Functions', h('ul', { class: 'notes' }, e.notes.map((n) => h('li', {}, n.fn ? [h('code', { class: 'fn' }, n.fn), ': '] : null, n.what)))) : null));
      }));
    }
    root.replaceChildren(h('div', { class: 'code-top' }, tabs), body);
    pick(lang);
  }));
  return root;
}

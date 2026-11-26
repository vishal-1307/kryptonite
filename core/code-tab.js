import { h } from './dom.js';
import { ICON } from './icons.js';
import { LANGS, entriesFor, sourceUrl, looksLikeCommand } from './code-manifest.js';
import { copyText } from './clipboard.js';
import { parseArgs, runCode } from './code-runner.js';

// Code tab: Python 3 / C++17 programs for the method, listed in code/manifest.json (schema: docs/code-manifest.md).
// All async work is tied to the view's Scope: leaving the page aborts the fetches and late results are ignored.
// Missing manifest / entry / file → a calm "Code coming soon" state (a 404 shows in the Network panel, no JS error).
// For local testing the base folder can be pointed at the test fixture: localStorage cv-code-base = "tests/fixtures/code/".
const manifestCache = new Map();

export function codeBase(prefs) {
  const b = prefs.get('code-base', 'code/');
  return /^[a-z0-9_\-/]+\/$/i.test(b) && !b.includes('..') && !b.startsWith('/') ? b : 'code/';
}

export async function loadManifest(base, signal) {
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

function statusLabel(lang, status) {
  if (status === 'loading') return lang === 'cpp' ? 'Downloading the C++ compiler…' : 'Loading Python…';
  if (status === 'busy') return lang === 'cpp' ? 'Compiling…' : 'Starting…';
  if (status === 'ready') return 'Running…';
  return 'Running…';
}

function cppNote() {
  return h('p', { class: 'muted small runner-note' },
    'The C++ compiler (Clang 21, about 26 MB) is downloaded from jsDelivr the first time you press Run, then cached. Compilation stays in your browser — the source is not sent to a server. The first compile can take several seconds.');
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
    if (!langs.length) { soon(); return; }
    let lang = langs.find((l) => l.id === prefs.get('code-lang', 'python')) || langs[0];
    const tabs = h('div', { class: 'segmented code-langs', role: 'radiogroup', 'aria-label': 'Language' });
    const body = h('div', { class: 'code-body' });
    const buffers = {};
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
        if (buffers[lang.id] == null) buffers[lang.id] = { code: src, args: '', stdin: '' };
        const buf = buffers[lang.id];
        const [copyBtn, copyStatus] = copyButton(scope, () => editor.value, 'Copy code', `Copy ${e.file.split('/').pop()}`);
        const cmdRow = (c) => { const [b, st] = copyButton(scope, () => c, 'Copy', `Copy command: ${c}`); return h('li', { class: 'cmd' }, h('code', {}, c), b, st); };
        const sec = (title, ...kids) => h('section', { class: 'code-sec' }, h('h3', {}, title), ...kids);
        const editor = h('textarea', {
          class: 'code-editor mono', spellcheck: 'false', wrap: 'off', 'aria-label': `${lang.label} source code`,
          oninput: () => { buf.code = editor.value; },
        });
        editor.value = buf.code;
        const args = h('input', { type: 'text', class: 'runner-args mono', spellcheck: 'false', autocomplete: 'off',
          'aria-label': 'Program arguments', placeholder: 'Program arguments (leave empty for the sample defaults)',
          value: buf.args, oninput: () => { buf.args = args.value; } });
        const stdin = h('textarea', { class: 'runner-stdin mono', rows: 2, spellcheck: 'false', wrap: 'off',
          'aria-label': 'Standard input', placeholder: 'Standard input (optional)',
          oninput: () => { buf.stdin = stdin.value; } });
        stdin.value = buf.stdin;
        const out = h('pre', { class: 'runner-output mono', tabindex: '0', 'aria-label': 'Program output' }, 'Press Run to execute this program in your browser.');
        const runLabel = h('span', {}, 'Run');
        const runStatus = h('span', { class: 'runner-status', role: 'status', 'aria-live': 'polite' });
        const runBtn = h('button', { type: 'button', class: 'btn btn-primary btn-run-code' }, runLabel);
        let running = false;
        runBtn.addEventListener('click', async () => {
          if (running || !scope.alive) return;
          running = true;
          runBtn.disabled = true;
          runLabel.textContent = 'Running…';
          out.textContent = '';
          out.classList.remove('is-error', 'is-ok');
          const chunks = [];
          const append = (stream, text) => {
            chunks.push({ stream, text });
            // Rebuild so stderr can be marked without relying on innerHTML of user output.
            out.replaceChildren();
            for (const c of chunks) {
              if (c.stream === 'system') out.append(h('span', { class: 'out-sys' }, c.text));
              else if (c.stream === 'stderr') out.append(h('span', { class: 'out-err' }, c.text));
              else out.append(c.text);
            }
          };
          const result = await runCode(lang.id === 'cpp' ? 'cpp' : 'python', {
            code: editor.value,
            args: parseArgs(args.value),
            stdin: stdin.value,
            signal: scope.signal,
            onOutput: (stream, text) => { if (scope.alive && my === gen) append(stream, text); },
            onStatus: (status) => { if (scope.alive) runStatus.textContent = statusLabel(lang.id, status); },
          });
          if (!scope.alive) return;
          running = false;
          runBtn.disabled = false;
          runLabel.textContent = 'Run';
          if (!result.ok) {
            append('stderr', result.error ? `${result.error}\n` : 'The runner failed.\n');
            out.classList.add('is-error');
            runStatus.textContent = result.error || 'Failed';
          } else if (result.exitCode !== 0) {
            out.classList.add('is-error');
            runStatus.textContent = `Exit code ${result.exitCode}`;
          } else {
            out.classList.add('is-ok');
            runStatus.textContent = 'Finished';
            if (!chunks.length) out.append('(no output)');
          }
        });
        const resetBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => {
          buf.code = src; buf.args = ''; buf.stdin = '';
          editor.value = src; args.value = ''; stdin.value = '';
        } }, 'Reset to original');
        body.replaceChildren(
          h('div', { class: 'code-file' },
            h('div', { class: 'code-file-head' }, h('span', { class: 'code-filename mono' }, e.file.split('/').pop()), h('span', { class: 'muted small' }, lang.label), h('span', { class: 'spacer' }), resetBtn, copyBtn),
            copyStatus,
            editor),
          h('div', { class: 'code-runner' },
            h('div', { class: 'runner-head' }, h('h3', {}, 'Run in the browser'), runBtn, runStatus),
            lang.id === 'cpp' ? cppNote() : h('p', { class: 'muted small runner-note' }, 'Python runs in your browser (Pyodide is loaded the first time you press Run).'),
            h('label', { class: 'runner-field' }, h('span', { class: 'runner-label' }, 'Arguments'), args),
            h('label', { class: 'runner-field' }, h('span', { class: 'runner-label' }, 'stdin'), stdin),
            h('div', { class: 'runner-out-wrap' }, h('span', { class: 'runner-label' }, 'Output'), out)),
          h('div', { class: 'code-meta' },
            sec('Dependencies',
              e.deps.length ? h('ul', { class: 'deps' }, e.deps.map((d) => h('li', { class: 'mono' }, d))) : h('p', { class: 'muted small' }, 'No extra packages.'),
              e.install.length ? h('ul', { class: 'cmds' }, e.install.map((c) => (looksLikeCommand(c) ? cmdRow(c) : h('li', { class: 'cmd-note small' }, c)))) : null),
            e.run.length ? sec(lang.syntax === 'cpp' ? 'On your machine: compile and run' : 'On your machine', h('p', { class: 'muted small' }, 'From the method folder (', h('code', {}, `code/${e.file.split('/').slice(0, -1).join('/') || '.'}`), '):'), h('ul', { class: 'cmds' }, e.run.map(cmdRow))) : null,
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

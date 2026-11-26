/**
 * In-browser runners for the Code tab.
 * Python: Pyodide 0.29.5, self-hosted under vendor/pyodide/, loaded on the first Run.
 * C++: YoWASP Clang 21 (via vendor/clang-in-browser), toolchain fetched from jsDelivr on first Run.
 * Both run entirely in the browser; program source is not sent to a compile API.
 */

/** Split a shell-like argument string into argv (supports "double" and 'single' quotes). */
export function parseArgs(text) {
  const out = [];
  const s = String(text ?? '');
  let i = 0;
  const isSpace = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
  while (i < s.length) {
    while (i < s.length && isSpace(s[i])) i++;
    if (i >= s.length) break;
    let cur = '';
    while (i < s.length && !isSpace(s[i])) {
      const c = s[i];
      if (c === '"' || c === "'") {
        const q = c; i++;
        while (i < s.length && s[i] !== q) {
          if (s[i] === '\\' && q === '"' && i + 1 < s.length) { cur += s[i + 1]; i += 2; }
          else { cur += s[i]; i++; }
        }
        if (i < s.length && s[i] === q) i++;
      } else if (c === '\\' && i + 1 < s.length) {
        cur += s[i + 1]; i += 2;
      } else {
        cur += c; i++;
      }
    }
    out.push(cur);
  }
  return out;
}

const PY_TIMEOUT_MS = 30_000;
const CPP_TIMEOUT_MS = 60_000; // first compile can take several seconds without a PCH

let pyWorker = null;
let clangWorker = null;
let runId = 0;

function terminate(which) {
  if (which !== 'cpp' && pyWorker) { pyWorker.terminate(); pyWorker = null; }
  if (which !== 'python' && clangWorker) { clangWorker.terminate(); clangWorker = null; }
}

function getPyWorker() {
  if (!pyWorker) pyWorker = new Worker(new URL('./python-worker.mjs', import.meta.url), { type: 'module' });
  return pyWorker;
}

function getClangWorker() {
  if (!clangWorker) clangWorker = new Worker(new URL('../vendor/clang-in-browser/clang-worker.mjs', import.meta.url), { type: 'module' });
  return clangWorker;
}

/**
 * Run a Python or C++ program in a worker.
 * @param {'python'|'cpp'} lang
 * @param {{ code: string, args?: string[], stdin?: string, onOutput?: Function, onStatus?: Function, signal?: AbortSignal }} opts
 * @returns {Promise<{ ok: boolean, exitCode: number, error?: string }>}
 */
export function runCode(lang, { code, args = [], stdin = '', onOutput = () => {}, onStatus = () => {}, signal } = {}) {
  const isCpp = lang === 'cpp';
  const worker = isCpp ? getClangWorker() : getPyWorker();
  const timeoutMs = isCpp ? CPP_TIMEOUT_MS : PY_TIMEOUT_MS;
  const my = ++runId;
  const result = new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const arm = (ms) => { clearTimeout(timer); timer = setTimeout(() => done({ ok: false, exitCode: 124, error: `Timed out after ${Math.round(ms / 1000)}s.` }), ms); };
    const cleanup = () => {
      worker.removeEventListener('message', onMsg);
      worker.removeEventListener('error', onErr);
      if (signal) signal.removeEventListener('abort', onAbort);
      clearTimeout(timer);
    };
    const kill = () => {
      try { worker.terminate(); } catch { /* already gone */ }
      if (isCpp) clangWorker = null; else pyWorker = null;
    };
    const done = (r) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!r.ok) kill();
      resolve(r);
    };
    const onAbort = () => done({ ok: false, exitCode: 130, error: 'Run cancelled.' });
    const onMsg = (event) => {
      const data = event.data || {};
      if (data.type === 'output') onOutput(data.stream || 'stdout', data.text || '');
      else if (data.type === 'status') {
        onStatus(data.status);
        if (data.status === 'ready') arm(isCpp ? 15_000 : PY_TIMEOUT_MS);
      } else if (data.type === 'done') {
        if (data.id != null && data.id !== my) return;
        done({ ok: true, exitCode: Number(data.exitCode) || 0 });
      }
    };
    const onErr = (err) => done({ ok: false, exitCode: 1, error: err && err.message ? err.message : 'The runner worker failed.' });
    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', onErr);
    if (signal) {
      if (signal.aborted) { onAbort(); return; }
      signal.addEventListener('abort', onAbort);
    }
    arm(timeoutMs);
    worker.postMessage({ type: 'run', id: my, language: isCpp ? 'cpp' : 'python', code: String(code ?? ''), args, stdin: String(stdin ?? '') });
  });
  return result;
}

/** Stop a running program by terminating its worker (it will be recreated on the next Run). */
export function stopRunner(lang) { terminate(lang); }


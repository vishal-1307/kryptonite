/**
 * Web Worker that lazily loads self-hosted Pyodide (vendor/pyodide, v0.29.5) and runs a program.
 * Protocol: page → { type: 'run', id, code, args?: string[], stdin?: string }
 * worker → { type: 'status', status: 'loading'|'busy'|'ready' } | { type: 'output', stream, text } | { type: 'done', id, exitCode }
 */
import { loadPyodide } from '../vendor/pyodide/pyodide.mjs';

const INDEX_URL = new URL('../vendor/pyodide/', import.meta.url).href;
const MAX_OUTPUT = 200000;

let pyodide = null;
let written = 0;

function emit(stream, text) {
  if (!text || written > MAX_OUTPUT) return;
  written += text.length;
  if (written > MAX_OUTPUT) text = `\n[Output truncated after ${MAX_OUTPUT} characters]\n`;
  self.postMessage({ type: 'output', stream, text });
}

async function ensurePyodide() {
  if (pyodide) return pyodide;
  self.postMessage({ type: 'status', status: 'loading' });
  pyodide = await loadPyodide({ indexURL: INDEX_URL });
  return pyodide;
}

const WRAPPER = `
import runpy, sys, traceback
code = 0
try:
    runpy.run_path("/tmp/main.py", run_name="__main__")
except SystemExit as e:
    if e.code is None:
        code = 0
    elif isinstance(e.code, int):
        code = e.code
    else:
        if e.code:
            print(e.code, file=sys.stderr)
        code = 1
except Exception:
    traceback.print_exc()
    code = 1
code
`;

self.onmessage = async (event) => {
  const data = event.data || {};
  if (data.type !== 'run') return;
  written = 0;
  const id = data.id;
  let exitCode = 0;
  try {
    const runtime = await ensurePyodide();
    self.postMessage({ type: 'status', status: 'busy' });
    const args = Array.isArray(data.args) ? data.args.map(String) : [];
    const stdin = String(data.stdin || '');
    runtime.setStdout({ batched: (s) => emit('stdout', s) });
    runtime.setStderr({ batched: (s) => emit('stderr', s) });
    runtime.setStdin({ stdin: () => (stdin ? stdin : null) });
    runtime.FS.writeFile('/tmp/main.py', String(data.code ?? ''), { encoding: 'utf8' });
    runtime.globals.set('_k_argv', runtime.toPy(['main.py', ...args]));
    self.postMessage({ type: 'status', status: 'ready' });
    const result = await runtime.runPythonAsync('import sys\nsys.argv = list(_k_argv)\n' + WRAPPER);
    exitCode = Number(result) || 0;
  } catch (error) {
    exitCode = 1;
    const message = error && error.message ? error.message : String(error);
    emit('stderr', message.endsWith('\n') ? message : `${message}\n`);
  }
  self.postMessage({ type: 'done', id, exitCode });
};

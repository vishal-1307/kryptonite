// Reads code/manifest.json defensively (pure; see docs/code-manifest.md for the schema).
// Accepted shapes:
//   { "aes": { "python": {...}, "cpp": {...} }, ... }                      (preferred)
//   { "methods": { "aes": { "python": {...} } } }                           (wrapped)
//   { "aes": { "languages": { "python": {...} } } }                         (nested)
// Language keys are normalised: python | python3 | py → python; cpp | c++ | cpp17 | c++17 → cpp.
// `pythonLibrary` (optional, e.g. AES via `cryptography`, SHA-256 via `hashlib`) is a third choice shown only when present.
export const LANGS = [
  { id: 'python', label: 'Python 3', ext: 'py', syntax: 'python', optional: false },
  { id: 'cpp', label: 'C++17', ext: 'cpp', syntax: 'cpp', optional: false },
  { id: 'pylib', label: 'Python (library)', ext: 'py', syntax: 'python', optional: true },
];
const ALIASES = { python: 'python', python3: 'python', py: 'python', cpp: 'cpp', 'c++': 'cpp', cpp17: 'cpp', 'c++17': 'cpp', cxx: 'cpp', pythonlibrary: 'pylib', python_library: 'pylib', pylib: 'pylib' };
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : Array.isArray(v) ? v.map(String).join('\n') : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));
const list = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : x && x.name ? `${x.name}${x.version ? ` ${x.version}` : ''}` : str(x))).filter(Boolean) : typeof v === 'string' && v.trim() ? [v] : []);
const cmds = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : typeof v === 'string' && v.trim() ? v.split('\n').map((x) => x.trim()).filter(Boolean) : []);

/** A string that is a shell command (gets a Copy button) rather than prose like "none (standard library only)". */
export const looksLikeCommand = (c) => /^(?:pip3?|python3?|py|apt-get|apt|sudo|brew|npm|npx|node|conda|choco|winget|g\+\+|clang\+\+|c\+\+|cmake|make|cd|sh|bash)(?=\s|$)|^\.\//.test(String(c).trim()) && !/\b(with|only|none|standard library)\b/i.test(String(c));

/** Normalise one language entry; returns null when it has no `file`. */
export function normalizeEntry(e) {
  if (!e || typeof e !== 'object' || typeof e.file !== 'string' || !e.file.trim()) return null;
  const notes = e.notes;
  const note = (n) => (n && typeof n === 'object' ? { fn: n.fn ? String(n.fn) : null, what: str(n.what ?? n.description ?? '') } : { fn: null, what: str(n) });
  const si = e.sampleInput;
  return {
    file: e.file.trim(),
    route: typeof e.route === 'string' ? e.route : null,
    deps: list(e.deps),
    install: cmds(e.install),
    run: cmds(e.run),
    usage: str(e.usage),
    sampleInput: si && typeof si === 'object' && !Array.isArray(si) ? null : str(si),
    sampleFields: si && typeof si === 'object' && !Array.isArray(si) ? Object.entries(si).map(([k, v]) => [k, str(v)]) : [],
    expectedOutput: str(e.expectedOutput),
    notes: Array.isArray(notes) ? notes.map(note).filter((n) => n.what || n.fn)
      : notes && typeof notes === 'object' ? Object.entries(notes).map(([k, v]) => ({ fn: k, what: str(v) })) : str(notes) ? [{ fn: null, what: str(notes) }] : [],
  };
}

/** Method-level extras from the manifest (optional warning, folder, …). */
export function methodInfo(manifest, methodId) {
  const root = manifest && typeof manifest === 'object' ? (manifest.methods && typeof manifest.methods === 'object' ? manifest.methods : manifest) : {};
  const m = root[methodId];
  return m && typeof m === 'object' ? { warning: str(m.warning), folder: str(m.folder) } : { warning: '', folder: '' };
}

/** Entries for one method: { python?: entry, cpp?: entry }. Unknown or broken entries are skipped. */
export function entriesFor(manifest, methodId) {
  if (!manifest || typeof manifest !== 'object') return {};
  const root = manifest.methods && typeof manifest.methods === 'object' ? manifest.methods : manifest;
  let m = root[methodId];
  if (!m || typeof m !== 'object') return {};
  if (m.languages && typeof m.languages === 'object') m = m.languages;
  const out = {};
  for (const [k, v] of Object.entries(m)) {
    const id = ALIASES[String(k).toLowerCase()];
    if (!id || out[id]) continue;
    const e = normalizeEntry(v);
    if (e) out[id] = e;
  }
  return out;
}

/** URL of a source file: `file` is relative to code/ (a leading "code/" or "./" is tolerated); never leaves code/. */
export function sourceUrl(file, base = 'code/') {
  const clean = String(file).replace(/^\.\//, '').replace(/^code\//, '');
  if (/^[a-z]+:|^\/|(^|\/)\.\.(\/|$)/i.test(clean)) return null; // no absolute URLs or parent paths
  return base + clean;
}

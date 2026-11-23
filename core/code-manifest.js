// Reads code/manifest.json defensively (pure; see docs/code-manifest.md for the schema).
// Accepted shapes:
//   { "aes": { "python": {...}, "cpp": {...} }, ... }                      (preferred)
//   { "methods": { "aes": { "python": {...} } } }                           (wrapped)
//   { "aes": { "languages": { "python": {...} } } }                         (nested)
// Language keys are normalised: python | python3 | py → python; cpp | c++ | cpp17 | c++17 → cpp.
export const LANGS = [
  { id: 'python', label: 'Python 3', ext: 'py' },
  { id: 'cpp', label: 'C++17', ext: 'cpp' },
];
const ALIASES = { python: 'python', python3: 'python', py: 'python', cpp: 'cpp', 'c++': 'cpp', cpp17: 'cpp', 'c++17': 'cpp', cxx: 'cpp' };
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : Array.isArray(v) ? v.map(String).join('\n') : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));
const list = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : x && x.name ? `${x.name}${x.version ? ` ${x.version}` : ''}` : str(x))).filter(Boolean) : typeof v === 'string' && v.trim() ? [v] : []);
const cmds = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : typeof v === 'string' && v.trim() ? v.split('\n').map((x) => x.trim()).filter(Boolean) : []);

/** Normalise one language entry; returns null when it has no `file`. */
export function normalizeEntry(e) {
  if (!e || typeof e !== 'object' || typeof e.file !== 'string' || !e.file.trim()) return null;
  const notes = e.notes;
  return {
    file: e.file.trim(),
    deps: list(e.deps),
    install: cmds(e.install),
    run: cmds(e.run),
    sampleInput: str(e.sampleInput),
    expectedOutput: str(e.expectedOutput),
    notes: Array.isArray(notes) ? notes.map(str).filter(Boolean) : notes && typeof notes === 'object'
      ? Object.entries(notes).map(([k, v]) => `${k}: ${str(v)}`) : str(notes) ? [str(notes)] : [],
  };
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

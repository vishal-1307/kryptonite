// Tiny syntax highlighter for the Code tab (Python 3 and C++17). No libraries, no regex backtracking traps:
// a single left-to-right scanner that emits tokens { t: type, v: text }. Types: kw, type, str, com, num, pre, fn, op, txt.
// Concatenating every token's v always gives back the exact source (tested), so highlighting never changes code.
const PY_KW = new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'.split(' '));
const PY_TYPES = new Set('int str bytes bytearray list dict set tuple bool float object range len print self'.split(' '));
const CPP_KW = new Set('alignas alignof and asm auto break case catch class const constexpr const_cast continue decltype default delete do dynamic_cast else enum explicit export extern false for friend goto if inline mutable namespace new noexcept not nullptr operator or private protected public register reinterpret_cast return sizeof static static_assert static_cast struct switch template this throw true try typedef typeid typename union using virtual volatile while'.split(' '));
const CPP_TYPES = new Set('bool char char8_t char16_t char32_t double float int long short signed unsigned void size_t uint8_t uint16_t uint32_t uint64_t int32_t int64_t string vector array map set pair std'.split(' '));

const isIdStart = (c) => /[A-Za-z_]/.test(c);
const isId = (c) => /[A-Za-z0-9_]/.test(c);
const isDigit = (c) => c >= '0' && c <= '9';

export function tokenize(src, lang) {
  const s = String(src ?? '');
  const py = lang === 'python';
  const KW = py ? PY_KW : CPP_KW, TY = py ? PY_TYPES : CPP_TYPES;
  const out = [];
  const push = (t, v) => { if (!v) return; const last = out[out.length - 1]; if (last && last.t === t && t === 'txt') last.v += v; else out.push({ t, v }); };
  let i = 0, lineStart = true;
  while (i < s.length) {
    const c = s[i];
    // comments
    if (py && c === '#') { let j = s.indexOf('\n', i); if (j < 0) j = s.length; push('com', s.slice(i, j)); i = j; continue; }
    if (!py && c === '/' && s[i + 1] === '/') { let j = s.indexOf('\n', i); if (j < 0) j = s.length; push('com', s.slice(i, j)); i = j; continue; }
    if (!py && c === '/' && s[i + 1] === '*') { let j = s.indexOf('*/', i + 2); j = j < 0 ? s.length : j + 2; push('com', s.slice(i, j)); i = j; continue; }
    // C++ preprocessor line
    if (!py && c === '#' && lineStart) { let j = s.indexOf('\n', i); if (j < 0) j = s.length; push('pre', s.slice(i, j)); i = j; continue; }
    // strings (Python: optional prefix letters handled by the identifier branch falling through; triple quotes)
    if (c === '"' || c === "'") {
      const triple = py && s.slice(i, i + 3) === c.repeat(3);
      const q = triple ? c.repeat(3) : c;
      let j = i + q.length;
      while (j < s.length) {
        if (s[j] === '\\') { j += 2; continue; }
        if (s.startsWith(q, j)) { j += q.length; break; }
        if (!triple && s[j] === '\n') break;
        j++;
      }
      push('str', s.slice(i, Math.min(j, s.length))); i = Math.min(j, s.length); lineStart = false; continue;
    }
    if (isDigit(c) || (c === '.' && isDigit(s[i + 1] || ''))) {
      let j = i + 1;
      while (j < s.length && /[0-9A-Fa-fxXoObB_.'uUlL]/.test(s[j])) j++;
      push('num', s.slice(i, j)); i = j; lineStart = false; continue;
    }
    if (isIdStart(c)) {
      let j = i + 1;
      while (j < s.length && isId(s[j])) j++;
      const word = s.slice(i, j);
      // Python string prefixes: f"..", b'..', rb"..": treat as part of the string.
      if (py && /^(?:[rRbBuUfF]{1,2})$/.test(word) && (s[j] === '"' || s[j] === "'")) { push('str', word); i = j; continue; }
      let k = j; while (s[k] === ' ') k++;
      push(KW.has(word) ? 'kw' : TY.has(word) ? 'type' : s[k] === '(' ? 'fn' : 'txt', word);
      i = j; lineStart = false; continue;
    }
    if (c === '\n') { push('txt', c); i++; lineStart = true; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { push('txt', c); i++; continue; }
    push(/[+\-*/%=<>!&|^~?:]/.test(c) ? 'op' : 'txt', c); i++; lineStart = false;
  }
  return out;
}

/** Split tokens into lines (each line is a token list); tokens spanning newlines are split. */
export function toLines(tokens) {
  const lines = [[]];
  for (const tk of tokens) {
    const parts = tk.v.split('\n');
    parts.forEach((p, k) => { if (k) lines.push([]); if (p) lines[lines.length - 1].push({ t: tk.t, v: p }); });
  }
  return lines;
}

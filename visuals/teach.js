// Pure helpers that derive *presentation* hints from data the method already produced (no new crypto).
// Each helper prefers explicit step fields when a method provides them (see code/STEP_FIELDS.md) and falls
// back to deriving the same thing from the visual data, so the visuals work before and after those fields exist.

/** Playfair: which letters of each pair are fillers (inserted X/Q or padding), by walking the original letters. */
export function playfairFillers(pairs, message) {
  const letters = String(message ?? '').toUpperCase().replace(/[^A-Z]/g, '').replace(/J/g, 'I');
  let k = 0;
  return pairs.map((p) => [...String(p)].map((ch) => { if (letters[k] === ch) { k++; return false; } return true; }));
}

/** Smallest period of a sequence (e.g. the key letters LEMONLEMONLEM → 5). */
export function period(seq) {
  const n = seq.length;
  for (let p = 1; p < n; p++) { let ok = true; for (let i = p; i < n && ok; i++) ok = seq[i] === seq[i - p]; if (ok) return p; }
  return n;
}

/** Vigenère-style key progression for column `active`: { keyword, pos (0-based in keyword), count (key letters used so far) }. */
export function keyProgress(keyCells, active, meta, keyword) {
  const seq = keyCells.filter((c) => c);
  if (meta && Number.isInteger(meta.keyIndex) && Number.isInteger(meta.keyLength) && meta.keyLength > 0) {
    // Method data (Vigenère step.meta): exact key position; the keyword comes from the first step's meta.key.
    const kw = typeof keyword === 'string' && keyword.length === meta.keyLength ? [...keyword] : seq.length >= meta.keyLength ? seq.slice(0, meta.keyLength) : null;
    if (kw) return { keyword: kw, pos: meta.keyIndex, count: Number.isInteger(meta.letterNumber) ? meta.letterNumber + 1 : seq.length };
  }
  if (!seq.length || active == null || !keyCells[active]) return null;
  const used = keyCells.slice(0, active + 1).filter((c) => c).length; // 1-based count of the active key letter
  const p = period(seq);
  return { keyword: seq.slice(0, p), pos: (used - 1) % p, count: used };
}

/** Hex digits that differ between two equal-length words (for "what changed" highlighting). */
export function hexDiff(prev, now) {
  const a = String(prev ?? ''), b = String(now ?? '');
  return [...b].map((ch, i) => ch !== a[i]);
}

/** SHA-256: a…h after round t, from the step field if present, else from the rounds table row. */
export function registerRows(step, tableRows) {
  const f = step && ((step.meta && step.meta.registers) || step.registers || step.rounds);
  if (Array.isArray(f) && f.length && (Array.isArray(f[0]) || typeof f[0] === 'object')) {
    return f.map((r, i) => (Array.isArray(r) ? r : [r.t ?? i, ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => r[k] ?? (r.vars ? r.vars['abcdefgh'.indexOf(k)] : ''))]).map(String));
  }
  return tableRows.map((r) => r.map(String));
}

/**
 * Hill: per output row, the products, their sum and the mod-26 result.
 * Prefers step.hill.rows = [{ products: [..], sum, mod }] (or step.rows), else multiplies the matrix by the vector
 * that the matrix visual shows (both already on screen), which is exactly what the step's math lines state.
 */
export function hillRows(step, items) {
  const m = step && step.meta;
  if (m && Array.isArray(m.rows) && m.rows.length && m.rows[0] && Array.isArray(m.rows[0].terms)) {
    return m.rows.map((r) => ({ terms: r.terms.map((t) => [Number(t.k), Number(t.x)]), products: r.terms.map((t) => Number(t.product)), sum: Number(r.sum), mod: Number(r.result), letter: r.letter }));
  }
  const f = step && ((step.hill && step.hill.rows) || step.hillRows);
  if (Array.isArray(f) && f.length && f[0] && Array.isArray(f[0].products)) return f.map((r) => ({ terms: r.terms || null, products: r.products.map(Number), sum: Number(r.sum), mod: Number(r.mod) }));
  const mats = (items || []).filter((x) => x.kind === 'matrix');
  if (mats.length < 3) return null;
  const [K, v] = [mats[0].values, mats[1].values];
  if (!Array.isArray(K) || !Array.isArray(v) || K.length !== v.length || v.some((r) => r.length !== 1) || K.some((row) => row.length !== v.length)) return null;
  const vec = v.map((r) => Number(r[0]));
  const M = K.map((row) => row.map(Number));
  if ([...vec, ...M.flat()].some((x) => !Number.isFinite(x))) return null;
  return M.map((row) => {
    const products = row.map((k, j) => k * vec[j]);
    const sum = products.reduce((a, b) => a + b, 0);
    return { terms: row.map((k, j) => [k, vec[j]]), products, sum, mod: ((sum % 26) + 26) % 26 };
  });
}

/** Rail Fence: the column that must stay visible (explicit field, else the newest active cell). */
export function railFocus(step, data) {
  const mf = step && step.meta && step.meta.focus;
  if (mf && Number.isInteger(mf.col)) {
    const cols = (step.meta.active || []).map((a) => a.col).filter(Number.isInteger).sort((a, b) => a - b);
    return { first: cols.length ? cols[0] : mf.col, last: mf.col };
  }
  const f = step && (step.activeIndex ?? step.activeChar ?? (step.rail && step.rail.index));
  if (Number.isInteger(f)) return { first: f, last: f };
  if (data && Number.isInteger(data.activeIndex)) return { first: data.activeIndex, last: data.activeIndex };
  const cols = (data && data.active ? data.active : []).map(([, c]) => c).sort((a, b) => a - b);
  return cols.length ? { first: cols[0], last: cols[cols.length - 1] } : null;
}

import { playfairFillers } from './teach.js';
// Per-method teaching context passed to renderers as ctx.teach (presentation only; methods stay untouched).
// Prefers the methods' own step data (step.meta / visual.data, see code/STEP_FIELDS.md) and falls back to
// deriving the same hints from the visible data, so it works with and without those fields.
export function teachContext(methodId, actionId, values, step, steps = []) {
  if (methodId === 'playfair' && actionId === 'encrypt' && step) {
    const vis = [].concat(step.visual || []);
    const tr = vis.find((v) => v.type === 'textRows')?.data;
    const pairRow = (tr?.rows || []).find((r) => /^(pairs|in)$/i.test(r.label));
    if (!pairRow) return {};
    // 1) The split step carries visual.data.fillerPairs (second letter is a filler) and meta.fillers.
    const split = steps.find((s) => s.meta && Array.isArray(s.meta.fillers) && Array.isArray(s.meta.pairs));
    let fillers = null;
    if (split) {
      fillers = split.meta.pairs.map(() => [false, false]);
      for (const f of split.meta.fillers) if (fillers[f.pair]) fillers[f.pair][1] = true;
    } else {
      const fp = steps.map((s) => [].concat(s.visual || []).find((v) => v.type === 'textRows' && Array.isArray(v.data?.fillerPairs))).find(Boolean);
      if (fp) { fillers = pairRow.cells.map(() => [false, false]); fp.data.fillerPairs.forEach((i) => { if (fillers[i]) fillers[i][1] = true; }); }
    }
    if (!fillers || fillers.length !== pairRow.cells.length) fillers = playfairFillers(pairRow.cells, values && values.text); // 2) derive
    const active = Number.isInteger(tr.active) ? tr.active : null;
    const activeFillers = Array.isArray(step.meta?.isFiller) ? step.meta.isFiller : active !== null ? fillers[active] : null;
    return { fillers, fillerLabel: pairRow.label, activeFillers };
  }
  if (methodId === 'vigenere') {
    const first = steps.find((s) => s.meta && typeof s.meta.key === 'string');
    return first ? { keyword: first.meta.key } : {};
  }
  return {};
}

/** Extra presentation-only visuals built from method step data (shown in the maths panel). */
export function extraVisuals(methodId, step) {
  const mp = step && step.meta && step.meta.modPow;
  if (methodId === 'rsa' && mp && Array.isArray(mp.progress) && mp.progress.length && mp.progress.length <= 64) {
    // Left-to-right square-and-multiply, one row per exponent bit (values are strings; never converted to Number).
    return [{ type: 'table', data: { mono: true, compact: true, scroll: mp.progress.length > 12,
      headers: ['bit', 'square: acc² mod n', '× base mod n', 'acc'],
      rows: mp.progress.map((r) => [String(r.bit), String(r.squared), r.multiplied == null ? '—' : String(r.multiplied), String(r.acc)]),
      highlightRows: [mp.progress.length - 1], caption: `${mp.base}^${mp.exponent} mod ${mp.modulus}` } }];
  }
  return [];
}

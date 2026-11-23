import { playfairFillers } from './teach.js';
// Per-method teaching context passed to renderers as ctx.teach (presentation only; methods stay untouched).
export function teachContext(methodId, actionId, values, step) {
  if (methodId === 'playfair' && actionId === 'encrypt' && values) {
    const vis = [].concat(step?.visual || []);
    const rows = vis.find((v) => v.type === 'textRows')?.data?.rows || [];
    const pairRow = rows.find((r) => /^(pairs|in)$/i.test(r.label));
    if (!pairRow) return {};
    const fillers = step.fillers || playfairFillers(pairRow.cells, values.text);
    const active = vis.find((v) => v.type === 'textRows')?.data?.active;
    return { fillers, fillerLabel: pairRow.label, activeFillers: Number.isInteger(active) ? fillers[active] : null };
  }
  return {};
}

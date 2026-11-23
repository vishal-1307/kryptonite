import { h } from './dom.js';
import { getActions, defaultValues, validate, runAction, inputsFor } from './contract.js';

// Examples tab: every example is computed live by running the method, so the output shown is always the
// method's real output. Sources: the method's own presets (method.examples), the default inputs for every
// action, and — for methods with an inverse action — the round trip of the default result.
export function examplesModel(method) {
  const actions = getActions(method);
  const base = defaultValues(method);
  const list = [];
  const add = (label, actionId, values, note = '') => {
    const action = actions.find((a) => a.id === actionId);
    if (!action) return;
    const v = { ...base, ...values };
    const { fieldErrors, formError } = validate(method, actionId, v);
    if (Object.keys(fieldErrors).length || formError) return;
    try {
      const res = runAction(method, actionId, v);
      const shown = inputsFor(method, actionId).map((i) => ({ label: i.label, value: i.type === 'select' ? (i.options.find((o) => String(o.value) === String(v[i.id]))?.label ?? String(v[i.id])) : String(v[i.id] ?? '') }));
      list.push({ label, action, values: v, inputs: shown, output: res.output, outputLabel: res.outputLabel, steps: res.steps.length, note });
    } catch { /* skip examples that do not run */ }
  };
  for (const ex of method.examples || []) add(ex.label, ex.action || actions[0].id, ex.values);
  for (const a of actions) add(`Default · ${a.label}`, a.id, {});
  const first = list.find((x) => x.label === `Default · ${actions[0].label}`);
  const inv = actions[0].inverse && actions.find((a) => a.id === actions[0].inverse);
  if (first && inv && method.ioField) add(`Round trip · ${inv.label} the default result`, inv.id, { ...first.values, [method.ioField]: first.output }, `${inv.label} applied to the output of “Default · ${actions[0].label}”.`);
  // Drop exact duplicates (e.g. a preset equal to the defaults).
  const seen = new Set();
  return list.filter((x) => { const k = `${x.action.id}|${JSON.stringify(x.values)}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export function renderExamples(method, { onLoad }) {
  const list = examplesModel(method);
  if (!list.length) return h('p', { class: 'muted' }, 'No examples for this method yet.');
  return h('div', { class: 'examples-doc' },
    h('p', { class: 'muted small' }, 'Each example was run just now by the same code as the visualizer. Load one to step through it.'),
    h('ul', { class: 'ex-cards' }, list.map((ex, i) => h('li', { class: 'ex-card' },
      h('div', { class: 'ex-card-head' }, h('h2', { id: `exm-${i}` }, ex.label), h('span', { class: 'ex-action' }, ex.action.label)),
      ex.note ? h('p', { class: 'muted small' }, ex.note) : null,
      h('dl', { class: 'ex-io' },
        ex.inputs.map((x) => [h('dt', {}, x.label), h('dd', { class: 'mono' }, x.value === '' ? h('span', { class: 'muted' }, '(empty)') : x.value)]),
        h('dt', {}, ex.outputLabel || 'Output'), h('dd', { class: 'mono ex-out' }, ex.output === '' ? h('span', { class: 'muted' }, '(empty)') : ex.output)),
      h('div', { class: 'ex-card-foot' },
        h('span', { class: 'muted small' }, `${ex.steps} step${ex.steps === 1 ? '' : 's'}`),
        h('button', { type: 'button', class: 'btn btn-sm', 'aria-describedby': `exm-${i}`, onclick: () => onLoad(ex) }, 'Load into visualizer'))))));
}

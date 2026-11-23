import { h } from './dom.js';
import { getActions, defaultValues, validate, runAction } from './contract.js';

// Explanation tab. Everything shown comes from the method itself — its metadata and the step text produced by
// actually running each action on the default inputs. Nothing is written here about the cryptography.
// Optional metadata fields (string or string[]) a method may add later; each becomes its own section:
export const TEXT_FIELDS = [
  ['theory', 'Theory'], ['overview', 'Overview'], ['principle', 'Working principle'], ['howItWorks', 'How it works'],
  ['security', 'Security considerations'], ['weaknesses', 'Weaknesses and attacks'], ['limitations', 'Limitations'],
];
const paras = (v) => [].concat(v).filter((x) => typeof x === 'string' && x.trim());

/** Pure: the sections to show (used by the renderer and the tests). */
export function explanationModel(method) {
  const sections = [];
  for (const [field, title] of TEXT_FIELDS) {
    const p = paras(method[field]);
    if (p.length) sections.push({ kind: 'text', id: field, title, paragraphs: p });
  }
  const actions = getActions(method);
  const runs = [];
  for (const a of actions) {
    const values = defaultValues(method);
    const { fieldErrors, formError } = validate(method, a.id, values);
    if (Object.keys(fieldErrors).length || formError) continue;
    try {
      const res = runAction(method, a.id, values);
      if (res.steps.length) runs.push({ action: a, steps: res.steps.map((s) => ({ title: s.title, explanation: s.explanation || '' })) });
    } catch { /* default input not valid for this action (e.g. decrypt needs ciphertext): skip */ }
  }
  return { description: method.description || '', sections, runs };
}

export function renderExplanation(method) {
  const m = explanationModel(method);
  const stepsSection = (run) => {
    const list = run.steps;
    const li = (s, i) => h('li', {}, h('strong', {}, s.title), s.explanation ? h('p', {}, s.explanation) : null);
    const SHOW = 8;
    const ol = h('ol', { class: 'ex-steps' }, list.slice(0, SHOW).map(li));
    const more = list.length > SHOW
      ? h('details', { class: 'ex-more' }, h('summary', {}, `Show the other ${list.length - SHOW} steps`), h('ol', { class: 'ex-steps', start: SHOW + 1 }, list.slice(SHOW).map((s, i) => li(s, i + SHOW))))
      : null;
    return h('section', { class: 'ex-sec', 'aria-labelledby': `ex-run-${run.action.id}` },
      h('h2', { id: `ex-run-${run.action.id}` }, `Steps: ${run.action.label}`),
      h('p', { class: 'muted small' }, `The steps the visualizer shows for “${run.action.label}” with the default inputs.`),
      ol, more);
  };
  return h('div', { class: 'explain-doc' },
    h('section', { class: 'ex-sec' }, h('h2', {}, 'What it does'), h('p', { class: 'ex-lead' }, m.description)),
    m.sections.map((s) => h('section', { class: 'ex-sec' }, h('h2', {}, s.title), s.paragraphs.map((p) => h('p', {}, p)))),
    m.runs.map(stepsSection),
    m.sections.some((s) => ['security', 'weaknesses', 'limitations'].includes(s.id)) ? null
      : h('p', { class: 'ex-note muted small' }, 'Security notes and weaknesses for this method are part of the step explanations above (usually in the last step).'));
}

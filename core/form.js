import { h } from './dom.js';
import { inputsFor } from './contract.js';

/**
 * Builds the input form from a method's declared inputs.
 * Returns { el, read(), setValues(values), showErrors(fieldErrors), setAction(actionId) }.
 */
export function buildForm(method, { onInput } = {}) {
  const fields = {};
  const el = h('div', { class: 'form' });

  for (const input of method.inputs) {
    const id = `in-${method.id}-${input.id}`;
    let control;
    if (input.type === 'select') {
      control = h('select', { id }, input.options.map((o) => h('option', { value: o.value }, o.label)));
    } else if (input.type === 'textarea') {
      control = h('textarea', { id, rows: 3, placeholder: input.placeholder || '', spellcheck: 'false' });
    } else {
      control = h('input', { id, type: input.type === 'number' ? 'number' : 'text', placeholder: input.placeholder || '', min: input.min, max: input.max, step: input.type === 'number' ? 1 : undefined, spellcheck: 'false', autocomplete: 'off' });
    }
    control.value = input.default ?? '';
    control.addEventListener('input', () => { if (onInput) onInput(); });
    // Help and error text are tied to the control (aria-describedby); errors also set aria-invalid.
    const helpId = `${id}-help`, errId = `${id}-err`;
    const err = h('div', { class: 'field-error', id: errId, role: 'alert' });
    control.setAttribute('aria-describedby', input.help ? `${helpId} ${errId}` : errId);
    const field = h('div', { class: `field${input.type === 'number' ? '' : ' is-wide'}` },
      h('label', { for: id }, input.label, input.help ? h('span', { class: 'help', id: helpId }, input.help) : null), control, err);
    fields[input.id] = { input, control, err, field };
    el.append(field);
  }

  return {
    el,
    read() {
      const values = {};
      for (const [k, { input, control }] of Object.entries(fields)) {
        if (input.type === 'number') values[k] = control.value.trim() === '' ? NaN : Number(control.value);
        else values[k] = control.value;
      }
      return values;
    },
    setValues(values) {
      for (const [k, v] of Object.entries(values)) if (fields[k]) fields[k].control.value = v;
    },
    showErrors(fieldErrors = {}) {
      for (const [k, f] of Object.entries(fields)) {
        f.err.textContent = fieldErrors[k] || '';
        f.field.classList.toggle('has-error', !!fieldErrors[k]);
        if (fieldErrors[k]) f.control.setAttribute('aria-invalid', 'true'); else f.control.removeAttribute('aria-invalid');
      }
    },
    setAction(actionId) {
      const visible = new Set(inputsFor(method, actionId).map((i) => i.id));
      for (const [k, f] of Object.entries(fields)) f.field.hidden = !visible.has(k);
    },
  };
}

// Pure helpers describing the method contract (no DOM; shared by the app and the tests).

const DEFAULT_ACTIONS = [
  { id: 'encrypt', label: 'Encrypt', inverse: 'decrypt' },
  { id: 'decrypt', label: 'Decrypt', inverse: 'encrypt' },
];

/** The actions a method offers. Missing `inverse` links are filled in for encrypt/decrypt and encode/decode. */
export function getActions(method) {
  const list = (method.actions || DEFAULT_ACTIONS).map((a) => ({ label: a.id, ...a }));
  const ids = new Set(list.map((a) => a.id));
  const pairs = { encrypt: 'decrypt', decrypt: 'encrypt', encode: 'decode', decode: 'encode' };
  for (const a of list) if (!a.inverse && pairs[a.id] && ids.has(pairs[a.id])) a.inverse = pairs[a.id];
  return list;
}

/** Inputs visible for an action. */
export const inputsFor = (method, actionId) => method.inputs.filter((i) => !i.showFor || i.showFor.includes(actionId));

/** Default values for every input. */
export const defaultValues = (method) => Object.fromEntries(method.inputs.map((i) => [i.id, i.default]));

/**
 * Validate values for an action. Returns { fieldErrors: {id: msg}, formError: msg|null }.
 */
export function validate(method, actionId, values) {
  const fieldErrors = {};
  for (const input of inputsFor(method, actionId)) {
    const v = values[input.id];
    if (input.type === 'number' && (v === null || Number.isNaN(v))) { fieldErrors[input.id] = `${input.label} must be a number.`; continue; }
    if (input.validate) {
      const err = input.validate(v, values);
      if (err) fieldErrors[input.id] = err;
    }
  }
  let formError = null;
  if (!Object.keys(fieldErrors).length && method.validate) formError = method.validate(values, actionId) || null;
  return { fieldErrors, formError };
}

/** Run an action and normalise its result. Throws friendly Errors for invalid input. */
export function runAction(method, actionId, values) {
  if (typeof method[actionId] !== 'function') throw new Error(`Method "${method.id}" has no action "${actionId}".`);
  const res = method[actionId](values);
  if (!res || !Array.isArray(res.steps)) throw new Error(`Method "${method.id}" returned no steps.`);
  return { output: String(res.output ?? ''), outputLabel: res.outputLabel, steps: res.steps };
}

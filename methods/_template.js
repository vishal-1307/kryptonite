/**
 * TEMPLATE for a new method. Copy this file to methods/<your-method>.js, fill it in,
 * then add it to registry.js (one import + one array entry). Nothing in core/ needs to change.
 *
 * Contract
 * --------
 * id          unique, lowercase, used in the URL (#/atbash)
 * name        shown in the sidebar and header
 * category    'Classical' | 'Symmetric' | 'Asymmetric' | 'Key Exchange' | 'Hashing' | 'Encoding' | anything new
 * description one sentence for the method card
 * ioField     (optional) id of the input that holds the message; enables the "Use output as input" button
 * inputs      form fields; the form is generated automatically from this list:
 *               { id, label, type: 'text' | 'textarea' | 'number' | 'select',
 *                 default, placeholder?, help?, min?, max?, options?: [{ value, label }],
 *                 showFor?: ['encrypt']            // only show for some actions
 *                 validate?: (value, values) => 'error message' | null }
 * actions     (optional) buttons; default is [{id:'encrypt'}, {id:'decrypt'}].
 *             Each action id must be a function on this object.
 * validate    (optional) (values, actionId) => 'error message' | null, for checks across fields
 * examples    (optional) [{ label, values }] quick-fill presets shown above the form
 *
 * Every action function receives the input values ({ id: value }, numbers already parsed)
 * and returns { output, outputLabel?, steps }. Throw an Error with a friendly message on bad input.
 *
 * A step is { title, explanation, visual } where visual is { type, data } or an array of them.
 * Built-in visual types (see visuals/ for the data each one expects):
 *   letterStrip, wheel, textRows, grid, railFence, matrix, byteGrid, hexDump,
 *   math, table, bits, flow, digest
 *
 * Methods must stay pure (no DOM access) so they can be unit-tested with `node --test`.
 */
import { isLetter, letterIndex, indexLetter } from '../lib/text.js';

// Example: the Atbash cipher (A↔Z, B↔Y, …). It is its own inverse.
function atbash(text) {
  return [...text].map((ch) => (isLetter(ch) ? indexLetter(25 - letterIndex(ch), ch === ch.toLowerCase()) : ch)).join('');
}

function run({ text }) {
  const output = atbash(text);
  const steps = [
    {
      title: 'Reverse the alphabet',
      explanation: 'Atbash maps A→Z, B→Y, C→X and so on.',
      visual: { type: 'letterStrip', data: { top: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'], bottom: [...'ZYXWVUTSRQPONMLKJIHGFEDCBA'], labelTop: 'Plain', labelBottom: 'Cipher' } },
    },
    {
      title: 'Result',
      explanation: 'Each letter was replaced by its mirror.',
      visual: { type: 'textRows', data: { rows: [{ label: 'In', cells: [...text] }, { label: 'Out', cells: [...output] }] } },
    },
  ];
  return { output, steps };
}

export default {
  id: 'atbash',
  name: 'Atbash Cipher',
  category: 'Classical',
  description: 'Mirror the alphabet: A becomes Z, B becomes Y.',
  ioField: 'text',
  inputs: [
    { id: 'text', label: 'Message', type: 'textarea', default: 'Hello World' },
  ],
  encrypt: run,
  decrypt: run,
};

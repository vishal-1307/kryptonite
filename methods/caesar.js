import { isLetter, letterIndex, indexLetter, ALPHABET } from '../lib/text.js';
import { mod } from '../lib/math.js';

const MAX_LETTER_STEPS = 24; // keep long messages watchable
const PASS_NOTE = 'Only the letters A–Z / a–z are shifted (case is kept). Everything else (spaces, digits, punctuation, accented or non-Latin letters) is copied to the output unchanged and in the same position.';
export function shiftText(text, k) {
  return [...text].map((ch) => (isLetter(ch) ? indexLetter(letterIndex(ch) + k, ch === ch.toLowerCase()) : ch)).join('');
}

function run(text, shift, decrypting) {
  if (!String(text ?? '').length) throw new Error('Enter a message');
  const k = mod(Number(shift), 26);
  const eff = decrypting ? mod(-k, 26) : k;
  const chars = [...text];
  const out = shiftText(text, eff);
  const outChars = [...out];
  const passCount = chars.filter((ch) => !isLetter(ch)).length;
  const formula = decrypting ? 'D(x) = (x − k) mod 26' : 'E(x) = (x + k) mod 26';
  const steps = [{
    title: decrypting ? `Rotate the alphabet back by ${k}` : `Rotate the alphabet by ${k}`,
    explanation: (decrypting
      ? `Decryption undoes the shift: every cipher letter moves ${k} places back. The inner ring shows which plain letter each cipher letter came from.`
      : `Caesar replaces each letter with the one ${k} places further down the alphabet, wrapping Z around to A.`)
      + ` ${PASS_NOTE}${passCount ? ` In this message ${passCount} character${passCount === 1 ? ' is' : 's are'} copied unchanged.` : ''}`,
    meta: { shift: k, effectiveShift: eff, passThroughCount: passCount },
    visual: [
      { type: 'wheel', data: { shift: eff } },
      { type: 'letterStrip', data: { top: [...ALPHABET], bottom: [...shiftText(ALPHABET, eff)], labelTop: decrypting ? 'Cipher' : 'Plain', labelBottom: decrypting ? 'Plain' : 'Cipher' } },
    ],
  }];

  let shown = 0;
  chars.forEach((ch, i) => {
    if (!isLetter(ch) || shown >= MAX_LETTER_STEPS) return;
    shown++;
    const x = letterIndex(ch), y = letterIndex(outChars[i]);
    steps.push({
      title: `${ch} → ${outChars[i]}`,
      explanation: `${ch.toUpperCase()} is letter number ${x} (A = 0). ${decrypting ? `Subtract ${k}` : `Add ${k}`} and wrap around 26 to get ${y}, which is ${outChars[i].toUpperCase()}.`,
      visual: [
        { type: 'wheel', data: { shift: eff, active: x } },
        { type: 'textRows', data: { rows: [
          { label: decrypting ? 'Cipher' : 'Plain', cells: chars },
          { label: decrypting ? 'Plain' : 'Cipher', cells: outChars.map((c, j) => (j <= i ? c : '')) },
        ], active: i } },
        { type: 'math', data: { lines: [
          { expr: formula, note: 'A=0, B=1 … Z=25' },
          { expr: `(${x} ${decrypting ? '−' : '+'} ${k}) mod 26 = ${y}`, note: `${ch.toUpperCase()} → ${outChars[i].toUpperCase()}`, highlight: true },
        ] } },
      ],
      meta: { charIndex: i, letterNumber: shown - 1, inValue: x, outValue: y, shift: k },
    });
  });
  const letters = chars.filter(isLetter).length;
  steps.push({
    title: 'Result',
    explanation: (letters > MAX_LETTER_STEPS
      ? `The first ${MAX_LETTER_STEPS} letters were shown one by one; the other ${letters - MAX_LETTER_STEPS} are shifted exactly the same way. `
      : '')
      + 'Every letter was shifted by the same amount, so there are only 25 useful keys.'
      + (/[^\x00-\x7F]/.test(text) ? ' Note: only the English letters A–Z are shifted; accented or non-Latin letters (é, अ …) pass through unchanged.' : ''),
    visual: { type: 'textRows', data: { rows: [
      { label: decrypting ? 'Cipher' : 'Plain', cells: chars },
      { label: decrypting ? 'Plain' : 'Cipher', cells: outChars },
    ] } },
  });
  return { output: out, steps };
}

export default {
  id: 'caesar',
  name: 'Caesar Cipher',
  category: 'Classical',
  description: 'Shift every letter by a fixed number of places. The oldest and simplest substitution cipher.',
  ioField: 'text',
  inputs: [
    { id: 'text', label: 'Message', type: 'textarea', default: 'Attack at dawn', placeholder: 'Type a message…' },
    { id: 'shift', label: 'Shift (key)', type: 'number', default: 3, min: 0, max: 25, help: '0 – 25', showFor: ['encrypt', 'decrypt'],
      validate: (v) => (Number.isInteger(v) && v >= 0 && v <= 25 ? null : 'Shift must be a whole number from 0 to 25.') },
  ],
  validate: ({ text }) => (String(text ?? '').length ? null : 'Enter a message'),
  actions: [
    { id: 'encrypt', label: 'Encrypt' },
    { id: 'decrypt', label: 'Decrypt' },
  ],
  encrypt: ({ text, shift }) => run(text, shift, false),
  decrypt: ({ text, shift }) => run(text, shift, true),

};

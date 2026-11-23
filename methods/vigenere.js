import { isLetter, letterIndex, indexLetter, onlyLetters, ALPHABET } from '../lib/text.js';
import { mod } from '../lib/math.js';
import { shiftText } from './caesar.js';

const MAX_LETTER_STEPS = 24;

export function vigenere(text, key, decrypting) {
  const k = onlyLetters(key);
  if (!k) throw new Error('The key must contain at least one letter.');
  let j = 0;
  const keyRow = [];
  const keyPos = []; // per character: index into the key (0-based), or null when the key does not advance
  const out = [...text].map((ch) => {
    if (!isLetter(ch)) { keyRow.push(''); keyPos.push(null); return ch; }
    const s = letterIndex(k[j % k.length]);
    keyRow.push(k[j % k.length]);
    keyPos.push(j % k.length);
    j++;
    return indexLetter(letterIndex(ch) + (decrypting ? -s : s), ch === ch.toLowerCase());
  }).join('');
  return { out, keyRow, keyPos, k };
}

function run({ text, key }, decrypting) {
  if (!String(text ?? '').length) throw new Error('Enter a message');
  const { out, keyRow, keyPos, k } = vigenere(text, key, decrypting);
  const passCount = [...text].filter((ch) => !isLetter(ch)).length;
  const chars = [...text], outChars = [...out];
  const inLabel = decrypting ? 'Cipher' : 'Plain', outLabel = decrypting ? 'Plain' : 'Cipher';
  const steps = [{
    title: 'Repeat the key under the message',
    explanation: `The key "${k}" is written repeatedly under the letters of the message. Each key letter is a different Caesar shift: A = 0, B = 1 … Z = 25.${k !== String(key) ? ` (The keyword was reduced to its letters, in capitals: "${k}".)` : ''} Non-letters (spaces, digits, punctuation, accented letters) are copied unchanged and do NOT use up a key letter: the key only moves forward on A–Z.${passCount ? ` Here ${passCount} character${passCount === 1 ? ' is' : 's are'} skipped that way.` : ''}`,
    meta: { key: k, keyLength: k.length, passThroughCount: passCount },
    visual: { type: 'textRows', data: { rows: [
      { label: inLabel, cells: chars },
      { label: 'Key', cells: keyRow },
    ] } },
  }];
  let shown = 0;
  chars.forEach((ch, i) => {
    if (!isLetter(ch) || shown >= MAX_LETTER_STEPS) return;
    shown++;
    const x = letterIndex(ch), s = letterIndex(keyRow[i]), y = letterIndex(outChars[i]);
    steps.push({
      title: `${ch.toUpperCase()} with key ${keyRow[i]} → ${outChars[i].toUpperCase()}`,
      explanation: `Letter ${shown} of the message uses key letter ${keyPos[i] + 1} of ${k.length} ("${keyRow[i]}"${shown > k.length ? `, the key has started over ${Math.floor((shown - 1) / k.length)} time${Math.floor((shown - 1) / k.length) === 1 ? '' : 's'}` : ''}). Key letter ${keyRow[i]} means shift ${s}. Look up row ${keyRow[i]} of the Vigenère square: ${decrypting ? 'find' : 'column'} ${ch.toUpperCase()} ${decrypting ? 'in that row; its column is' : 'gives'} ${outChars[i].toUpperCase()}.`,
      visual: [
        { type: 'letterStrip', data: decrypting
          ? { top: [...shiftText(ALPHABET, s)], bottom: [...ALPHABET], labelTop: `Row ${keyRow[i]}`, labelBottom: 'Plain', active: y }
          : { top: [...ALPHABET], bottom: [...shiftText(ALPHABET, s)], labelTop: 'Plain', labelBottom: `Row ${keyRow[i]}`, active: x } },
        { type: 'textRows', data: { rows: [
          { label: inLabel, cells: chars },
          { label: 'Key', cells: keyRow },
          { label: outLabel, cells: outChars.map((c, j) => (j <= i ? c : '')) },
        ], active: i } },
        { type: 'math', data: { lines: [
          { expr: `(${x} ${decrypting ? '−' : '+'} ${s}) mod 26 = ${y}`, note: `${ch.toUpperCase()} → ${outChars[i].toUpperCase()}`, highlight: true },
        ] } },
      ],
      meta: { charIndex: i, letterNumber: shown - 1, keyLetter: keyRow[i], keyIndex: keyPos[i], keyLength: k.length, shift: s, inValue: x, outValue: y },
    });
  });
  steps.push({
    title: 'Result',
    explanation: 'Because the shift keeps changing, the same plain letter can become different cipher letters. That defeats simple frequency analysis, although the repeating key can still be attacked: repeated fragments in the ciphertext reveal the key length (Kasiski examination), and then each column is just a Caesar cipher. If the key were truly random, used once, and as long as the message, this would become a one-time pad, which is unbreakable.',
    visual: { type: 'textRows', data: { rows: [
      { label: inLabel, cells: chars }, { label: 'Key', cells: keyRow }, { label: outLabel, cells: outChars },
    ] } },
  });
  return { output: out, steps };
}

export default {
  id: 'vigenere',
  name: 'Vigenère Cipher',
  category: 'Classical',
  description: 'A keyword picks a different Caesar shift for each letter (polyalphabetic substitution).',
  ioField: 'text',
  inputs: [
    { id: 'text', label: 'Message', type: 'textarea', default: 'ATTACK AT DAWN' },
    { id: 'key', label: 'Keyword', type: 'text', default: 'LEMON', validate: (v) => (/[A-Za-z]/.test(v) ? null : 'The keyword needs at least one letter.') },
  ],
  validate: ({ text }) => (String(text ?? '').length ? null : 'Enter a message'),
  encrypt: (v) => run(v, false),
  decrypt: (v) => run(v, true),
};

import { isLetter, letterIndex, indexLetter, ALPHABET } from '../lib/text.js';
import { mod } from '../lib/math.js';

const MAX_LETTER_STEPS = 24; // keep long messages watchable
const MIN_LETTERS_FOR_STATS = 20; // below this, frequency scores are unreliable

// English letter frequencies (%), used to score brute-force candidates.
const EN = [8.17,1.49,2.78,4.25,12.7,2.23,2.02,6.09,6.97,0.15,0.77,4.03,2.41,6.75,7.51,1.93,0.1,5.99,6.33,9.06,2.76,0.98,2.36,0.15,1.97,0.07];

export function shiftText(text, k) {
  return [...text].map((ch) => (isLetter(ch) ? indexLetter(letterIndex(ch) + k, ch === ch.toLowerCase()) : ch)).join('');
}

/** Chi-squared distance from English (lower = more English-like). */
export function chiSquared(text) {
  const counts = new Array(26).fill(0);
  let total = 0;
  for (const ch of text) if (isLetter(ch)) { counts[letterIndex(ch)]++; total++; }
  if (!total) return Infinity;
  return counts.reduce((sum, c, i) => {
    const expected = (EN[i] / 100) * total;
    return sum + ((c - expected) ** 2) / expected;
  }, 0);
}

function run(text, shift, decrypting) {
  if (!String(text ?? '').length) throw new Error('Enter a message');
  const k = mod(Number(shift), 26);
  const eff = decrypting ? mod(-k, 26) : k;
  const chars = [...text];
  const out = shiftText(text, eff);
  const outChars = [...out];
  const formula = decrypting ? 'D(x) = (x − k) mod 26' : 'E(x) = (x + k) mod 26';
  const steps = [{
    title: decrypting ? `Rotate the alphabet back by ${k}` : `Rotate the alphabet by ${k}`,
    explanation: decrypting
      ? `Decryption undoes the shift: every cipher letter moves ${k} places back. The inner ring shows which plain letter each cipher letter came from.`
      : `Caesar replaces each letter with the one ${k} places further down the alphabet, wrapping Z around to A. Numbers, spaces and punctuation stay unchanged.`,
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
    });
  });
  const letters = chars.filter(isLetter).length;
  steps.push({
    title: 'Result',
    explanation: (letters > MAX_LETTER_STEPS
      ? `The first ${MAX_LETTER_STEPS} letters were shown one by one; the other ${letters - MAX_LETTER_STEPS} are shifted exactly the same way. `
      : '')
      + 'Every letter was shifted by the same amount. That is the weakness: there are only 25 useful keys, so an attacker can simply try them all (see "Brute-force attack").'
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
    { id: 'attack', label: 'Brute-force attack' },
  ],
  encrypt: ({ text, shift }) => run(text, shift, false),
  decrypt: ({ text, shift }) => run(text, shift, true),

  /** Try all 26 shifts and rank them by how English-like they look. */
  attack({ text }) {
    if (!/[A-Za-z]/.test(text)) throw new Error('Enter some ciphertext containing letters to attack.');
    const rows = [];
    for (let k = 0; k < 26; k++) {
      const guess = shiftText(text, mod(-k, 26));
      rows.push({ k, guess, score: chiSquared(guess) });
    }
    const ranked = rows.slice().sort((a, b) => a.score - b.score);
    const top = ranked.slice(0, 3);
    const letters = [...text].filter((c) => /[A-Za-z]/.test(c)).length;
    const short = letters < MIN_LETTERS_FOR_STATS;
    const table = (upto, hi) => ({ type: 'table', data: {
      headers: ['Key', 'Decryption attempt', 'χ² vs English (lower = better)'],
      rows: rows.slice(0, upto).map((r) => [r.k, r.guess.length > 48 ? r.guess.slice(0, 48) + '…' : r.guess, r.score.toFixed(1)]),
      highlightRows: hi,
    } });
    const steps = [{
      title: 'Only 26 possible keys',
      explanation: 'An attacker who does not know the shift just tries every one of them. A computer does this instantly.',
      visual: table(0, []),
    }];
    for (let k = 0; k < 26; k++) {
      steps.push({ title: `Try key ${k}`, explanation: `Shift every letter back by ${k}. The χ² score compares the letter frequencies with normal English; lower means more English-like.`, visual: table(k + 1, [k]) });
    }
    steps.push({
      title: short ? `Top candidates (text too short to be sure)` : `Top candidates: key ${top[0].k} looks best`,
      explanation: (short
        ? `⚠ Only ${letters} letters: letter-frequency statistics are unreliable for short text, so the lowest score may be wrong. Read the top candidates (and the full table) and pick the one that makes sense.`
        : `Key ${top[0].k} gives the most English-like letter frequencies. Always read the candidate to confirm.`)
        + ' This frequency-analysis attack is why Caesar is never used for real security.',
      visual: [
        { type: 'math', data: { lines: top.map((r, i) => ({ expr: `#${i + 1}  key ${r.k}: ${r.guess.length > 40 ? r.guess.slice(0, 40) + '…' : r.guess}`, note: `χ² = ${r.score.toFixed(1)}`, highlight: i === 0 && !short })) } },
        table(26, top.map((r) => r.k)),
      ],
    });
    const output = short ? top.map((r) => `key ${r.k}: ${r.guess}`).join('  ·  ') : top[0].guess;
    const outputLabel = short ? `Text is short (${letters} letters) — top 3 candidates, check which reads correctly` : `Most likely plaintext (key ${top[0].k}; next best: key ${top[1].k}, key ${top[2].k})`;
    return { output, outputLabel, steps, candidates: top.map(({ k, guess, score }) => ({ k, guess, score })) };
  },
};

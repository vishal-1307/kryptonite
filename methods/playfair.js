import { onlyLetters } from '../lib/text.js';

const MAX_PAIR_STEPS = 20;
const LOSSY = 'Decryption does not always give back the exact original text: spaces, punctuation and lower case are lost, every J comes back as I, and the filler X/Q letters stay in until a human removes them (a real X next to a filler cannot be told apart automatically).';

/** Build the 5×5 key square (I and J share a cell). */
export function keySquare(key) {
  const seen = new Set();
  const letters = [];
  for (const ch of (onlyLetters(key) + 'ABCDEFGHIKLMNOPQRSTUVWXYZ').replace(/J/g, 'I')) {
    if (!seen.has(ch)) { seen.add(ch); letters.push(ch); }
  }
  const grid = [];
  for (let r = 0; r < 5; r++) grid.push(letters.slice(r * 5, r * 5 + 5));
  const pos = {};
  grid.forEach((row, r) => row.forEach((ch, c) => { pos[ch] = [r, c]; }));
  return { grid, pos, keyLetters: [...new Set(onlyLetters(key).replace(/J/g, 'I'))] };
}

/**
 * Split plaintext into digraphs with details: which second letters are inserted fillers and why.
 * Returns { pairs: [[a,b]], fillers: [{ pair, letter, reason: 'double' | 'odd' }], jCount, dropped }.
 */
export function prepareDetailed(text) {
  const raw = String(text ?? '');
  const s = onlyLetters(raw).replace(/J/g, 'I');
  const pairs = [], fillers = [];
  let i = 0;
  while (i < s.length) {
    const a = s[i];
    const b = s[i + 1];
    const filler = a === 'X' ? 'Q' : 'X';
    if (b === undefined) { fillers.push({ pair: pairs.length, letter: filler, reason: 'odd' }); pairs.push([a, filler]); i += 1; }
    else if (a === b) { fillers.push({ pair: pairs.length, letter: filler, reason: 'double', doubled: a }); pairs.push([a, filler]); i += 1; }
    else { pairs.push([a, b]); i += 2; }
  }
  const jCount = (raw.match(/[Jj]/g) || []).length;
  const dropped = [...raw].filter((ch) => !/[A-Za-z]/.test(ch)).length;
  return { pairs, fillers, jCount, dropped };
}

/** Split plaintext into digraphs, inserting X between doubled letters and padding with X. */
export function prepare(text) {
  return prepareDetailed(text).pairs;
}

function transformPair([a, b], sq, dir) {
  const [r1, c1] = sq.pos[a], [r2, c2] = sq.pos[b];
  const m = (x) => (x + 5) % 5;
  if (r1 === r2) return { rule: 'Same row', out: [sq.grid[r1][m(c1 + dir)], sq.grid[r2][m(c2 + dir)]], cells: [[r1, m(c1 + dir)], [r2, m(c2 + dir)]],
    why: `${a} and ${b} are in the same row, so each is replaced by the letter to its ${dir > 0 ? 'right' : 'left'} (wrapping around).` };
  if (c1 === c2) return { rule: 'Same column', out: [sq.grid[m(r1 + dir)][c1], sq.grid[m(r2 + dir)][c2]], cells: [[m(r1 + dir), c1], [m(r2 + dir), c2]],
    why: `${a} and ${b} are in the same column, so each is replaced by the letter ${dir > 0 ? 'below' : 'above'} it (wrapping around).` };
  return { rule: 'Rectangle', out: [sq.grid[r1][c2], sq.grid[r2][c1]], cells: [[r1, c2], [r2, c1]],
    why: `${a} and ${b} form the corners of a rectangle. Each letter is replaced by the corner in its own row but the other letter's column.` };
}

function run({ text, key }, decrypting) {
  if (!String(text ?? '').length) throw new Error('Enter a message');
  const sq = keySquare(key);
  let pairs, fillers = [], jCount = 0, dropped = 0;
  if (decrypting) {
    const s = onlyLetters(text).replace(/J/g, 'I');
    if (s.length % 2) throw new Error('Playfair ciphertext must have an even number of letters.');
    pairs = [];
    for (let i = 0; i < s.length; i += 2) {
      if (s[i] === s[i + 1]) throw new Error(`"${s[i]}${s[i + 1]}" cannot appear in valid Playfair ciphertext (a pair never has two equal letters).`);
      pairs.push([s[i], s[i + 1]]);
    }
  } else {
    ({ pairs, fillers, jCount, dropped } = prepareDetailed(text));
    if (!pairs.length) throw new Error('Enter a message containing letters.');
  }
  const dir = decrypting ? -1 : 1;
  const results = pairs.map((p) => transformPair(p, sq, dir));
  const output = results.map((r) => r.out.join('')).join('');
  const pairCells = (arr) => arr.map((p) => p.join(''));
  const fillerAt = new Map(fillers.map((f) => [f.pair, f]));
  const fillerPairs = fillers.map((f) => f.pair);
  const fillerText = fillers.map((f) => (f.reason === 'double'
    ? `${f.letter} between the two ${f.doubled}s (pair ${f.pair + 1})`
    : `${f.letter} after the last letter to make the length even (pair ${f.pair + 1})`)).join('; ');

  const steps = [{
    title: 'Build the 5×5 key square',
    explanation: `Write the key letters (without repeats) first, then the rest of the alphabet. I and J share one cell so 25 letters fit. Highlighted cells come from the key "${key}".`,
    visual: { type: 'grid', data: { cells: sq.grid, primary: sq.keyLetters.map((ch) => sq.pos[ch]) } },
  }];
  if (!sq.keyLetters.length) {
    steps.push({
      title: '⚠ Empty key = plain alphabet square',
      explanation: 'The key has no letters, so the square is just the alphabet in order (A–Z without J). Anyone can rebuild it, so this offers NO security. It is still useful to practise the rules; for real secrecy pick a keyword.',
      visual: { type: 'grid', data: { cells: sq.grid, caption: 'No key: everyone knows this square' } },
    });
  }
  steps.push({
    title: decrypting ? 'Split the ciphertext into pairs' : 'Split the message into pairs',
    explanation: decrypting
      ? 'Ciphertext is read two letters at a time.'
      : 'Letters are taken two at a time. Only A–Z are used: spaces, digits and punctuation are dropped and capitals are used throughout. J becomes I (they share one cell). A pair may not contain the same letter twice, so a filler X is inserted between doubled letters (e.g. "EE" → "EX E…"), and an X pads an odd final letter. If the doubled or final letter is itself X, the filler is Q instead (e.g. "XX" → "XQ XQ").'
        + (fillers.length ? ` Fillers added here: ${fillerText}.` : ' No filler letters were needed for this message.')
        + (jCount ? ` ${jCount} J${jCount === 1 ? ' was' : 's were'} changed to I.` : '')
        + (dropped ? ` ${dropped} non-letter character${dropped === 1 ? ' was' : 's were'} dropped.` : ''),
    visual: { type: 'textRows', data: { rows: [{ label: 'Pairs', cells: pairCells(pairs) }], fillerPairs } },
    meta: { pairs: pairCells(pairs), fillers, jToI: jCount, droppedChars: dropped },
  });
  results.slice(0, MAX_PAIR_STEPS).forEach((r, i) => {
    const [a, b] = pairs[i];
    const f = fillerAt.get(i);
    steps.push({
      title: `${a}${b} → ${r.out.join('')} (${r.rule})`,
      explanation: r.why + (f ? ` (The ${f.letter} in this pair is a filler letter, not part of the original message.)` : ''),
      meta: { pairIndex: i, pair: [a, b], out: r.out, rule: r.rule, inCells: [sq.pos[a], sq.pos[b]], outCells: r.cells, isFiller: [false, !!f] },
      visual: [
        { type: 'grid', data: { cells: sq.grid, primary: [sq.pos[a], sq.pos[b]], secondary: r.cells, caption: r.rule } },
        { type: 'textRows', data: { rows: [
          { label: 'In', cells: pairCells(pairs) },
          { label: 'Out', cells: results.map((x, j) => (j <= i ? x.out.join('') : '')) },
        ], active: i } },
      ],
    });
  });
  steps.push({
    title: 'Result',
    explanation: (results.length > MAX_PAIR_STEPS ? `The first ${MAX_PAIR_STEPS} pairs were shown; the rest follow the same three rules. ` : '')
      + (decrypting
        ? `${LOSSY} Read the result and remove the filler X (or Q) letters that do not make sense.`
        : `${LOSSY} Encrypting pairs instead of single letters hides single-letter frequencies, which made Playfair much stronger than Caesar in its time. It can still be broken by digraph (letter-pair) frequency analysis on longer messages, e.g. "TH" and "HE" are very common in English.`),
    visual: { type: 'textRows', data: { rows: [{ label: 'In', cells: pairCells(pairs) }, { label: 'Out', cells: results.map((x) => x.out.join('')) }] } },
  });
  return { output, steps };
}

export default {
  id: 'playfair',
  name: 'Playfair Cipher',
  category: 'Classical',
  description: 'Encrypts pairs of letters using a 5×5 key square and three simple rules.',
  ioField: 'text',
  inputs: [
    { id: 'text', label: 'Message', type: 'textarea', default: 'Hide the gold in the tree stump' },
    { id: 'key', label: 'Keyword', type: 'text', default: 'playfair example' },
  ],
  validate: ({ text }) => (!String(text ?? '').length ? 'Enter a message' : /[A-Za-z]/.test(text) ? null : 'The message needs at least one letter.'),
  encrypt: (v) => run(v, false),
  decrypt: (v) => run(v, true),
};

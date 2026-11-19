/** Rail index for each position of a zigzag with `rails` rows. */
export function zigzag(len, rails) {
  const rows = [];
  let r = 0, d = 1;
  for (let i = 0; i < len; i++) {
    rows.push(r);
    if (rails === 1) continue;
    if (r === 0) d = 1; else if (r === rails - 1) d = -1;
    r += d;
  }
  return rows;
}

/** Rails must be an integer ≥ 2; the UI also caps at 10, but the core functions do not. */
export function assertRails(rails) {
  const n = Number(rails);
  if (!Number.isInteger(n) || n < 2) throw new Error('Rails must be a whole number of at least 2.');
  return n;
}

export function railEncrypt(text, rails) {
  const n = assertRails(rails);
  const chars = [...text];
  const rows = zigzag(chars.length, n);
  let out = '';
  for (let r = 0; r < n; r++) chars.forEach((ch, i) => { if (rows[i] === r) out += ch; });
  return out;
}

export function railDecrypt(text, rails) {
  const n = assertRails(rails);
  const chars = [...text];
  const rows = zigzag(chars.length, n);
  const res = new Array(chars.length);
  let k = 0;
  for (let r = 0; r < n; r++) rows.forEach((row, i) => { if (row === r) res[i] = chars[k++]; });
  return res.join('');
}

const show = (ch) => (ch === ' ' ? '␣' : ch);

function run({ text, rails }, decrypting) {
  const chars = [...text];
  if (!chars.length) throw new Error('Enter a message.');
  const n = assertRails(rails);
  const rows = zigzag(chars.length, n);
  const plain = decrypting ? [...railDecrypt(text, n)] : chars;
  const output = decrypting ? plain.join('') : railEncrypt(text, n);
  const cellsUpTo = (pred) => plain.map((ch, i) => ({ r: rows[i], c: i, ch: pred(i) ? show(ch) : '' }));
  const fence = (cells, active = [], caption = '', mark = false) => ({ type: 'railFence', data: { rails: n, cols: chars.length, cells, active, caption, pattern: mark ? rows : null } });
  const steps = [];

  if (!decrypting) {
    steps.push({ title: `Draw ${n} rails`, explanation: `The message is written diagonally down and up across ${n} rows ("rails"), like a zigzag fence. Spaces are kept and shown as ␣.`, visual: fence(cellsUpTo(() => false), [], '', true) });
    // Split the writing into legs at the turning points (top and bottom rail).
    const legs = [];
    let cur = [];
    rows.forEach((r, i) => {
      cur.push(i);
      if ((r === n - 1 || (r === 0 && i > 0)) && i < rows.length - 1) { legs.push(cur); cur = []; }
    });
    if (cur.length) legs.push(cur);
    for (const idx of legs) {
      const s0 = idx[0], end = idx[idx.length - 1];
      // Direction is the step that reached this leg (rows[i] − rows[i−1]), not the rail the leg sits on.
      const delta = s0 === 0 ? (idx.length > 1 ? rows[1] - rows[0] : 1) : rows[s0] - rows[s0 - 1];
      const dir = delta > 0 ? 'going down' : 'going up';
      steps.push({ title: `Write characters ${s0 + 1}–${end + 1} (${dir})`, explanation: `Continue the zigzag ${dir}: ${idx.map((i) => show(chars[i])).join(' ')}. The direction turns around at the top and bottom rails.`, visual: fence(cellsUpTo((i) => i <= end), idx.map((i) => [rows[i], i])) });
    }
    let soFar = '';
    for (let r = 0; r < n; r++) {
      const part = plain.filter((_, i) => rows[i] === r).join('');
      soFar += part;
      steps.push({ title: `Read rail ${r + 1}`, explanation: `Read rail ${r + 1} left to right: "${part}". Ciphertext so far: "${soFar}".`,
        visual: fence(cellsUpTo(() => true), plain.map((_, i) => [rows[i], i]).filter(([rr]) => rr === r), `Output: ${soFar}`) });
    }
  } else {
    steps.push({ title: 'Mark the zigzag pattern', explanation: `First draw the empty zigzag for ${chars.length} characters on ${n} rails, so we know how many characters belong to each rail.`, visual: fence(cellsUpTo(() => false), [], '', true) });
    let k = 0;
    for (let r = 0; r < n; r++) {
      const count = rows.filter((x) => x === r).length;
      const part = chars.slice(k, k + count).join(''); k += count;
      steps.push({ title: `Fill rail ${r + 1}`, explanation: `Rail ${r + 1} has ${count} positions, so it takes the next ${count} ciphertext characters: "${part}".`,
        visual: fence(cellsUpTo((i) => rows[i] <= r), plain.map((_, i) => [rows[i], i]).filter(([rr]) => rr === r)) });
    }
    steps.push({ title: 'Read the zigzag', explanation: 'Now follow the zigzag from left to right to recover the original message.', visual: fence(cellsUpTo(() => true), plain.map((_, i) => [rows[i], i]), `Output: ${output}`) });
  }
  if (n >= chars.length) {
    steps.unshift({ title: '⚠ Too many rails', explanation: `With ${n} rails and only ${chars.length} characters, the zigzag never turns around: every character sits on its own rail, so the output is identical to the input. Use fewer rails than characters.`, visual: { type: 'math', data: { lines: [{ expr: `rails (${n}) ≥ length (${chars.length})`, note: 'output = input', highlight: true }] } } });
  }
  steps.push({ title: 'Result', explanation: 'Rail Fence is a transposition cipher: the letters are not changed, only their order. The number of rails is the key, and there are only a few possible keys, so it is easy to brute-force.', visual: { type: 'textRows', data: { rows: [{ label: 'In', cells: chars.map(show) }, { label: 'Out', cells: [...output].map(show) }] } } });
  return { output, steps };
}

export default {
  id: 'railfence',
  name: 'Rail Fence Cipher',
  category: 'Classical',
  description: 'A transposition cipher: write the message in a zigzag across several rails, then read row by row.',
  ioField: 'text',
  inputs: [
    { id: 'text', label: 'Message', type: 'textarea', default: 'WEAREDISCOVEREDFLEEATONCE' },
    { id: 'rails', label: 'Rails (key)', type: 'number', default: 3, min: 2, max: 10,
      validate: (v) => (Number.isInteger(v) && v >= 2 && v <= 10 ? null : 'Rails must be a whole number from 2 to 10.') },
  ],
  validate: ({ text }) => (!String(text ?? '').length ? 'Enter a message' : [...text].length > 80 ? 'Keep Rail Fence messages to 80 characters so the fence fits on screen.' : null),
  encrypt: (v) => run(v, false),
  decrypt: (v) => run(v, true),
};

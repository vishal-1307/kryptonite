import { bytesToHex, hexToBytes, utf8Encode, utf8Decode, toHex } from '../lib/text.js';

// ---------- AES-128 primitives (FIPS-197). State bytes are stored column-major: index = row + 4*col.

const xtime = (b) => ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff;
export function gmul(a, b) {
  let p = 0;
  while (b) { if (b & 1) p ^= a; a = xtime(a); b >>= 1; }
  return p;
}

// Build the S-box from its definition (multiplicative inverse in GF(2^8) + affine transform).
export const SBOX = new Array(256);
export const INV_SBOX = new Array(256);
(() => {
  for (let x = 0; x < 256; x++) {
    let inv = 0;
    if (x) for (let y = 1; y < 256; y++) if (gmul(x, y) === 1) { inv = y; break; }
    let s = inv;
    for (let i = 1; i <= 4; i++) s ^= ((inv << i) | (inv >> (8 - i))) & 0xff;
    s ^= 0x63;
    SBOX[x] = s; INV_SBOX[s] = x;
  }
})();

const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

export const subBytes = (s) => s.map((b) => SBOX[b]);
export const invSubBytes = (s) => s.map((b) => INV_SBOX[b]);
export const shiftRows = (s) => s.map((_, i) => { const r = i % 4, c = (i - r) / 4; return s[r + 4 * ((c + r) % 4)]; });
export const invShiftRows = (s) => s.map((_, i) => { const r = i % 4, c = (i - r) / 4; return s[r + 4 * ((c - r + 4) % 4)]; });
const MIX = [[2, 3, 1, 1], [1, 2, 3, 1], [1, 1, 2, 3], [3, 1, 1, 2]];
const INV_MIX = [[14, 11, 13, 9], [9, 14, 11, 13], [13, 9, 14, 11], [11, 13, 9, 14]];
const mixWith = (M) => (s) => {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[r + 4 * c] = M[r].reduce((acc, m, k) => acc ^ gmul(m, s[k + 4 * c]), 0);
  }
  return out;
};
export const mixColumns = mixWith(MIX);
export const invMixColumns = mixWith(INV_MIX);
export const addRoundKey = (s, k) => s.map((b, i) => b ^ k[i]);

/** Key expansion: returns 44 words plus a trace of how each word was made. */
export function expandKey(key) {
  if (key.length !== 16) throw new Error('AES-128 needs a 16-byte key.');
  const w = [];
  const trace = [];
  for (let i = 0; i < 4; i++) { w.push(key.slice(4 * i, 4 * i + 4)); trace.push({ i, note: 'from key' }); }
  for (let i = 4; i < 44; i++) {
    let temp = w[i - 1].slice();
    const t = { i, prev: w[i - 1].slice(), back: w[i - 4].slice() };
    if (i % 4 === 0) {
      t.rot = [temp[1], temp[2], temp[3], temp[0]];
      t.sub = t.rot.map((b) => SBOX[b]);
      t.rcon = RCON[i / 4];
      temp = t.sub.slice(); temp[0] ^= t.rcon;
      t.afterRcon = temp.slice();
    }
    w.push(w[i - 4].map((b, j) => b ^ temp[j]));
    trace.push(t);
  }
  const roundKeys = [];
  for (let r = 0; r <= 10; r++) roundKeys.push([].concat(w[4 * r], w[4 * r + 1], w[4 * r + 2], w[4 * r + 3]));
  return { w, roundKeys, trace };
}

/** Encrypt one block, returning output plus every intermediate state. */
export function aesEncryptBlock(input, key) {
  const { roundKeys } = expandKey(key);
  const log = [];
  let s = addRoundKey(input, roundKeys[0]);
  log.push({ round: 0, op: 'AddRoundKey', before: input, after: s, key: roundKeys[0] });
  for (let round = 1; round <= 10; round++) {
    let b = s; s = subBytes(s); log.push({ round, op: 'SubBytes', before: b, after: s });
    b = s; s = shiftRows(s); log.push({ round, op: 'ShiftRows', before: b, after: s });
    if (round < 10) { b = s; s = mixColumns(s); log.push({ round, op: 'MixColumns', before: b, after: s }); }
    b = s; s = addRoundKey(s, roundKeys[round]); log.push({ round, op: 'AddRoundKey', before: b, after: s, key: roundKeys[round] });
  }
  return { output: s, log, roundKeys };
}

/** Inverse cipher (FIPS-197 §5.3). */
export function aesDecryptBlock(input, key) {
  const { roundKeys } = expandKey(key);
  const log = [];
  let s = addRoundKey(input, roundKeys[10]);
  log.push({ round: 0, op: 'AddRoundKey', before: input, after: s, key: roundKeys[10], keyRound: 10 });
  for (let round = 1; round <= 10; round++) {
    const kr = 10 - round;
    let b = s; s = invShiftRows(s); log.push({ round, op: 'InvShiftRows', before: b, after: s });
    b = s; s = invSubBytes(s); log.push({ round, op: 'InvSubBytes', before: b, after: s });
    b = s; s = addRoundKey(s, roundKeys[kr]); log.push({ round, op: 'AddRoundKey', before: b, after: s, key: roundKeys[kr], keyRound: kr });
    if (round < 10) { b = s; s = invMixColumns(s); log.push({ round, op: 'InvMixColumns', before: b, after: s }); }
  }
  return { output: s, log, roundKeys };
}

// ---------- Visual steps

const ALL = [...Array(16).keys()];
const g = (label, bytes, hl = [], tone) => ({ label, bytes, hl, tone });

const EXPLAIN = {
  SubBytes: 'Every byte is replaced using the S-box, a fixed 256-entry lookup table built from inverses in GF(2⁸). This is the only non-linear step and gives AES its "confusion".',
  InvSubBytes: 'Every byte is replaced using the inverse S-box, undoing SubBytes.',
  ShiftRows: 'Row 0 stays put, row 1 rotates left by 1, row 2 by 2 and row 3 by 3. This spreads each column\'s bytes across all four columns.',
  InvShiftRows: 'Rotate row 1 right by 1, row 2 by 2 and row 3 by 3, undoing ShiftRows.',
  MixColumns: 'Each column is multiplied by a fixed matrix in GF(2⁸). Every output byte depends on all four input bytes of its column, which creates "diffusion".',
  InvMixColumns: 'Each column is multiplied by the inverse MixColumns matrix (14, 11, 13, 9).',
  AddRoundKey: 'XOR (⊕) the state with this round\'s 16-byte round key. This is where the secret key enters the cipher.',
};

function opStep(e, decrypting) {
  const roundLabel = e.round === 0 ? 'Initial round' : `Round ${e.round}`;
  const visual = [];
  let extra = '';
  if (e.op === 'AddRoundKey') {
    const kr = e.keyRound ?? e.round;
    visual.push({ type: 'byteGrid', data: { items: [g('State', e.before), { op: '⊕' }, g(`Round key ${kr}`, e.key, [], 'key'), { op: '=' }, g('New state', e.after, ALL, 'out')] } });
    extra = ` Example: ${toHex(e.before[0])} ⊕ ${toHex(e.key[0])} = ${toHex(e.after[0])}.`;
  } else if (e.op.includes('Sub')) {
    visual.push({ type: 'byteGrid', data: { items: [g('Before', e.before, [0]), { op: '→' }, g('After', e.after, [0], 'out')] } });
    extra = ` Example: ${e.op === 'SubBytes' ? 'S-box' : 'inverse S-box'}[${toHex(e.before[0])}] = ${toHex(e.after[0])} (row ${e.before[0] >> 4}, column ${e.before[0] & 15} of the table).`;
  } else if (e.op.includes('Shift')) {
    visual.push({ type: 'byteGrid', data: { items: [g('Before', e.before, [1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15]), { op: '→' }, g('After', e.after, [1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15], 'out')], rowShift: e.op === 'ShiftRows' ? 'left' : 'right' } });
  } else {
    const col = e.before.slice(0, 4);
    const M = e.op === 'MixColumns' ? MIX : INV_MIX;
    visual.push({ type: 'byteGrid', data: { items: [g('Before', e.before, [0, 1, 2, 3]), { op: '→' }, g('After', e.after, [0, 1, 2, 3], 'out')] } });
    visual.push({ type: 'math', data: { lines: M.map((row, r) => ({
      expr: row.map((m, k) => `${m}·${toHex(col[k])}`).join(' ⊕ ') + ` = ${toHex(e.after[r])}`,
      note: `column 0, row ${r}`, highlight: r === 0,
    })) } });
    extra = ' Column 0 is worked out below (· is multiplication in GF(2⁸)).';
  }
  return { title: `${roundLabel} · ${e.op}`, explanation: EXPLAIN[e.op] + extra, visual };
}

function parseBlock(value, format, what) {
  if (format === 'text') {
    const bytes = utf8Encode(value);
    if (bytes.length > 16) throw new Error(`${what} is ${bytes.length} bytes; this single-block demo allows at most 16 bytes (16 plain English characters).`);
    return bytes.concat(new Array(16 - bytes.length).fill(0));
  }
  const bytes = hexToBytes(value);
  if (bytes.length !== 16) throw new Error(`${what} must be exactly 32 hex characters (16 bytes); got ${bytes.length} bytes.`);
  return bytes;
}

function run({ block, key, format }, decrypting) {
  const k = parseBlock(key, format, 'The key');
  const input = decrypting ? parseBlock(block, 'hex', 'The ciphertext') : parseBlock(block, format, 'The plaintext');
  const { output, log, roundKeys } = decrypting ? aesDecryptBlock(input, k) : aesEncryptBlock(input, k);
  const { w, trace } = expandKey(k);
  const t4 = trace[4];
  const hexWord = (b) => b.map(toHex).join(' ');
  const steps = [{
    title: decrypting ? 'Load the ciphertext into the state' : 'Load the plaintext into the state',
    explanation: `AES works on a 4×4 grid of bytes called the state, filled column by column.${format === 'text' && !decrypting ? ' Your text was converted to UTF-8 bytes and padded with 00 to 16 bytes.' : ''}`,
    visual: { type: 'byteGrid', data: { items: [g(decrypting ? 'Ciphertext' : 'Plaintext', input, ALL), { op: ' ' }, g('Key', k, [], 'key')] } },
  }, {
    title: 'Key expansion: making word w4',
    explanation: 'The 16-byte key is expanded into 44 four-byte words (11 round keys). Every 4th word is made by rotating the previous word, passing it through the S-box and XOR-ing a round constant (Rcon); then it is XOR-ed with the word 4 positions back.',
    visual: { type: 'math', data: { lines: [
      { expr: `w3 = ${hexWord(t4.prev)}`, note: 'previous word' },
      { expr: `RotWord → ${hexWord(t4.rot)}`, note: 'rotate left 1 byte' },
      { expr: `SubWord → ${hexWord(t4.sub)}`, note: 'S-box each byte' },
      { expr: `⊕ Rcon(${toHex(t4.rcon)} 00 00 00) → ${hexWord(t4.afterRcon)}`, note: 'round constant' },
      { expr: `⊕ w0 (${hexWord(t4.back)}) = ${hexWord(w[4])}`, note: 'w4', highlight: true },
    ] } },
  }, {
    title: 'Key expansion: all 11 round keys',
    explanation: 'Repeating that process gives one 128-bit round key for the initial step and each of the 10 rounds.',
    visual: { type: 'table', data: { mono: true, headers: ['Round', 'Round key (w₀ w₁ w₂ w₃)'], rows: roundKeys.map((rk, r) => [r, bytesToHex(rk).match(/.{8}/g).join(' ')]), highlightRows: decrypting ? [10] : [0] } },
  }];
  log.forEach((e) => steps.push(opStep(e, decrypting)));
  let outputText = bytesToHex(output);
  let outputLabel = decrypting ? 'Plaintext (hex)' : 'Ciphertext (hex)';
  if (decrypting && format === 'text') {
    let end = 16; while (end > 0 && output[end - 1] === 0) end--;
    outputText = utf8Decode(output.slice(0, end));
    outputLabel = `Plaintext (hex ${bytesToHex(output)})`;
  }
  steps.push({
    title: decrypting ? 'Plaintext recovered' : 'Ciphertext',
    explanation: decrypting
      ? 'Running the inverse steps in reverse order with the same round keys gives back the original block.'
      : 'After 10 rounds the state is the ciphertext. Change a single bit of the plaintext or key and about half of these output bits change (the avalanche effect). Note: real systems use a mode of operation such as GCM to encrypt more than one block.',
    visual: { type: 'byteGrid', data: { items: [g(decrypting ? 'Plaintext' : 'Ciphertext', output, ALL, 'out')] } },
  });
  return { output: outputText, outputLabel, steps };
}

export default {
  id: 'aes',
  name: 'AES-128',
  category: 'Symmetric',
  description: 'The modern standard block cipher: 10 rounds of SubBytes, ShiftRows, MixColumns and AddRoundKey on a 4×4 byte state.',
  ioField: 'block',
  examples: [
    { label: 'FIPS-197 Appendix B', values: { format: 'hex', block: '3243f6a8885a308d313198a2e0370734', key: '2b7e151628aed2a6abf7158809cf4f3c' } },
    { label: 'FIPS-197 Appendix C.1', values: { format: 'hex', block: '00112233445566778899aabbccddeeff', key: '000102030405060708090a0b0c0d0e0f' } },
    { label: 'Text example', values: { format: 'text', block: 'Two One Nine Two', key: 'Thats my Kung Fu' } },
  ],
  inputs: [
    { id: 'format', label: 'Input format', type: 'select', default: 'hex', options: [{ value: 'hex', label: 'Hex (32 hex characters)' }, { value: 'text', label: 'Text (up to 16 characters)' }], help: 'Ciphertext for decryption is always hex' },
    { id: 'block', label: 'Plaintext / ciphertext block', type: 'textarea', default: '3243f6a8885a308d313198a2e0370734', help: 'Default values are the FIPS-197 Appendix B test vector' },
    { id: 'key', label: 'Key (128-bit)', type: 'text', default: '2b7e151628aed2a6abf7158809cf4f3c' },
  ],
  encrypt: (v) => run(v, false),
  decrypt: (v) => run(v, true),
};

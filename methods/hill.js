import { onlyLetters, indexLetter } from '../lib/text.js';
import { mod, gcd, modInverseNum } from '../lib/math.js';

const MAX_PAIR_STEPS = 16;

/** Parse "3 3 2 5" or a 4-letter word like "HILL" into [[a,b],[c,d]]. */
export function parseKey(key) {
  const s = String(key).trim();
  let v;
  if (/^[A-Za-z]{4}$/.test(s.replace(/\s+/g, ''))) v = [...onlyLetters(s)].map((c) => c.charCodeAt(0) - 65);
  else {
    v = s.split(/[\s,;]+/).filter(Boolean).map(Number);
    if (v.length !== 4 || v.some((x) => !Number.isInteger(x))) throw new Error('Key must be 4 whole numbers (e.g. "3 3 2 5") or a 4-letter word (e.g. "HILL").');
    v = v.map((x) => mod(x, 26));
  }
  return [[v[0], v[1]], [v[2], v[3]]];
}

export function inverseKey(K) {
  const det = mod(K[0][0] * K[1][1] - K[0][1] * K[1][0], 26);
  const dInv = modInverseNum(det, 26);
  if (dInv === null) return { det, dInv: null, inv: null };
  const adj = [[K[1][1], -K[0][1]], [-K[1][0], K[0][0]]];
  return { det, dInv, adj: adj.map((r) => r.map((x) => mod(x, 26))), inv: adj.map((r) => r.map((x) => mod(x * dInv, 26))) };
}

const mul = (M, p) => [mod(M[0][0] * p[0] + M[0][1] * p[1], 26), mod(M[1][0] * p[0] + M[1][1] * p[1], 26)];

export function hill(text, key, decrypting) {
  const K = parseKey(key);
  const info = inverseKey(K);
  if (info.dInv === null) throw new Error(`This key cannot be inverted: its determinant is ${info.det}, which shares a factor with 26 (gcd = ${gcd(info.det, 26)}). Choose a key whose determinant is odd and not 13.`);
  let s = onlyLetters(text);
  if (!s) throw new Error('Enter a message containing letters.');
  if (s.length % 2) {
    if (decrypting) throw new Error('Hill ciphertext must have an even number of letters.');
    s += 'X';
  }
  const M = decrypting ? info.inv : K;
  const pairs = [];
  for (let i = 0; i < s.length; i += 2) {
    const p = [s.charCodeAt(i) - 65, s.charCodeAt(i + 1) - 65];
    pairs.push({ inText: s.slice(i, i + 2), p, c: mul(M, p) });
  }
  return { K, info, M, pairs, output: pairs.map((x) => indexLetter(x.c[0]) + indexLetter(x.c[1])).join(''), prepared: s };
}

function run({ text, key }, decrypting) {
  const { K, info, M, pairs, output, prepared } = hill(text, key, decrypting);
  const mat = (label, values) => ({ kind: 'matrix', label, values });
  const vec = (label, v, letters) => ({ kind: 'matrix', label, values: v.map((x, i) => [`${x}`]), sub: letters });
  const steps = [{
    title: 'Key matrix',
    explanation: `The key is a 2×2 matrix of numbers (A = 0 … Z = 25). Its determinant must have an inverse mod 26, otherwise decryption would be impossible. det = ${K[0][0]}·${K[1][1]} − ${K[0][1]}·${K[1][0]} ≡ ${info.det} (mod 26), and gcd(${info.det}, 26) = 1 ✓`,
    visual: [
      { type: 'matrix', data: { items: [mat('K', K)] } },
      { type: 'math', data: { lines: [
        { expr: `det(K) = ${K[0][0]}×${K[1][1]} − ${K[0][1]}×${K[1][0]} = ${K[0][0] * K[1][1] - K[0][1] * K[1][0]}`, note: '' },
        { expr: `det(K) mod 26 = ${info.det}`, note: 'must be coprime with 26', highlight: true },
      ] } },
    ],
  }];
  if (decrypting) {
    steps.push({
      title: 'Compute the inverse key K⁻¹',
      explanation: `Decryption multiplies by the inverse matrix. First find det⁻¹: ${info.det} × ${info.dInv} ≡ 1 (mod 26). Then K⁻¹ = det⁻¹ × adj(K) mod 26, where adj(K) swaps a and d and negates b and c.`,
      visual: [
        { type: 'matrix', data: { items: [mat('adj(K)', info.adj), { kind: 'op', text: `× ${info.dInv} mod 26 =` }, mat('K⁻¹', info.inv)] } },
        { type: 'math', data: { lines: [{ expr: `${info.det} × ${info.dInv} = ${info.det * info.dInv} ≡ 1 (mod 26)`, note: 'det⁻¹', highlight: true }] } },
      ],
    });
  }
  steps.push({
    title: 'Split into pairs of numbers',
    explanation: `Letters are grouped in twos and turned into column vectors.${!decrypting && onlyLetters(text).length % 2 ? ' An X was added to make the length even.' : ''}`,
    visual: { type: 'textRows', data: { rows: [{ label: 'Pairs', cells: pairs.map((p) => p.inText) }, { label: 'Numbers', cells: pairs.map((p) => p.p.join(',')) }] } },
  });
  const name = decrypting ? 'K⁻¹' : 'K';
  pairs.slice(0, MAX_PAIR_STEPS).forEach((x, i) => {
    const out = indexLetter(x.c[0]) + indexLetter(x.c[1]);
    steps.push({
      title: `${x.inText} → ${out}`,
      explanation: `Multiply ${name} by the vector [${x.p}] and reduce each result mod 26.`,
      visual: [
        { type: 'matrix', data: { items: [mat(name, M), { kind: 'op', text: '×' }, vec(x.inText, x.p), { kind: 'op', text: '=' }, vec(out, x.c)] } },
        { type: 'math', data: { lines: [
          { expr: `${M[0][0]}×${x.p[0]} + ${M[0][1]}×${x.p[1]} = ${M[0][0] * x.p[0] + M[0][1] * x.p[1]} ≡ ${x.c[0]}`, note: `→ ${out[0]}`, highlight: true },
          { expr: `${M[1][0]}×${x.p[0]} + ${M[1][1]}×${x.p[1]} = ${M[1][0] * x.p[0] + M[1][1] * x.p[1]} ≡ ${x.c[1]}`, note: `→ ${out[1]}`, highlight: true },
        ] } },
        { type: 'textRows', data: { rows: [
          { label: 'In', cells: pairs.map((p) => p.inText) },
          { label: 'Out', cells: pairs.map((p, j) => (j <= i ? indexLetter(p.c[0]) + indexLetter(p.c[1]) : '')) },
        ], active: i } },
      ],
    });
  });
  steps.push({
    title: 'Result',
    explanation: (pairs.length > MAX_PAIR_STEPS ? `The first ${MAX_PAIR_STEPS} pairs were shown; the rest work the same way. ` : '')
      + (decrypting ? 'If the original message had an odd number of letters, the last letter here is the padding X that was added before encryption; Hill cannot tell, so remove it by reading. ' : '')
      + 'Hill was the first cipher built on linear algebra. Because it is linear, an attacker who knows two plaintext–ciphertext pairs can solve for the 2×2 key with one matrix inversion (a known-plaintext attack).',
    visual: { type: 'textRows', data: { rows: [{ label: 'In', cells: [...prepared] }, { label: 'Out', cells: [...output] }] } },
  });
  return { output, steps };
}

export default {
  id: 'hill',
  name: 'Hill Cipher (2×2)',
  category: 'Classical',
  description: 'Treats pairs of letters as vectors and multiplies them by a key matrix, mod 26.',
  ioField: 'text',
  inputs: [
    { id: 'text', label: 'Message', type: 'textarea', default: 'HELP' },
    { id: 'key', label: 'Key matrix', type: 'text', default: '3 3 2 5', help: '4 numbers row by row (a b c d) or a 4-letter word',
      validate: (v) => { try { const K = parseKey(v); const { dInv, det } = inverseKey(K); return dInv === null ? `Determinant ${det} is not invertible mod 26. Try "3 3 2 5".` : null; } catch (e) { return e.message; } } },
  ],
  validate: ({ text }) => (!String(text ?? '').length ? 'Enter a message' : /[A-Za-z]/.test(text) ? null : 'The message needs at least one letter.'),
  encrypt: (v) => run(v, false),
  decrypt: (v) => run(v, true),
};

import { utf8Encode, toHex } from '../lib/text.js';

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
const w32 = (x) => (x >>> 0).toString(16).padStart(8, '0');

export function pad(bytes) {
  const bitLen = bytes.length * 8;
  const out = bytes.slice();
  out.push(0x80);
  while (out.length % 64 !== 56) out.push(0);
  const hi = Math.floor(bitLen / 2 ** 32), lo = bitLen >>> 0;
  for (const v of [hi, lo]) out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  return out;
}

/** Full SHA-256 with a per-block trace (schedule + all 64 rounds). */
export function sha256Trace(bytes) {
  const padded = pad(bytes);
  let H = H0.slice();
  const blocks = [];
  for (let off = 0; off < padded.length; off += 64) {
    const W = [];
    for (let t = 0; t < 16; t++) W.push(((padded[off + 4 * t] << 24) | (padded[off + 4 * t + 1] << 16) | (padded[off + 4 * t + 2] << 8) | padded[off + 4 * t + 3]) >>> 0);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W.push((W[t - 16] + s0 + W[t - 7] + s1) >>> 0);
    }
    let [a, b, c, d, e, f, g, h] = H;
    const rounds = [];
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const T1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const T2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + T1) >>> 0; d = c; c = b; b = a; a = (T1 + T2) >>> 0;
      rounds.push({ t, T1, T2, vars: [a, b, c, d, e, f, g, h] });
    }
    const before = H;
    H = H.map((x, i) => (x + [a, b, c, d, e, f, g, h][i]) >>> 0);
    blocks.push({ W, rounds, before, after: H.slice() });
  }
  return { padded, blocks, digest: H.map(w32).join('') };
}

export const sha256Hex = (input) => sha256Trace(typeof input === 'string' ? utf8Encode(input) : input).digest;

const bitDiff = (h1, h2) => {
  let n = 0;
  for (let i = 0; i < h1.length; i += 2) { let x = parseInt(h1.slice(i, i + 2), 16) ^ parseInt(h2.slice(i, i + 2), 16); while (x) { n += x & 1; x >>= 1; } }
  return n;
};

const MAX_BLOCKS_SHOWN = 2;

export default {
  id: 'sha256',
  name: 'SHA-256',
  category: 'Hashing',
  description: 'A one-way hash function: any input becomes a fixed 256-bit fingerprint. Used for passwords, blockchains and file integrity.',
  ioField: 'text',
  inputs: [{ id: 'text', label: 'Message', type: 'textarea', default: 'abc' }],
  actions: [{ id: 'hash', label: 'Hash' }],
  validate: ({ text }) => (utf8Encode(text).length > 1000 ? 'Keep the message under 1000 bytes so the visualization stays fast.' : null),

  hash({ text }) {
    const bytes = utf8Encode(text);
    const { padded, blocks, digest } = sha256Trace(bytes);
    const L = bytes.length;
    const steps = [{
      title: 'Message → bytes',
      explanation: `The text is converted to ${L} byte${L === 1 ? '' : 's'} (UTF-8), which is ${L * 8} bits.`,
      visual: { type: 'hexDump', data: { bytes, segments: [{ from: 0, to: L, tone: 'msg', label: 'message' }], chars: true } },
    }, {
      title: 'Padding',
      explanation: `SHA-256 processes 512-bit (64-byte) blocks. Append one 1-bit (byte 80), then zeros, then the original length (${L * 8} bits) as a 64-bit number, so the total is a multiple of 64 bytes. Result: ${padded.length / 64} block${padded.length > 64 ? 's' : ''}.`,
      visual: { type: 'hexDump', data: { bytes: padded, segments: [
        { from: 0, to: L, tone: 'msg', label: 'message' },
        { from: L, to: L + 1, tone: 'one', label: '1-bit (0x80)' },
        { from: L + 1, to: padded.length - 8, tone: 'zero', label: 'zeros' },
        { from: padded.length - 8, to: padded.length, tone: 'len', label: 'length' },
      ] } },
    }, {
      title: 'Initial hash values H₀…H₇',
      explanation: 'The hash starts from eight fixed 32-bit words: the first 32 bits of the fractional parts of the square roots of the first 8 primes.',
      visual: { type: 'table', data: { mono: true, headers: ['Word', 'Value'], rows: H0.map((h, i) => [`H${i}`, w32(h)]) } },
    }];
    blocks.slice(0, MAX_BLOCKS_SHOWN).forEach((blk, bi) => {
      const tag = blocks.length > 1 ? ` (block ${bi + 1})` : '';
      const r0 = blk.rounds[0];
      steps.push({
        title: `Message schedule W₀…W₆₃${tag}`,
        explanation: 'The 16 words of the block become W₀–W₁₅. Each later word mixes four earlier ones: Wₜ = σ₁(Wₜ₋₂) + Wₜ₋₇ + σ₀(Wₜ₋₁₅) + Wₜ₋₁₆, where σ uses bit rotations and shifts.',
        visual: [
          { type: 'math', data: { lines: [{ expr: `W16 = σ1(${w32(blk.W[14])}) + ${w32(blk.W[9])} + σ0(${w32(blk.W[1])}) + ${w32(blk.W[0])} = ${w32(blk.W[16])}`, note: 'mod 2³²', highlight: true }] } },
          { type: 'table', data: { mono: true, compact: true, headers: ['t', 'Wₜ', 't', 'Wₜ', 't', 'Wₜ', 't', 'Wₜ'], rows: Array.from({ length: 16 }, (_, r) => [r, w32(blk.W[r]), r + 16, w32(blk.W[r + 16]), r + 32, w32(blk.W[r + 32]), r + 48, w32(blk.W[r + 48])]) } },
        ],
      });
      steps.push({
        title: `Compression round 0${tag}`,
        explanation: 'Each round computes two temporary words and shifts the eight working variables a…h down by one. Σ are rotations, Ch picks bits from f or g depending on e, Maj takes the majority bit of a, b, c, and Kₜ is a round constant.',
        visual: { type: 'math', data: { lines: [
          { expr: 'T1 = h + Σ1(e) + Ch(e,f,g) + K0 + W0', note: `= ${w32(r0.T1)}` },
          { expr: 'T2 = Σ0(a) + Maj(a,b,c)', note: `= ${w32(r0.T2)}` },
          { expr: 'h←g, g←f, f←e, e←d+T1', note: `e = ${w32(r0.vars[4])}` },
          { expr: 'd←c, c←b, b←a, a←T1+T2', note: `a = ${w32(r0.vars[0])}`, highlight: true },
        ] } },
      });
      steps.push({
        title: `All 64 rounds${tag}`,
        explanation: 'The same round function runs 64 times, each with its own Wₜ and Kₜ. Every bit of the message ends up affecting every working variable.',
        visual: { type: 'table', data: { mono: true, compact: true, scroll: true, headers: ['t', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], rows: blk.rounds.map((r) => [r.t, ...r.vars.map(w32)]), highlightRows: [63] } },
      });
      steps.push({
        title: `Add to the hash${tag}`,
        explanation: 'The final a…h are added (mod 2³²) to the hash values from before this block. This feed-forward makes the function hard to reverse.',
        visual: { type: 'table', data: { mono: true, headers: ['Word', 'Before', '+ working var', '= New'], rows: blk.after.map((h, i) => [`H${i}`, w32(blk.before[i]), w32(blk.rounds[63].vars[i]), w32(h)]), highlightRows: [0, 1, 2, 3, 4, 5, 6, 7] } },
      });
    });
    if (blocks.length > MAX_BLOCKS_SHOWN) steps.push({ title: `Blocks ${MAX_BLOCKS_SHOWN + 1}–${blocks.length}`, explanation: `The remaining ${blocks.length - MAX_BLOCKS_SHOWN} blocks are processed the same way, each starting from the previous hash.`, visual: { type: 'math', data: { lines: [{ expr: `${blocks.length} blocks × 64 rounds`, note: '' }] } } });
    steps.push({
      title: 'Digest',
      explanation: 'Concatenate H₀…H₇ to get the 256-bit (64 hex character) hash. There is no key and no way to "decrypt" it back to the message.',
      visual: { type: 'digest', data: { label: 'SHA-256', hex: digest } },
    });
    const altBytes = bytes.length ? bytes.slice(0, -1).concat([bytes[bytes.length - 1] ^ 1]) : [0x01];
    const alt = sha256Trace(altBytes).digest;
    steps.push({
      title: 'Avalanche effect',
      explanation: `Flipping just one bit of the input (${bytes.length ? `last byte ${toHex(bytes[bytes.length - 1])} → ${toHex(altBytes[altBytes.length - 1])}` : 'adding byte 01'}) changes ${bitDiff(digest, alt)} of the 256 output bits — about half, as a good hash should.`,
      visual: [{ type: 'digest', data: { label: 'Original', hex: digest } }, { type: 'digest', data: { label: '1 bit changed', hex: alt, compare: digest } }],
    });
    return { output: digest, outputLabel: 'SHA-256 digest (hex)', steps };
  },
};


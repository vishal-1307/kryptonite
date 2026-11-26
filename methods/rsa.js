import { isPrime, bgcd, modInverse, modPowTrace } from '../lib/math.js';

/** Small public exponents that work for this φ(n), used in error messages. */
export function suggestE(phi) {
  return [3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 65537n].filter((x) => x < phi && bgcd(x, phi) === 1n).slice(0, 4);
}

const PRIME_INPUT_LIMIT = 10_000_000n; // matches the p/q input max
const SUGGEST_CUTOFF = 10n ** 13n; // larger than this, skip the search (would also exceed the input limit)

/** Integer square root, so we can start at ⌈√x⌉ instead of counting up from 2. */
function isqrt(n) {
  n = BigInt(n);
  if (n < 2n) return n;
  let x0 = n, x1 = (n + 1n) / 2n;
  while (x1 < x0) { x0 = x1; x1 = (x1 + n / x1) / 2n; }
  return x0;
}

/**
 * Two primes whose product is larger than `x`, both at most 10,000,000 so they fit the inputs.
 * Returns null when x is too large to suggest (above ~10^13, or no such pair within the limit).
 */
export function suggestPrimes(x) {
  x = BigInt(x);
  if (x >= SUGGEST_CUTOFF) return null;
  let p = isqrt(x) + 1n;
  if (p < 3n) p = 3n;
  if (p > PRIME_INPUT_LIMIT) return null;
  while (p <= PRIME_INPUT_LIMIT && !isPrime(p)) p++;
  if (p > PRIME_INPUT_LIMIT) return null;
  let q = p + 1n;
  while (q <= PRIME_INPUT_LIMIT && !isPrime(q)) q++;
  if (q > PRIME_INPUT_LIMIT || p * q <= x) return null;
  return [p, q];
}

/**
 * Extended Euclid written the way it is taught for RSA: start with (φ, 0) and (e, 1); every row keeps
 * r ≡ t × e (mod φ). When r reaches 1, t is the inverse of e.
 */
export function inverseTable(e, phi) {
  e = BigInt(e); phi = BigInt(phi);
  const rows = [{ r: phi, q: null, t: 0n }, { r: e, q: null, t: 1n }];
  while (rows[rows.length - 1].r > 1n) {
    const a = rows[rows.length - 2], b = rows[rows.length - 1];
    const q = a.r / b.r;
    rows.push({ r: a.r - q * b.r, q, t: a.t - q * b.t, from: [a, b] });
    if (rows[rows.length - 1].r === 0n) break;
  }
  const last = rows[rows.length - 1];
  return { rows, d: last.r === 1n ? ((last.t % phi) + phi) % phi : null, lastT: last.t };
}

const MAX_BLOCK_STEPS = 8;

/** Square-and-multiply without building a trace (for results; teaching steps still use modPowTrace). */
export function modPowFast(base, exp, m) {
  base = BigInt(base) % BigInt(m); exp = BigInt(exp); m = BigInt(m);
  let acc = 1n;
  while (exp > 0n) {
    if (exp & 1n) acc = (acc * base) % m;
    base = (base * base) % m;
    exp >>= 1n;
  }
  return acc;
}

/** Derive the key pair, throwing a friendly error for bad parameters. */
export function rsaKeys(p, q, e) {
  p = BigInt(p); q = BigInt(q); e = BigInt(e);
  if (!isPrime(p)) throw new Error(`p = ${p} is not prime.`);
  if (!isPrime(q)) throw new Error(`q = ${q} is not prime.`);
  if (p === q) throw new Error('p and q must be different primes.');
  const n = p * q, phi = (p - 1n) * (q - 1n);
  if (e <= 1n || e >= phi) throw new Error(`e must satisfy 1 < e < φ(n) = ${phi}.`);
  if (bgcd(e, phi) !== 1n) throw new Error(`e = ${e} shares a factor with φ(n) = ${phi} (gcd = ${bgcd(e, phi)}). Try ${suggestE(phi).join(', ') || 'larger primes'}.`);
  const d = modInverse(e, phi);
  return { p, q, n, phi, e, d };
}

export function parseNumbers(s) {
  const parts = String(s).trim().split(/[\s,;]+/).filter(Boolean);
  if (!parts.length) throw new Error('Enter at least one number.');
  return parts.map((x) => { if (!/^\d+$/.test(x)) throw new Error(`"${x}" is not a whole number.`); return BigInt(x); });
}

export function rsaEncryptBlocks(ms, k) { return ms.map((m) => modPowFast(m, k.e, k.n)); }
export function rsaDecryptBlocks(cs, k) { return cs.map((c) => modPowFast(c, k.d, k.n)); }

const paren = (x) => (x < 0n ? `(${x})` : `${x}`);

function keySteps(k) {
  const it = inverseTable(k.e, k.phi);
  return [{
    title: 'Pick two primes p and q',
    explanation: `RSA starts with two different secret prime numbers p and q. They must be chosen at random and kept secret (anyone who knows them can compute the private key). Real RSA uses random primes of 1024+ bits each (n of 2048+ bits); here we use the demonstration values p = ${k.p} and q = ${k.q} so every step can be followed by hand.`,
    visual: { type: 'math', data: { lines: [{ expr: `p = ${k.p}`, note: 'prime ✓' }, { expr: `q = ${k.q}`, note: 'prime ✓' }] } },
  }, {
    title: 'Compute n = p × q',
    explanation: `n = p × q is the modulus. It is part of both the public and the private key. Every message block m and ciphertext c is a number from 0 to n − 1. Security relies on the fact that recovering p and q from a large n (factoring) is extremely hard.`,
    visual: { type: 'math', data: { lines: [{ expr: `n = ${k.p} × ${k.q} = ${k.n}`, note: 'public', highlight: true }] } },
  }, {
    title: 'Compute φ(n) = (p − 1)(q − 1)',
    explanation: "Euler's totient φ(n) counts the whole numbers from 1 to n that share no factor with n. For n = p × q with p and q prime it equals (p − 1)(q − 1). It must stay secret: anyone who knows φ(n) can compute d (and even recover p and q). Many real libraries use the smaller λ(n) = lcm(p − 1, q − 1) instead; both give a working d.",
    visual: { type: 'math', data: { lines: [{ expr: `φ(n) = (${k.p} − 1) × (${k.q} − 1) = ${k.p - 1n} × ${k.q - 1n} = ${k.phi}`, note: 'secret', highlight: true }] } },
  }, {
    title: 'Choose the public exponent e',
    explanation: `The public exponent e must satisfy 1 < e < φ(n) and gcd(e, φ(n)) = 1; otherwise it has no inverse mod φ(n) and there is no matching private key. e is public. Real systems almost always use e = 65537.`,
    visual: { type: 'math', data: { lines: [{ expr: `e = ${k.e}`, note: 'public' }, { expr: `gcd(${k.e}, ${k.phi}) = 1`, note: 'coprime ✓', highlight: true }] } },
  }, {
    title: 'Find d with the extended Euclidean algorithm',
    explanation: `The private exponent d is the inverse of e modulo φ(n): the number with e × d ≡ 1 (mod ${k.phi}). It is the secret part of the private key. Start with the rows (r = φ, t = 0) and (r = e, t = 1). Each new row takes q = previous r ÷ current r (whole number), then r_new = r_prev − q × r and t_new = t_prev − q × t. Every row keeps r ≡ t × e (mod φ), so when r reaches 1, t is the inverse.${it.lastT < 0n ? ` The last t is ${it.lastT} (negative), so add φ: ${it.lastT} + ${k.phi} = ${it.d}.` : ''}`,
    visual: [
      { type: 'table', data: { headers: ['Row', 'q', 'r = r₋₂ − q·r₋₁', 't = t₋₂ − q·t₋₁', 'check: t·e mod φ'], highlightRows: [it.rows.length - 1], rows: it.rows.map((row, i) => [
        i, row.q === null ? '—' : `${row.q}`,
        row.from ? `${row.from[0].r} − ${row.q}·${row.from[1].r} = ${row.r}` : `${row.r}`,
        row.from ? `${row.from[0].t} − ${row.q}·${paren(row.from[1].t)} = ${row.t}` : `${row.t}`,
        `${(((row.t * k.e) % k.phi) + k.phi) % k.phi}`,
      ]) } },
      { type: 'math', data: { lines: [{ expr: `d = ${it.lastT} mod ${k.phi} = ${k.d}`, note: 'secret', highlight: true }, { expr: `${k.e} × ${k.d} mod ${k.phi} = ${(k.e * k.d) % k.phi}`, note: 'check ✓' }] } },
    ],
    meta: {
      euclid: {
        phi: `${k.phi}`, e: `${k.e}`,
        // r = s·φ + t·e on every row (s is the coefficient of φ; it is not needed for d but completes the identity).
        rows: (() => { const sc = []; return it.rows.map((row, i) => { sc.push(i === 0 ? 1n : i === 1 ? 0n : sc[i - 2] - row.q * sc[i - 1]); return { index: i, quotient: row.q === null ? null : `${row.q}`, remainder: `${row.r}`, s: `${sc[i]}`, t: `${row.t}`, tTimesEModPhi: `${(((row.t * k.e) % k.phi) + k.phi) % k.phi}` }; }); })(),
        currentRow: it.rows.length - 1,
        lastT: `${it.lastT}`, d: `${k.d}`,
      },
    },
  }, {
    title: 'The key pair',
    explanation: 'Public key (n, e): anyone may use it to encrypt. Private key (n, d): only its owner can decrypt. p, q and φ(n) are no longer needed and must be kept secret or destroyed. (Real implementations keep p and q to speed up decryption with the Chinese Remainder Theorem.)',
    meta: { publicKey: { n: `${k.n}`, e: `${k.e}` }, privateKey: { n: `${k.n}`, d: `${k.d}` }, secret: { p: `${k.p}`, q: `${k.q}`, phi: `${k.phi}` } },
    visual: { type: 'flow', data: { columns: [
      { title: 'Public key', items: [{ text: `n = ${k.n}` }, { text: `e = ${k.e}` }] },
      { title: 'Private key', items: [{ text: `n = ${k.n}` }, { text: `d = ${k.d}`, highlight: true }] },
      { title: 'Destroy / keep secret', items: [{ text: `p = ${k.p}, q = ${k.q}` }, { text: `φ(n) = ${k.phi}` }] },
    ] } },
  }];
}

function powStep(x, exp, k, label, i, total) {
  const { result, bits, trace } = modPowTrace(x, exp, k.n);
  const sym = label === 'encrypt' ? 'e' : 'd';
  return {
    title: `${label === 'encrypt' ? 'Encrypt' : 'Decrypt'} block ${i + 1}${total > 1 ? ` of ${total}` : ''}: ${x}^${sym} mod n = ${result}`,
    explanation: `Compute ${x}^${exp} mod ${k.n} with square-and-multiply: read the exponent in binary (${bits}). For each bit square the running value, and when the bit is 1 also multiply by ${x}. Every intermediate value stays below n.`,
    visual: [
      { type: 'math', data: { lines: [{ expr: `${label === 'encrypt' ? 'c = m' : 'm = c'}^${sym} mod n = ${x}^${exp} mod ${k.n}`, note: '' }, { expr: `= ${result}`, note: label === 'encrypt' ? 'ciphertext' : 'plaintext', highlight: true }] } },
      { type: 'table', data: { headers: ['Bit', 'Square', 'Multiply', 'Running value'], rows: trace.map((t) => [t.bit, `${t.squared}`, t.multiplied === null ? '—' : `× ${x} → ${t.multiplied}`, `${t.acc}`]), highlightRows: [trace.length - 1] } },
    ],
    meta: {
      modPow: {
        base: `${x}`, exponent: `${exp}`, modulus: `${k.n}`, bits, result: `${result}`, blockIndex: i,
        // One entry per exponent bit, most significant first (left-to-right square-and-multiply).
        progress: trace.map((t, bi) => ({ bitIndex: bi, bit: t.bit, base: `${x}`, accBefore: bi === 0 ? '1' : `${trace[bi - 1].acc}`, squared: `${t.squared}`, multiplied: t.multiplied === null ? null : `${t.multiplied}`, acc: `${t.acc}` })),
      },
    },
  };
}

function run({ p, q, e, message, format }, decrypting) {
  if (!String(message ?? '').length) throw new Error('Enter a message');
  const k = rsaKeys(p, q, e);
  const steps = keySteps(k);
  let blocks;
  if (decrypting) blocks = parseNumbers(message);
  else if (format === 'numbers') blocks = parseNumbers(message);
  else {
    blocks = [...message].map((ch) => BigInt(ch.codePointAt(0)));
    steps.push({ title: 'Turn the text into numbers', explanation: 'RSA works on numbers, so each character becomes its Unicode code (e.g. A = 65). Real systems encrypt a padded block of bytes instead (OAEP padding).', visual: { type: 'textRows', data: { rows: [{ label: 'Char', cells: [...message].map((c) => (c === ' ' ? '␣' : c)) }, { label: 'Code m', cells: blocks.map(String) }] } } });
  }
  const tooBig = blocks.find((m) => m >= k.n);
  if (tooBig !== undefined) {
    const rec = suggestPrimes(tooBig);
    if (rec) {
      const [sp, sq] = rec;
      throw new Error(`${tooBig} is not smaller than n = ${k.n}. Each block must be less than n, so choose primes whose product is larger than ${tooBig} (for example p = ${sp}, q = ${sq} gives n = ${sp * sq}).`);
    }
    throw new Error(`${tooBig} is not smaller than n = ${k.n}. Each block must be less than n. This number is too large for the primes this demo allows (p and q must be at most 10,000,000); use larger primes in a real system, or a smaller message here.`);
  }
  const exp = decrypting ? k.d : k.e;
  const results = blocks.map((x) => modPowFast(x, exp, k.n));
  blocks.slice(0, MAX_BLOCK_STEPS).forEach((x, i) => steps.push(powStep(x, exp, k, decrypting ? 'decrypt' : 'encrypt', i, blocks.length)));

  let output = results.join(' ');
  let outputLabel;
  if (decrypting && format !== 'numbers') {
    try { output = results.map((m) => String.fromCodePoint(Number(m))).join(''); outputLabel = `Plaintext (numbers: ${results.join(' ')})`; } catch { /* keep numbers */ }
  }
  steps.push({
    title: 'Result',
    explanation: (blocks.length > MAX_BLOCK_STEPS ? `The first ${MAX_BLOCK_STEPS} blocks were shown; the rest work the same way. ` : '')
      + (decrypting ? `Raising to the power d undoes raising to the power e, because e × d ≡ 1 (mod φ(n)).` : `Send the ciphertext numbers. Only the owner of d = ${k.d} can reverse them. Note: encrypting one character at a time is insecure (identical letters give identical numbers); it is used here only for teaching.`),
    visual: { type: 'textRows', data: { rows: [{ label: decrypting ? 'c' : 'm', cells: blocks.map(String) }, { label: decrypting ? 'm' : 'c', cells: results.map(String) }] } },
  });
  if (!decrypting) steps.push(unsafeStep(k), realWorldStep());
  return { output, outputLabel, steps };
}

/** Textbook RSA (this demo) vs RSA as it is really used. */
function realWorldStep() {
  return {
    title: 'Textbook RSA vs real-world RSA',
    explanation: 'What this page shows is "textbook" RSA with small numbers and no padding. Real RSA is never used like this: encryption uses OAEP padding (RSAES-OAEP, PKCS #1 v2.2), signatures use PSS (RSASSA-PSS) on a hash of the message, keys are 2048 bits or more, and in practice RSA usually only encrypts or signs a short random key, while the data itself is encrypted with AES.',
    visual: { type: 'table', data: { headers: ['', 'Textbook RSA (this demo)', 'Real-world RSA'], rows: [
      ['Key size', 'n of a few digits', 'n of 2048, 3072 or 4096 bits'],
      ['Encryption', 'c = mᵉ mod n, one character at a time', 'RSAES-OAEP: random padding, then mᵉ mod n'],
      ['Signatures', 'not shown (s = mᵈ mod n would be insecure)', 'RSASSA-PSS over a SHA-256 hash'],
      ['Same message twice', 'same ciphertext', 'different ciphertext every time (random padding)'],
      ['What is encrypted', 'the message itself', 'usually a random AES key (hybrid encryption)'],
    ], highlightRows: [1, 2] } },
  };
}

/** Why "textbook" RSA (no padding) is unsafe, with numbers from the current key. */
function unsafeStep(k) {
  const enc = (m) => modPowFast(m, k.e, k.n);
  // Count of trial divisions from 2 up to the smaller prime (inclusive), without actually looping.
  const f = k.p < k.q ? k.p : k.q;
  const tries = f - 2n;
  const sample = k.n > 72n ? 72n : (k.n > 65n ? 65n : 2n);
  const sampleNote = sample === 72n ? "72 ('H')" : sample === 65n ? "65 ('A')" : '2';
  return {
    title: 'Why textbook RSA is unsafe',
    explanation: 'What you just saw is "textbook" RSA: no padding and tiny numbers. Real RSA uses 2048-bit or larger n and OAEP padding (signatures use PSS), which adds randomness so these attacks fail.',
    visual: { type: 'table', data: { headers: ['Problem', 'Demonstration', 'Fix'], rows: [
      ['Deterministic: same message → same ciphertext', `With your key, m = ${sampleNote} always gives c = ${enc(sample)}, so an attacker can build a dictionary`, 'Random padding (OAEP)'],
      ['Some messages do not change', `With your key, 0 → ${enc(0n)}, 1 → ${enc(1n)}, ${k.n - 1n} → ${enc(k.n - 1n)}`, 'Padding'],
      ['Small e and small m: no wrap-around', 'Fixed example (not your key): n = 55, e = 3, m = 2 → c = 8; the integer cube root of 8 gives m = 2 back', 'Padding makes m large'],
      ['Small n can be factored', `With your key, n = ${k.n} = ${f} × ${k.n / f}, found by trial division in ${tries + 1n} tries; then φ and d follow`, 'n of 2048+ bits'],
    ], highlightRows: [3] } },
  };
}

const intInput = (id, label, def, help) => ({ id, label, type: 'number', default: def, min: 2, help,
  validate: (v) => (Number.isInteger(v) && v >= 2 && v <= 1e7 ? null : `${label} must be a whole number between 2 and 10,000,000.`) });

export default {
  id: 'rsa',
  name: 'RSA',
  category: 'Asymmetric',
  description: 'Public-key encryption: key generation from two primes, then c = mᵉ mod n and m = cᵈ mod n. This is textbook RSA: small numbers and no OAEP/PSS padding.',
  ioField: 'message',
  inputs: [
    intInput('p', 'Prime p', 61),
    intInput('q', 'Prime q', 53),
    intInput('e', 'Public exponent e', 17),
    { id: 'format', label: 'Message format', type: 'select', default: 'text', options: [{ value: 'text', label: 'Text (each character → its code)' }, { value: 'numbers', label: 'Numbers (space-separated)' }] },
    { id: 'message', label: 'Message', type: 'textarea', default: 'HI', help: 'When decrypting, paste the ciphertext numbers' },
  ],
  validate: ({ p, q, message }) => {
    if (!isPrime(p)) return `p = ${p} is not prime. Try 61.`;
    if (!isPrime(q)) return `q = ${q} is not prime. Try 53.`;
    if (p === q) return 'p and q must be different.';
    if (!String(message ?? '').length) return 'Enter a message';
    return null;
  },
  encrypt: (v) => run(v, false),
  decrypt: (v) => run(v, true),
};

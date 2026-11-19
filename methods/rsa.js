import { isPrime, bgcd, modInverse, modPowTrace } from '../lib/math.js';

/** Small public exponents that work for this φ(n), used in error messages. */
export function suggestE(phi) {
  return [3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 65537n].filter((x) => x < phi && bgcd(x, phi) === 1n).slice(0, 4);
}

/** Two primes whose product is larger than `x`, used to suggest bigger keys. */
export function suggestPrimes(x) {
  let p = 2n;
  while (p * p <= x) p++;
  while (!isPrime(p)) p++;
  let q = p + 1n;
  while (!isPrime(q)) q++;
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

export function rsaEncryptBlocks(ms, k) { return ms.map((m) => modPowTrace(m, k.e, k.n).result); }
export function rsaDecryptBlocks(cs, k) { return cs.map((c) => modPowTrace(c, k.d, k.n).result); }

const paren = (x) => (x < 0n ? `(${x})` : `${x}`);

function keySteps(k) {
  const it = inverseTable(k.e, k.phi);
  return [{
    title: 'Pick two primes p and q',
    explanation: `RSA starts with two secret prime numbers. Real RSA uses primes with hundreds of digits; here we use p = ${k.p} and q = ${k.q} so every step can be followed by hand.`,
    visual: { type: 'math', data: { lines: [{ expr: `p = ${k.p}`, note: 'prime ✓' }, { expr: `q = ${k.q}`, note: 'prime ✓' }] } },
  }, {
    title: 'Compute n = p × q',
    explanation: `n is the modulus and is made public. Security relies on the fact that recovering p and q from a large n (factoring) is extremely hard.`,
    visual: { type: 'math', data: { lines: [{ expr: `n = ${k.p} × ${k.q} = ${k.n}`, note: 'public', highlight: true }] } },
  }, {
    title: 'Compute φ(n) = (p − 1)(q − 1)',
    explanation: "Euler's totient φ(n) counts the numbers below n that share no factor with n. It stays secret because computing it needs p and q.",
    visual: { type: 'math', data: { lines: [{ expr: `φ(n) = (${k.p} − 1) × (${k.q} − 1) = ${k.p - 1n} × ${k.q - 1n} = ${k.phi}`, note: 'secret', highlight: true }] } },
  }, {
    title: 'Choose the public exponent e',
    explanation: `e must be between 1 and φ(n) and share no common factor with φ(n), otherwise there is no matching private key.`,
    visual: { type: 'math', data: { lines: [{ expr: `e = ${k.e}`, note: 'public' }, { expr: `gcd(${k.e}, ${k.phi}) = 1`, note: 'coprime ✓', highlight: true }] } },
  }, {
    title: 'Find d with the extended Euclidean algorithm',
    explanation: `We need d with e × d ≡ 1 (mod ${k.phi}). Start with the rows (r = φ, t = 0) and (r = e, t = 1). Each new row takes q = previous r ÷ current r (whole number), then r_new = r_prev − q × r and t_new = t_prev − q × t. Every row keeps r ≡ t × e (mod φ), so when r reaches 1, t is the inverse.${it.lastT < 0n ? ` The last t is ${it.lastT} (negative), so add φ: ${it.lastT} + ${k.phi} = ${it.d}.` : ''}`,
    visual: [
      { type: 'table', data: { headers: ['Row', 'q', 'r = r₋₂ − q·r₋₁', 't = t₋₂ − q·t₋₁', 'check: t·e mod φ'], highlightRows: [it.rows.length - 1], rows: it.rows.map((row, i) => [
        i, row.q === null ? '—' : `${row.q}`,
        row.from ? `${row.from[0].r} − ${row.q}·${row.from[1].r} = ${row.r}` : `${row.r}`,
        row.from ? `${row.from[0].t} − ${row.q}·${paren(row.from[1].t)} = ${row.t}` : `${row.t}`,
        `${(((row.t * k.e) % k.phi) + k.phi) % k.phi}`,
      ]) } },
      { type: 'math', data: { lines: [{ expr: `d = ${it.lastT} mod ${k.phi} = ${k.d}`, note: 'secret', highlight: true }, { expr: `${k.e} × ${k.d} mod ${k.phi} = ${(k.e * k.d) % k.phi}`, note: 'check ✓' }] } },
    ],
  }, {
    title: 'The key pair',
    explanation: 'Anyone may use the public key to encrypt. Only the holder of the private key can decrypt.',
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
  };
}

function run({ p, q, e, message, format }, decrypting) {
  const k = rsaKeys(p, q, e);
  const steps = keySteps(k);
  let blocks;
  if (decrypting) blocks = parseNumbers(message);
  else if (format === 'numbers') blocks = parseNumbers(message);
  else {
    if (!message.length) throw new Error('Enter a message.');
    blocks = [...message].map((ch) => BigInt(ch.codePointAt(0)));
    steps.push({ title: 'Turn the text into numbers', explanation: 'RSA works on numbers, so each character becomes its Unicode code (e.g. A = 65). Real systems encrypt a padded block of bytes instead (OAEP padding).', visual: { type: 'textRows', data: { rows: [{ label: 'Char', cells: [...message].map((c) => (c === ' ' ? '␣' : c)) }, { label: 'Code m', cells: blocks.map(String) }] } } });
  }
  const tooBig = blocks.find((m) => m >= k.n);
  if (tooBig !== undefined) {
    const [sp, sq] = suggestPrimes(tooBig);
    throw new Error(`${tooBig} is not smaller than n = ${k.n}. Each block must be less than n, so choose primes whose product is larger than ${tooBig} (for example p = ${sp}, q = ${sq} gives n = ${sp * sq}).`);
  }
  const exp = decrypting ? k.d : k.e;
  const results = blocks.map((x) => modPowTrace(x, exp, k.n).result);
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
  if (!decrypting) steps.push(unsafeStep(k));
  return { output, outputLabel, steps };
}

/** Why "textbook" RSA (no padding) is unsafe, with numbers from the current key. */
function unsafeStep(k) {
  const enc = (m) => modPowTrace(m, k.e, k.n).result;
  let f = 2n, tries = 0;
  while (k.n % f !== 0n) { f++; tries++; }
  return {
    title: 'Why textbook RSA is unsafe',
    explanation: 'What you just saw is "textbook" RSA: no padding and tiny numbers. Real RSA uses 2048-bit or larger n and OAEP padding (signatures use PSS), which adds randomness so these attacks fail. Never implement RSA this way for real data.',
    visual: { type: 'table', data: { headers: ['Problem', 'Demonstrated with your key', 'Fix'], rows: [
      ['Deterministic: same message → same ciphertext', `m = 72 ('H') always gives c = ${enc(72n % k.n)}, so an attacker can build a dictionary`, 'Random padding (OAEP)'],
      ['Some messages do not change', `0 → ${enc(0n)}, 1 → ${enc(1n)}, ${k.n - 1n} → ${enc(k.n - 1n)}`, 'Padding'],
      ['Small e and small m: no wrap-around', 'n = 55, e = 3, m = 2 → c = 8; the integer cube root of 8 gives m = 2 back', 'Padding makes m large'],
      ['Small n can be factored', `n = ${k.n} = ${f} × ${k.n / f}, found by trial division in ${tries + 1} tries; then φ and d follow`, 'n of 2048+ bits'],
    ], highlightRows: [3] } },
  };
}

const intInput = (id, label, def, help) => ({ id, label, type: 'number', default: def, min: 2, help,
  validate: (v) => (Number.isInteger(v) && v >= 2 && v <= 1e7 ? null : `${label} must be a whole number between 2 and 10,000,000.`) });

export default {
  id: 'rsa',
  name: 'RSA',
  category: 'Asymmetric',
  description: 'Public-key encryption: key generation from two primes, then c = mᵉ mod n and m = cᵈ mod n.',
  ioField: 'message',
  inputs: [
    intInput('p', 'Prime p', 61),
    intInput('q', 'Prime q', 53),
    intInput('e', 'Public exponent e', 17),
    { id: 'format', label: 'Message format', type: 'select', default: 'text', options: [{ value: 'text', label: 'Text (each character → its code)' }, { value: 'numbers', label: 'Numbers (space-separated)' }] },
    { id: 'message', label: 'Message', type: 'textarea', default: 'HI', help: 'When decrypting, paste the ciphertext numbers' },
  ],
  validate: ({ p, q }) => {
    if (!isPrime(p)) return `p = ${p} is not prime. Try 61.`;
    if (!isPrime(q)) return `q = ${q} is not prime. Try 53.`;
    if (p === q) return 'p and q must be different.';
    return null;
  },
  encrypt: (v) => run(v, false),
  decrypt: (v) => run(v, true),
};

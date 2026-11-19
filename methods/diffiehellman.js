import { isPrime, modPowTrace } from '../lib/math.js';

/** Returns the public values and the shared secret (BigInt). */
export function dh(p, g, a, b) {
  p = BigInt(p); g = BigInt(g); a = BigInt(a); b = BigInt(b);
  const A = modPowTrace(g, a, p).result, B = modPowTrace(g, b, p).result;
  const sA = modPowTrace(B, a, p).result, sB = modPowTrace(A, b, p).result;
  return { A, B, sA, sB };
}

/** Prime factors of n (trial division; fine for n ≤ 1e9). */
export function primeFactors(n) {
  n = BigInt(n);
  const out = [];
  for (let f = 2n; f * f <= n; f += f === 2n ? 1n : 2n) {
    if (n % f === 0n) { out.push(f); while (n % f === 0n) n /= f; }
  }
  if (n > 1n) out.push(n);
  return out;
}

/** Multiplicative order of g modulo prime p: the number of distinct values g^k mod p can take. */
export function orderOf(g, p) {
  g = BigInt(g); p = BigInt(p);
  let order = p - 1n;
  for (const q of primeFactors(p - 1n)) {
    while (order % q === 0n && modPowTrace(g, order / q, p).result === 1n) order /= q;
  }
  return order;
}

const col = (title, items) => ({ title, items });

export default {
  id: 'diffiehellman',
  name: 'Diffie–Hellman',
  category: 'Key Exchange',
  description: 'Two people agree on a shared secret over a public channel without ever sending the secret.',
  inputs: [
    { id: 'p', label: 'Prime modulus p', type: 'number', default: 23, min: 3 },
    { id: 'g', label: 'Generator g', type: 'number', default: 5, min: 2 },
    { id: 'a', label: "Alice's secret a", type: 'number', default: 4, min: 1 },
    { id: 'b', label: "Bob's secret b", type: 'number', default: 3, min: 1 },
  ],
  actions: [{ id: 'exchange', label: 'Run key exchange' }],
  validate: ({ p, g, a, b }) => {
    for (const [k, v] of Object.entries({ p, g, a, b })) if (!Number.isInteger(v) || v < 1 || v > 1e9) return `${k} must be a whole number between 1 and 1,000,000,000.`;
    if (!isPrime(p)) return `p = ${p} is not prime. Try 23.`;
    if (g < 2 || g >= p) return 'g must be between 2 and p − 1.';
    if (orderOf(g, p) <= 2n) return `g = ${g} is a trivial generator: its powers mod ${p} only take ${orderOf(g, p)} value(s), so the shared secret would be easy to guess. Choose another g (for p = 23, try g = 5).`;
    if (a >= p - 1 || b >= p - 1) return 'Secrets a and b should be between 1 and p − 2.';
    return null;
  },

  exchange({ p, g, a, b }) {
    const { A, B, sA, sB } = dh(p, g, a, b);
    const ord = orderOf(g, p);
    const full = ord === BigInt(p - 1);
    const flow = (alice, pub, bob) => ({ type: 'flow', data: { columns: [col('👩 Alice', alice), col('🌐 Public channel (Eve can see)', pub), col('👨 Bob', bob)] } });
    const hi = (text) => ({ text, highlight: true });
    const t = (text) => ({ text });
    const steps = [
      { title: 'Agree on public numbers', explanation: `Alice and Bob openly agree on a prime p = ${p} and a generator g = ${g}. Anyone, including an eavesdropper Eve, can see these.`,
        visual: flow([], [hi(`p = ${p}`), hi(`g = ${g}`)], []) },
      { title: 'Check the generator g',
        explanation: full
          ? `The powers of g = ${g} produce all ${p - 1} possible values mod ${p} (g is a primitive root). That is good: the secret can be any of them.`
          : `⚠ Warning: the powers of g = ${g} only produce ${ord} of the ${p - 1} possible values (order ${ord}). The shared secret can only be one of those ${ord} values, which makes guessing easier (a "small subgroup"). Real systems use standard safe groups such as RFC 3526 / RFC 7919 or elliptic curves.`,
        visual: { type: 'math', data: { lines: [
          { expr: `order of g = ${ord}`, note: full ? 'primitive root ✓' : `only ${ord} possible secrets ⚠`, highlight: true },
          { expr: `p − 1 = ${p - 1}`, note: 'maximum possible order' },
        ] } } },
      { title: 'Each picks a private secret', explanation: `Alice secretly picks a = ${a} and Bob secretly picks b = ${b}. These never leave their computers.`,
        visual: flow([hi(`a = ${a} 🔒`)], [t(`p = ${p}`), t(`g = ${g}`)], [hi(`b = ${b} 🔒`)]) },
      { title: 'Compute public keys', explanation: `Alice computes A = gᵃ mod p and Bob computes B = gᵇ mod p.`,
        visual: [flow([t(`a = ${a} 🔒`), hi(`A = ${g}^${a} mod ${p} = ${A}`)], [t(`p = ${p}`), t(`g = ${g}`)], [t(`b = ${b} 🔒`), hi(`B = ${g}^${b} mod ${p} = ${B}`)]),
          { type: 'math', data: { lines: [{ expr: `A = ${g}^${a} mod ${p} = ${A}`, note: 'Alice', highlight: true }, { expr: `B = ${g}^${b} mod ${p} = ${B}`, note: 'Bob', highlight: true }] } }] },
      { title: 'Swap public keys', explanation: `They send A = ${A} and B = ${B} over the public channel. Eve now knows p, g, A and B, but not a or b.`,
        visual: flow([t(`a = ${a} 🔒`), t(`A = ${A}`), hi(`received B = ${B}`)], [t(`p = ${p}`), t(`g = ${g}`), hi(`A = ${A} →`), hi(`← B = ${B}`)], [t(`b = ${b} 🔒`), t(`B = ${B}`), hi(`received A = ${A}`)]) },
      { title: 'Both compute the same secret', explanation: `Alice computes Bᵃ mod p and Bob computes Aᵇ mod p. Both equal g^(ab) mod p, so they get the same number: ${sA}.`,
        visual: [flow([t(`a = ${a} 🔒`), hi(`s = ${B}^${a} mod ${p} = ${sA}`)], [t(`p = ${p}`), t(`g = ${g}`), t(`A = ${A}`), t(`B = ${B}`)], [t(`b = ${b} 🔒`), hi(`s = ${A}^${b} mod ${p} = ${sB}`)]),
          { type: 'math', data: { lines: [{ expr: `Bᵃ = (gᵇ)ᵃ = g^(ab) = (gᵃ)ᵇ = Aᵇ  (mod p)`, note: 'why it works' }, { expr: `shared secret = ${sA}`, note: sA === sB ? 'match ✓' : 'mismatch', highlight: true }] } }] },
      { title: 'Why Eve is stuck', explanation: `To get the secret Eve would need a or b, i.e. solve ${g}^x ≡ ${A} (mod ${p}) — the discrete logarithm problem. With tiny numbers she can guess, but with 2048-bit primes it is infeasible. In practice the shared secret is not used as a key directly: it is passed through a key-derivation function (for example HKDF) to produce keys for a fast cipher such as AES.`,
        visual: flow([t(`secret s = ${sA}`)], [t(`Eve sees: p, g, A = ${A}, B = ${B}`), hi('needs a or b → discrete log ✗')], [t(`secret s = ${sB}`)]) },
    ];
    // Man-in-the-middle: Mallory replaces A and B with her own public value.
    const m = BigInt(p) > 5n ? 2n : 1n;
    const M = (BigInt(g) ** m) % BigInt(p);
    const sAM = dh(p, g, a, m).sA; // Alice computes M^a
    const sBM = dh(p, g, m, b).sB; // Bob computes M^b
    steps.push({
      title: '⚠ But an active attacker can sit in the middle',
      explanation: `Plain Diffie–Hellman does not prove WHO you are talking to. Mallory intercepts the traffic, picks her own secret m = ${m}, and sends M = g^m mod p = ${M} to both sides. Alice ends up sharing ${sAM} with Mallory and Bob shares ${sBM} with Mallory; Mallory decrypts and re-encrypts everything. Real protocols use authenticated Diffie–Hellman: TLS signs the exchange with the server's certificate, and Signal checks safety numbers.`,
      visual: [
        flow([t(`a = ${a} 🔒`), t(`sent A = ${A}`), hi(`received M = ${M} (thinks it is Bob's)`), hi(`key with Mallory = ${sAM}`)],
          [hi(`😈 Mallory: m = ${m}`), t(`intercepts A = ${A}, B = ${B}`), hi(`sends M = ${M} both ways`), hi(`knows both keys: ${sAM} and ${sBM}`)],
          [t(`b = ${b} 🔒`), t(`sent B = ${B}`), hi(`received M = ${M} (thinks it is Alice's)`), hi(`key with Mallory = ${sBM}`)]),
        { type: 'math', data: { lines: [
          { expr: 'Fix: authenticate the public values', note: 'signatures / certificates', highlight: true },
          { expr: 'TLS 1.3, SSH, Signal all use authenticated (EC)DH', note: '' },
        ] } },
      ],
    });
    return { output: `${sA}`, outputLabel: 'Shared secret', steps };
  },
};

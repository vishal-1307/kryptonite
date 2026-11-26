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

/**
 * Degenerate / weak parameter checks. Returns a list of { code, severity: 'error' | 'warning', message }.
 * 'error' items make validate() refuse the inputs; exchange() still reports them as a warning step if called directly.
 */
export function dhIssues(p, g, a, b) {
  const P = BigInt(p), G = BigInt(g), A0 = BigInt(a), B0 = BigInt(b);
  const out = [];
  const err = (code, message) => out.push({ code, severity: 'error', message });
  if (G === 1n) err('g-one', 'g = 1: every power of 1 is 1, so A, B and the shared secret are all 1.');
  if (G === P - 1n) err('g-minus-one', `g = p − 1 = ${P - 1n}: its powers are only 1 and p − 1 (order 2), so the shared secret is 1 or p − 1 — trivial to guess.`);
  for (const [who, x] of [['a', A0], ['b', B0]]) {
    if (x === 0n) err(`${who}-zero`, `${who} = 0 gives a public value g⁰ = 1, which reveals the secret.`);
    else if (x === 1n) err(`${who}-one`, `${who} = 1 makes the public value equal to g itself, so Eve can see that the secret is 1.`);
    else if (x === P - 1n) err(`${who}-p-minus-one`, `${who} = p − 1 gives g^(p−1) ≡ 1 (mod p) (Fermat), so the public value is 1.`);
  }
  if (P > 2n && G > 1n && G < P) {
    const ord = orderOf(G, P);
    const { A, B, sA } = dh(P, G, A0 < 0n ? 0n : A0, B0 < 0n ? 0n : B0);
    if (!out.some((i) => /^[ab]-/.test(i.code))) {
      if (A === 1n) err('A-one', `A = g^a mod p = 1 because the order of g (${ord}) divides a = ${a}. A public value of 1 reveals information about a and forces the shared secret to 1.`);
      if (B === 1n) err('B-one', `B = g^b mod p = 1 because the order of g (${ord}) divides b = ${b}. A public value of 1 forces the shared secret to 1.`);
      if (A === P - 1n) err('A-p-minus-one', `A = g^a mod p = ${P - 1n} (p − 1). When a public value is p − 1 the shared secret can only be 1 or p − 1, so Eve can guess it from A alone. Received public values must satisfy 1 < y < p − 1 (RFC 7919).`);
      if (B === P - 1n) err('B-p-minus-one', `B = g^b mod p = ${P - 1n} (p − 1). When a public value is p − 1 the shared secret can only be 1 or p − 1, so Eve can guess it from B alone. Received public values must satisfy 1 < y < p − 1 (RFC 7919).`);
      if (A !== 1n && B !== 1n && sA === 1n) err('s-one', `The shared secret is 1 because the order of g (${ord}) divides a × b. Anyone can guess a secret of 1.`);
      if (A !== 1n && A !== P - 1n && B !== 1n && B !== P - 1n && sA === P - 1n) err('s-p-minus-one', `The shared secret is p − 1 because a × b is a multiple of half the order of g (${ord}). Anyone can guess a secret of 1 or p − 1. Implementations must reject values of 0, 1 and p − 1 (RFC 7919).`);
    }
    if (ord > 2n && ord * 4n < P - 1n) out.push({ code: 'small-subgroup', severity: 'warning', message: `g only generates a subgroup of ${ord} of the ${P - 1n} values; prefer a primitive root or, in a safe prime, the subgroup of order (p − 1)/2.` });
  }
  return out;
}

const GROUP_NOTE = 'The group here is the numbers 1 … p − 1 under multiplication mod p. The powers of g form a subgroup whose size is the order of g. For security that subgroup must be large and of (large) prime order: then every public value and secret is one of very many possibilities, and small-subgroup / Pohlig–Hellman attacks do not apply. The standard choice is a safe prime p = 2q + 1 (q prime) with g of order q, and implementations must reject received public values of 0, 1 and p − 1 (that is, require 1 < y < p − 1; RFC 7919), and likewise a shared secret of 1 or p − 1.';

export default {
  id: 'diffiehellman',
  name: 'Diffie–Hellman',
  category: 'Key Exchange',
  description: 'Two people agree on a shared secret over a public channel without ever sending the secret. This page uses small groups so each step is visible; deployed systems use much larger groups or elliptic curves (X25519) and authenticate the exchange.',
  inputs: [
    { id: 'p', label: 'Prime modulus p', type: 'number', default: 23, min: 3 },
    { id: 'g', label: 'Generator g', type: 'number', default: 5, min: 2 },
    { id: 'a', label: "Alice's secret a", type: 'number', default: 4, min: 2, help: '2 … p − 2' },
    { id: 'b', label: "Bob's secret b", type: 'number', default: 3, min: 2, help: '2 … p − 2' },
  ],
  actions: [{ id: 'exchange', label: 'Run key exchange' }],
  validate: ({ p, g, a, b }) => {
    for (const [k, v] of Object.entries({ p, g, a, b })) if (!Number.isInteger(v) || v < 1 || v > 1e9) return `${k} must be a whole number between 1 and 1,000,000,000.`;
    if (!isPrime(p)) return `p = ${p} is not prime. Try 23.`;
    if (g < 2 || g >= p) return 'g must be between 2 and p − 1.';
    if (orderOf(g, p) <= 2n) return `g = ${g} is a trivial generator: its powers mod ${p} only take ${orderOf(g, p)} value(s)${g === p - 1 ? ' (g = p − 1 always has order 2)' : ''}, so the shared secret would be easy to guess. Choose another g (for p = 23, try g = 5).`;
    if (a < 2 || b < 2 || a > p - 2 || b > p - 2) return `Secrets a and b must be between 2 and p − 2 (${p - 2}). a or b = 1 makes the public value equal to g (revealing the secret); p − 1 makes it 1.`;
    const errs = dhIssues(p, g, a, b).filter((i) => i.severity === 'error');
    if (errs.length) return `Degenerate parameters: ${errs[0].message} Choose different secrets.`;
    return null;
  },

  exchange({ p, g, a, b }) {
    const { A, B, sA, sB } = dh(p, g, a, b);
    const ord = orderOf(g, p);
    const full = ord === BigInt(p - 1);
    const safeSubgroup = !full && ord * 2n === BigInt(p - 1) && isPrime(ord);
    const smallSubgroup = !full && !safeSubgroup && ord * 4n < BigInt(p - 1);
    const flow = (alice, pub, bob) => ({ type: 'flow', data: { columns: [col('👩 Alice', alice), col('🌐 Public channel (Eve can see)', pub), col('👨 Bob', bob)] } });
    const hi = (text) => ({ text, highlight: true });
    const t = (text) => ({ text });
    const steps = [
      { title: 'Agree on public numbers', explanation: `Alice and Bob openly agree on a prime p = ${p} and a generator g = ${g}. Anyone, including an eavesdropper Eve, can see these. (These are small demonstration values.)`,
        meta: { exchange: { public: ['p', 'g'], secret: [], messages: [] } },
        visual: flow([], [hi(`p = ${p}`), hi(`g = ${g}`)], []) },
      { title: 'Check the generator g',
        explanation: (full
          ? `The powers of g = ${g} produce all ${p - 1} possible values mod ${p} (g is a primitive root). That is good: the secret can be any of them.`
          : safeSubgroup
            ? `p = ${p} is a safe prime ((p−1)/2 = ${ord} is also prime) and g = ${g} generates the prime-order subgroup of size ${ord}. That design is standard — RFC 3526 groups also use a generator of order (p−1)/2 (often g = 2). The weakness here is only that these numbers are tiny: real systems use 2048-bit or larger groups (RFC 3526 / RFC 7919) or elliptic curves.`
            : smallSubgroup
              ? `⚠ Warning: the powers of g = ${g} only produce ${ord} of the ${p - 1} possible values (order ${ord}). That is a small subgroup compared with p−1, so the shared secret is easier to guess. Choose a g whose order is p−1 (a primitive root) or (p−1)/2 in a safe prime. Real systems use 2048-bit or larger groups (RFC 3526).`
              : `The powers of g = ${g} produce ${ord} of the ${p - 1} possible values (order ${ord}). Prefer a primitive root (order p−1) or, in a safe prime, the subgroup of order (p−1)/2. Real systems use 2048-bit or larger groups (RFC 3526).`)
          + ` ${GROUP_NOTE}`,
        meta: { order: `${ord}`, pMinus1: `${BigInt(p) - 1n}`, primitiveRoot: full, safePrimeSubgroup: safeSubgroup, smallSubgroup },
        visual: { type: 'math', data: { lines: [
          { expr: `order of g = ${ord}`, note: full ? 'primitive root ✓' : safeSubgroup ? 'prime-order subgroup ✓ (p is tiny)' : `only ${ord} possible secrets ⚠`, highlight: true },
          { expr: `p − 1 = ${p - 1}`, note: 'maximum possible order' },
        ] } } },
      { title: 'Each picks a private secret', explanation: `Alice secretly picks a = ${a} and Bob secretly picks b = ${b} (each between 2 and p − 2). These never leave their computers.`,
        meta: { exchange: { public: ['p', 'g'], secret: [{ name: 'a', owner: 'Alice', value: `${a}` }, { name: 'b', owner: 'Bob', value: `${b}` }], messages: [] } },
        visual: flow([hi(`a = ${a} 🔒`)], [t(`p = ${p}`), t(`g = ${g}`)], [hi(`b = ${b} 🔒`)]) },
      { title: 'Compute public keys', explanation: `Alice computes A = gᵃ mod p and Bob computes B = gᵇ mod p.`,
        meta: { exchange: { public: ['p', 'g'], secret: ['a', 'b'], computed: [{ name: 'A', by: 'Alice', formula: 'g^a mod p', value: `${A}` }, { name: 'B', by: 'Bob', formula: 'g^b mod p', value: `${B}` }], messages: [] } },
        visual: [flow([t(`a = ${a} 🔒`), hi(`A = ${g}^${a} mod ${p} = ${A}`)], [t(`p = ${p}`), t(`g = ${g}`)], [t(`b = ${b} 🔒`), hi(`B = ${g}^${b} mod ${p} = ${B}`)]),
          { type: 'math', data: { lines: [{ expr: `A = ${g}^${a} mod ${p} = ${A}`, note: 'Alice', highlight: true }, { expr: `B = ${g}^${b} mod ${p} = ${B}`, note: 'Bob', highlight: true }] } }] },
      { title: 'Swap public keys', explanation: `They send A = ${A} and B = ${B} over the public channel. Eve now knows p, g, A and B, but not a or b.`,
        meta: { exchange: { public: ['p', 'g', 'A', 'B'], secret: ['a', 'b'], messages: [{ from: 'Alice', to: 'Bob', name: 'A', value: `${A}`, public: true }, { from: 'Bob', to: 'Alice', name: 'B', value: `${B}`, public: true }] } },
        visual: flow([t(`a = ${a} 🔒`), t(`A = ${A}`), hi(`received B = ${B}`)], [t(`p = ${p}`), t(`g = ${g}`), hi(`A = ${A} →`), hi(`← B = ${B}`)], [t(`b = ${b} 🔒`), t(`B = ${B}`), hi(`received A = ${A}`)]) },
      { title: 'Both compute the same secret',
        meta: { exchange: { public: ['p', 'g', 'A', 'B'], secret: ['a', 'b', 's'], computed: [{ name: 's', by: 'Alice', formula: 'B^a mod p', value: `${sA}` }, { name: 's', by: 'Bob', formula: 'A^b mod p', value: `${sB}` }], messages: [] } },
        explanation: `Alice computes Bᵃ mod p and Bob computes Aᵇ mod p. Both equal g^(ab) mod p, so they get the same number: ${sA}.`,
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
      explanation: `Plain Diffie–Hellman does not prove WHO you are talking to. Mallory intercepts the traffic, picks her own secret m = ${m}, and sends M = g^m mod p = ${M} to both sides. Alice ends up sharing ${sAM} with Mallory and Bob shares ${sBM} with Mallory; Mallory decrypts and re-encrypts everything. Real protocols use authenticated Diffie–Hellman: TLS signs the exchange with the private key that matches the server's certificate, and Signal checks safety numbers.`,
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
    const issues = dhIssues(p, g, a, b);
    const errors = issues.filter((i) => i.severity === 'error');
    if (errors.length) {
      // Only reachable when validate() is bypassed: never present a degenerate result as a good one.
      steps.unshift({
        title: '⚠ Degenerate parameters',
        explanation: `These values make the exchange useless: ${errors.map((i) => i.message).join(' ')} An attacker can guess the shared secret without solving any discrete logarithm.`,
        visual: { type: 'math', data: { lines: errors.map((i) => ({ expr: i.code, note: 'degenerate', highlight: true })) } },
        meta: { issues },
      });
    }
    return { output: `${sA}`, outputLabel: errors.length ? 'Shared secret (⚠ degenerate parameters: easy to guess)' : 'Shared secret', steps, issues };
  },
};

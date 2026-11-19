// Shared number-theory helpers (pure, no DOM). Used by methods and tests.

/** Always-positive modulo for Numbers. */
export const mod = (a, m) => ((a % m) + m) % m;

/** Always-positive modulo for BigInts. */
export const bmod = (a, m) => ((a % m) + m) % m;

export function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function bgcd(a, b) {
  a = a < 0n ? -a : a; b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Extended Euclid on BigInts. Returns {g, x, y, rows} with a*x + b*y = g.
 * `rows` records every iteration so the visualizer can show the table.
 */
export function egcd(a, b) {
  a = BigInt(a); b = BigInt(b);
  let [oldR, r] = [a, b];
  let [oldS, s] = [1n, 0n];
  let [oldT, t] = [0n, 1n];
  const rows = [];
  while (r !== 0n) {
    const q = oldR / r;
    rows.push({ q, r: oldR, nextR: r });
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
    [oldT, t] = [t, oldT - q * t];
  }
  return { g: oldR, x: oldS, y: oldT, rows };
}

/** Modular inverse (BigInt). Returns null when it does not exist. */
export function modInverse(a, m) {
  const { g, x } = egcd(bmod(BigInt(a), BigInt(m)), BigInt(m));
  if (g !== 1n) return null;
  return bmod(x, BigInt(m));
}

/** Number version of modInverse (small moduli like 26). */
export function modInverseNum(a, m) {
  const r = modInverse(BigInt(a), BigInt(m));
  return r === null ? null : Number(r);
}

/**
 * Square-and-multiply modular exponentiation with a trace of every bit.
 * Returns {result, trace:[{bit, square, multiply, acc}]}.
 */
export function modPowTrace(base, exp, m) {
  base = bmod(BigInt(base), BigInt(m)); exp = BigInt(exp); m = BigInt(m);
  const bits = exp.toString(2);
  let acc = 1n;
  const trace = [];
  for (const bit of bits) {
    const squared = (acc * acc) % m;
    acc = squared;
    let multiplied = null;
    if (bit === '1') { acc = (acc * base) % m; multiplied = acc; }
    trace.push({ bit, squared, multiplied, acc });
  }
  return { result: acc, bits, trace };
}

export function modPow(base, exp, m) {
  return modPowTrace(base, exp, m).result;
}

export function isPrime(n) {
  n = BigInt(n);
  if (n < 2n) return false;
  if (n % 2n === 0n) return n === 2n;
  for (let i = 3n; i * i <= n; i += 2n) if (n % i === 0n) return false;
  return true;
}

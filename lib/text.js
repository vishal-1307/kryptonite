// Shared text / byte helpers (pure, no DOM).

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const isLetter = (ch) => /^[A-Za-z]$/.test(ch);
export const letterIndex = (ch) => ch.toUpperCase().charCodeAt(0) - 65;
export const indexLetter = (i, lower = false) => {
  const c = String.fromCharCode(65 + (((i % 26) + 26) % 26));
  return lower ? c.toLowerCase() : c;
};
/** Keep only A-Z (uppercased). */
export const onlyLetters = (s) => s.toUpperCase().replace(/[^A-Z]/g, '');

export const utf8Encode = (s) => Array.from(new TextEncoder().encode(s));
export const utf8Decode = (bytes) => new TextDecoder().decode(new Uint8Array(bytes));

export const toHex = (b) => b.toString(16).padStart(2, '0');
export const bytesToHex = (bytes) => bytes.map(toHex).join('');
export function hexToBytes(hex) {
  const clean = hex.replace(/\s+/g, '').toLowerCase();
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2) throw new Error('Hex must contain an even number of 0-9 / a-f characters.');
  const out = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return out;
}
export const toBin = (n, width = 8) => n.toString(2).padStart(width, '0');

/** Truncate long strings for display. */
export const clip = (s, n = 64) => (s.length > n ? s.slice(0, n) + '…' : s);

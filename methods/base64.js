import { utf8Encode, toBin } from '../lib/text.js';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const MAX_GROUP_STEPS = 12;

export function b64encode(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = bytes.slice(i, i + 3);
    const n = (a << 16) | (b << 8) | c;
    const take = bytes.length - i;
    out += CHARS[(n >> 18) & 63] + CHARS[(n >> 12) & 63] + (take > 1 ? CHARS[(n >> 6) & 63] : '=') + (take > 2 ? CHARS[n & 63] : '=');
  }
  return out;
}

/**
 * Normalise input to standard, padded Base64. Accepts the URL-safe alphabet (- and _) and missing padding.
 * Returns { std, urlSafe, addedPadding }.
 */
export function normalizeB64(str) {
  let s = str.replace(/\s+/g, '');
  const urlSafe = /[-_]/.test(s);
  if (urlSafe && /[+/]/.test(s)) throw new Error('Mixes standard (+ /) and URL-safe (- _) Base64 characters.');
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('Not valid Base64: use A–Z, a–z, 0–9, + and / (or - and _ for base64url), with "=" only at the end.');
  let addedPadding = 0;
  if (!s.includes('=') && s.length % 4) {
    if (s.length % 4 === 1) throw new Error('Not valid Base64: the length cannot be one more than a multiple of 4.');
    addedPadding = 4 - (s.length % 4);
    s += '='.repeat(addedPadding);
  }
  if (s.length % 4) throw new Error('Not valid Base64: the length (with "=" padding) must be a multiple of 4.');
  return { std: s, urlSafe, addedPadding };
}

export function b64decode(str) {
  const s = normalizeB64(str).std;
  const bytes = [];
  for (let i = 0; i < s.length; i += 4) {
    const q = s.slice(i, i + 4);
    const n = [...q].reduce((acc, ch) => (acc << 6) | (ch === '=' ? 0 : CHARS.indexOf(ch)), 0);
    // Canonical check (RFC 4648 §3.5): unused bits before "=" padding must be zero.
    if ((q[2] === '=' && (n & 0xffff)) || (q[3] === '=' && (n & 0xff))) {
      throw new Error(`"${q}" is non-canonical Base64: the unused bits before "=" must be zero (did you mean "${b64encode([(n >> 16) & 255].concat(q[2] === '=' ? [] : [(n >> 8) & 255]))}"?).`);
    }
    bytes.push((n >> 16) & 255);
    if (q[2] !== '=') bytes.push((n >> 8) & 255);
    if (q[3] !== '=') bytes.push(n & 255);
  }
  return bytes;
}

function groupVisual(bytes, i, encoded) {
  const chunk = bytes.slice(i, i + 3);
  const bits = chunk.map((b) => toBin(b)).join('').padEnd(Math.ceil((chunk.length * 8) / 6) * 6, '0');
  const sextets = bits.match(/.{6}/g);
  const outChars = encoded.slice((i / 3) * 4, (i / 3) * 4 + 4);
  return [
    { type: 'bits', data: { groups: [
      { label: 'Bytes (8 bits)', items: chunk.map((b) => ({ top: toBin(b), bottom: `${b} ${b >= 32 && b < 127 ? `'${String.fromCharCode(b)}'` : ''}` })) },
      { label: 'Groups of 6 bits', items: sextets.map((s) => ({ top: s, bottom: `${parseInt(s, 2)}` })) },
      { label: 'Base64 characters', items: [...outChars].map((c, k) => ({ top: c, bottom: c === '=' ? 'padding' : `index ${parseInt(sextets[k], 2)}` , accent: true })) },
    ] } },
  ];
}

/**
 * Decoding visual, in the correct direction: Base64 characters → 6-bit sextets → 8-bit bytes.
 * `quad` is the 4-character group, `bytes` the bytes it decodes to (1–3).
 */
export function decodeGroup(quad, bytes) {
  const chars = [...quad];
  const sextets = chars.filter((c) => c !== '=').map((c) => toBin(CHARS.indexOf(c), 6));
  const bits = sextets.join('');
  const used = bytes.length * 8;
  return {
    chars,
    sextets: chars.map((c) => (c === '=' ? null : { char: c, index: CHARS.indexOf(c), bits: toBin(CHARS.indexOf(c), 6) })),
    bytes: bytes.map((b, k) => ({ value: b, hex: b.toString(16).padStart(2, '0'), bits: bits.slice(k * 8, k * 8 + 8) })),
    droppedBits: bits.slice(used),
    visual: { type: 'bits', data: { direction: 'decode', groups: [
      { label: 'Base64 characters', items: chars.map((c) => ({ top: c, bottom: c === '=' ? 'padding' : `index ${CHARS.indexOf(c)}`, accent: true })) },
      { label: 'Groups of 6 bits', items: sextets.map((x) => ({ top: x, bottom: `${parseInt(x, 2)}` })) },
      { label: 'Bytes (8 bits)', items: bytes.map((b) => ({ top: toBin(b), bottom: `${b} (0x${b.toString(16).padStart(2, '0')})${b >= 32 && b < 127 ? ` '${String.fromCharCode(b)}'` : ''}` })) },
    ] } },
  };
}

/** Strict, byte-exact UTF-8 decode (keeps a leading BOM as U+FEFF). Returns null when the bytes are not valid UTF-8. */
export function strictUtf8(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(new Uint8Array(bytes)); } catch { return null; }
}

/** Accurate size note: every 3 input bytes become 4 characters; the last group is padded to 4 with "=". */
export function expansionNote(nBytes, nChars) {
  if (!nBytes) return 'Zero bytes encode to zero characters.';
  const pct = Math.round(((nChars - nBytes) / nBytes) * 100);
  return `${nBytes} byte${nBytes === 1 ? '' : 's'} became ${nChars} characters (+${pct}%). Base64 always writes 4 characters for every 3 bytes (4/3 ≈ 1.33, i.e. about 33% larger), and the last group is rounded up to 4 characters with "=" padding, so short inputs grow by more than 33%: the output length is 4 × ⌈n / 3⌉.`;
}

const NOTE = 'Base64 is an ENCODING, not encryption: there is no key and anyone can decode it. It just makes binary data safe to send as text (e-mail attachments, data: URLs, JSON).';

export default {
  id: 'base64',
  name: 'Base64',
  category: 'Encoding',
  description: 'Turns bytes into 64 safe text characters. Encoding, not encryption — included to show the difference.',
  ioField: 'text',
  inputs: [{ id: 'text', label: 'Text', type: 'textarea', default: 'Man', help: 'Plain text to encode, or Base64 / base64url to decode' }],
  actions: [{ id: 'encode', label: 'Encode' }, { id: 'decode', label: 'Decode' }],

  encode({ text }) {
    const bytes = utf8Encode(text);
    if (!bytes.length) {
      return { output: '', outputLabel: 'Base64 (empty input → empty output)', steps: [
        { title: 'Not encryption!', explanation: NOTE, visual: { type: 'digest', data: { label: 'Input', hex: '(empty)' } } },
        { title: 'Empty in, empty out', explanation: 'By RFC 4648, encoding zero bytes gives an empty string.', visual: { type: 'digest', data: { label: 'Base64', hex: '(empty)' } } },
      ] };
    }
    const out = b64encode(bytes);
    const steps = [{
      title: 'Not encryption!',
      explanation: NOTE + ' The 64 characters are A–Z (0–25), a–z (26–51), 0–9 (52–61), + (62) and / (63).',
      visual: { type: 'letterStrip', data: { top: [...CHARS], bottom: [...CHARS].map((_, i) => String(i)), labelTop: 'Char', labelBottom: 'Index', small: true } },
    }];
    for (let i = 0, n = 0; i < bytes.length && n < MAX_GROUP_STEPS; i += 3, n++) {
      const chunk = bytes.slice(i, i + 3);
      steps.push({
        title: `Bytes ${i + 1}–${i + chunk.length} → ${out.slice((i / 3) * 4, (i / 3) * 4 + 4)}`,
        explanation: chunk.length === 3
          ? 'Take 3 bytes (24 bits), split them into four 6-bit groups, and look up each group (0–63) in the Base64 alphabet.'
          : `Only ${chunk.length} byte${chunk.length > 1 ? 's' : ''} left, so the bits are padded with zeros and "=" marks the missing ${3 - chunk.length} byte${3 - chunk.length > 1 ? 's' : ''}.`,
        visual: groupVisual(bytes, i, out),
      });
    }
    const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    steps.push({ title: 'Result', explanation: `${expansionNote(bytes.length, out.length)}${bom ? ' The text starts with a byte-order mark (U+FEFF, bytes EF BB BF); it is encoded like any other character.' : ''} ${NOTE}`, visual: { type: 'digest', data: { label: 'Base64', hex: out } }, meta: { inputBytes: bytes.length, outputChars: out.length, bom } });
    return { output: out, outputLabel: 'Base64', steps };
  },

  decode({ text }) {
    const { std: clean, urlSafe, addedPadding } = normalizeB64(text);
    const bytes = b64decode(text);
    // Byte-exact: fatal decoding (no silent U+FFFD) and ignoreBOM so a leading EF BB BF is kept, not swallowed.
    const decoded = strictUtf8(bytes);
    const badUtf8 = decoded === null;
    const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    const notes = [urlSafe ? 'This is base64url (the URL-safe variant): "-" and "_" were read as "+" and "/".' : '', addedPadding ? `${addedPadding} missing "=" padding character(s) were added.` : ''].filter(Boolean).join(' ');
    const steps = [{ title: 'Decoding needs no key', explanation: `${NOTE} Decoding runs the encoding backwards: characters → 6-bit groups (sextets) → 8-bit bytes.${notes ? ' ' + notes : ''}`, visual: { type: 'digest', data: { label: 'Input', hex: clean || '(empty)' } } }];
    for (let q = 0, n = 0; q < clean.length && n < MAX_GROUP_STEPS; q += 4, n++) {
      const quad = clean.slice(q, q + 4);
      const from = (q / 4) * 3;
      const groupBytes = bytes.slice(from, from + 3);
      const gp = decodeGroup(quad, groupBytes);
      const eq = quad.split('=').length - 1;
      steps.push({
        title: `${quad} → bytes ${from + 1}–${from + groupBytes.length}`,
        explanation: `1. Look up each character's index in the Base64 alphabet (0–63). 2. Write each index as 6 bits. 3. Join the ${gp.sextets.filter(Boolean).length * 6} bits and cut them into 8-bit bytes: ${gp.bytes.map((b) => b.hex).join(' ')}.`
          + (eq ? ` The ${eq} "=" character${eq > 1 ? 's carry' : ' carries'} no data, and the ${gp.droppedBits.length} leftover zero bit${gp.droppedBits.length === 1 ? '' : 's'} after the last full byte ${gp.droppedBits.length === 1 ? 'is' : 'are'} dropped.` : ''),
        visual: gp.visual,
        meta: { groupIndex: n, chars: gp.chars, sextets: gp.sextets, bytes: gp.bytes, droppedBits: gp.droppedBits, order: ['chars', 'sextets', 'bytes'] },
      });
    }
    if (bom && !badUtf8) {
      steps.push({
        title: 'Starts with a UTF-8 byte-order mark',
        explanation: 'The first three bytes are EF BB BF, the UTF-8 byte-order mark (BOM, U+FEFF). It is kept in the output so the decoded data is byte-for-byte identical; it is invisible when displayed.',
        visual: { type: 'digest', data: { label: 'Decoded bytes (hex)', hex } },
        meta: { bom: true },
      });
    }
    if (badUtf8) {
      steps.push({
        title: 'Decoded bytes are not valid UTF-8 text',
        explanation: `⚠ These ${bytes.length} bytes are not valid UTF-8 text (probably binary data such as an image or a key), so the output is the exact bytes written in hex instead of garbled characters.`,
        visual: { type: 'digest', data: { label: 'Decoded bytes (hex)', hex } },
      });
    }
    steps.push({ title: 'Result',
      explanation: `${clean.length} characters decoded to ${bytes.length} byte${bytes.length === 1 ? '' : 's'}. Anyone can do this — so never use Base64 to "hide" passwords or secrets.`,
      visual: badUtf8
        ? { type: 'digest', data: { label: 'Decoded bytes (hex)', hex } }
        : { type: 'digest', data: { label: 'Decoded text', hex: decoded || '(empty)' } },
      meta: { bytes: bytes.length, hex: hex.replace(/ /g, ''), utf8: !badUtf8, bom } });
    return { output: badUtf8 ? hex.replace(/ /g, '') : decoded, outputLabel: badUtf8 ? `Decoded bytes are not valid UTF-8 text (hex: ${hex})` : (bom ? 'Decoded text (starts with a UTF-8 BOM, kept)' : 'Decoded text'), steps };
  },
};

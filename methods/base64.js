import { utf8Encode, utf8Decode, toBin } from '../lib/text.js';

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

export function b64decode(str) {
  const s = str.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4) throw new Error('Not valid Base64: use A–Z, a–z, 0–9, + and /, with length a multiple of 4 (padded with =).');
  const bytes = [];
  for (let i = 0; i < s.length; i += 4) {
    const q = s.slice(i, i + 4);
    const n = [...q].reduce((acc, ch) => (acc << 6) | (ch === '=' ? 0 : CHARS.indexOf(ch)), 0);
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

const NOTE = 'Base64 is an ENCODING, not encryption: there is no key and anyone can decode it. It just makes binary data safe to send as text (e-mail attachments, data: URLs, JSON).';

export default {
  id: 'base64',
  name: 'Base64',
  category: 'Encoding',
  description: 'Turns bytes into 64 safe text characters. Encoding, not encryption — included to show the difference.',
  ioField: 'text',
  inputs: [{ id: 'text', label: 'Text', type: 'textarea', default: 'Man', help: 'Plain text to encode, or Base64 to decode' }],
  actions: [{ id: 'encode', label: 'Encode' }, { id: 'decode', label: 'Decode' }],

  encode({ text }) {
    const bytes = utf8Encode(text);
    if (!bytes.length) throw new Error('Enter some text to encode.');
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
    steps.push({ title: 'Result', explanation: `${bytes.length} bytes became ${out.length} characters (about 33% larger). ${NOTE}`, visual: { type: 'digest', data: { label: 'Base64', hex: out } } });
    return { output: out, outputLabel: 'Base64', steps };
  },

  decode({ text }) {
    const bytes = b64decode(text);
    const clean = text.replace(/\s+/g, '');
    let out;
    try { out = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); } catch { out = utf8Decode(bytes); }
    const steps = [{ title: 'Decoding needs no key', explanation: NOTE, visual: { type: 'digest', data: { label: 'Input', hex: clean } } }];
    for (let i = 0, n = 0; i < bytes.length && n < MAX_GROUP_STEPS; i += 3, n++) {
      steps.push({ title: `${clean.slice((i / 3) * 4, (i / 3) * 4 + 4)} → bytes ${i + 1}–${Math.min(bytes.length, i + 3)}`, explanation: 'Look up each character\'s 6-bit value, join the bits, and cut them back into 8-bit bytes. "=" padding is dropped.', visual: groupVisual(bytes, i, clean) });
    }
    steps.push({ title: 'Result', explanation: 'Anyone can do this — so never use Base64 to "hide" passwords or secrets.', visual: { type: 'digest', data: { label: 'Decoded text', hex: out } } });
    return { output: out, outputLabel: 'Decoded text', steps };
  },
};

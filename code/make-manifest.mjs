#!/usr/bin/env node
// Regenerates code/manifest.json (the Code tab reads it). expectedOutput comes from the JS method on the sample input,
// and code/verify.mjs checks that every program prints exactly that. Run: node code/make-manifest.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { methods } from '../registry.js';
import { runAction } from '../core/contract.js';

const here = dirname(fileURLToPath(import.meta.url));
const byId = Object.fromEntries(methods.map((m) => [m.id, m]));
const defaults = (m) => Object.fromEntries(m.inputs.map((i) => [i.id, i.default]));

const WARN = 'Educational code for learning how the algorithm works. Do not use it to protect real data; use a vetted library.';
const spec = {
  caesar: { jsId: 'caesar', action: 'encrypt', cli: 'encrypt|decrypt "text" shift',
    py: [['shift_char', 'Shifts one A–Z/a–z letter by k places with wrap-around; other characters unchanged'], ['shift_text', 'Applies shift_char to every character'], ['encrypt', 'E(x) = (x + k) mod 26'], ['decrypt', 'D(x) = (x − k) mod 26']],
    cpp: [['shiftChar', 'Shifts one ASCII letter by k places; other bytes unchanged'], ['shiftText', 'Applies shiftChar to every byte'], ['encrypt', 'E(x) = (x + k) mod 26'], ['decrypt', 'D(x) = (x − k) mod 26']] },
  vigenere: { jsId: 'vigenere', action: 'encrypt', cli: 'encrypt|decrypt "text" key',
    py: [['clean_key', 'Keeps only the letters of the keyword, uppercased'], ['vigenere', 'Shifts each letter by the next key letter; the key position only advances on letters']],
    cpp: [['cleanKey', 'Keeps only the letters of the keyword, uppercased'], ['vigenere', 'Shifts each letter by the next key letter; the key position only advances on letters']] },
  playfair: { jsId: 'playfair', action: 'encrypt', cli: 'encrypt|decrypt "text" "key"',
    py: [['key_square', 'Builds the 5×5 square (key letters first, J merged into I)'], ['prepare', 'Splits the text into pairs, inserting X/Q fillers for doubled letters and odd length'], ['transform_pair', 'Applies the same-row, same-column or rectangle rule'], ['encrypt', 'Prepare, then transform each pair to the right/down'], ['decrypt', 'Checks even length and no equal pair, then transforms to the left/up']],
    cpp: [['keySquare', 'Builds the 5×5 square (key letters first, J merged into I)'], ['prepare', 'Splits the text into pairs with X/Q fillers'], ['transformPair', 'Same-row, same-column or rectangle rule'], ['encrypt', 'Prepare and transform each pair'], ['decrypt', 'Validate and inverse-transform each pair']] },
  railfence: { jsId: 'railfence', action: 'encrypt', cli: 'encrypt|decrypt "text" rails',
    py: [['zigzag', 'Rail (row) number of every position in the zigzag'], ['encrypt', 'Writes the zigzag and reads rail by rail'], ['decrypt', 'Fills each rail with the next ciphertext characters, then reads the zigzag']],
    cpp: [['splitUtf8', 'Splits the text into Unicode characters so multi-byte characters move as one'], ['zigzag', 'Rail (row) number of every position'], ['encrypt', 'Write the zigzag, read rail by rail'], ['decrypt', 'Fill rails, read the zigzag']] },
  hill: { jsId: 'hill', action: 'encrypt', cli: 'encrypt|decrypt "text" "a b c d" | WORD',
    py: [['parse_key', 'Reads 4 numbers (exact for any size, reduced mod 26) or a 4-letter word'], ['inverse_key', 'Checks gcd(det, 26) = 1 and computes K⁻¹ = det⁻¹ · adj(K) mod 26'], ['mul', 'Matrix × column vector mod 26'], ['hill', 'Keeps A–Z, pads odd length with X, multiplies each pair']],
    cpp: [['decimalMod26', 'Reduces a decimal string mod 26 digit by digit (no overflow for huge keys)'], ['parseKey', 'Reads 4 numbers or a 4-letter word'], ['inverseKey', 'Checks invertibility and computes K⁻¹ mod 26'], ['mul', 'Matrix × vector mod 26'], ['hill', 'Prepares the text and multiplies each pair']] },
  aes: { dir: 'aes128', jsId: 'aes', action: 'encrypt', cli: 'encrypt|decrypt block key [--format hex|text] [--key-format hex|text] [--padding zero|pkcs7]',
    py: [['key_expansion', 'Expands the 16-byte key into 11 round keys (RotWord, SubWord, Rcon)'], ['sub_bytes', 'SubBytes: replaces every byte with its S-box value'], ['shift_rows', 'ShiftRows: rotates row r left by r'], ['mix_columns', 'MixColumns: multiplies each column by the fixed matrix in GF(2⁸)'], ['add_round_key', 'AddRoundKey: XORs the state with the round key'], ['encrypt_block', 'Initial AddRoundKey + 10 rounds (no MixColumns in round 10)'], ['decrypt_block', 'Inverse cipher with InvShiftRows, InvSubBytes, InvMixColumns'], ['build_sbox', 'Builds the S-box from GF(2⁸) inverses and the affine transform']],
    cpp: [['KeyExpansion', 'Expands the key into 11 round keys'], ['SubBytes', 'S-box substitution of every byte'], ['ShiftRows', 'Rotates row r left by r'], ['MixColumns', 'Column mixing in GF(2⁸)'], ['AddRoundKey', 'XOR with the round key'], ['encryptBlock', 'Initial AddRoundKey + 10 rounds'], ['decryptBlock', 'Inverse cipher'], ['buildSbox', 'Builds the S-box from its definition']],
    lib: { file: 'aes128/aes128_lib.py', deps: ['cryptography'], install: 'python3 -m pip install cryptography', run: 'python3 aes128_lib.py', notes: [['run', 'Library route: AES from the cryptography package; hex block and hex key only (no text input, no padding), one raw block in ECB']], sampleInput: { action: 'encrypt', format: 'hex', block: '3243f6a8885a308d313198a2e0370734', key: '2b7e151628aed2a6abf7158809cf4f3c' } } },
  rsa: { jsId: 'rsa', action: 'encrypt', cli: 'encrypt|decrypt p q e text|numbers "message"',
    py: [['is_prime', 'Trial-division primality test'], ['rsa_keys', 'n = p·q, φ(n) = (p−1)(q−1), checks e, finds d'], ['inverse_table', 'Extended Euclid (r, t rows) to find d = e⁻¹ mod φ(n)'], ['mod_pow', 'Left-to-right square-and-multiply'], ['run', 'Text → code points (or numbers), checks m < n, raises to e or d']],
    cpp: [['mulmod', '(a·b) mod n without 64-bit overflow'], ['modPow', 'Left-to-right square-and-multiply'], ['inverseOf', 'Extended Euclid for d'], ['codePoints', 'UTF-8 text → Unicode code points'], ['main', 'Key checks, blocks, encryption/decryption']] },
  diffiehellman: { jsId: 'diffiehellman', action: 'exchange', cli: 'p g a b',
    py: [['order_of', 'Size of the subgroup generated by g'], ['check', 'Rejects degenerate parameters exactly like the web page'], ['exchange', 'A = gᵃ, B = gᵇ, s = Bᵃ = Aᵇ mod p']],
    cpp: [['modPow', 'Modular exponentiation'], ['orderOf', 'Size of the subgroup generated by g'], ['check', 'Rejects degenerate parameters'], ['main', 'Computes A, B and the shared secret']] },
  sha256: { jsId: 'sha256', action: 'hash', cli: '"text"',
    py: [['pad', 'Appends 0x80, zeros and the 64-bit length'], ['message_schedule', 'Expands 16 words into W₀…W₆₃'], ['compress', '64 rounds on registers a…h, then the feed-forward'], ['sha256', 'Processes every 64-byte block and outputs the hex digest']],
    cpp: [['pad', 'Appends 0x80, zeros and the 64-bit length'], ['messageSchedule', 'W₀…W₆₃'], ['compress', '64 rounds on a…h plus feed-forward'], ['sha256', 'Hex digest']],
    lib: { file: 'sha256/sha256_lib.py', deps: [], install: 'none (hashlib is in the standard library)', run: 'python3 sha256_lib.py', notes: [['hashlib.sha256', 'Library route: the standard library implementation']] } },
  base64: { jsId: 'base64', pyFile: 'base64/base64_demo.py', pyRun: 'python3 base64_demo.py', action: 'encode', cli: 'encode|decode "text"',
    py: [['encode', '3 bytes → four 6-bit groups → four characters, = for missing bytes'], ['normalize', 'Accepts base64url and missing padding, validates the input'], ['decode', 'Characters → sextets → bytes, rejects non-canonical padding bits'], ['decode_to_display', 'Strict UTF-8 text (BOM kept) or hex for binary data']],
    cpp: [['encode', '3 bytes → 4 characters'], ['normalize', 'base64url / padding handling and validation'], ['decode', 'Characters → sextets → bytes'], ['validUtf8', 'Strict UTF-8 check; otherwise the bytes are printed in hex']] },
};

// Keyed by the Kryptonite method id (registry.js), so the Code tab can look up the current page directly.
const manifest = {};
for (const [key, s] of Object.entries(spec)) {
  const dir = s.dir || key;
  const m = byId[s.jsId];
  const sampleInput = { action: s.action, ...defaults(m) };
  const expectedOutput = runAction(m, s.action, defaults(m)).output;
  const notes = (list) => list.map(([fn, what]) => ({ fn, what }));
  manifest[s.jsId] = {
    folder: dir,
    warning: WARN,
    python: { file: s.pyFile || `${dir}/${dir}.py`, deps: [], install: 'none (Python 3 standard library only)', run: s.pyRun || `python3 ${dir}.py`, usage: `${s.pyRun || `python3 ${dir}.py`} ${s.cli}`, sampleInput, expectedOutput, notes: notes(s.py) },
    cpp: { file: `${dir}/${dir}.cpp`, deps: [], install: 'g++ with C++17 (standard library only)', run: `g++ -std=c++17 -O2 ${dir}.cpp -o ${dir} && ./${dir}`, usage: `./${dir} ${s.cli}`, sampleInput, expectedOutput, notes: notes(s.cpp) },
  };
  if (s.lib) manifest[s.jsId].pythonLibrary = { file: s.lib.file, deps: s.lib.deps, install: s.lib.install, run: s.lib.run, sampleInput: s.lib.sampleInput || sampleInput, expectedOutput, notes: notes(s.lib.notes), route: 'library' };
}
writeFileSync(join(here, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${Object.keys(manifest).length} methods to code/manifest.json`);

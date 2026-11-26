// Tests for the educational/accuracy fixes (methods-fixes branch) and the optional step.meta fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import caesar from '../methods/caesar.js';
import vigenere from '../methods/vigenere.js';
import playfair, { prepareDetailed } from '../methods/playfair.js';
import railfence from '../methods/railfence.js';
import hill, { parseKey as hillKey } from '../methods/hill.js';
import aes, { parseBlock, unpadText } from '../methods/aes.js';
import rsa from '../methods/rsa.js';
import dhMethod, { dhIssues } from '../methods/diffiehellman.js';
import sha256, { flipOneBit, bitDiffBytes, SELECTED_ROUNDS } from '../methods/sha256.js';
import base64, { b64decode, expansionNote } from '../methods/base64.js';

const json = (x) => JSON.parse(JSON.stringify(x));

test('Caesar explains that non-letters pass through unchanged, for encrypt and decrypt', () => {
  for (const action of ['encrypt', 'decrypt']) {
    const r = caesar[action]({ text: 'Hi, 42!', shift: 3 });
    assert.match(r.steps[0].explanation, /copied to the output unchanged/);
    assert.match(r.steps[0].explanation, /5 characters are copied unchanged/);
    const letterSteps = r.steps.filter((s) => s.meta && 'charIndex' in s.meta);
    assert.deepEqual(letterSteps.map((s) => s.meta.charIndex), [0, 1]);
  }
});

test('Vigenère: key does not advance on non-letters; steps expose key letter and key index', () => {
  const r = vigenere.encrypt({ text: 'AB CD EF', key: 'XYZ' });
  assert.equal(r.output, 'XZ BA CE');
  assert.match(r.steps[0].explanation, /do NOT use up a key letter/);
  const metas = r.steps.filter((s) => s.meta && 'keyIndex' in s.meta).map((s) => s.meta);
  assert.deepEqual(metas.map((m) => m.keyLetter).join(''), 'XYZXYZ');
  assert.deepEqual(metas.map((m) => m.keyIndex), [0, 1, 2, 0, 1, 2]);
  assert.deepEqual(metas.map((m) => m.charIndex), [0, 1, 3, 4, 6, 7]);
  assert.match(r.steps.find((s) => s.meta?.charIndex === 3).explanation, /key letter 3 of 3/);
});

test('Playfair: fillers are marked and explained; decryption is described as lossy', () => {
  const d = prepareDetailed('balloon Jx');
  assert.deepEqual(d.pairs.map((p) => p.join('')), ['BA', 'LX', 'LO', 'ON', 'IX']);
  assert.deepEqual(d.fillers, [{ pair: 1, letter: 'X', reason: 'double', doubled: 'L' }]);
  assert.equal(d.jCount, 1); assert.equal(d.dropped, 1);
  const odd = prepareDetailed('abc');
  assert.deepEqual(odd.fillers, [{ pair: 1, letter: 'X', reason: 'odd' }]);
  const r = playfair.encrypt({ text: 'balloon', key: 'monarchy' });
  const split = r.steps.find((s) => /Split the message/.test(s.title));
  assert.match(split.explanation, /X between the two Ls \(pair 2\)/);
  assert.deepEqual(split.visual.data.fillerPairs, [1]);
  const pairSteps = r.steps.filter((s) => s.meta && 'pairIndex' in s.meta);
  assert.deepEqual(pairSteps.map((s) => s.meta.isFiller), [[false, false], [false, true], [false, false], [false, false]]);
  assert.deepEqual(pairSteps[0].meta.inCells.length, 2); assert.deepEqual(pairSteps[0].meta.outCells.length, 2);
  const dec = playfair.decrypt({ text: r.output, key: 'monarchy' });
  assert.match(dec.steps.at(-1).explanation, /does not always give back the exact original text/);
  assert.match(dec.steps.at(-1).explanation, /J comes back as I/);
});

test('Rail Fence: every drawing step exposes the active character positions and a focus', () => {
  for (const action of ['encrypt', 'decrypt']) {
    const r = railfence[action]({ text: 'WEAREDISCOVERED', rails: 3 });
    const withMeta = r.steps.filter((s) => s.meta);
    assert.ok(withMeta.length >= 4);
    for (const s of withMeta) {
      assert.ok(s.meta.active.length >= 1);
      for (const a of s.meta.active) { assert.equal(a.col, a.index); assert.ok(a.row >= 0 && a.row < 3); }
      assert.deepEqual(s.meta.focus, s.meta.active.at(-1));
    }
  }
  const leg = railfence.encrypt({ text: 'WEAREDISCOVERED', rails: 3 }).steps.find((s) => s.title === 'Write characters 4–5 (going up)');
  assert.deepEqual(leg.meta.active.map((a) => [a.index, a.row]), [[3, 1], [4, 0]]);
});

test('Hill: huge key entries are reduced mod 26 exactly (no Number precision loss)', () => {
  const big = '26000000000000000000000003 3 2 5'; // ≡ 3 3 2 5 (mod 26)
  assert.notEqual(Number('26000000000000000000000003') % 26, 3, 'sanity: Number would get this wrong');
  assert.deepEqual(hillKey(big), [[3, 3], [2, 5]]);
  assert.equal(hill.encrypt({ text: 'HELP', key: big }).output, 'HIAT');
  assert.deepEqual(hillKey('-23 3 -24 5'), [[3, 3], [2, 5]]);
  assert.throws(() => hillKey('1e3 3 2 5'), /4 whole numbers/);
});

test('Hill: steps explain invertibility and padding and expose per-row products', () => {
  const r = hill.encrypt({ text: 'HELPS', key: '3 3 2 5' });
  assert.match(r.steps[0].explanation, /odd \(not divisible by 2\) and not divisible by 13/);
  const split = r.steps.find((s) => /Split into pairs/.test(s.title));
  assert.match(split.explanation, /padding X/);
  const blocks = r.steps.filter((s) => s.meta && 'pairIndex' in s.meta).map((s) => json(s.meta));
  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks[0].input, { letters: 'HE', vector: [7, 4] });
  assert.deepEqual(blocks[0].rows[0], { terms: [{ k: 3, x: 7, product: 21 }, { k: 3, x: 4, product: 12 }], sum: 33, result: 7, letter: 'H' });
  assert.deepEqual(blocks[0].output, { letters: 'HI', vector: [7, 8] });
  assert.deepEqual(blocks[2].isPadding, [false, true]);
});

test('AES: lengths are in bytes; multi-byte text is labelled correctly', () => {
  const p = parseBlock('héllo🔐', 'text', 'The plaintext');
  assert.equal(p.textChars, 6); assert.equal(p.textBytes, 10);
  assert.throws(() => parseBlock('ééééééééé', 'text', 'The plaintext'), /18 bytes \(9 characters/);
  const r = aes.encrypt({ format: 'text', block: 'héllo', keyFormat: 'hex', key: '2b7e151628aed2a6abf7158809cf4f3c' });
  assert.match(r.steps[0].explanation, /5 characters = 6 bytes in UTF-8/);
  assert.match(r.steps[0].explanation, /exactly ONE 16-byte block/);
  assert.equal(aes.inputs.find((i) => i.id === 'format').options[1].label, 'Text (up to 16 bytes in UTF-8)');
});

test('AES: PKCS#7 padding preserves genuine trailing 00 bytes; zero padding is documented as lossy', () => {
  const key = '000102030405060708090a0b0c0d0e0f';
  const enc = aes.encrypt({ format: 'text', block: 'ab\u0000', keyFormat: 'hex', key, padding: 'pkcs7' });
  assert.ok(enc.steps.some((s) => /13 PKCS#7 bytes \(value 0d\)/.test(s.title)));
  const dec = aes.decrypt({ format: 'text', block: enc.output, keyFormat: 'hex', key, padding: 'pkcs7' });
  assert.equal(dec.output, 'ab\u0000');
  const z = aes.encrypt({ format: 'text', block: 'ab\u0000', keyFormat: 'hex', key });
  const zd = aes.decrypt({ format: 'text', block: z.output, keyFormat: 'hex', key });
  assert.equal(zd.output, 'ab'); // zero padding cannot tell the genuine 00 apart: said so in the step
  assert.match(zd.steps.find((s) => s.title === 'Plaintext recovered').explanation, /genuine trailing 00 would also be lost/);
  const sixteen = () => { try { aes.encrypt({ format: 'text', block: 'Two One Nine Two', keyFormat: 'hex', key, padding: 'pkcs7' }); } catch (e) { return e.message; } };
  assert.match(sixteen(), /at most 15 bytes/);
  assert.match(sixteen(), /extra block of sixteen 10 \(hex\) bytes/);
  assert.deepEqual(unpadText([...Array(16)].map(() => 7)).paddingOk, true);
});

test('AES: decrypted bytes that are not UTF-8 are output as raw hex', () => {
  // FIPS-197 C.1 ciphertext decrypts to 00112233…ff, which is not valid UTF-8 after stripping zeros.
  const v = { format: 'text', block: '69c4e0d86a7b0430d8cdb78070b4c55a', keyFormat: 'hex', key: '000102030405060708090a0b0c0d0e0f' };
  const r = aes.decrypt(v);
  assert.equal(r.output, '00112233445566778899aabbccddeeff');
  assert.match(r.outputLabel, /not valid UTF-8/);
  const bad = aes.decrypt({ ...v, padding: 'pkcs7' });
  assert.equal(bad.output, '00112233445566778899aabbccddeeff');
  assert.match(bad.outputLabel, /not valid PKCS#7/);
  const keys = aes.encrypt({ format: 'hex', block: '3243f6a8885a308d313198a2e0370734', keyFormat: 'hex', key: '2b7e151628aed2a6abf7158809cf4f3c' }).steps.find((s) => /all 11 round keys/i.test(s.title));
  assert.deepEqual(keys.visual.data.headers, ['Round', 'Words', 'Round key (4 words)']);
  assert.equal(keys.visual.data.rows[0][1], 'w0–w3');
  assert.equal(keys.visual.data.rows[1][1], 'w4–w7');
  assert.equal(keys.visual.data.rows[10][1], 'w40–w43');
  assert.match(aes.description, /Single-block AES-128/);
  assert.doesNotMatch(aes.description, /Educational|not for real|vetted library/i);
});

test('RSA: correct definitions, textbook vs real-world step, Euclid and square-and-multiply data', () => {
  const r = rsa.encrypt({ p: 61, q: 53, e: 17, format: 'numbers', message: '65' });
  const t = (re) => r.steps.find((s) => re.test(s.title));
  assert.match(t(/φ\(n\)/).explanation, /from 1 to n that share no factor/);
  assert.match(t(/public exponent e/).explanation, /gcd\(e, φ\(n\)\) = 1/);
  assert.match(t(/Find d/).explanation, /inverse of e modulo φ\(n\)/);
  const real = t(/Textbook RSA vs real-world RSA/);
  assert.match(real.explanation, /OAEP/); assert.match(real.explanation, /PSS/); assert.match(real.explanation, /2048/);
  assert.doesNotMatch(real.explanation, /vetted library|educational demo|not a production/i);
  const eu = t(/Find d/).meta.euclid;
  assert.equal(eu.d, '2753'); assert.equal(eu.rows[eu.currentRow].remainder, '1');
  assert.deepEqual(eu.rows[0], { index: 0, quotient: null, remainder: '3120', s: '1', t: '0', tTimesEModPhi: '0' });
  for (const row of eu.rows) assert.equal(BigInt(row.s) * 3120n + BigInt(row.t) * 17n, BigInt(row.remainder), 'r = s·φ + t·e');
  const mp = r.steps.find((s) => s.meta?.modPow).meta.modPow;
  assert.equal(mp.bits, '10001'); assert.equal(mp.result, '2790');
  assert.equal(mp.progress.length, 5); assert.equal(mp.progress.at(-1).acc, '2790');
  assert.equal(mp.progress[0].accBefore, '1');
  assert.doesNotThrow(() => JSON.stringify(r.steps));
  assert.match(rsa.description, /textbook RSA/);
  assert.doesNotMatch(rsa.description, /Educational|not for real use|vetted library/i);
});

test('Diffie–Hellman: degenerate parameters are rejected or flagged; exchange data exposed', () => {
  const v = dhMethod.validate;
  assert.equal(v({ p: 23, g: 5, a: 4, b: 3 }), null);
  assert.match(v({ p: 23, g: 5, a: 1, b: 3 }), /between 2 and p − 2/);
  assert.match(v({ p: 23, g: 5, a: 22, b: 3 }), /between 2 and p − 2/);
  assert.match(v({ p: 23, g: 22, a: 4, b: 3 }), /trivial generator.*p − 1/);
  assert.match(v({ p: 23, g: 2, a: 11, b: 3 }), /A = g\^a mod p = 1/);
  assert.match(v({ p: 23, g: 2, a: 3, b: 11 }), /B = g\^b mod p = 1/);
  // g=5 is a primitive root mod 23, so a = 11 = (p-1)/2 gives A = g^a = p-1 = 22, and the shared secret is also p-1.
  assert.match(v({ p: 23, g: 5, a: 11, b: 3 }), /A = g\^a mod p = 22 \(p − 1\)/);
  assert.match(v({ p: 23, g: 5, a: 4, b: 11 }), /B = g\^b mod p = 22 \(p − 1\)/);
  // order of 2 mod 31 is 5: a = 2, b = 5 → B = 1; a = 2, b = 10 → B = 1 too. a = 10, b = 3 → A = 1.
  assert.match(v({ p: 31, g: 2, a: 10, b: 3 }), /A = g\^a mod p = 1/);
  assert.deepEqual(dhIssues(23, 1, 4, 3).map((i) => i.code).includes('g-one'), true);
  const direct = dhMethod.exchange({ p: 23, g: 5, a: 1, b: 3 });
  assert.equal(direct.steps[0].title, '⚠ Degenerate parameters');
  assert.match(direct.outputLabel, /degenerate/);
  const ok = dhMethod.exchange({ p: 23, g: 5, a: 4, b: 3 });
  assert.ok(!ok.steps.some((s) => /Degenerate/.test(s.title)));
  assert.match(ok.steps.find((s) => /Check the generator/.test(s.title)).explanation, /safe prime p = 2q \+ 1/);
  const swap = ok.steps.find((s) => s.title === 'Swap public keys').meta.exchange;
  assert.deepEqual(swap.messages, [{ from: 'Alice', to: 'Bob', name: 'A', value: '4', public: true }, { from: 'Bob', to: 'Alice', name: 'B', value: '10', public: true }]);
  assert.deepEqual(swap.public, ['p', 'g', 'A', 'B']);
  assert.match(dhMethod.description, /small groups/);
  assert.doesNotMatch(dhMethod.description, /Educational demo|vetted library/i);
});

test('SHA-256 avalanche flips exactly one bit and reports both bit counts', () => {
  const f = flipOneBit([0x61, 0x62, 0x63]);
  assert.equal(bitDiffBytes([0x61, 0x62, 0x63], f.bytes), 1);
  const r = sha256.hash({ text: 'abc' });
  const av = r.steps.find((s) => s.title === 'Avalanche effect');
  assert.equal(av.meta.inputBitsChanged, 1);
  assert.ok(av.meta.outputBitsChanged > 64 && av.meta.outputBitsChanged < 192);
  assert.match(av.explanation, /Flip exactly one bit/);
  assert.match(av.explanation, /63 = 01100011 → 62 = 01100010/);
  const empty = sha256.hash({ text: '' }).steps.find((s) => s.title === 'Avalanche effect');
  assert.match(empty.explanation, /no bit to flip/);
  assert.doesNotMatch(empty.explanation, /Flip exactly one bit/);
  assert.equal(empty.meta.inputBitsChanged, null);
});

test('SHA-256 exposes registers a…h for selected rounds (FIPS 180-4 "abc" round 0 and 63)', () => {
  const r = sha256.hash({ text: 'abc' });
  const sel = r.steps.find((s) => /Registers a…h in selected rounds/.test(s.title));
  assert.deepEqual(sel.meta.rounds.map((x) => x.t), SELECTED_ROUNDS);
  // FIPS 180-4 example (SHA-256 "abc"), t = 0 and t = 63.
  assert.deepEqual(sel.meta.rounds[0].after, { a: '5d6aebcd', b: '6a09e667', c: 'bb67ae85', d: '3c6ef372', e: 'fa2a4622', f: '510e527f', g: '9b05688c', h: '1f83d9ab' });
  assert.equal(sel.meta.rounds[7].after.a, '506e3058');
  assert.equal(sel.meta.rounds[0].before.a, '6a09e667');
  const all = r.steps.find((s) => /All 64 rounds/.test(s.title));
  assert.equal(all.meta.registers.length, 64);
});

test('Base64 decode goes characters → sextets → bytes; byte-exact BOM; hex for binary', () => {
  const r = base64.decode({ text: 'TWFu' });
  const g = r.steps.find((s) => s.meta?.order);
  assert.deepEqual(g.meta.order, ['chars', 'sextets', 'bytes']);
  assert.deepEqual(g.visual.data.groups.map((x) => x.label), ['Base64 characters', 'Groups of 6 bits', 'Bytes (8 bits)']);
  assert.deepEqual(g.meta.sextets.map((x) => x.bits), ['010011', '010110', '000101', '101110']);
  assert.deepEqual(g.meta.bytes.map((x) => x.value), [77, 97, 110]);
  const pad = base64.decode({ text: 'TQ==' }).steps.find((s) => s.meta?.order);
  assert.equal(pad.meta.droppedBits, '0000');
  // UTF-8 BOM is kept (byte-exact), not silently swallowed by TextDecoder.
  const bom = base64.decode({ text: '77u/aGk=' });
  assert.equal(bom.output, '\uFEFFhi');
  assert.ok(bom.steps.some((s) => /byte-order mark/.test(s.title)));
  assert.equal(base64.encode({ text: '\uFEFFhi' }).output, '77u/aGk=');
  // Binary output is shown as exact hex.
  assert.equal(base64.decode({ text: '/w==' }).output, 'ff');
  assert.deepEqual(b64decode('AAD/'), [0, 0, 255]);
  assert.equal(base64.decode({ text: 'AAD/' }).output, '0000ff');
});

test('Base64 expansion is explained accurately', () => {
  assert.match(expansionNote(3, 4), /\+33%/);
  assert.match(expansionNote(1, 4), /\+300%/);
  assert.match(expansionNote(1, 4), /4 × ⌈n \/ 3⌉/);
  const r = base64.encode({ text: 'Man' });
  assert.match(r.steps.at(-1).explanation, /4 characters for every 3 bytes/);
});

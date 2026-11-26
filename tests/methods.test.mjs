import { test } from 'node:test';
import assert from 'node:assert/strict';
import { methods } from '../registry.js';
import { getActions, validate, runAction } from '../core/contract.js';
import template from '../methods/_template.js';
import caesar from '../methods/caesar.js';
import vigenere from '../methods/vigenere.js';
import playfair, { keySquare } from '../methods/playfair.js';
import railfence, { railEncrypt, railDecrypt } from '../methods/railfence.js';
import hill from '../methods/hill.js';
import aes, { SBOX, INV_SBOX, aesEncryptBlock, aesDecryptBlock, expandKey } from '../methods/aes.js';
import rsa, { rsaKeys, suggestPrimes } from '../methods/rsa.js';
import dhMethod, { dh } from '../methods/diffiehellman.js';
import sha256, { sha256Hex } from '../methods/sha256.js';
import base64, { b64encode, b64decode } from '../methods/base64.js';
import { hexToBytes, bytesToHex, utf8Encode } from '../lib/text.js';
import { modInverse, modPow, isPrime } from '../lib/math.js';

const defaults = (m) => Object.fromEntries(m.inputs.map((i) => [i.id, i.default]));

// ---------------------------------------------------------------- contract
test('every registered method satisfies the plugin contract', () => {
  const ids = new Set();
  for (const m of [...methods, template]) {
    for (const k of ['id', 'name', 'category', 'description']) assert.equal(typeof m[k], 'string', `${m.id}.${k}`);
    assert.ok(!ids.has(m.id), `duplicate id ${m.id}`); ids.add(m.id);
    assert.ok(Array.isArray(m.inputs) && m.inputs.length, `${m.id} inputs`);
    const actions = getActions(m);
    const inverses = new Set(actions.map((a) => a.inverse).filter(Boolean));
    for (const a of actions) assert.equal(typeof m[a.id], 'function', `${m.id}.${a.id}`);
    const checkResult = (res, label) => {
      assert.equal(typeof res.output, 'string', `${label} output`);
      assert.ok(res.steps.length >= 2, `${label} steps`);
      assert.doesNotThrow(() => JSON.stringify(res.steps), `${label} steps must be plain data (no BigInt)`);
      for (const s of res.steps) {
        assert.ok(s.title && s.explanation, `${label} step text`);
        for (const v of [].concat(s.visual)) assert.equal(typeof v.type, 'string', `${label} visual type`);
      }
    };
    for (const a of actions) {
      // Primary actions run on the defaults; their inverse runs on the primary output.
      if (inverses.has(a.id) && !a.inverse) continue;
      if (inverses.has(a.id) && actions.findIndex((x) => x.id === a.id) > actions.findIndex((x) => x.id === a.inverse)) continue;
      const values = defaults(m);
      assert.deepEqual(validate(m, a.id, values), { fieldErrors: {}, formError: null }, `${m.id}.${a.id} defaults valid`);
      const res = runAction(m, a.id, values);
      checkResult(res, `${m.id}.${a.id}`);
      if (a.inverse) {
        assert.ok(m.ioField, `${m.id} needs ioField for inverse`);
        checkResult(runAction(m, a.inverse, { ...values, [m.ioField]: res.output }), `${m.id}.${a.inverse}`);
      }
    }
    for (const i of m.inputs) if (i.validate) assert.equal(i.validate(i.default, defaults(m)), null, `${m.id}.${i.id} default valid`);
  }
});

// ---------------------------------------------------------------- classical
test('Caesar: known vector, case/punctuation preserved, round trip', () => {
  assert.equal(caesar.encrypt({ text: 'Attack at dawn!', shift: 3 }).output, 'Dwwdfn dw gdzq!');
  assert.equal(caesar.encrypt({ text: 'XYZ', shift: 3 }).output, 'ABC');
  assert.equal(caesar.encrypt({ text: 'The quick brown fox jumps over the lazy dog', shift: 13 }).output, 'Gur dhvpx oebja sbk whzcf bire gur ynml qbt');
  for (let k = 0; k < 26; k++) {
    const t = 'Hello, World 123';
    assert.equal(caesar.decrypt({ text: caesar.encrypt({ text: t, shift: k }).output, shift: k }).output, t);
  }
});


test('Vigenère: textbook ATTACKATDAWN / LEMON', () => {
  assert.equal(vigenere.encrypt({ text: 'ATTACKATDAWN', key: 'LEMON' }).output, 'LXFOPVEFRNHR');
  assert.equal(vigenere.encrypt({ text: 'attack at dawn', key: 'lemon' }).output, 'lxfopv ef rnhr');
  const t = 'Crypto is fun, isn\'t it?';
  assert.equal(vigenere.decrypt({ text: vigenere.encrypt({ text: t, key: 'Key' }).output, key: 'Key' }).output, t);
  assert.throws(() => vigenere.encrypt({ text: 'abc', key: '123' }));
});

test('Playfair: Wikipedia example and round trip', () => {
  const sq = keySquare('playfair example');
  assert.deepEqual(sq.grid.map((r) => r.join('')), ['PLAYF', 'IREXM', 'BCDGH', 'KNOQS', 'TUVWZ']);
  const enc = playfair.encrypt({ text: 'Hide the gold in the tree stump', key: 'playfair example' }).output;
  assert.equal(enc, 'BMODZBXDNABEKUDMUIXMMOUVIF');
  assert.equal(playfair.decrypt({ text: enc, key: 'playfair example' }).output, 'HIDETHEGOLDINTHETREXESTUMP');
  const enc2 = playfair.encrypt({ text: 'balloon', key: 'monarchy' }).output; // BA LX LO ON → IB SU PM NA
  assert.equal(enc2, 'IBSUPMNA');
  assert.equal(playfair.decrypt({ text: enc2, key: 'monarchy' }).output, 'BALXLOON');
  assert.throws(() => playfair.decrypt({ text: 'ABC', key: 'k' }));
});

test('Rail Fence: classic WEAREDISCOVERED vector and round trips', () => {
  assert.equal(railfence.encrypt({ text: 'WEAREDISCOVEREDFLEEATONCE', rails: 3 }).output, 'WECRLTEERDSOEEFEAOCAIVDEN');
  for (let r = 2; r <= 10; r++) {
    const t = 'Rail fence with spaces & symbols!';
    assert.equal(railfence.decrypt({ text: railfence.encrypt({ text: t, rails: r }).output, rails: r }).output, t);
  }
});

test('Hill 2×2: HELP → HIAT and round trip; rejects singular key', () => {
  assert.equal(hill.encrypt({ text: 'HELP', key: '3 3 2 5' }).output, 'HIAT');
  assert.equal(hill.decrypt({ text: 'HIAT', key: '3 3 2 5' }).output, 'HELP');
  assert.equal(hill.decrypt({ text: hill.encrypt({ text: 'odd', key: 'HILL' }).output, key: 'HILL' }).output, 'ODDX');
  const enc = hill.encrypt({ text: 'short example', key: 'HILL' }).output;
  assert.equal(hill.decrypt({ text: enc, key: 'HILL' }).output, 'SHORTEXAMPLE');
  assert.throws(() => hill.encrypt({ text: 'HELP', key: '2 4 6 8' }), /determinant/);
});

// ---------------------------------------------------------------- AES
test('AES S-box sanity', () => {
  assert.equal(SBOX[0x00], 0x63); assert.equal(SBOX[0x53], 0xed); assert.equal(SBOX[0xff], 0x16);
  for (let i = 0; i < 256; i++) assert.equal(INV_SBOX[SBOX[i]], i);
});

test('AES-128 FIPS-197 Appendix B (with intermediate states)', () => {
  const pt = hexToBytes('3243f6a8885a308d313198a2e0370734');
  const key = hexToBytes('2b7e151628aed2a6abf7158809cf4f3c');
  const { output, log } = aesEncryptBlock(pt, key);
  assert.equal(bytesToHex(output), '3925841d02dc09fbdc118597196a0b32');
  const r1 = log.filter((e) => e.round === 1);
  assert.equal(bytesToHex(r1[0].before), '193de3bea0f4e22b9ac68d2ae9f84808');
  assert.equal(bytesToHex(r1[0].after), 'd42711aee0bf98f1b8b45de51e415230');
  assert.equal(bytesToHex(r1[1].after), 'd4bf5d30e0b452aeb84111f11e2798e5');
  assert.equal(bytesToHex(r1[2].after), '046681e5e0cb199a48f8d37a2806264c');
  assert.equal(bytesToHex(r1[3].key), 'a0fafe1788542cb123a339392a6c7605');
  const { w } = expandKey(key);
  assert.equal(bytesToHex(w[43]), 'b6630ca6');
  assert.equal(bytesToHex(aesDecryptBlock(output, key).output), '3243f6a8885a308d313198a2e0370734');
});

test('AES-128 FIPS-197 Appendix C.1 via method API', () => {
  const v = { format: 'hex', block: '00112233445566778899aabbccddeeff', key: '000102030405060708090a0b0c0d0e0f' };
  const enc = aes.encrypt(v);
  assert.equal(enc.output, '69c4e0d86a7b0430d8cdb78070b4c55a');
  assert.equal(aes.decrypt({ ...v, block: enc.output }).output, '00112233445566778899aabbccddeeff');
  assert.equal(enc.steps.length, 3 + 40 + 1 + 2); // load, key expansion ×2, 40 round ops, ciphertext, avalanche, modes
});

test('AES-128 text mode round trip', () => {
  const enc = aes.encrypt({ format: 'text', block: 'Two One Nine Two', keyFormat: 'text', key: 'Thats my Kung Fu' });
  assert.equal(enc.output, '29c3505f571420f6402299b31a02d73a');
  assert.equal(aes.decrypt({ format: 'text', block: enc.output, keyFormat: 'text', key: 'Thats my Kung Fu' }).output, 'Two One Nine Two');
  // Text plaintext with a HEX key (QA bug: key used to be parsed with the plaintext format).
  const short = aes.encrypt({ format: 'text', block: 'hi', keyFormat: 'hex', key: '2b7e151628aed2a6abf7158809cf4f3c' });
  assert.ok(short.steps.some((s) => /Padding: 14 zero bytes/.test(s.title)), 'explicit padding step');
  assert.equal(aes.decrypt({ format: 'text', block: short.output, keyFormat: 'hex', key: '2b7e151628aed2a6abf7158809cf4f3c' }).output, 'hi');
  assert.throws(() => aes.encrypt({ format: 'hex', block: 'abcd', key: '00' }));
});

test('AES-128 matches Node crypto on random blocks', async () => {
  const { createCipheriv, randomBytes } = await import('node:crypto');
  for (let i = 0; i < 25; i++) {
    const k = randomBytes(16), p = randomBytes(16);
    const c = createCipheriv('aes-128-ecb', k, null).setAutoPadding(false).update(p);
    assert.equal(bytesToHex(aesEncryptBlock([...p], [...k]).output), c.toString('hex'));
    assert.equal(bytesToHex(aesDecryptBlock([...c], [...k]).output), p.toString('hex'));
  }
});

// ---------------------------------------------------------------- RSA / DH
test('RSA: Wikipedia key (61, 53, 17) → d = 2753, 65 ↔ 2790', () => {
  const k = rsaKeys(61, 53, 17);
  assert.equal(k.n, 3233n); assert.equal(k.phi, 3120n); assert.equal(k.d, 2753n);
  assert.equal(rsa.encrypt({ p: 61, q: 53, e: 17, format: 'numbers', message: '65' }).output, '2790');
  assert.equal(rsa.decrypt({ p: 61, q: 53, e: 17, format: 'numbers', message: '2790' }).output, '65');
  const enc = rsa.encrypt({ p: 61, q: 53, e: 17, format: 'text', message: 'Hello RSA!' });
  assert.equal(rsa.decrypt({ p: 61, q: 53, e: 17, format: 'text', message: enc.output }).output, 'Hello RSA!');
  assert.throws(() => rsa.encrypt({ p: 4, q: 53, e: 17, format: 'text', message: 'x' }), /not prime/);
  assert.throws(() => rsa.encrypt({ p: 61, q: 53, e: 6, format: 'text', message: 'x' }), /shares a factor/);
  assert.throws(() => rsa.encrypt({ p: 3, q: 5, e: 3, format: 'text', message: 'A' }), /smaller than n/);
});

test('math helpers', () => {
  assert.equal(modInverse(17, 3120), 2753n);
  assert.equal(modInverse(2, 4), null);
  assert.equal(modPow(4, 13, 497), 445n);
  assert.deepEqual([2, 3, 4, 97, 561].map(isPrime), [true, true, false, true, false]);
});

test('Diffie–Hellman: Wikipedia example p=23 g=5 a=4 b=3 → s=18', () => {
  const r = dh(23, 5, 4, 3);
  assert.equal(r.A, 4n); assert.equal(r.B, 10n); assert.equal(r.sA, 18n); assert.equal(r.sB, 18n);
  assert.equal(dhMethod.exchange({ p: 23, g: 5, a: 4, b: 3 }).output, '18');
  assert.match(dhMethod.validate({ p: 24, g: 5, a: 4, b: 3 }), /not prime/);
});

// ---------------------------------------------------------------- SHA-256 / Base64
test('SHA-256 standard vectors', async () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  assert.equal(sha256.hash({ text: 'abc' }).output, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const { createHash } = await import('node:crypto');
  for (const s of ['a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'नमस्ते 🔐', 'x'.repeat(300)]) {
    assert.equal(sha256Hex(s), createHash('sha256').update(s).digest('hex'), `len ${s.length}`);
  }
});

test('Base64 RFC 4648 vectors and round trip', () => {
  const v = { '': '', f: 'Zg==', fo: 'Zm8=', foo: 'Zm9v', foob: 'Zm9vYg==', fooba: 'Zm9vYmE=', foobar: 'Zm9vYmFy' };
  for (const [k, e] of Object.entries(v)) assert.equal(b64encode(utf8Encode(k)), e);
  assert.equal(base64.encode({ text: 'Man' }).output, 'TWFu');
  assert.equal(base64.decode({ text: 'TWFu' }).output, 'Man');
  const t = 'Hello, नमस्ते 🔐';
  assert.equal(base64.decode({ text: base64.encode({ text: t }).output }).output, t);
  assert.equal(base64.encode({ text: t }).output, Buffer.from(t).toString('base64'));
  assert.throws(() => b64decode('a'));
});

// ---------------------------------------------------------------- review round 1: new validation
test('AES key validation: exact 16 bytes, no silent padding', async () => {
  const { parseKey } = await import('../methods/aes.js');
  assert.throws(() => parseKey('abc', 'text'), /exactly 16 bytes.*3 bytes/);
  assert.throws(() => aes.encrypt({ format: 'text', block: 'hi', keyFormat: 'text', key: 'abc' }), /exactly 16 bytes/);
  assert.throws(() => parseKey('2b7e15', 'hex'), /exactly 32 hex characters.*6/);
  assert.throws(() => parseKey('Thats my Kung Fu', 'hex'), /switch "Key format" to Text/);
  assert.equal(parseKey('2B7E1516 28AED2A6 ABF71588 09CF4F3C', 'hex').length, 16);
  const keyField = aes.inputs.find((i) => i.id === 'key');
  assert.match(keyField.validate('abc', { keyFormat: 'text' }), /exactly 16 bytes/);
  assert.equal(keyField.validate('Thats my Kung Fu', { keyFormat: 'text' }), null);
  assert.match(aes.validate({ format: 'text', block: 'x'.repeat(17) }, 'encrypt'), /at most 16 bytes/);
  assert.match(aes.validate({ format: 'text', block: 'hello' }, 'decrypt'), /ciphertext must be hex/);
  const enc = aes.encrypt({ format: 'hex', block: '3243f6a8885a308d313198a2e0370734', keyFormat: 'hex', key: '2b7e151628aed2a6abf7158809cf4f3c' });
  assert.ok(enc.steps.some((s) => /modes of operation/.test(s.title)) && enc.steps.some((s) => /Avalanche/.test(s.title)));
});

test('Diffie–Hellman rejects trivial generators and warns about small subgroups', async () => {
  const { orderOf } = await import('../methods/diffiehellman.js');
  assert.equal(orderOf(5, 23), 22n); assert.equal(orderOf(22, 23), 2n); assert.equal(orderOf(2, 23), 11n);
  assert.match(dhMethod.validate({ p: 23, g: 22, a: 4, b: 3 }), /trivial generator/);
  assert.equal(dhMethod.validate({ p: 23, g: 2, a: 4, b: 3 }), null);
  const warn = dhMethod.exchange({ p: 23, g: 2, a: 4, b: 3 });
  const gen = warn.steps.find((s) => /Check the generator/.test(s.title));
  assert.match(gen.explanation, /safe prime/);
  assert.match(gen.explanation, /prime-order subgroup/);
  assert.match(gen.explanation, /2048-bit/);
  assert.doesNotMatch(gen.explanation, /small subgroup/);
  const ok = dhMethod.exchange({ p: 23, g: 5, a: 4, b: 3 });
  assert.ok(ok.steps.some((s) => /man|middle/i.test(s.title)), 'MITM step');
  assert.ok(ok.steps.some((s) => /HKDF/.test(s.explanation)), 'KDF wording');
  assert.ok(ok.steps.some((s) => /private key that matches the server's certificate/.test(s.explanation)), 'TLS signs with the matching private key');
});

test('RSA: extended Euclid table derives d; helpful error messages', async () => {
  const { inverseTable, suggestE } = await import('../methods/rsa.js');
  const t = inverseTable(17, 3120);
  assert.equal(t.d, 2753n);
  assert.equal(t.rows.at(-1).r, 1n);
  for (const r of t.rows) assert.equal((((r.t * 17n) % 3120n) + 3120n) % 3120n, r.r % 3120n);
  assert.ok(!suggestE(3120n).includes(65537n));
  assert.throws(() => rsa.encrypt({ p: 61, q: 53, e: 6, format: 'text', message: 'x' }), /Try 7, 11, 17, 19/);
  assert.throws(() => rsa.encrypt({ p: 61, q: 53, e: 17, format: 'text', message: '😀' }), /larger than 128512/);
  const res = rsa.encrypt({ p: 61, q: 53, e: 17, format: 'text', message: 'HI' });
  assert.ok(res.steps.some((s) => /textbook RSA is unsafe/.test(s.title)));
});


test('SHA-256 wording: not for passwords; security notes step', () => {
  assert.doesNotMatch(sha256.description, /Used for passwords/);
  assert.match(sha256.description, /bcrypt or Argon2/);
  assert.ok(sha256.hash({ text: 'abc' }).steps.some((s) => s.title === 'Security notes'));
});

test('Playfair empty key is allowed with a warning', () => {
  const r = playfair.encrypt({ text: 'hello', key: '' });
  assert.ok(r.steps.some((s) => /Empty key/.test(s.title)));
  assert.equal(playfair.decrypt({ text: r.output, key: '' }).output, 'HELXLO');
});

test('Rail Fence: legs split at turning points; warning when rails ≥ length', () => {
  const titles = railfence.encrypt({ text: 'WEAREDISCOVERED', rails: 3 }).steps.map((s) => s.title);
  assert.ok(titles.includes('Write characters 1–3 (going down)') && titles.includes('Write characters 4–5 (going up)'));
  assert.ok(railfence.encrypt({ text: 'HI', rails: 3 }).steps.some((s) => /Too many rails/.test(s.title)));
});

test('Base64: empty string, base64url, unpadded, non-canonical, invalid UTF-8', () => {
  assert.equal(base64.encode({ text: '' }).output, '');
  assert.equal(base64.decode({ text: '' }).output, '');
  assert.deepEqual(b64decode('-_8='), [0xfb, 0xff]);
  assert.equal(base64.decode({ text: 'Zm9vYg' }).output, 'foob');
  assert.throws(() => b64decode('Zh=='), /non-canonical/);
  assert.match(base64.decode({ text: '/w==' }).outputLabel, /not valid UTF-8/);
  const abc = base64.decode({ text: 'abc' });
  assert.deepEqual(b64decode('abc'), [105, 183]);
  assert.ok(abc.steps.some((s) => s.title === 'Decoded bytes are not valid UTF-8 text'));
  assert.match(abc.outputLabel, /not valid UTF-8 text \(hex: 69 b7\)/);
  // The invalid-UTF-8 warning is shown once (its own step), not repeated in Result.
  for (const res of [abc, base64.decode({ text: '/w==' })]) {
    const mentions = res.steps.filter((s) => /not valid UTF-8/.test(s.title) || /not valid UTF-8/.test(s.explanation));
    assert.equal(mentions.length, 1, 'warning should appear in exactly one step');
    assert.equal(mentions[0].title, 'Decoded bytes are not valid UTF-8 text');
    const result = res.steps.find((s) => s.title === 'Result');
    assert.doesNotMatch(result.explanation, /not valid UTF-8/);
  }
});

// ---------------------------------------------------------------- QA leftovers + review round 2
test('Rail Fence core functions throw for rails < 2 or non-integers', () => {
  for (const n of [0, 1, -1, 1.5, NaN, 'x']) {
    assert.throws(() => railEncrypt('HELLO', n), /whole number of at least 2/);
    assert.throws(() => railDecrypt('HELLO', n), /whole number of at least 2/);
    assert.throws(() => railfence.encrypt({ text: 'HELLO', rails: n }), /whole number of at least 2/);
    assert.throws(() => railfence.decrypt({ text: 'HELLO', rails: n }), /whole number of at least 2/);
  }
  assert.equal(railEncrypt('HELLO', 3), railfence.encrypt({ text: 'HELLO', rails: 3 }).output);
});

test('Rail Fence with 2 rails labels direction from the step into each leg', () => {
  const titles = railfence.encrypt({ text: 'ABCDEF', rails: 2 }).steps.map((s) => s.title);
  assert.deepEqual(titles.filter((s) => s.startsWith('Write characters')), [
    'Write characters 1–2 (going down)',
    'Write characters 3–3 (going up)',
    'Write characters 4–4 (going down)',
    'Write characters 5–5 (going up)',
    'Write characters 6–6 (going down)',
  ]);
});

test('Empty message is rejected with "Enter a message"; SHA-256 and Base64 allow empty', () => {
  for (const [m, action] of [
    [caesar, 'encrypt'], [caesar, 'decrypt'],
    [vigenere, 'encrypt'], [playfair, 'encrypt'], [railfence, 'encrypt'], [hill, 'encrypt'],
    [aes, 'encrypt'], [rsa, 'encrypt'],
  ]) {
    const values = { ...defaults(m) };
    if (m.id === 'aes') { values.format = 'text'; values.block = ''; }
    else if (m.id === 'rsa') { values.format = 'text'; values.message = ''; }
    else values[m.ioField || 'text'] = '';
    const r = validate(m, action, values);
    const msg = r.formError || Object.values(r.fieldErrors)[0];
    assert.equal(msg, 'Enter a message', `${m.id}.${action} empty message`);
  }
  assert.deepEqual(validate(sha256, 'hash', { text: '' }), { fieldErrors: {}, formError: null });
  assert.deepEqual(validate(base64, 'encode', { text: '' }), { fieldErrors: {}, formError: null });
  assert.deepEqual(validate(base64, 'decode', { text: '' }), { fieldErrors: {}, formError: null });
  assert.equal(sha256.hash({ text: '' }).output, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(base64.encode({ text: '' }).output, '');

  // Direct encrypt/decrypt (bypassing validate) throw the same exact message.
  const emptyValues = (m) => {
    const values = { ...defaults(m) };
    if (m.id === 'aes') { values.format = 'text'; values.block = ''; }
    else if (m.id === 'rsa') { values.format = 'text'; values.message = ''; }
    else values[m.ioField || 'text'] = '';
    return values;
  };
  for (const [m, action] of [
    [caesar, 'encrypt'], [caesar, 'decrypt'],
    [vigenere, 'encrypt'], [vigenere, 'decrypt'],
    [playfair, 'encrypt'], [playfair, 'decrypt'],
    [railfence, 'encrypt'], [railfence, 'decrypt'],
    [hill, 'encrypt'], [hill, 'decrypt'],
    [aes, 'encrypt'],
    [rsa, 'encrypt'], [rsa, 'decrypt'],
  ]) {
    assert.throws(() => m[action](emptyValues(m)), { message: 'Enter a message' }, `${m.id}.${action} direct empty throw`);
  }
  assert.doesNotThrow(() => sha256.hash({ text: '' }));
  assert.doesNotThrow(() => base64.encode({ text: '' }));
  assert.doesNotThrow(() => base64.decode({ text: '' }));
});

test('RSA suggestPrimes is bounded, stays within the input limit, and is fast for huge ciphertext', () => {
  assert.deepEqual(suggestPrimes(128512n), [359n, 367n]);
  const t0 = Date.now();
  assert.equal(suggestPrimes(999999999999999999n), null);
  assert.ok(Date.now() - t0 < 200, 'must not scan up to sqrt of an 18-digit number');
  assert.throws(
    () => rsa.decrypt({ p: 61, q: 53, e: 17, format: 'numbers', message: '999999999999999999' }),
    /use larger primes/,
  );
  const rec = suggestPrimes(10n ** 12n);
  assert.ok(rec && rec[0] <= 10_000_000n && rec[1] <= 10_000_000n && rec[0] * rec[1] > 10n ** 12n);
  const unsafe = rsa.encrypt({ p: 61, q: 53, e: 17, format: 'text', message: 'HI' }).steps.find((s) => /textbook RSA is unsafe/.test(s.title));
  const smallE = unsafe.visual.data.rows[2][1];
  assert.match(smallE, /Fixed example \(not your key\)/);
  assert.match(smallE, /n = 55, e = 3, m = 2/);
  assert.equal(unsafe.visual.data.headers[1], 'Demonstration');
});

test('SHA-256 K_t wording uses the (t+1)-th prime', () => {
  const step = sha256.hash({ text: 'abc' }).steps.find((s) => /Compression round 0/.test(s.title));
  assert.match(step.explanation, /\(t\+1\)-th prime/);
});

test('AES avalanche on short text flips a student letter, not a padding byte', () => {
  const key = '2b7e151628aed2a6abf7158809cf4f3c';
  const short = aes.encrypt({ format: 'text', block: 'hello', keyFormat: 'hex', key });
  const av = short.steps.find((s) => s.title === 'Avalanche effect');
  assert.match(av.explanation, /byte 5: 6f → 6e/); // 'o' of "hello", not padding 00 → 01
  assert.doesNotMatch(av.explanation, /00 → 01/);
  // Full 16-byte block still flips the last byte (FIPS-197 App. B: 64 bits change).
  const full = aes.encrypt({ format: 'hex', block: '3243f6a8885a308d313198a2e0370734', keyFormat: 'hex', key });
  assert.match(full.steps.find((s) => s.title === 'Avalanche effect').explanation, /byte 16: 34 → 35/);
});

test('RSA large primes encrypt/decrypt stay fast and still teach factoring tries', () => {
  const p = 9999991, q = 9999973, e = 17;
  const t0 = Date.now();
  const enc = rsa.encrypt({ p, q, e, format: 'text', message: 'HI' });
  const encMs = Date.now() - t0;
  const t1 = Date.now();
  const dec = rsa.decrypt({ p, q, e, format: 'text', message: enc.output });
  const decMs = Date.now() - t1;
  assert.equal(dec.output, 'HI');
  assert.ok(encMs < 200, `encrypt should be well under 200ms, was ${encMs}ms`);
  assert.ok(decMs < 200, `decrypt should be well under 200ms, was ${decMs}ms`);
  // Teaching count is preserved: trial divisions from 2 through the smaller prime (inclusive).
  const factorRow = enc.steps.find((s) => /textbook RSA is unsafe/.test(s.title)).visual.data.rows[3][1];
  const smaller = Math.min(p, q);
  assert.match(factorRow, new RegExp(`found by trial division in ${smaller - 1} tries`));
  assert.match(factorRow, new RegExp(`${smaller}`));
});

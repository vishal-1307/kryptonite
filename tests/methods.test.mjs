import { test } from 'node:test';
import assert from 'node:assert/strict';
import { methods } from '../registry.js';
import { getActions, validate, runAction } from '../core/contract.js';
import template from '../methods/_template.js';
import caesar, { shiftText } from '../methods/caesar.js';
import vigenere from '../methods/vigenere.js';
import playfair, { keySquare } from '../methods/playfair.js';
import railfence from '../methods/railfence.js';
import hill from '../methods/hill.js';
import aes, { SBOX, INV_SBOX, aesEncryptBlock, aesDecryptBlock, expandKey } from '../methods/aes.js';
import rsa, { rsaKeys } from '../methods/rsa.js';
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

test('Caesar brute force recovers the key', () => {
  const ct = shiftText('Meet me near the old clock tower at nine tonight', 7);
  const res = caesar.attack({ text: ct });
  assert.equal(res.output, 'Meet me near the old clock tower at nine tonight');
  assert.equal(res.steps.length, 28);
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
  assert.equal(enc.steps.length, 3 + 40 + 1);
});

test('AES-128 text mode round trip', () => {
  const enc = aes.encrypt({ format: 'text', block: 'Two One Nine Two', key: 'Thats my Kung Fu' });
  assert.equal(enc.output, '29c3505f571420f6402299b31a02d73a');
  assert.equal(aes.decrypt({ format: 'text', block: enc.output, key: 'Thats my Kung Fu' }).output, 'Two One Nine Two');
  const short = aes.encrypt({ format: 'text', block: 'hi', key: 'k' });
  assert.equal(aes.decrypt({ format: 'text', block: short.output, key: 'k' }).output, 'hi');
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
  assert.throws(() => b64decode('abc'));
});

#!/usr/bin/env node
// Parity check: compiles every code/<method>/<method>.cpp, runs the Python and C++ programs, and compares
// their stdout with the output of the JavaScript method that Kryptonite runs in the browser.
// Usage: node code/verify.mjs   (or: sh code/verify.sh)   Needs: node 18+, python3, g++ (C++17).
// Optional library routes (aes128_lib.py needs `pip install cryptography`) are skipped with a note if missing.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { methods } from '../registry.js';
import { runAction, validate } from '../core/contract.js';

const here = dirname(fileURLToPath(import.meta.url));
const byId = Object.fromEntries(methods.map((m) => [m.id, m]));
// Every case must also pass Kryptonite's form validation, so the programs are compared on inputs the page accepts.
const js = (id, action, values) => {
  const v = validate(byId[id], action, values);
  if (Object.keys(v.fieldErrors).length || v.formError) throw new Error(`verify case rejected by Kryptonite validation: ${id}.${action} ${JSON.stringify(values)} → ${JSON.stringify(v)}`);
  return runAction(byId[id], action, values).output;
};

const B = { pt: '3243f6a8885a308d313198a2e0370734', key: '2b7e151628aed2a6abf7158809cf4f3c' };
const C1 = { pt: '00112233445566778899aabbccddeeff', key: '000102030405060708090a0b0c0d0e0f', ct: '69c4e0d86a7b0430d8cdb78070b4c55a' };
const hexAes = (action, block, key) => ({ args: [action, block, key], js: ['aes', action, { format: 'hex', block, keyFormat: 'hex', key }] });
const rsaEnc = js('rsa', 'encrypt', { p: 61, q: 53, e: 17, format: 'text', message: 'Hello RSA!' });
const pkcsCt = js('aes', 'encrypt', { format: 'text', block: 'ab\u0000', keyFormat: 'hex', key: C1.key, padding: 'pkcs7' });

// dir = code/<dir>; prog = file stem (python: <prog>.py, C++: <prog>.cpp). Each case: CLI args + the equivalent JS call.
const suites = [
  { dir: 'caesar', cases: [
    { args: [], js: ['caesar', 'encrypt', { text: 'Attack at dawn', shift: 3 }] },
    { args: ['encrypt', 'Hello, World 123!', '7'], js: ['caesar', 'encrypt', { text: 'Hello, World 123!', shift: 7 }] },
    { args: ['decrypt', 'Dwwdfn dw gdzq', '3'], js: ['caesar', 'decrypt', { text: 'Dwwdfn dw gdzq', shift: 3 }] },
    { args: ['encrypt', 'Grüße, Zoë!', '25'], js: ['caesar', 'encrypt', { text: 'Grüße, Zoë!', shift: 25 }] },
  ] },
  { dir: 'vigenere', cases: [
    { args: [], js: ['vigenere', 'encrypt', { text: 'ATTACK AT DAWN', key: 'LEMON' }] },
    { args: ['encrypt', 'attack at dawn', 'lemon'], js: ['vigenere', 'encrypt', { text: 'attack at dawn', key: 'lemon' }] },
    { args: ['decrypt', 'LXFOPV EF RNHR', 'LEMON'], js: ['vigenere', 'decrypt', { text: 'LXFOPV EF RNHR', key: 'LEMON' }] },
    { args: ['encrypt', "Crypto is fun, isn't it? 42", 'K3y!'], js: ['vigenere', 'encrypt', { text: "Crypto is fun, isn't it? 42", key: 'K3y!' }] },
  ] },
  { dir: 'playfair', cases: [
    { args: [], js: ['playfair', 'encrypt', { text: 'Hide the gold in the tree stump', key: 'playfair example' }] },
    { args: ['encrypt', 'balloon', 'monarchy'], js: ['playfair', 'encrypt', { text: 'balloon', key: 'monarchy' }] },
    { args: ['decrypt', 'BMODZBXDNABEKUDMUIXMMOUVIF', 'playfair example'], js: ['playfair', 'decrypt', { text: 'BMODZBXDNABEKUDMUIXMMOUVIF', key: 'playfair example' }] },
    { args: ['encrypt', 'Jazz XX x', 'keyword'], js: ['playfair', 'encrypt', { text: 'Jazz XX x', key: 'keyword' }] },
  ] },
  { dir: 'railfence', cases: [
    { args: [], js: ['railfence', 'encrypt', { text: 'WEAREDISCOVEREDFLEEATONCE', rails: 3 }] },
    { args: ['encrypt', 'Rail fence with spaces & symbols!', '4'], js: ['railfence', 'encrypt', { text: 'Rail fence with spaces & symbols!', rails: 4 }] },
    { args: ['decrypt', 'WECRLTEERDSOEEFEAOCAIVDEN', '3'], js: ['railfence', 'decrypt', { text: 'WECRLTEERDSOEEFEAOCAIVDEN', rails: 3 }] },
    { args: ['encrypt', 'नमस्ते 🔐 hi', '3'], js: ['railfence', 'encrypt', { text: 'नमस्ते 🔐 hi', rails: 3 }] },
  ] },
  { dir: 'hill', cases: [
    { args: [], js: ['hill', 'encrypt', { text: 'HELP', key: '3 3 2 5' }] },
    { args: ['encrypt', 'short example', 'HILL'], js: ['hill', 'encrypt', { text: 'short example', key: 'HILL' }] },
    { args: ['decrypt', 'HIAT', '3 3 2 5'], js: ['hill', 'decrypt', { text: 'HIAT', key: '3 3 2 5' }] },
    { reject: true, args: ['encrypt', 'HELP', '2 4 6 8'], js: ['hill', 'encrypt', { text: 'HELP', key: '2 4 6 8' }], note: 'singular key rejected' },
    { args: ['encrypt', 'odd', '26000000000000000000000003 3 -24 5'], js: ['hill', 'encrypt', { text: 'odd', key: '26000000000000000000000003 3 -24 5' }] },
  ] },
  { dir: 'aes128', cases: [
    { args: [], js: ['aes', 'encrypt', { format: 'hex', block: B.pt, keyFormat: 'hex', key: B.key }], note: 'FIPS-197 App. B' },
    { ...hexAes('encrypt', C1.pt, C1.key), note: 'FIPS-197 App. C.1' },
    { ...hexAes('decrypt', C1.ct, C1.key), note: 'FIPS-197 App. C.1 inverse' },
    { args: ['encrypt', 'Two One Nine Two', 'Thats my Kung Fu', '--format', 'text', '--key-format', 'text'], js: ['aes', 'encrypt', { format: 'text', block: 'Two One Nine Two', keyFormat: 'text', key: 'Thats my Kung Fu' }] },
    { args: ['decrypt', '29c3505f571420f6402299b31a02d73a', 'Thats my Kung Fu', '--format', 'text', '--key-format', 'text'], js: ['aes', 'decrypt', { format: 'text', block: '29c3505f571420f6402299b31a02d73a', keyFormat: 'text', key: 'Thats my Kung Fu' }] },
    { args: ['encrypt', 'hé', B.key, '--format', 'text'], js: ['aes', 'encrypt', { format: 'text', block: 'hé', keyFormat: 'hex', key: B.key }] },
    { args: ['decrypt', pkcsCt, C1.key, '--format', 'text', '--padding', 'pkcs7'], js: ['aes', 'decrypt', { format: 'text', block: pkcsCt, keyFormat: 'hex', key: C1.key, padding: 'pkcs7' }], note: 'PKCS#7 keeps trailing 00' },
    { args: ['decrypt', C1.ct, C1.key, '--format', 'text'], js: ['aes', 'decrypt', { format: 'text', block: C1.ct, keyFormat: 'hex', key: C1.key }], note: 'not UTF-8 → hex' },
  ] },
  { dir: 'aes128', prog: 'aes128_lib', pythonOnly: true, label: 'aes128 (library route)', cases: [
    { args: [], js: ['aes', 'encrypt', { format: 'hex', block: B.pt, keyFormat: 'hex', key: B.key }] },
    hexAes('encrypt', C1.pt, C1.key),
    hexAes('decrypt', C1.ct, C1.key),
  ] },
  { dir: 'rsa', cases: [
    { args: [], js: ['rsa', 'encrypt', { p: 61, q: 53, e: 17, format: 'text', message: 'HI' }] },
    { args: ['encrypt', '61', '53', '17', 'numbers', '65'], js: ['rsa', 'encrypt', { p: 61, q: 53, e: 17, format: 'numbers', message: '65' }] },
    { args: ['decrypt', '61', '53', '17', 'numbers', '2790'], js: ['rsa', 'decrypt', { p: 61, q: 53, e: 17, format: 'numbers', message: '2790' }] },
    { args: ['encrypt', '61', '53', '17', 'text', 'Hello RSA!'], js: ['rsa', 'encrypt', { p: 61, q: 53, e: 17, format: 'text', message: 'Hello RSA!' }] },
    { args: ['decrypt', '61', '53', '17', 'text', rsaEnc], js: ['rsa', 'decrypt', { p: 61, q: 53, e: 17, format: 'text', message: rsaEnc }] },
    { args: ['encrypt', '9999991', '9999973', '65537', 'text', 'Hé🔐'], js: ['rsa', 'encrypt', { p: 9999991, q: 9999973, e: 65537, format: 'text', message: 'Hé🔐' }] },
  ] },
  { dir: 'diffiehellman', cases: [
    { args: [], js: ['diffiehellman', 'exchange', { p: 23, g: 5, a: 4, b: 3 }] },
    { args: ['467', '2', '153', '197'], js: ['diffiehellman', 'exchange', { p: 467, g: 2, a: 153, b: 197 }] },
    { args: ['23', '2', '4', '3'], js: ['diffiehellman', 'exchange', { p: 23, g: 2, a: 4, b: 3 }] },
    { reject: true, args: ['23', '5', '1', '3'], js: ['diffiehellman', 'exchange', { p: 23, g: 5, a: 1, b: 3 }], note: 'a = 1 rejected' },
    { reject: true, args: ['23', '22', '4', '3'], js: ['diffiehellman', 'exchange', { p: 23, g: 22, a: 4, b: 3 }], note: 'g = p − 1 rejected' },
    { reject: true, args: ['23', '2', '11', '3'], js: ['diffiehellman', 'exchange', { p: 23, g: 2, a: 11, b: 3 }], note: 'A = 1 rejected' },
    { args: ['999999937', '5', '123456789', '987654321'], js: ['diffiehellman', 'exchange', { p: 999999937, g: 5, a: 123456789, b: 987654321 }] },
  ] },
  { dir: 'sha256', cases: [
    { args: [], js: ['sha256', 'hash', { text: 'abc' }], expect: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
    { args: [''], js: ['sha256', 'hash', { text: '' }], expect: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    { args: ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'], js: ['sha256', 'hash', { text: 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq' }], expect: '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1' },
    { args: ['नमस्ते 🔐'], js: ['sha256', 'hash', { text: 'नमस्ते 🔐' }] },
    { args: ['a'.repeat(200)], js: ['sha256', 'hash', { text: 'a'.repeat(200) }] },
  ] },
  { dir: 'sha256', prog: 'sha256_lib', pythonOnly: true, label: 'sha256 (hashlib route)', cases: [
    { args: [], js: ['sha256', 'hash', { text: 'abc' }] },
    { args: [''], js: ['sha256', 'hash', { text: '' }] },
    { args: ['नमस्ते 🔐'], js: ['sha256', 'hash', { text: 'नमस्ते 🔐' }] },
  ] },
  { dir: 'base64', cases: [
    { args: [], js: ['base64', 'encode', { text: 'Man' }] },
    { args: ['encode', 'Hello, नमस्ते 🔐'], js: ['base64', 'encode', { text: 'Hello, नमस्ते 🔐' }] },
    { args: ['encode', ''], js: ['base64', 'encode', { text: '' }] },
    { args: ['decode', 'TWFu'], js: ['base64', 'decode', { text: 'TWFu' }] },
    { args: ['decode', '77u/aGk='], js: ['base64', 'decode', { text: '77u/aGk=' }], note: 'BOM kept' },
    { args: ['decode', 'abc'], js: ['base64', 'decode', { text: 'abc' }], note: 'not UTF-8 → hex' },
    { args: ['decode', '-_8'], js: ['base64', 'decode', { text: '-_8' }], note: 'base64url, no padding' },
  ] },
];

function hasCmd(cmd, args) { return spawnSync(cmd, args, { stdio: 'ignore' }).status === 0; }
const haveGpp = hasCmd('g++', ['--version']);
const havePy = hasCmd('python3', ['--version']);
const haveCryptography = havePy && hasCmd('python3', ['-c', 'import cryptography']);
const build = mkdtempSync(join(tmpdir(), 'kryptonite-code-'));

const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  return { ok: r.status === 0, out: (r.stdout || '').replace(/\n$/, ''), err: (r.stderr || '').trim() };
};

const rows = [];
let failures = 0;
for (const s of suites) {
  const prog = s.prog || s.dir;
  const cwd = join(here, s.dir);
  const label = s.label || s.dir;
  const result = { label, python: 'pass', cpp: s.pythonOnly ? 'n/a' : 'pass', cases: s.cases.length };
  let exe = null;
  if (!s.pythonOnly) {
    if (!haveGpp) result.cpp = 'SKIP (no g++)';
    else {
      exe = join(build, prog);
      try { execFileSync('g++', ['-std=c++17', '-O2', '-Wall', '-Wextra', '-o', exe, join(cwd, `${prog}.cpp`)], { stdio: 'pipe' }); }
      catch (e) { result.cpp = 'FAIL (compile)'; console.error(String(e.stderr)); failures++; exe = null; }
    }
  }
  if (!havePy) result.python = 'SKIP (no python3)';
  if (prog === 'aes128_lib' && !haveCryptography) result.python = 'SKIP (pip install cryptography)';
  for (const c of s.cases) {
    if (c.reject) {
      // Kryptonite must refuse these inputs (validation or a thrown error), and so must both programs.
      const m = byId[c.js[0]];
      const v = validate(m, c.js[1], c.js[2]);
      let jsRejects = Boolean(Object.keys(v.fieldErrors).length || v.formError);
      if (!jsRejects) { try { runAction(m, c.js[1], c.js[2]); } catch { jsRejects = true; } }
      if (!jsRejects) { console.error(`JS accepted a reject case: ${label} ${c.args}`); failures++; }
      if (result.python === 'pass' && run('python3', [`${prog}.py`, ...c.args], cwd).ok) { result.python = 'FAIL'; failures++; console.error(`✗ ${label} python should reject ${JSON.stringify(c.args)}`); }
      if (exe && result.cpp === 'pass' && run(exe, c.args, cwd).ok) { result.cpp = 'FAIL'; failures++; console.error(`✗ ${label} c++ should reject ${JSON.stringify(c.args)}`); }
      continue;
    }
    const expected = js(...c.js);
    if (c.expect !== undefined && c.expect !== expected) { console.error(`JS mismatch with published vector: ${label} ${c.args}`); failures++; }
    if (result.python === 'pass') {
      const r = run('python3', [`${prog}.py`, ...c.args], cwd);
      if (!r.ok || r.out !== expected) { result.python = 'FAIL'; failures++; console.error(`✗ ${label} python ${JSON.stringify(c.args)}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(r.out)} ${r.err}`); }
    }
    if (exe && result.cpp === 'pass') {
      const r = run(exe, c.args, cwd);
      if (!r.ok || r.out !== expected) { result.cpp = 'FAIL'; failures++; console.error(`✗ ${label} c++ ${JSON.stringify(c.args)}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(r.out)} ${r.err}`); }
    }
  }
  rows.push(result);
}
rmSync(build, { recursive: true, force: true });

// manifest.json must describe the same sample run that the programs print.
const { readFileSync } = await import('node:fs');
const manifest = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8'));
for (const m of methods) {
  const entry = manifest[m.id];
  if (!entry) { console.error(`manifest.json has no entry for ${m.id}`); failures++; continue; }
  for (const lang of ['python', 'cpp', 'pythonLibrary']) {
    const e = entry[lang];
    if (!e) continue;
    const { action, ...values } = e.sampleInput;
    const out = runAction(m, action, values).output;
    if (out !== e.expectedOutput) { console.error(`manifest ${m.id}.${lang}.expectedOutput is stale`); failures++; }
    if (!existsSync(join(here, e.file))) { console.error(`manifest ${m.id}.${lang}.file missing: ${e.file}`); failures++; }
  }
}
console.log(failures ? '' : 'manifest.json: all 10 methods present, files exist, expectedOutput matches.');

console.log('| Method | Cases | Python | C++ |');
console.log('|---|---|---|---|');
for (const r of rows) console.log(`| ${r.label} | ${r.cases} | ${r.python} | ${r.cpp} |`);
console.log(failures ? `\n${failures} failure(s)` : '\nAll programs match the JavaScript methods.');
process.exit(failures ? 1 : 0);

// Tests for the UI logic added on the ui-animations branch (pure modules only; Node has no DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parseHash, methodHash, TABS } from '../core/router.js';
import { Scope } from '../core/lifecycle.js';
import { StepPlayer } from '../core/player.js';
import { copyableOutput, copyText } from '../core/clipboard.js';
import { groupMethods, groupOf, slugify } from '../core/groups.js';
import { tokenize, toLines } from '../core/highlight.js';
import { entriesFor, normalizeEntry, methodInfo, sourceUrl, looksLikeCommand, LANGS } from '../core/code-manifest.js';
import { playfairFillers, period, keyProgress, hexDiff, registerRows, hillRows, railFocus } from '../visuals/teach.js';
import { teachContext, extraVisuals } from '../visuals/enhance.js';
import { explanationModel } from '../core/explain.js';
import { examplesModel } from '../core/examples.js';
import { methods, categoryOrder } from '../registry.js';
import { runAction, defaultValues, getActions } from '../core/contract.js';

const ids = methods.map((m) => m.id);
const byId = (id) => methods.find((m) => m.id === id);
const steps = (id, action, values) => { const m = byId(id); return runAction(m, action, values || defaultValues(m)).steps; };

test('router: skip-link anchor is not a route; tabs and actions are deep-linkable', () => {
  assert.deepEqual(parseHash('#main', ids), { view: 'anchor', anchor: 'main' });
  assert.equal(parseHash('', ids).view, 'home');
  assert.deepEqual(parseHash('#/c/classical-ciphers', ids), { view: 'home', category: 'classical-ciphers' });
  assert.deepEqual(parseHash('#/aes/code', ids), { view: 'method', id: 'aes', tab: 'code', action: null });
  assert.deepEqual(parseHash('#/caesar/bogus?a=decrypt', ids), { view: 'method', id: 'caesar', tab: 'visualizer', action: 'decrypt' });
  assert.equal(parseHash('#/nope', ids).notFound, 'nope');
  for (const tab of TABS) assert.deepEqual(parseHash(methodHash('rsa', { tab, action: 'decrypt' }), ids), { view: 'method', id: 'rsa', tab, action: 'decrypt' });
  assert.equal(methodHash('aes'), '#/aes');
});

test('Scope: dispose cancels pending timers and runs cleanups; late callbacks are ignored', async () => {
  const s = new Scope('t');
  let fired = 0, cleaned = 0;
  s.setTimeout(() => fired++, 5);
  s.setInterval(() => fired++, 5);
  s.add(() => cleaned++);
  const late = s.guard(() => fired++);
  s.dispose();
  late();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(fired, 0);
  assert.equal(cleaned, 1);
  assert.equal(s.alive, false);
  assert.equal(s.signal.aborted, true);
  s.add(() => cleaned++); // adding after dispose runs immediately
  assert.equal(cleaned, 2);
  assert.equal(s.setTimeout(() => fired++, 1), null);
});

test('player: pause keeps the step and Play resumes the remaining time; navigation drops the resume point', () => {
  let t = 0;
  const events = [];
  const p = new StepPlayer({ baseDelay: 1000, now: () => t, onPause: () => events.push('pause'), onResume: () => events.push('resume') });
  p.load([1, 2, 3, 4]);
  p.play();
  assert.equal(p.index, 1);
  t = 400;
  p.pause();
  assert.equal(p.index, 1, 'pause does not advance');
  assert.equal(p.resumable, true);
  assert.equal(p.resumeIn, 600);
  p.play();
  assert.equal(p.index, 1, 'resume continues the same step');
  assert.deepEqual(events, ['pause', 'resume']);
  p.pause();
  p.go(3);
  assert.equal(p.resumable, false);
  p.dispose();
});

test('copy: errors and empty output are never copyable; copyText reports failure instead of throwing', async () => {
  assert.equal(copyableOutput({ raw: 'Determinant 18 is not invertible', isError: true }), null);
  assert.equal(copyableOutput({ raw: '', isError: false }), null);
  assert.equal(copyableOutput({ raw: null, isError: false }), null);
  assert.equal(copyableOutput({ raw: 'KHOOR', isError: false }), 'KHOOR');
  assert.deepEqual(await copyText('', null), { ok: false, method: 'none', reason: 'Nothing to copy' });
  const r = await copyText('x', null);
  assert.equal(r.ok, false);
  assert.match(r.reason, /copy/i);
});

test('sidebar groups: counts come from the registry (10 = 5 + 3 + 2) and unknown categories get a group', () => {
  const g = groupMethods(methods, categoryOrder);
  assert.deepEqual(g.map((x) => [x.name, x.methods.length]), [['Classical Ciphers', 5], ['Modern Cryptography', 3], ['Hashing & Encoding', 2]]);
  assert.equal(g.reduce((a, x) => a + x.methods.length, 0), methods.length);
  assert.equal(groupOf(g, 'aes').slug, 'modern-cryptography');
  const extra = groupMethods([...methods, { id: 'zz', category: 'Post-Quantum' }], categoryOrder);
  assert.equal(extra.at(-1).slug, 'post-quantum');
  assert.equal(slugify('Hashing & Encoding'), 'hashing-encoding');
});

test('highlighter: tokens reproduce the source exactly and classify keywords, strings and comments', () => {
  const py = readFileSync(new URL('./fixtures/code/demo/demo.py', import.meta.url), 'utf8');
  const cpp = readFileSync(new URL('./fixtures/code/demo/demo.cpp', import.meta.url), 'utf8');
  for (const [src, lang] of [[py, 'python'], [cpp, 'cpp']]) assert.equal(tokenize(src, lang).map((t) => t.v).join(''), src);
  const types = (src, lang) => tokenize(src, lang).map((t) => t.t);
  assert.ok(types('def f(): return "s" # c', 'python').includes('kw'));
  assert.ok(types('def f(): return "s" # c', 'python').includes('str'));
  assert.ok(types('def f(): return "s" # c', 'python').includes('com'));
  assert.ok(types('#include <x>\nint a = 1; // c', 'cpp').includes('pre'));
  assert.equal(toLines(tokenize(py, 'python')).length, py.split('\n').length);
});

test('code manifest: fixture shapes are normalised; broken and escaping entries are rejected', () => {
  const m = JSON.parse(readFileSync(new URL('./fixtures/code/manifest.json', import.meta.url), 'utf8'));
  const e = entriesFor(m, 'demo');
  assert.deepEqual(Object.keys(e).sort(), ['cpp', 'python']);
  assert.deepEqual(e.python.deps, ['pycryptodome >=3.20']);
  assert.deepEqual(e.python.install, ['pip install pycryptodome']);
  assert.deepEqual(e.python.notes, [{ fn: null, what: 'Upper-cases the input.' }]);
  assert.deepEqual(e.cpp.run, ['g++ -std=c++17 demo.cpp -o demo', './demo']);
  assert.deepEqual(e.cpp.sampleFields, [['text', 'hello'], ['n', '3']]);
  assert.deepEqual(e.cpp.notes, [{ fn: 'main', what: 'reads stdin' }, { fn: null, what: 'free text' }]);
  assert.equal(sourceUrl(e.cpp.file, 'tests/fixtures/code/'), 'tests/fixtures/code/demo/demo.cpp');
  assert.deepEqual(entriesFor(m, 'broken'), {});
  assert.equal(sourceUrl(entriesFor(m, 'escape').python.file), null);
  assert.equal(sourceUrl('https://evil/x.py'), null);
  assert.equal(normalizeEntry({}), null);
  assert.equal(methodInfo(m, 'demo').warning, 'Fixture only.');
  assert.equal(looksLikeCommand('g++ -std=c++17 a.cpp'), true);
  assert.equal(looksLikeCommand('none (standard library only)'), false);
  assert.equal(looksLikeCommand('pip install cryptography'), true);
});

test('code manifest: every registered method has Python and C++ entries whose files exist (real manifest)', () => {
  const m = JSON.parse(readFileSync(new URL('../code/manifest.json', import.meta.url), 'utf8'));
  for (const id of ids) {
    const e = entriesFor(m, id);
    for (const lang of LANGS.filter((l) => !l.optional)) {
      assert.ok(e[lang.id], `${id} ${lang.id}`);
      assert.ok(existsSync(new URL('../' + sourceUrl(e[lang.id].file), import.meta.url)), `${id} ${lang.id} file ${e[lang.id].file}`);
    }
    for (const n of Object.values(e).flatMap((x) => x.notes)) assert.ok(n.what, `${id} note text`);
  }
  assert.ok(entriesFor(m, 'aes').pylib, 'AES has the optional library entry');
  assert.ok(entriesFor(m, 'sha256').pylib, 'SHA-256 has the optional library entry');
});

test('teach helpers: Vigenère key progress, Playfair fillers, hex diffs, Rail Fence focus', () => {
  assert.equal(period([...'LEMONLEMONLEM']), 5);
  const kp = keyProgress([...'LEMONLE'], 6, null);
  assert.deepEqual(kp, { keyword: [...'LEMON'], pos: 1, count: 7 });
  assert.deepEqual(keyProgress([], 0, { keyIndex: 2, keyLength: 5, letterNumber: 7 }, 'LEMON'), { keyword: [...'LEMON'], pos: 2, count: 8 });
  assert.deepEqual(playfairFillers(['HI', 'DE', 'TH', 'EG', 'OL', 'DI', 'NT', 'HE', 'TR', 'EX', 'ES', 'TU', 'MP'], 'Hide the gold in the tree stump')[9], [false, true]);
  assert.deepEqual(hexDiff('6a09e667', '6a09e668'), [false, false, false, false, false, false, false, true]);
  assert.deepEqual(railFocus({ meta: { focus: { col: 5 }, active: [{ col: 3 }, { col: 4 }, { col: 5 }] } }), { first: 3, last: 5 });
  assert.deepEqual(railFocus(null, { active: [[0, 2], [1, 7]] }), { first: 2, last: 7 });
  assert.equal(railFocus(null, {}), null);
});

test('Hill rows: method meta.rows match the matrix-derived rows (row × vector, sum, mod 26)', () => {
  const st = steps('hill', 'encrypt');
  const block = st.find((s) => s.meta && Array.isArray(s.meta.rows));
  assert.ok(block, 'hill emits meta.rows');
  const mx = [].concat(block.visual).find((v) => v.type === 'matrix');
  const fromMeta = hillRows(block, mx.data.items);
  const derived = hillRows({}, mx.data.items);
  assert.deepEqual(fromMeta.map((r) => [r.products, r.sum, r.mod]), derived.map((r) => [r.products, r.sum, r.mod]));
  for (const r of fromMeta) assert.equal(r.mod, r.sum % 26);
  assert.equal(hillRows({}, [{ kind: 'matrix', values: [[1, 2], [3, 4]] }, { kind: 'matrix', values: [[1, 2], [3, 4]] }, { kind: 'matrix', values: [[1]] }]), null, 'not a matrix × vector step');
});

test('SHA-256 register rows and Playfair/Vigenère teach context use the method step data', () => {
  const sha = steps('sha256', getActions(byId('sha256'))[0].id);
  const all = sha.find((s) => s.meta && Array.isArray(s.meta.registers));
  if (all) { const rows = registerRows(all, []); assert.equal(rows.length, 64); assert.equal(rows[0].length, 9); }
  const sel = sha.find((s) => s.meta && Array.isArray(s.meta.rounds));
  assert.ok(sel && sel.meta.rounds[0].before && sel.meta.rounds[0].after, 'selected rounds carry before/after');
  const pf = steps('playfair', 'encrypt', { ...defaultValues(byId('playfair')), text: 'Hide the gold in the tree stump' });
  const ex = pf.find((s) => /^EX/.test(s.title));
  const ctx = teachContext('playfair', 'encrypt', { text: 'Hide the gold in the tree stump' }, ex, pf);
  assert.deepEqual(ctx.fillers[9], [false, true]);
  assert.deepEqual(ctx.activeFillers, [false, true]);
  const vg = steps('vigenere', 'encrypt');
  assert.equal(typeof teachContext('vigenere', 'encrypt', {}, vg[1], vg).keyword, 'string');
});

test('RSA square-and-multiply table uses string values (never Number) and ends at the step result', () => {
  const st = steps('rsa', 'encrypt');
  const blk = st.find((s) => s.meta && s.meta.modPow);
  const [v] = extraVisuals('rsa', blk);
  assert.equal(v.type, 'table');
  assert.equal(v.data.rows.length, blk.meta.modPow.progress.length);
  assert.equal(v.data.rows.at(-1)[3], String(blk.meta.modPow.result));
  assert.ok(v.data.rows.flat().every((c) => typeof c === 'string'));
  assert.deepEqual(extraVisuals('caesar', st[0]), []);
});

test('Explanation and Examples are built from the methods themselves and every example round-trips', () => {
  for (const m of methods) {
    const e = explanationModel(m);
    assert.ok(e.description);
    assert.ok(e.runs.length >= 1 && e.runs.every((r) => r.steps.length));
    const xs = examplesModel(m);
    assert.ok(xs.length >= 1, m.id);
    for (const x of xs) assert.equal(runAction(m, x.action.id, x.values).output, x.output, `${m.id} ${x.label}`);
  }
});

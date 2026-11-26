import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../core/code-runner.js';

test('parseArgs splits on whitespace and keeps quoted strings', () => {
  assert.deepEqual(parseArgs(''), []);
  assert.deepEqual(parseArgs('  encrypt   Hello  7 '), ['encrypt', 'Hello', '7']);
  assert.deepEqual(parseArgs('encrypt "Attack at dawn" 3'), ['encrypt', 'Attack at dawn', '3']);
  assert.deepEqual(parseArgs("decrypt 'Dwwdfn dw gdzq' 3"), ['decrypt', 'Dwwdfn dw gdzq', '3']);
  assert.deepEqual(parseArgs('encrypt "say \\"hi\\"" 3'), ['encrypt', 'say "hi"', '3']);
});

test('Caesar no longer exposes a brute-force attack action', async () => {
  const { default: caesar } = await import('../methods/caesar.js');
  const { getActions } = await import('../core/contract.js');
  assert.equal(typeof caesar.attack, 'undefined');
  assert.deepEqual(getActions(caesar).map((a) => a.id), ['encrypt', 'decrypt']);
});

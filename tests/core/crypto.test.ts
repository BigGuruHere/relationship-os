// tests/core/crypto.test.ts
// PURPOSE: Protect Relish's encryption and deterministic lookup invariants before Core identity refactors begin.

import assert from 'node:assert/strict';
import test from 'node:test';

// IT: crypto.ts validates the master key when imported, so set a deterministic test-only key first.
process.env.SECRET_MASTER_KEY = '11'.repeat(32);

const cryptoModule = await import('../../src/lib/crypto.ts');
const { buildIndexToken, buildIndexTokenBytes, buildScopedIndexToken, decrypt, encrypt } = cryptoModule;

test('AES-GCM round trip returns the original plaintext with matching AAD', () => {
  const plaintext = 'Sensitive relationship information';
  const encrypted = encrypt(plaintext, 'test.field');
  assert.equal(decrypt(encrypted, 'test.field'), plaintext);
});

test('AES-GCM uses a fresh IV so identical plaintext does not produce identical ciphertext', () => {
  const first = encrypt('same value', 'test.field');
  const second = encrypt('same value', 'test.field');
  assert.notEqual(first, second);
});

test('deterministic indexes normalise equivalent values consistently', () => {
  assert.equal(buildIndexToken('  Person@Example.COM '), buildIndexToken('person@example.com'));
});

test('scoped deterministic indexes do not correlate the same value across scopes', () => {
  const value = 'person@example.com';
  const contact = buildIndexTokenBytes(value, 'contact:email').toString('hex');
  const user = buildIndexTokenBytes(value, 'user:email').toString('hex');
  assert.notEqual(contact, user);
});

test('tampered ciphertext fails authentication instead of returning plaintext', () => {
  const encrypted = encrypt('do not silently corrupt', 'test.field');
  const [iv, ciphertext, tag] = encrypted.split(':');
  const bytes = Buffer.from(ciphertext, 'base64');
  bytes[0] = bytes[0] ^ 1;
  const tampered = `${iv}:${bytes.toString('base64')}:${tag}`;
  assert.throws(() => decrypt(tampered, 'test.field'));
});

test('wrong AAD fails authentication', () => {
  const encrypted = encrypt('scoped secret', 'correct.scope');
  assert.throws(() => decrypt(encrypted, 'wrong.scope'));
});


test('scoped deterministic hex indexes are stable within a field and separated across fields', () => {
  const value = 'Same private statement';
  assert.equal(buildScopedIndexToken(value, 'knowledge:claim:statement'), buildScopedIndexToken('  same private statement  ', 'knowledge:claim:statement'));
  assert.notEqual(buildScopedIndexToken(value, 'knowledge:claim:statement'), buildScopedIndexToken(value, 'other:field'));
});

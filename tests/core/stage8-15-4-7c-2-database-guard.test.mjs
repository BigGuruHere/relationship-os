// Static safety regression checks for the opt-in real database test script.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const script = readFileSync(new URL('../../scripts/check-stage8-15-4-7c-2-phone-db.ts', import.meta.url), 'utf8');
test('database verification requires two explicit development guards', () => {
  assert.match(script, /ALLOW_RELISH_PHONE_DEV_DB_TEST !== 'YES'/);
  assert.match(script, /RELISH_DB_ENV !== 'development'/);
  assert.match(script, /NODE_ENV === 'production'/);
});
test('database test cleans up only its created sessions', () => {
  assert.match(script, /created\.push\(/);
  assert.match(script, /finally \{/);
  assert.match(script, /networkDorianSession\.deleteMany\(\{ where: \{ id: \{ in: created \} \} \}\)/);
  assert.doesNotMatch(script, /networkPhoneCaller\.delete/);
});
test('database test verifies actual PostgreSQL uniqueness and custody', () => {
  assert.match(script, /Promise\.allSettled/);
  assert.match(script, /'P2002'/);
  assert.match(script, /contextSpaceId: caller\.contextSpaceId/);
  assert.match(script, /callers\.length === 2/);
});

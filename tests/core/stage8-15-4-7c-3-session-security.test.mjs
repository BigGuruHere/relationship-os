// Structural regressions for Stage 8.15.4.7c.3 session security (not a substitute for the development database test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../src/lib/server/integrations/elevenlabs/networkSession.ts', import.meta.url), 'utf8');
const script = readFileSync(new URL('../../scripts/check-stage8-15-4-7c-3-session-security.ts', import.meta.url), 'utf8');
test('post-call session resolver rejects missing conversation IDs before claiming a session', () => {
  assert.match(source, /!input\.conversationId\.trim\(\)/);
  assert.match(source, /session\.conversationId && session\.conversationId !== input\.conversationId/);
});
test('session resolver requires exact token, valid lifetime and same binding', () => {
  assert.match(source, /networkSessionHash\(token\)/);
  assert.match(source, /session\.agentBindingId !== input\.bindingId/);
  assert.match(source, /session\.expiresAt < new Date\(\)/);
});
test('development database script requires explicit guards and cleans up test sessions', () => {
  assert.match(script, /ALLOW_RELISH_PHONE_DEV_DB_TEST !== 'YES'/);
  assert.match(script, /RELISH_DB_ENV !== 'development'/);
  assert.match(script, /created\.push\(session\.id\)/);
  assert.match(script, /finally \{/);
  assert.match(script, /networkDorianSession\.deleteMany/);
  assert.doesNotMatch(script, /networkPhoneCaller\.create|networkPhoneCaller\.delete/);
});

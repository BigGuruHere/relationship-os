// Stage 8.15.4.7d: test the actual phone initiation source contract.
// These are structural security regressions, NOT replacements for live calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../src/lib/server/integrations/elevenlabs/phoneOnboarding.ts', import.meta.url), 'utf8');

test('returning status uses ingested participant evidence instead of started sessions', () => {
  assert.match(source, /prisma\.interaction\.count\(\{ where: \{/);
  assert.match(source, /channel: PERSON_CONVERSATION_SOURCE_CHANNEL/);
  assert.match(source, /contactId: caller\.contactId/);
  assert.doesNotMatch(source, /networkDorianSession\.count/);
});
test('provisional callers do not receive saved summaries or understanding', () => {
  assert.match(source, /last_call_summary: ''/);
  assert.match(source, /memory_and_identity_context: ''/);
  assert.match(source, /user_name: ''/);
  assert.match(source, /do not supply summaries or private memory/i);
});
test('new and returning call states have separate greetings and privacy instructions', () => {
  assert.match(source, /first_message: returning/);
  assert.match(source, /welcome back to Dorian/i);
  assert.match(source, /What should I call you\?/);
  assert.match(source, /Do not assume who is speaking/);
});
test('provisional identity still requires an indexed telephone, scoped contact and unique session', () => {
  assert.match(source, /normalizePhoneForIdentity/);
  assert.match(source, /phoneIndex: idx/);
  assert.match(source, /contextSpaceId: caller\.contextSpaceId/);
  assert.match(source, /networkDorianSession\.create/);
});

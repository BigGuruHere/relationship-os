// Stage 8.15.4.7d: test the actual phone initiation source contract.
// These are structural security regressions, NOT replacements for live calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../src/lib/server/integrations/elevenlabs/phoneOnboarding.ts', import.meta.url), 'utf8');

test('returning status uses ingested participant evidence instead of started sessions', () => {
  assert.match(source, /prisma\.interaction\.count\(\{ where: \{/);
  assert.match(source, /channel: PERSON_CONVERSATION_SOURCE_CHANNEL/);
  assert.match(source, /contactId: selected\.contactId/);
  assert.doesNotMatch(source, /networkDorianSession\.count/);
});
test('private understanding is opt-in and restricted to the selected caller custody', () => {
  assert.match(source, /RELISH_PHONE_LU_CONTEXT === 'YES'/);
  assert.match(source, /phoneLivingContextEnabled\(\) && previousCalls > 0/);
  assert.match(source, /memory_and_identity_context: input.livingContext \|\| ''/);
  assert.match(source, /user_name: input.preferredName \|\| ''/);
  assert.match(source, /runWithWorkspaceCustody/);
});
test('new and returning greetings require provisional name confirmation', () => {
  assert.match(source, /first_message: returning/);
  assert.match(source, /May I ask who is calling/);
  assert.match(source, /ask for a preferred name/);
  assert.match(source, /confirm the caller/);
});
test('provisional identity still requires an indexed telephone, scoped contact and unique session', () => {
  assert.match(source, /normalizePhoneForIdentity/);
  assert.match(source, /phoneIndex: idx/);
  assert.match(source, /contextSpaceId: selected\.contextSpaceId/);
  assert.match(source, /networkDorianSession\.create/);
});

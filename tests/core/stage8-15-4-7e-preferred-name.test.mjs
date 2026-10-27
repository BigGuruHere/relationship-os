// Stage 8.15.4.7e source contract checks; live provider and DB testing remains required.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../../'+p, import.meta.url), 'utf8');
test('name tool validates provider authentication and avoids provider-selected contact IDs', () => {
  const route = read('src/routes/api/webhooks/elevenlabs/tools/save-preferred-name/+server.ts');
  assert.match(route, /ELEVENLABS_TOOL_SECRET/);
  assert.match(route, /providerAuthorised/);
  assert.doesNotMatch(route, /body\.contactId|body\.userId/);
});
test('name writes require session token, exact conversation, binding and provisional owner', () => {
  const service = read('src/lib/server/integrations/elevenlabs/preferredName.ts');
  for (const item of ['networkSessionHash(token)', 'session.conversationId !== conversationId', 'session.agentBindingId !== bindingId', 'session.expiresAt <= new Date()', 'networkPhoneCaller.findFirst', 'contact.updateMany']) assert.ok(service.includes(item), item);
});
test('name is encrypted and future calls receive a bounded provisional name', () => {
  const service = read('src/lib/server/integrations/elevenlabs/preferredName.ts');
  const onboarding = read('src/lib/server/integrations/elevenlabs/phoneOnboarding.ts');
  assert.match(service, /encrypt\(name, 'contact.full_name'\)/);
  assert.match(onboarding, /preferredName/);
  assert.match(onboarding, /May I ask who is calling/);
  assert.match(onboarding, /last_call_summary: input\.lastCallSummary \|\| ''/);
});

// Regression: phone initiation must not query a Contact without caller custody.
test('preferred-name lookup is scoped to the provisional caller workspace', () => {
  const onboarding = read('src/lib/server/integrations/elevenlabs/phoneOnboarding.ts');
  assert.doesNotMatch(onboarding, /prisma\.contact\.findUnique\(\{\s*where:\s*\{\s*id:\s*caller\.contactId/);
  assert.match(onboarding, /const nameContact = await prisma\.contact\.findFirst\(/);
  const lookup = onboarding.split('const nameContact = await prisma.contact.findFirst(')[1]?.split('select: { fullNameEnc: true }')[0];
  assert.ok(lookup, 'preferred-name query must select encrypted full name');
  for (const boundary of ['id: selected.contactId', 'userId: selected.userId', 'contextSpaceId: selected.contextSpaceId', 'linkedUserId: caller.userId']) {
    assert.ok(lookup.includes(boundary), `missing custody check: ${boundary}`);
  }
});

// Stage 8.15.4.7e.2: safe operational diagnostics for inbound tool calls.
test('preferred name tool logs redacted request, validation and outcome', () => {
  const route = read('src/routes/api/webhooks/elevenlabs/tools/save-preferred-name/+server.ts');
  for (const event of ["log('REQUEST'", "log('VALIDATE'", "log('RESPONSE'", "log('ERROR'"]) assert.ok(route.includes(event), event);
  assert.doesNotMatch(route, /console\.(?:log|info|warn|error)\([^\n]*(?:sessionToken|preferredName|authorization)/);
});

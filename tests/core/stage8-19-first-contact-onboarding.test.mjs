// Stage 8.19 - Source contracts for the mobile handoff and consent custody protections.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const src = file => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');

test('guest sees Dorian first, only one primary SMS action, and separate collapsed inviter profile', () => {
  const page = src('src/routes/u/[slug]/+page.svelte');
  const firstContact = page.split('{#if isFirstContact}')[1].split('{:else}\n<div class="container public-profile">')[0];
  assert.match(firstContact, /Meet Dorian/);
  assert.match(firstContact, /Your AI networking partner/);
  assert.match(firstContact, /Send Dorian a 'Call me' message/);
  assert.match(firstContact, /View \{ownerName\}'s profile/);
  assert.match(firstContact, /href=\{vcardUrl\} download/);
  assert.doesNotMatch(firstContact, /Connect on Relish|Stay connected on Relish|agreeTerms|shareContact/);
  assert.ok(firstContact.indexOf('Meet Dorian') < firstContact.indexOf("View {ownerName}'s profile"));
});

test('SMS is issued server-side only on button POST, signed incoming SMS still required', () => {
  const profile = src('src/routes/u/[slug]/+page.server.ts');
  const callback = src('src/lib/server/core/pilotSmsCallback.ts');
  assert.match(profile, /requestDorian: async/);
  assert.match(profile, /issuePilotSmsInvitation/);
  assert.match(callback, /randomBytes\(16\)/);
  assert.match(callback, /codeHash: sha\(code\)/);
  assert.match(callback, /Hi Dorian, call me! \(ref \$\{code\}\)/);
  assert.match(callback, /\^CALL\\s\+/); // Old invitations continue working during deployment.
  assert.match(callback, /claimed\.count !== 1/);
  assert.match(src('src/routes/api/sms/inbound/+server.ts'), /verifyTelnyxWebhook\(raw/);
});

test('voice terms acceptance requires shared-provider auth, session binding and a durable policy record', () => {
  const tool = src('src/routes/api/webhooks/elevenlabs/tools/record-policy-acceptance/+server.ts');
  const policy = src('src/lib/server/core/relishCallPolicy.ts');
  const prisma = src('prisma/schema.prisma');
  assert.match(tool, /timingSafeEqual/);
  assert.match(tool, /recordRelishVoicePolicyAcceptance/);
  assert.match(policy, /session\.conversationId !== conversationId/);
  assert.match(policy, /session\.agentBindingId !== bindingId/);
  assert.match(policy, /session\.expiresAt <= new Date\(\)/);
  assert.match(policy, /sessionId_policyVersion/);
  assert.match(policy, /input\.agreement !== true/);
  assert.match(policy, /policyVersion: policy\.version/);
  assert.match(prisma, /model RelishCallPolicyAcceptance/);
  assert.ok(existsSync(new URL('../../prisma/migrations/20261026170000_stage8_19_first_contact_policy/migration.sql', import.meta.url)));
});

test('outbound, returning inbound and browser calls use the same explicit consent gate', () => {
  const outgoing = src('src/lib/server/core/pilotSmsCallback.ts');
  const initiation = src('src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
  const webhook = src('src/routes/api/webhooks/elevenlabs/+server.ts');
  assert.match(outgoing, /withConsentGate\(projected\.dynamicVariables, policy\)/);
  assert.match(initiation, /policyInstructionForCaller\(prepared\.userId\)/);
  assert.match(initiation, /policyInstructionForCaller\(shared\.userId\)/);
  assert.match(webhook, /status: 'policy_not_accepted'/);
  assert.match(webhook, /understandingState: 'READY'/);
});

test('individual profile photos are resized and server-validated', () => {
  const editor = src('src/routes/settings/profile/+page.svelte');
  const save = src('src/routes/settings/profile/+page.server.ts');
  assert.match(editor, /canvas\.toDataURL\('image\/jpeg'/);
  assert.match(editor, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(save, /avatarAllowed/);
  assert.match(save, /avatarUrl\.length <= 320000/);
});

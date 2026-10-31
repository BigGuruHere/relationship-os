// Stage 8.22 structural tests. End-to-end integration still requires real Neon and Telnyx.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
test('direct telephone initiation dispatches notice based on server-side consent status', () => {
  const route = source('src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
  assert.match(route, /dispatchCurrentPolicySms\(\{ userId: prepared\.userId/);
  assert.match(route, /accepted: initialPolicy\.accepted/);
  assert.match(route, /policyInstructionForCaller\(prepared\.userId, smsStatus\)/);
});
test('SMS sender uses existing Relish legal page and deduplicated database dispatch', () => {
  const sender = source('src/lib/server/core/relishPolicySms.ts');
  assert.match(sender, /policy\.legalUrl/);
  assert.match(sender, /relishPolicySmsDispatch\.create/);
  assert.match(sender, /P2002/);
  assert.match(sender, /pilotSmsOptOut\.findUnique/);
  assert.match(sender, /previous\.state === 'SENT'/);
});
test('consent procedure and opening message distinguish SMS submission statuses', () => {
  const policy = source('src/lib/server/core/relishCallPolicy.ts');
  const greeting = source('src/lib/server/integrations/elevenlabs/dorianControlPlane.ts');
  const projection = source('src/lib/server/core/dorianConsentProjection.ts');
  assert.match(policy, /record_relish_policy_acceptance/);
  assert.match(policy, /Only if its status is ACCEPTED/);
  assert.match(greeting, /smsStatus === 'SENT'/);
  assert.match(greeting, /smsStatus === 'ALREADY_SENT'/);
  assert.match(projection, /relish_terms_sms_status/);
});
test('existing QR callback sends once and uses SENT status during outbound session initiation', () => {
  const callback = source('src/lib/server/core/pilotSmsCallback.ts');
  assert.match(callback, /await sendTelnyxSms\(phone,/);
  assert.match(callback, /policyInstructionForCaller\(caller\.userId, outboundSmsStatus\)/);
});
test('migration creates deduplication constraint', () => {
  const sql = source('prisma/migrations/20261031110000_stage8_22_unified_policy_sms/migration.sql');
  assert.match(sql, /CREATE UNIQUE INDEX/);
  assert.match(sql, /"userId", "policyVersion", "legalUrl"/);
});

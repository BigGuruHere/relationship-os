// Stage 8.18a - Verify that SMS callback diagnostics preserve privacy and cover all major steps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (file) => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
const callback = source('src/lib/server/core/pilotSmsCallback.ts');
const route = source('src/routes/api/sms/inbound/+server.ts');

test('the verified webhook has request correlation and reports final outcome', () => {
  assert.match(route, /randomUUID\(\)/);
  assert.match(route, /logPilotSmsCallback\('webhook\.received'/);
  assert.match(route, /logPilotSmsCallback\('webhook\.completed'/);
  assert.match(route, /logPilotSmsCallback\('webhook\.rejected'/);
  assert.match(route, /environment: locals\.env, requestId/);
});

test('a failed invitation records a stage or explicit error code', () => {
  for (const marker of [
    'ENVIRONMENT_MISMATCH', 'INVITATION_EXPIRED', 'CALLER_UNAVAILABLE',
    'TELNYX_TERMS_SMS_FAILED', 'PRIVATE_SESSION_UNAVAILABLE',
    'ELEVENLABS_HTTP_', 'PROCESSING_${processingStage}'
  ]) assert.ok(callback.includes(marker), `Missing failure diagnostic: ${marker}`);
  assert.match(callback, /status: 'FAILED', lastErrorCode: reason\.slice\(0, 60\)/);
});

test('provider handoffs emit stage diagnostics and do not print raw SMS or caller data', () => {
  for (const marker of ['terms_sms.requested', 'terms_sms.accepted', 'session.requested',
    'session.ready', 'elevenlabs.requested', 'elevenlabs.accepted', 'callback.calling']) {
    assert.ok(callback.includes(marker), `Missing phase diagnostic: ${marker}`);
  }
  assert.match(callback, /Never log SMS text, invitation codes, phone numbers/);
  assert.doesNotMatch(callback, /console\.log\(.*(phone|input\.body|codeHash|dynamicVariables)/);
  assert.doesNotMatch(route, /console\.log\(.*(raw|p\?\.text|phone_number)/);
});

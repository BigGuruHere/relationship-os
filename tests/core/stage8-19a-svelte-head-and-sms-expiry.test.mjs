// Stage 8.19a hotfix regressions: valid Svelte special-head placement and explicit SMS TTL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRequiredEnvironment } from '../../scripts/validate-required-env.mjs';
const src = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const profile = src('src/routes/u/[slug]/+page.svelte');
const sms = src('src/lib/server/core/pilotSmsCallback.ts');
const pilot = {
  DATABASE_URL: 'postgresql://fake.example/db', SECRET_MASTER_KEY: 'a'.repeat(64),
  SESSION_COOKIE_SECRET: 'b'.repeat(32), SESSION_DAYS: '30',
  LOGIN_THROTTLE_SECRET: 'c'.repeat(32), APP_ORIGIN: 'https://example.dev',
  RELISH_LEGAL_DOCUMENTS_PUBLISHED: 'YES',
  RELISH_PILOT_SMS_CALLBACK_ENABLED: 'YES', RELISH_PILOT_CONVERSATIONAL_TERMS: 'YES',
  ELEVENLABS_INITIATION_SECRET: 'init', ELEVENLABS_POST_CALL_WEBHOOK_SECRET: 'post',
  ELEVENLABS_TOOL_SECRET: 'd'.repeat(32), ELEVENLABS_API_KEY: 'key',
  ELEVENLABS_OUTBOUND_PHONE_NUMBER_ID: 'phone', ELEVENLABS_WEBHOOK_MAX_AGE_SECONDS: '1800',
  TELNYX_API_KEY: 'key', TELNYX_PUBLIC_KEY: 'key', RELISH_NETWORK_DORIAN_BINDING_ID: 'binding',
  RELISH_DORIAN_SMS_NUMBER: '+61400000000', RELISH_PILOT_TERMS_VERSION: '2026-10-27-v1',
  TELEPHONY_DEFAULT_COUNTRY: 'AU', LU_AUTO_PREPARE_AFTER_INGEST: 'YES',
  RELISH_PILOT_SMS_CODE_EXPIRY_MINUTES: '20'
};
test('public profile Svelte head is at the component root, not nested in the guest conditional', () => {
  assert.match(profile, /<svelte:head>[\s\S]*<\/svelte:head>[\s\S]*\{#if isFirstContact\}/);
  assert.match(profile, /<title>\{isFirstContact \?/);
  assert.equal((profile.match(/<svelte:head>/g)||[]).length, 1);
});
test('pilot code expiry is mandatory when phone onboarding is enabled', () => {
  assert.doesNotThrow(() => validateRequiredEnvironment(pilot));
  for (const bad of [undefined, '', '0', '-1', '1.5', 'abc', '1441', '9999999999999999']) {
    assert.throws(() => validateRequiredEnvironment({ ...pilot, RELISH_PILOT_SMS_CODE_EXPIRY_MINUTES: bad }), /RELISH_PILOT_SMS_CODE_EXPIRY_MINUTES/);
  }
  assert.doesNotThrow(() => validateRequiredEnvironment({ ...pilot, RELISH_PILOT_SMS_CODE_EXPIRY_MINUTES: '60' }));
  assert.doesNotThrow(() => validateRequiredEnvironment({ ...pilot, RELISH_PILOT_SMS_CALLBACK_ENABLED: 'NO', RELISH_PILOT_CONVERSATIONAL_TERMS: 'NO', RELISH_PILOT_SMS_CODE_EXPIRY_MINUTES: undefined }));
});
test('the code lifetime controls database expiry and visible expiry without default', () => {
  assert.doesNotMatch(sms, /const expirationMinutes = 20/);
  assert.match(sms, /const expirationMinutes = pilotSmsCodeExpiryMinutes\(\);/);
  assert.match(sms, /process\.env\.RELISH_PILOT_SMS_CODE_EXPIRY_MINUTES/);
  assert.match(sms, /expiresAt: new Date\(Date\.now\(\) \+ expirationMinutes \* 60000\)/);
  assert.match(sms, /expiresMinutes: expirationMinutes/);
  assert.match(sms, /invitation\.expiresAt < new Date\(\)/);
});

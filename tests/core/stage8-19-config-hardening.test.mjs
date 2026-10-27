// Configuration hardening regressions: never restore legacy secret aliases or weak defaults.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRequiredEnvironment } from '../../scripts/validate-required-env.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const webhook = read('../../src/routes/api/webhooks/elevenlabs/+server.ts');
const preferredName = read('../../src/routes/api/webhooks/elevenlabs/tools/save-preferred-name/+server.ts');
const acceptance = read('../../src/routes/api/webhooks/elevenlabs/tools/record-policy-acceptance/+server.ts');
const auth = read('../../src/lib/auth.ts');
const tokens = read('../../src/lib/server/tokens.ts');
const google = read('../../src/routes/auth/google/+server.ts');
const magic = read('../../src/lib/server/magic.ts');

const base = {
  DATABASE_URL: 'postgresql://fake.example/db',
  SECRET_MASTER_KEY: 'a'.repeat(64),
  SESSION_COOKIE_SECRET: 'b'.repeat(32),
  SESSION_DAYS: '30',
  LOGIN_THROTTLE_SECRET: 'c'.repeat(32),
  APP_ORIGIN: 'https://example.test'
};
const pilot = {
  ...base,
  RELISH_PILOT_SMS_CALLBACK_ENABLED: 'YES',
  RELISH_PILOT_CONVERSATIONAL_TERMS: 'YES',
  ELEVENLABS_POST_CALL_WEBHOOK_SECRET: 'postcall-secret',
  ELEVENLABS_TOOL_SECRET: 'd'.repeat(32),
  ELEVENLABS_INITIATION_SECRET: 'init-secret',
  ELEVENLABS_API_KEY: 'api-key',
  ELEVENLABS_OUTBOUND_PHONE_NUMBER_ID: 'phoneid',
  TELNYX_API_KEY: 'key',
  TELNYX_PUBLIC_KEY: 'public',
  RELISH_NETWORK_DORIAN_BINDING_ID: 'binding',
  RELISH_DORIAN_SMS_NUMBER: '+61400000000',
  RELISH_PILOT_TERMS_VERSION: '2026.10',
  RELISH_PILOT_TERMS_URL: 'https://example.test/terms',
  RELISH_PILOT_PRIVACY_URL: 'https://example.test/privacy',
  TELEPHONY_DEFAULT_COUNTRY: 'AU',
  ELEVENLABS_WEBHOOK_MAX_AGE_SECONDS: '1800',
  LU_AUTO_PREPARE_AFTER_INGEST: 'YES'
};

test('base startup requires session keys and never falls back to development secrets', () => {
  assert.doesNotThrow(() => validateRequiredEnvironment(base));
  assert.throws(() => validateRequiredEnvironment({ ...base, SESSION_COOKIE_SECRET: '' }), /SESSION_COOKIE_SECRET/);
  assert.throws(() => validateRequiredEnvironment({ ...base, SESSION_DAYS: undefined }), /SESSION_DAYS/);
  assert.doesNotMatch(auth, /'dev-secret'/);
  assert.doesNotMatch(tokens, /'change-me'/);
  assert.doesNotMatch(magic, /http:\/\/localhost:5173/);
  assert.doesNotMatch(google, /http:\/\/localhost:5173\/auth\/google\/callback/);
});

test('pilot startup requires renamed secrets and does not accept old keys', () => {
  assert.doesNotThrow(() => validateRequiredEnvironment(pilot));
  const { ELEVENLABS_POST_CALL_WEBHOOK_SECRET: _post, ELEVENLABS_TOOL_SECRET: _tool, ...withoutNewNames } = pilot;
  assert.throws(() => validateRequiredEnvironment({
    ...withoutNewNames,
    ELEVENLABS_WEBHOOK_SECRET: 'old-signing-key',
    RELISH_ELEVENLABS_TOOL_SECRET: 'old-tool-key'
  }), /ELEVENLABS_POST_CALL_WEBHOOK_SECRET.*ELEVENLABS_TOOL_SECRET/);
  assert.doesNotMatch(webhook, /process\.env\.POST_CALL_WEBHOOK_SECRET|process\.env\.ELEVENLABS_WEBHOOK_SECRET/);
  assert.match(webhook, /requiredEnv\('ELEVENLABS_POST_CALL_WEBHOOK_SECRET'\)/);
  assert.match(preferredName, /requiredEnv\('ELEVENLABS_TOOL_SECRET', 24\)/);
  assert.match(acceptance, /requiredEnv\('ELEVENLABS_TOOL_SECRET', 24\)/);
});

test('missing or invalid pilot config names exact required settings without printing values', () => {
  assert.throws(() => validateRequiredEnvironment({ ...pilot, ELEVENLABS_INITIATION_SECRET: undefined }), /ELEVENLABS_INITIATION_SECRET/);
  assert.throws(() => validateRequiredEnvironment({ ...pilot, RELISH_PILOT_TERMS_URL: 'http://example.test/terms' }), /RELISH_PILOT_TERMS_URL must use HTTPS/);
  assert.throws(() => validateRequiredEnvironment({ ...pilot, RELISH_PILOT_CONVERSATIONAL_TERMS: 'NO' }), /RELISH_PILOT_CONVERSATIONAL_TERMS/);
  assert.throws(() => validateRequiredEnvironment({ ...pilot, ELEVENLABS_TOOL_SECRET: 'short' }), /ELEVENLABS_TOOL_SECRET/);
  assert.doesNotThrow(() => validateRequiredEnvironment({ ...base, RELISH_PILOT_SMS_CALLBACK_ENABLED: 'NO' }));
});

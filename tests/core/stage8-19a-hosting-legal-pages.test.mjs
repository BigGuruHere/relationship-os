// Stage 8.19a: one policy SMS URL, deployed from git, with fail-closed config.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { validateRequiredEnvironment } from '../../scripts/validate-required-env.mjs';
const source = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const root = new URL('../../', import.meta.url);
const valid = {
  DATABASE_URL: 'postgresql://fake.example/db', SECRET_MASTER_KEY: 'a'.repeat(64),
  SESSION_COOKIE_SECRET: 'b'.repeat(32), SESSION_DAYS: '30',
  LOGIN_THROTTLE_SECRET: 'c'.repeat(32), APP_ORIGIN: 'https://example.dev',
  RELISH_LEGAL_DOCUMENTS_PUBLISHED: 'YES',
  RELISH_PILOT_SMS_CALLBACK_ENABLED: 'YES', RELISH_PILOT_CONVERSATIONAL_TERMS: 'YES',
  ELEVENLABS_INITIATION_SECRET: 'init', ELEVENLABS_POST_CALL_WEBHOOK_SECRET: 'post',
  ELEVENLABS_TOOL_SECRET: 'd'.repeat(32), ELEVENLABS_API_KEY: 'key',
  ELEVENLABS_OUTBOUND_PHONE_NUMBER_ID: 'phone', ELEVENLABS_WEBHOOK_MAX_AGE_SECONDS: '1800',
  RELISH_PILOT_SMS_CODE_EXPIRY_MINUTES: '20',
  TELNYX_API_KEY: 'key', TELNYX_PUBLIC_KEY: 'key', RELISH_NETWORK_DORIAN_BINDING_ID: 'binding',
  RELISH_DORIAN_SMS_NUMBER: '+61400000000', RELISH_PILOT_TERMS_VERSION: '2026-10-27-v1',
  TELEPHONY_DEFAULT_COUNTRY: 'AU', LU_AUTO_PREPARE_AFTER_INGEST: 'YES'
};

test('legal page base uses the existing APP_ORIGIN and rejects legacy HOSTING_URL', () => {
  assert.doesNotThrow(() => validateRequiredEnvironment(valid));
  assert.throws(() => validateRequiredEnvironment({ ...valid, APP_ORIGIN: undefined }), /APP_ORIGIN/);
  assert.throws(() => validateRequiredEnvironment({ ...valid, APP_ORIGIN: 'http://localhost:8080' }), /APP_ORIGIN must use HTTPS/);
  assert.throws(() => validateRequiredEnvironment({ ...valid, APP_ORIGIN: 'https://example.dev/misleading-path' }), /APP_ORIGIN must be a public HTTPS origin/);
  assert.doesNotThrow(() => validateRequiredEnvironment({ ...valid, APP_ORIGIN: 'https://example.dev/' }));
  assert.throws(() => validateRequiredEnvironment({ ...valid, HOSTING_URL: 'https://duplicate.example.dev' }), /Remove HOSTING_URL/);
  assert.throws(() => validateRequiredEnvironment({ ...valid, RELISH_LEGAL_DOCUMENTS_PUBLISHED: undefined }), /RELISH_LEGAL_DOCUMENTS_PUBLISHED/);
  assert.throws(() => validateRequiredEnvironment({ ...valid, RELISH_LEGAL_DOCUMENTS_PUBLISHED: 'NO' }), /RELISH_LEGAL_DOCUMENTS_PUBLISHED/);
  assert.throws(() => validateRequiredEnvironment({ ...valid, RELISH_PILOT_TERMS_URL: 'https://wrong.example/terms' }), /Remove RELISH_PILOT_TERMS_URL/);
});

test('canonical currentRelishPolicy builds all three URLs from APP_ORIGIN', () => {
  const policy = source('src/lib/server/core/relishCallPolicy.ts');
  assert.match(policy, /process\.env\.APP_ORIGIN/);
  assert.doesNotMatch(policy, /process\.env\.HOSTING_URL/);
  assert.match(policy, /new URL\('\/legal', root\)/);
  assert.match(policy, /new URL\('\/legal\/terms', root\)/);
  assert.match(policy, /new URL\('\/legal\/privacy', root\)/);
  assert.match(policy, /RELISH_LEGAL_DOCUMENTS_PUBLISHED === 'YES'/);
  assert.doesNotMatch(policy, /process\.env\.RELISH_PILOT_TERMS_URL|process\.env\.RELISH_PILOT_PRIVACY_URL/);
});

test('visitor and SMS link to one page while durable consent keeps the full document URLs', () => {
  const sms = source('src/lib/server/core/pilotSmsCallback.ts');
  const visitor = source('src/routes/u/[slug]/+page.svelte');
  const policy = source('src/lib/server/core/relishCallPolicy.ts');
  assert.match(sms, /Terms and Privacy information \(\$\{invitation\.termsVersion\}\): \$\{cfg\.legalUrl\}/);
  assert.doesNotMatch(sms, /Privacy: \$\{cfg\.privacyUrl\}/);
  assert.match(visitor, /href="\/legal"/);
  assert.match(policy, /policyVersion: policy\.version, termsUrl: policy\.termsUrl, privacyUrl: policy\.privacyUrl/);
});

test('both editable git-tracked documents and all three public routes exist', () => {
  for (const f of [
    'src/lib/legal/documents/terms.md', 'src/lib/legal/documents/privacy.md',
    'src/routes/legal/+page.svelte', 'src/routes/legal/terms/+page.svelte',
    'src/routes/legal/privacy/+page.svelte', 'src/lib/legal/LegalDocument.svelte'
  ]) assert.ok(existsSync(new URL('../../' + f, import.meta.url)), `${f} missing`);
  assert.match(source('src/routes/legal/+page.svelte'), /Read the full Terms/);
  assert.match(source('src/routes/legal/+page.svelte'), /Read the full Privacy/);
  assert.match(source('src/lib/legal/LegalDocument.svelte'), /legalMarkdownBlocks/);
  assert.match(source('src/routes/+layout.svelte'), /path === '\/legal'/);
});

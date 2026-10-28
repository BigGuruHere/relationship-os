// Stage 8.18 source contracts and real Ed25519 signature verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { generateKeyPairSync, sign } from 'node:crypto';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const src = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const source = src('src/lib/server/integrations/telnyx/messaging.ts');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { verifyTelnyxWebhook } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('valid signed Telnyx webhook verifies against exact timestamp and raw bytes', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const raw = JSON.stringify({ data: { event_type: 'message.received', payload: { text: 'CALL abc' } } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sig = sign(null, Buffer.from(`${timestamp}|${raw}`), privateKey).toString('base64');
  const key = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
  assert.equal(verifyTelnyxWebhook(raw, timestamp, sig, key), true);
  assert.equal(verifyTelnyxWebhook(raw + ' ', timestamp, sig, key), false);
  assert.equal(verifyTelnyxWebhook(raw, String(Number(timestamp) - 3600), sig, key), false);
  assert.equal(verifyTelnyxWebhook(raw, timestamp, '', key), false);
  assert.equal(verifyTelnyxWebhook(raw, timestamp, sig, ''), false);
});

test('SMS invitation persists only hashed random code and no plain telephone number', () => {
  const service = src('src/lib/server/core/pilotSmsCallback.ts');
  assert.match(service, /randomBytes\(16\)/);
  assert.match(service, /codeHash: sha\(code\)/);
  assert.match(service, /buildScopedIndexToken\(phone/);
  assert.match(service, /expiresAt: new Date\(Date\.now\(\) \+ expirationMinutes/);
  assert.match(service, /status: 'ISSUED'/);
});

test('signed webhook and single-use code required before originating call', () => {
  const route = src('src/routes/api/sms/inbound/+server.ts');
  const service = src('src/lib/server/core/pilotSmsCallback.ts');
  assert.match(route, /verifyTelnyxWebhook\(raw/);
  assert.match(route, /message\.received/);
  assert.match(service, /\^CALL\\s\+/);
  assert.match(service, /status: 'ISSUED'/);
  assert.match(service, /claimed\.count !== 1/);
  assert.match(service, /return 'duplicate'/);
});

test('only server-held profile and scoped participant identity determine custody', () => {
  const service = src('src/lib/server/core/pilotSmsCallback.ts');
  assert.match(service, /profile\.kind\) !== invitation\.domainKey/);
  assert.match(service, /ensureProvisionalPhoneCaller\(phone, invitation\.domainKey/);
  assert.match(service, /ensurePilotSelfContact\(caller\.userId, invitation\.domainKey/);
  assert.match(service, /visitorUserId: caller\.userId/);
  assert.match(service, /profileId: profile\.id/);
});

test('outbound dynamic context carries protected session, not owner private memory', () => {
  const service = src('src/lib/server/core/pilotSmsCallback.ts');
  assert.match(service, /startSharedNetworkSession\(caller\.userId, contextSpaceId/);
  assert.match(service, /dynamic_variables: withConsentGate\(projected\.dynamicVariables, policy\)/);
  assert.match(service, /conversation_config_override: \{ agent: \{ first_message: firstMessage \} \}/);
  assert.match(service, /agent_phone_number_id: process\.env\.ELEVENLABS_OUTBOUND_PHONE_NUMBER_ID/);
  assert.match(service, /networkDorianSession\.updateMany/);
  assert.match(src('src/routes/api/webhooks/elevenlabs/+server.ts'), /resolveSharedNetworkSession/);
});

test('legacy second screen preserves opt-in checks for old link; new route uses voice consent', () => {
  const page = src('src/routes/u/[slug]/call/+page.svelte');
  const server = src('src/routes/u/[slug]/call/+page.server.ts');
  assert.match(page, /agreeTerms/);
  assert.match(page, /shareContact/);
  assert.match(page, /sms:\$\{form\.issued\.smsTo\}/);
  assert.match(server, /form\.get\('agreeTerms'\) !== 'yes'/);
  assert.match(server, /connect && \(!name/);
});

test('real contact saving is visible to visitors in every published context', () => {
  const page = src('src/routes/u/[slug]/+page.svelte');
  assert.match(page, /isFirstContact/);
  assert.match(page, /href=\{vcardUrl\} download>Save/);
});

test('owner can choose browser or SMS and automatic or manual acceptance in each context', () => {
  const preferences = src('src/routes/space/[context]/settings/+page.server.ts');
  assert.match(preferences, /requireRelishWorkspace/);
  assert.match(preferences, /\['AUTOMATIC', 'APPROVAL'\]/);
  assert.match(preferences, /\['SMS_CALLBACK', 'BROWSER'\]/);
  assert.match(preferences, /ownerUserId_domainKey/);
  const page = src('src/routes/space/[context]/people/+page.server.ts');
  assert.match(page, /status: 'REQUESTED'/);
  assert.match(page, /status: 'ACCEPTED'/);
});

test('opt out and deduplication guard against repeated or unwanted callbacks', () => {
  const service = src('src/lib/server/core/pilotSmsCallback.ts');
  assert.match(service, /STOP\|UNSUBSCRIBE\|CANCEL\|QUIT/);
  assert.match(service, /pilotSmsOptOut\.upsert/);
  assert.match(service, /attempts > 3/);
  assert.match(service, /status: 'CLAIMED'/);
});

test('existing inbound telephone pipeline and background LU worker remain present', () => {
  const inbound = src('src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
  assert.match(inbound, /startProvisionalPhoneCall/);
  assert.match(src('src/lib/server/integrations/elevenlabs/phoneOnboarding.ts'), /understandingState: 'IN_CALL'/);
  assert.match(src('src/routes/api/webhooks/elevenlabs/+server.ts'), /understandingOutcome: 'QUEUED'/);
});

test('migration exists with uniqueness, preference scope, and no abandoned migration', () => {
  const sql = src('prisma/migrations/20261023130000_stage8_18_sms_context_callback/migration.sql');
  assert.match(sql, /CREATE UNIQUE INDEX "PilotSmsInvitation_codeHash_key"/);
  assert.match(sql, /"RelishContextPreference_ownerUserId_domainKey_key"/);
  assert.match(sql, /PilotSmsOptOut/);
  assert.equal(existsSync(new URL('../../prisma/migrations/20261019153000_stage8_15_4_7a_verified_phone_custody', import.meta.url)), false);
});

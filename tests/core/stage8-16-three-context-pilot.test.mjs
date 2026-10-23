// Stage 8.16 static contracts. Live DB, widget and webhook tests remain mandatory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
test('profiles are selected and saved by the requested kind, not another default', () => {
  const source = read('src/routes/settings/profile/+page.server.ts');
  assert.match(source, /safeRequestedKind/);
  assert.match(source, /where: \{ userId: locals\.user\.id, kind \}/);
  assert.match(source, /existing\.kind !== kind/);
});
test('three profile links and publication guard exist', () => {
  const hub = read('src/routes/profiles/+page.svelte');
  assert.match(hub, /Share QR/);
  assert.match(read('src/routes/u/[slug]/+page.server.ts'), /!profile\?\.isPublished/);
  assert.match(read('src/routes/api/qr/+server.ts'), /!exists\?\.isPublished/);
});
test('pilot identities cannot be inferred from phone or email', () => {
  const source = read('src/lib/server/pilot.ts');
  assert.match(source, /randomBytes\(32\)/);
  assert.match(source, /tokenHash: tokenHash\(token\)/);
  assert.match(source, /email_Idx \|\| user\.oauthAccounts\.length/);
});
test('session resolver requires profile provenance and domain custody', () => {
  const source = read('src/lib/server/integrations/elevenlabs/networkSession.ts');
  assert.match(source, /pilotEntryId/);
  assert.match(source, /pilotDomainForKind\(entry\.profile\.kind\)/);
  assert.match(source, /entry && entry.domainKey !== space.domainKey/);
  assert.match(source, /session\.agentBindingId !== input\.bindingId/);
});
test('telemetry is allowlisted, private contents omitted and signed callback controls completions', () => {
  const source = read('src/lib/server/pilot.ts');
  assert.match(source, /allowedEvents/);
  assert.doesNotMatch(source, /transcriptEnc|livingUnderstandingEnc|sessionToken:/);
  const callback = read('src/routes/api/webhooks/elevenlabs/+server.ts');
  assert.match(callback, /dorian\.conversation_completed/);
  assert.match(callback, /dedup: 'conversation:' \+ normalized/);
});
test('connection request explicitly records volunteered details only', () => {
  const route = read('src/routes/pilot/dorian/[entryId]/+page.server.ts');
  assert.match(route, /data\.get\('consent'\) !== 'yes'/);
  assert.match(route, /encrypt\(name, 'pilot\.connection\.name'\)/);
  assert.doesNotMatch(route, /sharingScope|matchEligible/);
});
test('automatic pilot LU reuses the existing separately scoped worker', () => {
  const worker = read('scripts/process-stage8-15-4-7f-2-phone-queue.ts');
  assert.match(worker, /runPilotOne/);
  assert.match(worker, /understandingOutcome: 'QUEUED'/);
  assert.match(worker, /runWithWorkspaceCustody/);
});
test('migration includes privacy controls, event uniqueness and no abandoned migration', () => {
  const migration = read('prisma/migrations/20261022233000_stage8_16_three_context_pilot/migration.sql');
  for(const keyword of ['isPublished', 'PilotBrowserSession', 'PilotProfileEntry', 'ProductEvent', 'PilotConnectionRequest', 'ProductEvent_idempotencyKey_key']) assert.ok(migration.includes(keyword));
  assert.equal(existsSync(new URL('../../prisma/migrations/20261019153000_stage8_15_4_7a_verified_phone_custody', import.meta.url)),false);
});

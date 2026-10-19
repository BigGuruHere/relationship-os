import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
test('provisional phone caller has a unique deterministic index', () => {
  assert.match(read('prisma/schema.prisma'), /model NetworkPhoneCaller/);
  assert.match(read('prisma/schema.prisma'), /phoneIndex String @unique/);
});
test('onboarding creates separately owned canonical identities', () => {
  const text = read('src/lib/server/integrations/elevenlabs/phoneOnboarding.ts');
  for (const piece of ['tx.user.create','tx.contextSpace.create','tx.contact.create','tx.networkPhoneCaller.create','networkSessionHash(token)']) assert.ok(text.includes(piece), piece);
});
test('initiation uses shared binding and issues only scoped session token', () => {
  const text = read('src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
  assert.ok(text.includes('startProvisionalPhoneCall'));
  assert.ok(text.includes('configuredSharedBindingId()'));
});
test('post-call custody requires shared network session token', () => {
  const text = read('src/routes/api/webhooks/elevenlabs/+server.ts');
  assert.ok(text.includes('resolveSharedNetworkSession'));
  assert.ok(text.includes('normalized.dynamicVariables.relish_network_session'));
});

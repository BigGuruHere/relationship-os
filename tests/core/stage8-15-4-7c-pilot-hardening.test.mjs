// Stage 8.15.4.7c regression checks. No live database credentials are required.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

test('concurrent initiation losing unique conversation race fails closed', () => {
  const phone = read('src/lib/server/integrations/elevenlabs/phoneOnboarding.ts');
  const model = read('prisma/schema.prisma');
  assert.match(model, /conversationId String\? @unique/);
  assert.match(phone, /prisma\.networkDorianSession\.create/);
  assert.match(phone, /error\.code === 'P2002'\) return null/);
  assert.match(phone, /if \(existingSession\) return null/);
});

test('shared post-call ingestion is bound to the issued token and participant custody', () => {
  const session = read('src/lib/server/integrations/elevenlabs/networkSession.ts');
  const post = read('src/routes/api/webhooks/elevenlabs/+server.ts');
  assert.match(session, /session\.agentBindingId !== input\.bindingId/);
  assert.match(session, /session\.expiresAt < new Date\(\)/);
  assert.match(session, /session\.conversationId !== input\.conversationId/);
  assert.match(post, /shared\?\.userId \?\? deployment\.userId/);
  assert.match(post, /if \(deployment\.bindingId === configuredSharedBindingId\(\) && !shared\)/);
});

test('webhook logs do not print full URL, caller number or external user ID', () => {
  const init = read('src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
  const post = read('src/routes/api/webhooks/elevenlabs/+server.ts');
  for (const source of [init, post]) {
    assert.doesNotMatch(source, /url: request\.url/);
    assert.match(source, /path: new URL\(request\.url\)\.pathname/);
  }
  assert.match(init, /hasCallerId: Boolean\(body\?\.caller_id\)/);
  assert.doesNotMatch(init, /callerId: body\?\.caller_id \|\| null/);
  assert.match(post, /hasCallerPhone: Boolean\(normalized\.callerPhone\)/);
  assert.doesNotMatch(post, /callerPhone: normalized\.callerPhone \|\| null/);
});

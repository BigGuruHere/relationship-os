// Source-level regression checks only; database/session tests must run in development.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
test('self-contact requires owned General ContextSpace and canonical Person', () => {
  const src = read('src/lib/server/core/networkSelfContact.ts');
  assert.match(src, /ownerUserId: userId, domainKey: 'general'/);
  assert.match(src, /if \(!user\?\.personId\) throw/);
  assert.match(src, /personId: user\.personId, linkedUserId: userId/);
});
test('self-contact preserves existing identity, and handles duplicate creation', () => {
  const src = read('src/lib/server/core/networkSelfContact.ts');
  assert.match(src, /Multiple self-contact records require review/);
  assert.match(src, /different Person identity/);
  assert.match(src, /error\.code === 'P2002'/);
  assert.match(read('prisma/schema.prisma'), /@@unique\(\[userId, contextSpaceId, linkedUserId\]\)/);
});
test('shared Dorian issues session only after resolving self-contact', () => {
  const src = read('src/lib/server/integrations/elevenlabs/networkSession.ts');
  assert.match(src, /await ensureNetworkSelfContact\(\{ userId, contextSpaceId \}\)/);
  assert.match(src, /contactId: selfContactId/);
  assert.match(src, /status: 'NO_SELF_IDENTITY'/);
});
test('participant-owned deployment uses same compatibility helper', () => {
  const src = read('src/routes/network/dorian/+page.server.ts');
  assert.match(src, /await ensureNetworkSelfContact\(\{ userId, contextSpaceId \}\)/);
  assert.match(src, /relish_contact_id: selfContactId/);
});

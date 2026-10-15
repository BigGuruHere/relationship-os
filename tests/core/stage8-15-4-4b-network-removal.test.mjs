import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
test('one-sided removal is recorded without deleting Contacts or origins', () => {
  const s = read('src/routes/network/+page.server.ts');
  assert.match(s, /networkConnectionVisibility\.upsert/);
  assert.match(s, /networkConnectionOrigin\.findFirst/);
  assert.doesNotMatch(s, /contact\.delete|networkConnectionOrigin\.delete/);
});
test('Network list filters removed participants and supports removal UI', () => {
  assert.match(read('src/routes/network/+page.server.ts'), /removedIds\.has/);
  assert.match(read('src/routes/network/+page.svelte'), /Remove from my Network/);
});
test('invitation prioritises Google and submits POST after auth', () => {
  const s = read('src/routes/network/join/[slug]/+page.svelte');
  assert.ok(s.indexOf('Continue with Google') < s.indexOf('Create account with email'));
  assert.match(s, /requestSubmit\(\)/);
  assert.match(read('src/routes/network/join/[slug]/+page.server.ts'), /networkConnectionVisibility\.deleteMany/);
});
test('migration has unique user-local removal key', () => {
  assert.match(read('prisma/schema.prisma'), /model NetworkConnectionVisibility/);
  assert.match(read('prisma/migrations/20261015100000_stage8_15_4_4b_network_visibility/migration.sql'), /UNIQUE INDEX/);
});

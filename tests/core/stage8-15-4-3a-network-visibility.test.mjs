import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(p, 'utf8');
test('Network lists both directions with authenticated participant scoping', () => {
 const code = read('src/routes/network/+page.server.ts');
 assert.match(code, /inviterUserId: locals\.user\.id/);
 assert.match(code, /visitorUserId: locals\.user\.id/);
 assert.match(code, /otherUsers\.set\(otherId/);
 assert.match(code, /kind: 'personal'/);
 assert.match(code, /profileByUserId/);
});
test('Network list retains public profile name and does not rewrite private contacts', () => {
 const code = read('src/routes/network/+page.server.ts');
 assert.match(code, /publicProfile\?\.displayName/);
 assert.doesNotMatch(code, /contact\.update|contact\.updateMany/);
 assert.match(read('src/routes/network/+page.svelte'), /Your connections/);
});
test('Personal public profiles use durable origin in both directions for Connected status', () => {
 const code = read('src/routes/u/[slug]/+page.server.ts');
 assert.match(code, /networkConnectionOrigin\.findFirst/);
 assert.match(code, /inviterUserId: ownerId, visitorUserId/);
 assert.match(code, /inviterUserId: visitorUserId, visitorUserId: ownerId/);
 assert.match(code, /isAlreadyConnected = Boolean\(networkOrigin\)/);
 assert.match(read('src/routes/u/[slug]/+page.svelte'), /already connected/);
});
test('Idempotent origin unique pair remains in schema and unchanged migration', () => {
 assert.match(read('prisma/schema.prisma'), /@@unique\(\[inviterUserId, visitorUserId\]\)/);
 assert.match(read('src/lib/connections.ts'), /networkConnectionOrigin\.upsert/);
});

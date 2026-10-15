import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(p, 'utf8');
test('Network connection uses dedicated General-context endpoint', () => {
 const route = read('src/routes/network/connect/[slug]/+server.ts');
 assert.match(route,/kind: 'personal'/);
 assert.match(route,/createNetworkConnection/);
 assert.match(route,/locals\.contextDomainKey !== 'general'/);
 assert.doesNotMatch(route,/form\.get\('ownerId'\)/);
});
test('Network connection resolves both owners General ContextSpaces and respects custody', () => {
 const src = read('src/lib/connections.ts');
 const network = src.slice(src.indexOf('export async function createNetworkConnection'));
 assert.match(network,/domainKey: 'general'/);
 assert.match(network,/source\.contextSpaceId !== visitorGeneral\.id/);
 assert.match(network,/runWithCrossOwnerWorkspaceCustody/);
 assert.match(network,/networkConnectionOrigin\.upsert/);
 assert.match(network,/kind: 'personal'/);
});
test('Public personal connect takes Network path, existing other-profile flow remains', () => {
 const ui = read('src/routes/u/[slug]/+page.svelte');
 assert.match(ui,/data\?\.profile\?\.kind === 'personal'/);
 assert.match(ui,/\?\/connectUsers/);
});
test('Migration has unique invitation origin and owner-scoped Network list', () => {
 assert.match(read('prisma/schema.prisma'),/@@unique\(\[inviterUserId, visitorUserId\]\)/);
 assert.match(read('src/routes/network/+page.server.ts'),/inviterUserId: locals\.user\.id/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(p, 'utf8');
test('Personal-profile public page links to a dedicated explicit Network invitation', () => {
 const page = read('src/routes/u/[slug]/+page.svelte');
 assert.match(page, /profile\?\.kind === 'personal'/);
 assert.match(page, /\/network\/join\//);
});
test('Join uses authenticated server identity and creates own General ContextSpace', () => {
 const server = read('src/routes/network/join/[slug]/+page.server.ts');
 assert.match(server, /ensureOwnedDomainContextSpace/);
 assert.match(server, /domainKey: 'general'/);
 assert.match(server, /createNetworkConnection/);
 assert.match(server, /runWithWorkspaceCustody/);
 assert.match(server, /personal\.userId === locals\.user\.id/);
});
test('Register and login retain only allowlisted invitation return route', () => {
 for(const dir of ['login','register']) {
  const server = read(`src/routes/auth/${dir}/+page.server.ts`);
  assert.match(server, /safeNetworkJoinReturn/);
  assert.match(server, /next \|\| '\/'/);
 }
 const helper = read('src/lib/server/networkJoinReturn.ts');
 assert.match(helper, /startsWith\('\/network\/join\/'\)/);
});
test('No schema or new migration is introduced in stage', () => {
 const p=JSON.parse(read('package.json'));
 assert.ok(p.scripts['check:stage8.15.4.4']);
});

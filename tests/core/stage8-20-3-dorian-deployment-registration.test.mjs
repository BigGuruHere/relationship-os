import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const root='src/lib/server/integrations/elevenlabs/';
const registry=readFileSync(root+'dorianDeploymentRegistry.ts','utf8');
const endpoint=readFileSync('src/routes/api/internal/agent-management/dorian/deployment/+server.ts','utf8');
const network=readFileSync(root+'networkSession.ts','utf8');
const legacy=readFileSync('src/routes/settings/agents/+page.server.ts','utf8');

test('registration is owner scoped and never trusts a caller-provided user id',()=>{
  assert.match(registry,/RELISH_DORIAN_DEPLOYMENT_OWNER_USER_ID/);
  assert.match(registry,/ownerUserId[:,}]|ownerUserId:ownerUserId/);
  assert.match(registry,/scopedSpaces/);
  assert.match(registry,/agentDefinition\.findUnique/);
  assert.doesNotMatch(registry,/input\.ownerUserId/);
});
test('registration is idempotent, serialized and rejects provider-ID collisions',()=>{
  assert.match(registry,/pg_advisory_xact_lock/);
  assert.match(registry,/activeForId/);
  assert.match(registry,/candidate.userId!==ownerUserId/);
  assert.match(registry,/ALREADY_REGISTERED/);
  assert.match(registry,/REGISTERE?D/);
});
test('API requires a separate bearer token, confirmation, strict JSON and has no public write fallback',()=>{
  assert.match(endpoint,/RELISH_DORIAN_DEPLOYMENT_REGISTRATION_TOKEN/);
  assert.match(endpoint,/timingSafeEqual/);
  assert.match(endpoint,/body\.confirm!==\(replacing\?'REPLACE':'REGISTER'\)/);
  assert.match(endpoint,/request\.headers\.get\('content-type'\)/);
});
test('shared Dorian binding resolves from the local DB rather than an external UUID',()=>{
  assert.match(network,/activeSharedDorianBindingId/);
  assert.match(network,/rows.length===1/);
  assert.match(network,/userId:ownerUserId/);
  assert.match(network,/return configuredSharedBindingId\(\)/);
  assert.match(readFileSync('src/routes/api/webhooks/elevenlabs/initiation/+server.ts','utf8'),/await isAuthorizedSharedDorianBindingId\(deployment.bindingId!/);
  assert.match(readFileSync('src/routes/api/webhooks/elevenlabs/+server.ts','utf8'),/await isAuthorizedSharedDorianBindingId\(deployment.bindingId!/);
});
test('old internal agent screen cannot administer Dorian bindings',()=>{
  assert.match(legacy,/key: \{ not: 'DORIAN' \}/);
  assert.match(legacy,/if \(key === 'DORIAN'\)/);
});
test('prior call recovery and consent procedure remain installed',()=>{
  assert.ok(existsSync('src/lib/server/pilotMonitor/dorianRecovery.ts'));
  assert.ok(existsSync('src/lib/server/core/dorianConsentProjection.ts'));
});

test('transaction-scoped registration lock does not return PostgreSQL VOID to Prisma',()=>{
  // Directly selecting pg_advisory_xact_lock() as a result column causes Prisma
  // known request errors on PostgreSQL because the result type is VOID.
  assert.doesNotMatch(registry,/\$queryRaw`SELECT pg_advisory_xact_lock\(820300031\)`/);
  assert.match(registry,/\$queryRaw`SELECT 1::integer AS locked FROM \(SELECT pg_advisory_xact_lock\(820300031\)\) AS lock_row`/);
  assert.match(endpoint,/\[dorian-registration\] registration failed/);
  assert.match(endpoint,/error\.code/);
});

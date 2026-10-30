import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=p=>readFileSync(p,'utf8');
const network=get('src/lib/server/integrations/elevenlabs/networkSession.ts');
const registry=get('src/lib/server/integrations/elevenlabs/dorianDeploymentRegistry.ts');
const plane=get('src/lib/server/integrations/elevenlabs/dorianControlPlane.ts');
const init=get('src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
const post=get('src/routes/api/webhooks/elevenlabs/+server.ts');
const policy=get('src/lib/server/core/relishCallPolicy.ts');
const preferred=get('src/lib/server/integrations/elevenlabs/preferredName.ts');
test('new provider binding registers alongside active ones; old bindings are not overwritten',()=>{
 assert.match(registry,/const activeForId/);
 assert.match(registry,/agentProviderBinding.create/);
 assert.doesNotMatch(registry.slice(registry.indexOf('export async function registerDorianDeployment'),registry.indexOf('// Stage 8.21 — explicit replacement')),/isActive:false/);
});
test('direct phone init authorizes the exact provider binding',()=>{
 assert.match(init,/isAuthorizedSharedDorianBindingId\(deployment.bindingId!/);
 assert.doesNotMatch(init,/deployment.bindingId !== sharedBindingId/);
 assert.match(network,/userId:ownerUserId,provider:'ELEVENLABS'/);
});
test('post-call and tools use session binding rather than global default',()=>{
 assert.match(post,/isAuthorizedSharedDorianBindingId\(deployment.bindingId!/);
 assert.match(network,/session.agentBindingId !== input.bindingId/);
 assert.match(policy,/isAuthorizedSharedDorianBindingId\(session.agentBindingId\)/);
 assert.match(preferred,/isAuthorizedSharedDorianBindingId\(session.agentBindingId\)/);
});
test('voice configuration is fetched and cached by provider, never shared across personas',()=>{
 assert.match(plane,/url.searchParams.set\('agent_id',providerAgentId\)/);
 assert.match(plane,/cacheKey=providerAgentId/);
 assert.match(plane,/agentKey:cacheKey/);
});
test('multiple active provider agents require explicit default only for outgoing/browser calls',()=>{
 assert.match(network,/RELISH_DORIAN_DEFAULT_PROVIDER_AGENT_ID/);
 assert.match(network,/return rows.length===1\?rows\[0\].id:''/);
 assert.match(network,/startSharedNetworkSession/);
 assert.match(network,/defaultSharedDorianProviderAgentId/);
});

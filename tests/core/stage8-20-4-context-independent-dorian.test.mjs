import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = 'src/lib/server/integrations/elevenlabs/';
const read = file => readFileSync(file,'utf8');
const registry = read(root + 'dorianDeploymentRegistry.ts');
const resolver = read(root + 'deployment.ts');
const initiation = read('src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
const webhook = read('src/routes/api/webhooks/elevenlabs/+server.ts');
const phone = read(root + 'phoneOnboarding.ts');
const defaultContext = read(root + 'phoneDefaultContext.ts');
const network = read(root + 'networkSession.ts');

test('registration accepts provider ID but not operator-supplied ContextSpace or owner', () => {
  assert.match(registry,/registerDorianDeployment\(input: \{ environment:unknown; agentId:unknown \}\)/);
  assert.doesNotMatch(registry,/input\.contextSpaceId/);
  assert.doesNotMatch(registry,/input\.ownerUserId/);
  assert.match(registry,/const anchor = legacyAnchor\(spaces\)/);
  assert.match(registry,/contextSpaceId:anchor\.id/); // legacy required FK only
  assert.match(registry,/candidate.agentDefinitionId!==agent.id \|\| candidate.environment!==environment/);
  assert.doesNotMatch(registry,/candidate\.contextSpaceId!==/);
});

test('existing provider bindings preserved and no ownership-to-caller scope fallbacks',()=>{
  assert.match(registry,/ALREADY_REGISTERED/);
  assert.match(registry,/runtimeContextSource:'PARTICIPANT_SESSION'/);
  assert.match(resolver,/row\.agentDefinition\.key === 'DORIAN' \? null : row\.contextSpaceId/);
  assert.match(resolver,/row\.agentDefinition\.key === 'DORIAN' \? null : row\.contextSpace\.domainKey/);
  assert.match(initiation,/deployment\.agentKey === 'DORIAN' && !sharedAllowed/);
  assert.match(webhook,/deployment\.agentKey === 'DORIAN' && !sharedAllowed/);
  assert.match(webhook,/deployment\.agentKey === 'DORIAN' && !shared/);
  assert.match(webhook,/targetContextSpaceId = shared\?\.contextSpaceId/);
});

test('direct phone gets participant General/default, invitation gets verified participant space',()=>{
  assert.match(phone,/ensureProvisionalPhoneCaller\(phone\)/);
  assert.match(phone,/resolvePhoneDefaultContext\(caller\)/);
  assert.match(defaultContext,/ownerUserId: caller\.userId/);
  assert.match(defaultContext,/defaultContextSpaceId/);
  assert.match(network,/const domainKey = pilot\?\.domainKey \|\| 'general'/);
  assert.match(network,/id: contextSpaceId, ownerUserId: userId, domainKey/);
  assert.match(network,/entry\.domainKey !== space\.domainKey/);
});

test('registration API requires dedicated bearer and explicit confirmation',()=>{
  const route=read('src/routes/api/internal/agent-management/dorian/deployment/+server.ts');
  assert.match(route,/RELISH_DORIAN_DEPLOYMENT_REGISTRATION_TOKEN/);
  assert.match(route,/body\.confirm!==\(replacing\?'REPLACE':'REGISTER'\)/);
  assert.match(route,/timingSafeEqual/);
});

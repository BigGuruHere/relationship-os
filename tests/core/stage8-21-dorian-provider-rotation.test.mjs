import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const registry=readFileSync('src/lib/server/integrations/elevenlabs/dorianDeploymentRegistry.ts','utf8');
const endpoint=readFileSync('src/routes/api/internal/agent-management/dorian/deployment/+server.ts','utf8');
test('rotation is explicit, owner-scoped, and requires matching previous binding',()=>{
  assert.match(registry,/replaceDorianDeployment/);
  assert.match(registry,/previousBindingId/);
  assert.match(registry,/active\.length!==1/);
  assert.match(registry,/agentDefinition\.findUnique/);
  assert.match(endpoint,/body.operation==='REPLACE'/);
});
test('old binding is archived and preserved for historic sessions',()=>{
  assert.match(registry,/isActive:false,validTo:now/);
  assert.match(registry,/createdAt:\{gte:cutoff\}/);
  assert.match(registry,/recent>0/);
  assert.doesNotMatch(registry,/agentProviderBinding.delete/);
});

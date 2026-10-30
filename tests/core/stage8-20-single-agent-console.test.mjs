// Stage 8.20 source invariants: one external console, environment-isolated
// published instructions, preserved server-owned policy and identity rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { validateRequiredEnvironment } from '../../scripts/validate-required-env.mjs';
const get = p => readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const resolver=get('src/lib/server/integrations/elevenlabs/dorianControlPlane.ts');
const inbound=get('src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
const outbound=get('src/lib/server/core/pilotSmsCallback.ts');
test('standalone management, with a dedicated Relish published-config snapshot',()=>{
 assert.ok(existsSync(new URL('../../src/lib/server/integrations/elevenlabs/dorianControlPlane.ts',import.meta.url)));
 assert.ok(!existsSync(new URL('../../control-plane/src/server.mjs',import.meta.url)));
 assert.match(get('prisma/schema.prisma'), /model DorianAgentConfigSnapshot/);
 assert.match(resolver, /dorianAgentConfigSnapshot\.findUnique/);
 assert.match(resolver, /dorianAgentConfigSnapshot\.upsert/);
 assert.match(resolver, /Management unavailable; using verified/);
});
test('required runtime env is explicit, version and audience checked',()=>{
 assert.match(resolver, /RELISH_CONTROL_PLANE_ENABLED must be YES or NO/);
 assert.match(resolver, /payload\?\.environment !== environment/);
 assert.match(resolver, /Published ElevenLabs agent ID does not match authorised deployment binding/);
 assert.match(resolver, /RELISH_CONTROL_PLANE_READ_TOKEN/);
 assert.match(resolver, /Telephone caller' is the provisional placeholder/);
});
test('outbound and inbound call paths use published configuration before consent',()=>{
 assert.match(outbound,/const publishedDorian\s*=\s*await fetchPublishedDorianConfig\(defaultProviderId\);/);
 assert.match(outbound,/const projected = await configureDorianCall/);
 assert.match(outbound,/withConsentGate\(projected\.dynamicVariables, policy\)/);
 assert.match(inbound,/const publishedDorian\s*=\s*await fetchPublishedDorianConfig\(String\(body.agent_id \|\| ''\)\);/);
 assert.match(inbound,/const phoneProjection = await configureDorianCall/);
 assert.match(inbound,/withConsentGate\(phoneProjection\.dynamicVariables, callPolicy\)/);
 assert.match(inbound,/policyInstructionForCaller\(shared\.userId\)/);
});
test('published configuration never selects another environment implicitly',()=>{
 assert.match(resolver, /payload\?\.environment !== environment/);
 assert.match(resolver, /RELISH_CONTROL_PLANE_READ_TOKEN/);
 assert.match(resolver, /Telephone caller' is the provisional placeholder/);
});
test('no silent fallback when control plane enabled',()=>{
 const base={ DATABASE_URL:'postgresql://x',SECRET_MASTER_KEY:'a'.repeat(64),SESSION_COOKIE_SECRET:'b'.repeat(32),SESSION_DAYS:'30',LOGIN_THROTTLE_SECRET:'c'.repeat(32),APP_ORIGIN:'https://example.com',RELISH_CONTROL_PLANE_ENABLED:'YES' };
 assert.throws(()=>validateRequiredEnvironment(base),/RELISH_CONTROL_PLANE_URL/);
 assert.throws(()=>validateRequiredEnvironment({...base,RELISH_CONTROL_PLANE_URL:'https://control.example.com',RELISH_CONTROL_PLANE_READ_TOKEN:'d'.repeat(32)}),/RELISH_CONTROL_PLANE_ENV/);
 assert.throws(()=>validateRequiredEnvironment({...base,RELISH_CONTROL_PLANE_URL:'https://control.example.com',RELISH_CONTROL_PLANE_READ_TOKEN:'d'.repeat(32),RELISH_CONTROL_PLANE_ENV:'local'}),/RELISH_CONTROL_PLANE_REFRESH_SECONDS/);
 assert.doesNotThrow(()=>validateRequiredEnvironment({...base,RELISH_CONTROL_PLANE_URL:'https://control.example.com',RELISH_CONTROL_PLANE_READ_TOKEN:'d'.repeat(32),RELISH_CONTROL_PLANE_ENV:'local',RELISH_CONTROL_PLANE_REFRESH_SECONDS:'120'}));
});

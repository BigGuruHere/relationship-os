import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { withConsentGate } from '../../src/lib/server/core/dorianConsentProjection.ts';

const src = file => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
const fullContext = Object.freeze({
  relish_network_session: 'VALID_SERVER_ISSUED_TOKEN_UNCHANGED',
  user_name: 'Test Caller', participant_name: 'Test Caller',
  previous_calls: '4',
  last_call_summary: 'Previously discussed a woodworking project.',
  memory_and_identity_context: 'Friendship: enjoys community woodworking.',
  living_understanding: 'Friendship: enjoys community woodworking.',
  living_understanding_revision: '6',
  relish_living_understanding: 'Friendship: enjoys community woodworking.',
  relish_living_understanding_revision: '6',
  relish_active_context: 'general',
  relish_context_instruction: 'Network conversation guidance',
  relish_persona_instruction: 'Talk naturally.',
  relish_scenario_instruction: 'Returning named caller.',
  relish_identity_status: 'PROVISIONAL_PHONE',
  call_instruction: 'Continue naturally with the returning caller.'
});

test('REQUIRED status preserves ALL participant-scoped context and session and prioritises consent', () => {
  const policy = { accepted: false, instruction: 'MANDATORY FIRST PROCEDURE: secure explicit consent via tool.' };
  const result = withConsentGate(fullContext, policy);
  assert.equal(result.relish_terms_status, 'REQUIRED');
  for (const [key,value] of Object.entries(fullContext)) {
    if (key !== 'call_instruction') assert.equal(result[key], value, `${key} was altered`);
  }
  assert.equal(result.call_instruction,
    'MANDATORY FIRST PROCEDURE: secure explicit consent via tool.\n\nContinue naturally with the returning caller.');
  assert.equal(fullContext.relish_terms_status, undefined, 'input object mutated');
  assert.equal(fullContext.call_instruction, 'Continue naturally with the returning caller.');
});

test('ACCEPTED status retains full context and normal conversation instructions', () => {
  const result = withConsentGate(fullContext, {accepted: true, instruction:'CONSENT STATUS ACCEPTED: do not ask again.'});
  assert.equal(result.relish_terms_status, 'ACCEPTED');
  assert.equal(result.last_call_summary, fullContext.last_call_summary);
  assert.equal(result.user_name, fullContext.user_name);
  assert.equal(result.relish_living_understanding, fullContext.relish_living_understanding);
  assert.ok(String(result.call_instruction).startsWith('CONSENT STATUS ACCEPTED:'));
  assert.ok(String(result.call_instruction).includes(fullContext.call_instruction));
});

test('no hallucinated context is introduced for first-time callers', () => {
  const result = withConsentGate({relish_network_session:'session', call_instruction:'Welcome a new caller.'},
    { accepted:false, instruction:'Request agreement first.' });
  assert.equal(result.user_name, undefined);
  assert.equal(result.relish_living_understanding, undefined);
  assert.equal(result.relish_network_session, 'session');
  assert.equal(result.relish_terms_status, 'REQUIRED');
});

test('all three initiation routes use the unchanged session-bound consent projection', () => {
  const inbound = src('src/routes/api/webhooks/elevenlabs/initiation/+server.ts');
  const outgoing = src('src/lib/server/core/pilotSmsCallback.ts');
  const policy = src('src/lib/server/core/relishCallPolicy.ts');
  assert.match(inbound, /dynamic_variables:\s*withConsentGate\(browserProjection\.dynamicVariables, browserPolicy\)/);
  assert.match(inbound, /withConsentGate\(phoneProjection\.dynamicVariables, callPolicy\)/);
  assert.match(outgoing, /withConsentGate\(projected\.dynamicVariables, policy\)/);
  assert.match(policy, /export \{ withConsentGate \} from '\.\/dorianConsentProjection'/);
  assert.doesNotMatch(policy, /vars\[key\] = ''/);
  assert.match(policy, /record_relish_policy_acceptance/);
  assert.match(policy, /Only if its status is ACCEPTED/);
  assert.match(policy, /same call/);
});

test('server-side policy writes and post-call ingestion still require acceptance', () => {
  const policy = src('src/lib/server/core/relishCallPolicy.ts');
  const postCall = src('src/routes/api/webhooks/elevenlabs/+server.ts');
  const name = src('src/lib/server/integrations/elevenlabs/preferredName.ts');
  assert.match(policy, /session\.conversationId !== conversationId/);
  assert.match(policy, /session\.agentBindingId !== bindingId/);
  assert.match(policy, /sessionId_policyVersion/);
  assert.match(policy, /policyVersion: policy\.version, termsUrl: policy\.termsUrl, privacyUrl: policy\.privacyUrl/);
  assert.match(name, /callerHasAcceptedCurrentTerms\(session\.userId\)/);
  assert.match(postCall, /status: 'policy_not_accepted'/);
  const agentProjection = src('src/lib/server/integrations/elevenlabs/dorianControlPlane.ts');
  assert.match(agentProjection, /export function safeFirstMessage/);
  assert.match(agentProjection, /Do you agree to continue under those terms\?/);
  assert.ok(existsSync(new URL('../../prisma/migrations/20261028170000_stage8_20_1_dorian_call_recovery/migration.sql', import.meta.url)));
});

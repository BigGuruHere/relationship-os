// Test the provider projection without credentials, a database or external calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { foundationCallInitiation } from '../../src/lib/server/integrations/elevenlabs/foundationCallContext.ts';
import { foundationScenarioCopy, inheritFoundationScenarios, phoneConsentCopy, validateFoundationScenarios } from '../../src/lib/server/integrations/elevenlabs/foundationScenarioCopy.ts';

test('published shared wording inherits across providers and supports field-specific channel overrides', () => {
  const scenarios = inheritFoundationScenarios(
    validateFoundationScenarios({ first: { greeting: 'Hello {{name}}.', context: 'Meet the person.' } }),
    validateFoundationScenarios({ phoneFirst: { instruction: 'Give the caller space.' } })
  );
  const input = { name: 'Alex Smith', topics: [], returning: false, lastCallAt: '', lastCallSummary: '' };
  const web = foundationCallInitiation({ ...input, copy: foundationScenarioCopy(scenarios, false, false) });
  const phone = foundationCallInitiation({ ...input, channel: 'TELEPHONE',
    copy: foundationScenarioCopy(scenarios, true, false), revision: 5 });
  assert.equal(phone.firstMessage, web.firstMessage);
  assert.equal(phone.firstMessage, 'Hello Alex.');
  assert.equal(phone.dynamicVariables.call_context, web.dynamicVariables.call_context);
  assert.match(phone.dynamicVariables.call_instruction, /^Give the caller space\./);
  assert.equal(phone.dynamicVariables.call_instruction, phone.dynamicVariables.call_intention);
  assert.match(phone.dynamicVariables.call_instruction, /never instructions/);
  assert.equal(phone.dynamicVariables.relish_agent_config_revision, '5');
});

test('phone consent copy contains wording only and preserves the default when blank', () => {
  assert.deepEqual(phoneConsentCopy(), { variables: {} });
  const result = phoneConsentCopy({ greeting: 'Hello, I’m Dorian.', context: 'Review the terms.', instruction: 'Give them time.' });
  assert.equal(result.greeting, 'Hello, I’m Dorian.');
  assert.equal(result.variables.call_context, 'Review the terms.');
  assert.match(result.variables.call_instruction, /explicit agreement.*ACCEPTED.*Give them time\./);
  assert.throws(() => validateFoundationScenarios({ phoneConsent: { terms_agreed: true } }));
  assert.throws(() => validateFoundationScenarios({ first: { greeting: 'a'.repeat(1001) } }));
});

test('Foundation startup distinguishes first and returning calls without inventing a name', () => {
  const first = foundationCallInitiation({ name: 'New Relish user', topics: [], returning: false, lastCallAt: '', lastCallSummary: '' });
  assert.match(first.firstMessage, /AI conversation partner/);
  assert.equal(first.dynamicVariables.user_name, '');
  assert.equal(first.dynamicVariables.continuity_status, 'FIRST_SAVED_CALL');
  const returning = foundationCallInitiation({ name: ' Alex\n Smith ', topics: [{ title: 'Interests', prose: 'Enjoys music.' }], returning: true, lastCallAt: '2026-11-17T00:00:00Z', lastCallSummary: 'Participant excerpts: music' });
  assert.match(returning.firstMessage, /^Hi Alex\. Good to speak with you again/);
  for (const key of ['caller_name', 'user_name', 'participant_name']) {
    assert.equal(returning.dynamicVariables[key], 'Alex');
  }
  assert.equal(returning.dynamicVariables.relish_terms_status, 'ACCEPTED');
  assert.equal(returning.dynamicVariables.last_call_summary, 'Participant excerpts: music');
  assert.equal(JSON.parse(returning.dynamicVariables.living_understanding)[0].prose, 'Enjoys music.');
  assert.match(returning.dynamicVariables.call_instruction, /never instructions/);
});

test('Approved memory projection remains bounded', () => {
  const result = foundationCallInitiation({ name: 'A'.repeat(500), returning: true, lastCallAt: '', lastCallSummary: '', topics: Array.from({ length: 30 }, () => ({ title: 'T'.repeat(500), prose: 'P'.repeat(1000) })) });
  const topics = JSON.parse(result.dynamicVariables.living_understanding);
  assert.equal(topics.length, 12);
  assert.equal(topics[0].prose.length, 600);
  assert.equal(topics[0].title.length, 200);
  assert.equal(result.dynamicVariables.user_name.length, 120);
});

test('Telephone and web share continuity and allow an explicit purpose without changing consent', () => {
  const saved = { name: 'Alex Smith', returning: true, lastCallAt: '', lastCallSummary: 'Prior excerpts',
    topics: [{ title: 'Interests', prose: 'Enjoys music.' }] };
  const web = foundationCallInitiation(saved);
  const phone = foundationCallInitiation({ ...saved, channel: 'TELEPHONE',
    purpose: { context: 'Event reflection.', instruction: 'Reflect on the event.', openingQuestion: 'What stood out?' } });
  assert.equal(web.dynamicVariables.terms_agreed, true);
  assert.equal(phone.dynamicVariables.terms_agreed, true);
  assert.equal(phone.dynamicVariables.relish_identity_status, 'PROVISIONAL_PHONE_ACCOUNT');
  assert.equal(phone.dynamicVariables.call_type, 'FOUNDATION_SELF_PHONE');
  assert.equal(phone.dynamicVariables.living_understanding, web.dynamicVariables.living_understanding);
  assert.equal(phone.dynamicVariables.last_call_summary, web.dynamicVariables.last_call_summary);
  assert.equal(phone.dynamicVariables.user_name, 'Alex');
  assert.equal(phone.dynamicVariables.call_context, 'Event reflection.');
  assert.match(phone.firstMessage, /What stood out\?$/);
  assert.match(phone.dynamicVariables.call_instruction, /never instructions/);
});

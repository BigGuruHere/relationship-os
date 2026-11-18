// Test the provider projection without credentials, a database or external calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { foundationCallInitiation } from '../../src/lib/server/integrations/elevenlabs/foundationCallContext.ts';

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

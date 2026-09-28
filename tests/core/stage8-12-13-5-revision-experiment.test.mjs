// PURPOSE: A fictional, non-sensitive fixture testing read-only revision guards.
// SECURITY: Model suggestions can never silently remove old knowledge or validate the wrong speaker.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateRevisionDraft } from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const old = [
  { id: 'prior-1', statement: 'Wants to make new friends.' },
  { id: 'prior-2', statement: 'Prefers small gatherings.' }
];
const source = 'Agent: Would you like to go hiking?\nUser: I would like to join a small weekend hiking group.';
const matchUser = (_source, quote) => {
  // IT: Only the user's own source turn is eligible as evidence.
  const own = 'I would like to join a small weekend hiking group.';
  return own.includes(quote) ? quote : null;
};
const output = {
  revisedUnderstanding: 'The person is interested in developing friendships through a small hiking group.',
  existingKnowledge: [
    { claimId: 'prior-1', action: 'REFINES', proposedStatement: 'Wants to make friends through hiking.', evidenceQuote: 'I would like to join a small weekend hiking group.' },
    { claimId: 'prior-2', action: 'UNCHANGED' }
  ],
  newKnowledge: [
    { kind: 'WANT', certainty: 'DIRECT', statement: 'Wants to join a small weekend hiking group.', evidenceQuote: 'I would like to join a small weekend hiking group.' }
  ]
};

test('valid direct revision preserves every prior claim and exact target evidence', () => {
  const result = validateRevisionDraft(output, old, source, matchUser);
  assert.equal(result.validForReview, true);
  assert.equal(result.omittedClaimIds.length, 0);
  assert.equal(result.proposals[0].evidenceValid, true);
});

test('omitted prior claims cannot be silently lost', () => {
  const result = validateRevisionDraft({ ...output, existingKnowledge: output.existingKnowledge.slice(0, 1) }, old, source, matchUser);
  assert.equal(result.validForReview, false);
  assert.deepEqual(result.omittedClaimIds, ['prior-2']);
});

test('wrong-speaker claims remain visible but invalid, not auto-confirmed', () => {
  const result = validateRevisionDraft({ ...output, newKnowledge: [{ kind: 'WANT', statement: 'Wants to go hiking.', evidenceQuote: 'Would you like to go hiking?' }] }, old, source, matchUser);
  assert.equal(result.proposals[0].evidenceValid, false);
  assert.equal(result.validForReview, false);
});

test('invalid model action, duplicate prior claims and missing quote are reported', () => {
  const result = validateRevisionDraft({ ...output,
    existingKnowledge: [output.existingKnowledge[0], output.existingKnowledge[0], { claimId: 'prior-2', action: 'DELETE' }],
    newKnowledge: [{ kind: 'FACT', statement: 'Unsupported', evidenceQuote: '' }]
  }, old, source, matchUser);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.length >= 3);
});

test('experiment has explicit feature, consent and no-write boundaries', () => {
  const svc = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  const route = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', import.meta.url), 'utf8');
  assert.match(svc, /DATING_REVISION_EXPERIMENT === 'YES'/);
  assert.match(svc, /NODE_ENV !== 'production'/);
  assert.match(svc, /requireSourceReflection\(scope/);
  assert.match(svc, /listUnderstandingTopics\(scope/);
  assert.doesNotMatch(svc, /\.(create|update|delete|upsert)\(/);
  assert.match(route, /form\.get\('consent'\) !== 'YES'/);
  assert.match(route, /revisionExperimentEnabled\(\)/);
});

test('experiment never silently truncates sensitive prior knowledge or transcripts', () => {
  const svc = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  assert.match(svc, /existing\.length > 45/);
  assert.match(svc, /context\.length > 21000/);
  assert.match(svc, /oldText\.length > 14500/);
});

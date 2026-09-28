// PURPOSE: Deterministic guards for topic discovery and turn-anchored read-only revision.
// SECURITY: Unknown topics and other-speaker evidence must never become valid proposals.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateTopicImpactDraft, validateTurnAnchoredRevisionDraft } from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const topics = [
  { id: 'topic-relationship', label: 'Romantic relationships / Desired relationship' },
  { id: 'topic-readiness', label: 'Romantic relationships / Relationship readiness' }
];
const allTurns = [
  { id: 'T001', speaker: 'Agent', text: 'Agent: What are you looking for?', target: false },
  { id: 'T002', speaker: 'User', text: 'User: I would like a strong relationship.', target: true },
  { id: 'T003', speaker: 'User', text: 'User: Commitment also feels heavy sometimes.', target: true }
];
const targetTurns = allTurns.filter(turn => turn.target);
const existing = [{ id: 'claim-1', statement: 'Is open to a relationship.' }];

test('topic impact analysis accepts only authorised existing topic IDs', () => {
  const result = validateTopicImpactDraft({
    affectedTopics: [
      { topicId: 'topic-relationship', impact: 'SIGNIFICANT', reason: 'New explicit relationship preference.' },
      { topicId: 'unknown-topic', impact: 'SIGNIFICANT', reason: 'Should fail closed.' }
    ],
    suggestedNewTopics: [{ realm: 'Family', name: 'Having children', reason: 'No current topic fits.' }]
  }, topics);
  assert.equal(result.impacts.length, 1);
  assert.equal(result.impacts[0].topicId, 'topic-relationship');
  assert.equal(result.newTopics.length, 1);
  assert.equal(result.errors.length, 1);
});

test('turn-anchored revision accepts target speaker IDs and resolves exact source turns locally', () => {
  const result = validateTurnAnchoredRevisionDraft({
    revisedUnderstanding: 'The person wants a strong relationship while retaining some uncertainty about commitment.',
    existingKnowledge: [{ claimId: 'claim-1', action: 'REFINES', proposedStatement: 'Wants a strong relationship.', reason: 'More explicit preference.', evidenceTurnIds: ['T002'] }],
    newKnowledge: [{ kind: 'CONSTRAINT', certainty: 'DIRECT', statement: 'Commitment can feel heavy.', evidenceTurnIds: ['T003'] }]
  }, existing, targetTurns, allTurns);
  assert.equal(result.validForReview, true);
  assert.equal(result.changes[0].evidenceTurns[0].text, 'User: I would like a strong relationship.');
  assert.equal(result.proposals[0].evidenceTurnIds[0], 'T003');
});

test('agent turn cannot validate a claim about the target person', () => {
  const result = validateTurnAnchoredRevisionDraft({
    revisedUnderstanding: 'The person wants a strong relationship.',
    existingKnowledge: [{ claimId: 'claim-1', action: 'UNCHANGED' }],
    newKnowledge: [{ kind: 'WANT', certainty: 'DIRECT', statement: 'Wants a relationship.', evidenceTurnIds: ['T001'] }]
  }, existing, targetTurns, allTurns);
  assert.equal(result.validForReview, false);
  assert.equal(result.proposals[0].evidenceValid, false);
  assert.match(result.errors.join(' '), /non-target speaker/);
});

test('omitted prior claims are still surfaced instead of being silently lost', () => {
  const result = validateTurnAnchoredRevisionDraft({
    revisedUnderstanding: 'The person wants a strong relationship.',
    existingKnowledge: [],
    newKnowledge: []
  }, existing, targetTurns, allTurns);
  assert.equal(result.validForReview, false);
  assert.deepEqual(result.omittedClaimIds, ['claim-1']);
});

test('service performs topic discovery before scoped topic revision and remains read-only', () => {
  const svc = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  const route = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', import.meta.url), 'utf8');
  assert.match(svc, /identifyAffectedTopicsReadOnly/);
  assert.match(svc, /evidenceTurnIds/);
  assert.match(svc, /TARGET-SPEAKER TURN IDS/);
  assert.match(svc, /validateTurnAnchoredRevisionDraft/);
  assert.doesNotMatch(svc, /prisma\.(create|update|delete|upsert)/);
  assert.match(route, /analyseTopics/);
  assert.match(route, /reviseTopics/);
  assert.match(route, /form\.get\('consent'\) !== 'YES'/);
});

test('topic revisions are bounded and hidden topic IDs are revalidated server-side', () => {
  const route = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', import.meta.url), 'utf8');
  const svc = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  assert.match(route, /topicIds\.length > 6/);
  assert.match(route, /reviseTopicReadOnly\(scope, sourceId, topicId\)/);
  assert.match(svc, /topics\.find\(item => item\.id === topicId\)/);
  assert.match(svc, /existing\.length > 45/);
});

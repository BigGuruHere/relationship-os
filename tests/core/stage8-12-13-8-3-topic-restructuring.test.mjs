import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateTopicRestructureDraft } from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const prior = [
  { targetKey: 'rel:partner', topicName: 'Romantic relationships / Desired partner qualities', proposedUnderstanding: 'Wants an intelligent partner and previously mixed family and mutual-care material into this topic.', sourceInteractionId: 's3' },
  { targetKey: 'family:kids', topicName: 'Family / Children', proposedUnderstanding: 'Previously considered more children but now does not want to pursue having more children.', sourceInteractionId: 's3' }
];

const cleanFamilyAudit = {
  targetKey: 'family:kids',
  semanticConcepts: ['current position on having more children'],
  contaminationFlags: ['NONE'],
  overlappingTargetKeys: [],
  recommendedOperation: 'KEEP',
  keepCoherent: true,
  explanation: 'One coherent family-planning topic.'
};

const contaminatedPartnerAudit = {
  targetKey: 'rel:partner',
  semanticConcepts: ['partner attributes', 'mutual-care relationship dynamic'],
  contaminationFlags: ['MULTIPLE_INDEPENDENT_CONCEPTS', 'BELONGS_ELSEWHERE'],
  overlappingTargetKeys: [],
  recommendedOperation: 'SPLIT',
  keepCoherent: false,
  explanation: 'Partner traits and reciprocity can evolve independently.'
};

test('8.12.13.8.3.1 restructuring may split one prior topic but cannot omit another', () => {
  const result = validateTopicRestructureDraft({
    topicAudits: [contaminatedPartnerAudit, cleanFamilyAudit],
    proposedTopics: [
      { targetKey: 'rel:partner', realm: 'Romantic relationships', topicName: 'Desired partner qualities', operation: 'NARROW', sourceTargetKeys: ['rel:partner'], proposedUnderstanding: 'Wants an intelligent partner and other enduring partner qualities only.', reason: 'Keep partner traits narrow.' },
      { realm: 'Romantic relationships', topicName: 'Mutual care', operation: 'SPLIT', sourceTargetKeys: ['rel:partner'], proposedUnderstanding: 'Values voluntary mutual consideration rather than obligation.', reason: 'Separate relationship dynamic from partner traits.' },
      { targetKey: 'family:kids', realm: 'Family', topicName: 'Children', operation: 'KEEP', sourceTargetKeys: ['family:kids'], proposedUnderstanding: 'Previously considered more children but now does not want to pursue having more children.', reason: 'Already coherent.' }
    ]
  }, prior);
  assert.equal(result.validForReview, true);
  assert.equal(result.coverage.find(row => row.targetKey === 'rel:partner').proposedTopicCount, 2);
  assert.equal(result.omittedTargetKeys.length, 0);
  assert.equal(result.audits.length, 2);
});

test('8.12.13.8.3.1 rejects KEEP when contamination audit says split or narrow', () => {
  const result = validateTopicRestructureDraft({
    topicAudits: [contaminatedPartnerAudit, cleanFamilyAudit],
    proposedTopics: [
      { targetKey: 'rel:partner', realm: 'Romantic relationships', topicName: 'Desired partner qualities', operation: 'KEEP', sourceTargetKeys: ['rel:partner'], proposedUnderstanding: 'Keeps partner qualities plus mutual-care material together in one topic.', reason: 'Keep.' },
      { targetKey: 'family:kids', realm: 'Family', topicName: 'Children', operation: 'KEEP', sourceTargetKeys: ['family:kids'], proposedUnderstanding: 'Previously considered more children but now does not want to pursue having more children.', reason: 'Already coherent.' }
    ]
  }, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(item => item.includes('conflicts with its structural contamination audit')));
});

test('8.12.13.8.3.1 rejects missing structural audits and silent topic loss', () => {
  const result = validateTopicRestructureDraft({
    topicAudits: [contaminatedPartnerAudit],
    proposedTopics: [
      { targetKey: 'rel:partner', realm: 'Romantic relationships', topicName: 'Desired partner qualities', operation: 'NARROW', sourceTargetKeys: ['rel:partner'], proposedUnderstanding: 'Wants an intelligent partner and other enduring partner qualities only.', reason: 'Narrow.' }
    ]
  }, prior);
  assert.equal(result.validForReview, false);
  assert.deepEqual(result.omittedTargetKeys, ['family:kids']);
  assert.ok(result.errors.some(item => item.includes('Missing structural contamination audit')));
});

test('8.12.13.8.3.1 service forces contamination checks before KEEP and preserves provenance', () => {
  const service = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  assert.match(service, /restructureLivingUnderstandingReadOnly/);
  assert.match(service, /STRUCTURAL ONLY/);
  assert.match(service, /structural contamination/);
  assert.match(service, /KEEP is a strong conclusion/);
  assert.match(service, /MULTIPLE_INDEPENDENT_CONCEPTS/);
  assert.match(service, /sourceInteractionIds/);
  assert.match(service, /restructuredLongitudinalSeed/);
});

test('8.12.13.8.3.1 route reauthorises provenance and UI exposes contamination audit', () => {
  const route = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte', import.meta.url), 'utf8');
  assert.match(route, /restructureTopics/);
  assert.match(route, /provenanceIds/);
  assert.match(route, /requireSourceReflection\(scope, sourceId\)/);
  assert.match(page, /Review the topic structure/);
  assert.match(page, /EXPERIMENTAL TOPIC RESTRUCTURING - NOT SAVED/);
  assert.match(page, /Structural contamination audit/);
  assert.match(page, /KEEP coherent/);
  assert.match(page, /Continue from the restructured baseline/);
});

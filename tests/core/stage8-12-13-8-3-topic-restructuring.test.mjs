import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateTopicRestructureDraft } from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const prior = [
  { targetKey: 'rel:partner', topicName: 'Romantic relationships / Desired partner qualities', proposedUnderstanding: 'Wants an intelligent partner and previously mixed family and mutual-care material into this topic.', sourceInteractionId: 's3' },
  { targetKey: 'family:kids', topicName: 'Family / Children', proposedUnderstanding: 'Previously considered more children but now does not want to pursue having more children.', sourceInteractionId: 's3' }
];

test('8.12.13.8.3 restructuring may split one prior topic but cannot omit another', () => {
  const result = validateTopicRestructureDraft({ proposedTopics: [
    { targetKey: 'rel:partner', realm: 'Romantic relationships', topicName: 'Desired partner qualities', operation: 'NARROW', sourceTargetKeys: ['rel:partner'], proposedUnderstanding: 'Wants an intelligent partner and other enduring partner qualities only.', reason: 'Keep partner traits narrow.' },
    { realm: 'Romantic relationships', topicName: 'Mutual care', operation: 'SPLIT', sourceTargetKeys: ['rel:partner'], proposedUnderstanding: 'Values voluntary mutual consideration rather than obligation.', reason: 'Separate relationship dynamic from partner traits.' },
    { targetKey: 'family:kids', realm: 'Family', topicName: 'Children', operation: 'KEEP', sourceTargetKeys: ['family:kids'], proposedUnderstanding: 'Previously considered more children but now does not want to pursue having more children.', reason: 'Already coherent.' }
  ]}, prior);
  assert.equal(result.validForReview, true);
  assert.equal(result.coverage.find(row => row.targetKey === 'rel:partner').proposedTopicCount, 2);
  assert.equal(result.omittedTargetKeys.length, 0);
});

test('8.12.13.8.3 restructuring rejects silent topic loss', () => {
  const result = validateTopicRestructureDraft({ proposedTopics: [
    { targetKey: 'rel:partner', realm: 'Romantic relationships', topicName: 'Desired partner qualities', operation: 'KEEP', sourceTargetKeys: ['rel:partner'], proposedUnderstanding: 'Wants an intelligent partner and other enduring partner qualities only.', reason: 'Keep.' }
  ]}, prior);
  assert.equal(result.validForReview, false);
  assert.deepEqual(result.omittedTargetKeys, ['family:kids']);
});

test('8.12.13.8.3 service is structural only and preserves provenance', () => {
  const service = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  assert.match(service, /restructureLivingUnderstandingReadOnly/);
  assert.match(service, /STRUCTURAL ONLY/);
  assert.match(service, /Every prior topic must remain represented/);
  assert.match(service, /sourceInteractionIds/);
  assert.match(service, /restructuredLongitudinalSeed/);
});

test('8.12.13.8.3 route reauthorises provenance and UI exposes read-only structural review', () => {
  const route = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte', import.meta.url), 'utf8');
  assert.match(route, /restructureTopics/);
  assert.match(route, /provenanceIds/);
  assert.match(route, /requireSourceReflection\(scope, sourceId\)/);
  assert.match(page, /Review the topic structure/);
  assert.match(page, /EXPERIMENTAL TOPIC RESTRUCTURING - NOT SAVED/);
  assert.match(page, /Every prior topic must be represented/);
  assert.match(page, /Continue from the restructured baseline/);
  assert.match(page, /restructuredLongitudinalSeed/);
});

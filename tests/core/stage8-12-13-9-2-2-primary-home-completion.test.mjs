import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateTopicRestructureDraft } from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const prior = [
  { targetKey: 'rel:goal', topicName: 'Romantic relationships / Desired relationship', proposedUnderstanding: 'The speaker wants a relationship and is open to meeting someone and seeing what develops.', sourceInteractionId: 's3' },
  { targetKey: 'rel:readiness', topicName: 'Romantic relationships / Relationship readiness', proposedUnderstanding: 'The speaker wants a relationship and is open to meeting someone and seeing what develops, but remains unsure whether they are ready now.', sourceInteractionId: 's3' }
];

function check(ref, meaning, fit = 'PURPOSE_CONTEXT_FIT') {
  return { meaningUnitRef: ref, proposedMeaning: meaning, fidelity: 'SAME_MEANING', primaryHomeFit: fit, explanation: 'Meaning and purpose preserved.' };
}

function rawDraft() {
  return {
    validationContractVersion: '8.12.13.9.2.2',
    semanticIdentityAuditComplete: false,
    topicAudits: [
      {
        targetKey: 'rel:goal', semanticConcepts: ['Relationship goal and openness'], contaminationFlags: ['NONE'], overlappingTargetKeys: ['rel:readiness'], recommendedOperation: 'NARROW', keepCoherent: false, titleFitsCurrentState: true, explanation: 'Primary relationship goal.',
        meaningUnits: [{ unitId: 'M1', sourceExcerpt: prior[0].proposedUnderstanding, temporalRole: 'CURRENT', purposeContext: 'Relationship goal and present openness to meeting someone.' }]
      },
      {
        targetKey: 'rel:readiness', semanticConcepts: ['Repeated goal', 'Readiness uncertainty'], contaminationFlags: ['MULTIPLE_INDEPENDENT_CONCEPTS', 'DUPLICATES_OTHER_TOPIC'], overlappingTargetKeys: ['rel:goal'], recommendedOperation: 'SPLIT', keepCoherent: false, titleFitsCurrentState: true, explanation: 'Separate duplicate goal from readiness.',
        meaningUnits: [
          { unitId: 'M1', sourceExcerpt: 'The speaker wants a relationship and is open to meeting someone and seeing what develops,', temporalRole: 'CURRENT', purposeContext: 'Repeats the relationship goal as context for readiness.' },
          { unitId: 'M2', sourceExcerpt: 'but remains unsure whether they are ready now.', temporalRole: 'CURRENT', purposeContext: 'Current relationship readiness uncertainty.' }
        ]
      }
    ],
    semanticOverlapGroups: [{
      groupId: 'G1', meaningUnitRefs: ['rel:goal#M1', 'rel:readiness#M1'], relationship: 'EQUIVALENT', canonicalMeaning: 'The speaker wants a relationship and is open to meeting someone.'
    }],
    proposedTopics: [
      {
        realm: 'Romantic relationships', topicName: 'Desired relationship', operation: 'NARROW', sourceTargetKeys: ['rel:goal', 'rel:readiness'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['rel:goal#M1', 'rel:readiness#M1'], primaryMeaningUnitRefs: ['rel:goal#M1'],
        meaningChecks: [check('rel:goal#M1', 'Wants a relationship and remains open.'), check('rel:readiness#M1', 'Wants a relationship and remains open.')],
        proposedUnderstanding: 'The speaker wants a relationship and is open to meeting someone and seeing what develops.', reason: 'The relationship goal and openness have their primary home here by purpose and context.'
      },
      {
        realm: 'Romantic relationships', topicName: 'Relationship readiness', operation: 'NARROW', sourceTargetKeys: ['rel:readiness'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['rel:readiness#M2'], primaryMeaningUnitRefs: ['rel:readiness#M2'], meaningChecks: [check('rel:readiness#M2', 'Unsure whether ready now.')],
        proposedUnderstanding: 'The speaker remains unsure whether they are ready for a serious relationship now.', reason: 'Keeps current readiness uncertainty distinct from the relationship goal.'
      }
    ]
  };
}

test('9.2.2 deterministically fills a missing primary home from a single-home overlap group', () => {
  const result = validateTopicRestructureDraft(rawDraft(), prior);
  assert.equal(result.validForReview, true, result.errors.join('\n'));
  const inherited = result.ownership.find(item => item.ref === 'rel:readiness#M1');
  assert.equal(inherited.primaryHome, 'Romantic relationships / Desired relationship');
  assert.equal(inherited.primaryHomeFit, 'PURPOSE_CONTEXT_FIT');
  assert.equal(inherited.primaryHomeSource, 'OVERLAP_GROUP');
  const desired = result.proposedTopics.find(topic => topic.label === 'Romantic relationships / Desired relationship');
  assert.ok(desired.primaryMeaningUnitRefs.includes('rel:readiness#M1'));
});

test('9.2.2 does not invent a home when the candidate topic does not represent the missing unit', () => {
  const raw = rawDraft();
  raw.proposedTopics[0].meaningUnitRefs = ['rel:goal#M1'];
  raw.proposedTopics[0].meaningChecks = [check('rel:goal#M1', 'Wants a relationship and remains open.')];
  const result = validateTopicRestructureDraft(raw, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('rel:readiness#M1 must have exactly one primary semantic home; found 0')));
});

test('9.2.2 does not inherit through an unsafe semantic mapping', () => {
  const raw = rawDraft();
  raw.proposedTopics[0].meaningChecks[1].primaryHomeFit = 'AMBIGUOUS';
  const result = validateTopicRestructureDraft(raw, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('rel:readiness#M1 must have exactly one primary semantic home; found 0')));
});

test('9.2.2 service and UI expose primary-home completion without changing the architecture', () => {
  const service = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte', import.meta.url), 'utf8');
  assert.match(service, /validationContractVersion: '8\.12\.15'/);
  assert.match(service, /server may only inherit a missing home/);
  assert.match(page, /server-resolved from semantic identity group/);
});

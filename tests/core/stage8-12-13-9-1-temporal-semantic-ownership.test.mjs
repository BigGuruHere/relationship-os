import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateTopicRestructureDraft } from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const prior = [
  {
    targetKey: 'rel:history',
    topicName: 'Romantic relationships / Relationship history and patterns',
    proposedUnderstanding: 'The speaker mostly had casual connections in the past. Serious relationships currently feel heavy and risky.',
    sourceInteractionId: 's3'
  },
  {
    targetKey: 'family:parenting',
    topicName: 'Family / Parenting expectations',
    proposedUnderstanding: 'The speaker would like a partner who can be available and caring for children as a mother.',
    sourceInteractionId: 's3'
  }
];

function audit(targetKey, units) {
  return {
    targetKey,
    semanticConcepts: units.map(unit => unit.sourceExcerpt),
    contaminationFlags: ['MULTIPLE_INDEPENDENT_CONCEPTS'],
    overlappingTargetKeys: [],
    recommendedOperation: 'SPLIT',
    keepCoherent: false,
    titleFitsCurrentState: true,
    titleCurrentStateConcern: '',
    explanation: 'Separate independent meaning and time.',
    meaningUnitsComplete: true,
    meaningUnits: units
  };
}

const audits = [
  audit('rel:history', [
    { unitId: 'M1', sourceExcerpt: 'The speaker mostly had casual connections in the past.', temporalRole: 'HISTORICAL' },
    { unitId: 'M2', sourceExcerpt: 'Serious relationships currently feel heavy and risky.', temporalRole: 'CURRENT' }
  ]),
  {
    ...audit('family:parenting', [
      { unitId: 'M1', sourceExcerpt: 'The speaker would like a partner who can be available and caring for children as a mother.', temporalRole: 'CURRENT' }
    ]),
    contaminationFlags: ['NONE'],
    recommendedOperation: 'KEEP',
    keepCoherent: true,
    explanation: 'One coherent parenting-expectations topic.'
  }
];

function same(ref, proposedMeaning) {
  return { meaningUnitRef: ref, proposedMeaning, fidelity: 'SAME_MEANING', explanation: 'No change in meaning.' };
}

test('9.1 gives current readiness and historical pattern different primary temporal homes', () => {
  const result = validateTopicRestructureDraft({
    validationContractVersion: '8.12.13.9.1',
    topicAudits: audits,
    proposedTopics: [
      {
        realm: 'Romantic relationships', topicName: 'Relationship history and patterns', operation: 'NARROW', sourceTargetKeys: ['rel:history'], temporalScope: 'HISTORICAL',
        meaningUnitRefs: ['rel:history#M1'], primaryMeaningUnitRefs: ['rel:history#M1'], meaningChecks: [same('rel:history#M1', 'Mostly had casual connections in the past.')],
        proposedUnderstanding: 'The speaker mostly had casual connections in the past.', reason: 'Historical material only.'
      },
      {
        realm: 'Romantic relationships', topicName: 'Relationship readiness', operation: 'SPLIT', sourceTargetKeys: ['rel:history'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['rel:history#M2'], primaryMeaningUnitRefs: ['rel:history#M2'], meaningChecks: [same('rel:history#M2', 'Serious relationships currently feel heavy and risky.')],
        proposedUnderstanding: 'Serious relationships currently feel heavy and risky.', reason: 'Current readiness owns current concern.'
      },
      {
        realm: 'Family', topicName: 'Parenting expectations', operation: 'KEEP', sourceTargetKeys: ['family:parenting'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['family:parenting#M1'], primaryMeaningUnitRefs: ['family:parenting#M1'], meaningChecks: [same('family:parenting#M1', 'Wants a partner able to be available and caring for children as a mother.')],
        proposedUnderstanding: 'The speaker would like a partner who can be available and caring for children as a mother.', reason: 'Preserve exact family meaning.'
      }
    ]
  }, prior);
  assert.equal(result.validForReview, true);
  assert.equal(result.ownership.find(row => row.ref === 'rel:history#M2').primaryHome, 'Romantic relationships / Relationship readiness');
});

test('9.1 rejects current meaning whose primary home is historical', () => {
  const result = validateTopicRestructureDraft({
    validationContractVersion: '8.12.13.9.1',
    topicAudits: audits,
    proposedTopics: [
      {
        realm: 'Romantic relationships', topicName: 'Relationship history and patterns', operation: 'NARROW', sourceTargetKeys: ['rel:history'], temporalScope: 'HISTORICAL',
        meaningUnitRefs: ['rel:history#M1', 'rel:history#M2'], primaryMeaningUnitRefs: ['rel:history#M1', 'rel:history#M2'],
        meaningChecks: [same('rel:history#M1', 'Past casual connections.'), same('rel:history#M2', 'Current heaviness.')],
        proposedUnderstanding: 'The speaker mostly had casual connections in the past and serious relationships currently feel heavy and risky.', reason: 'Incorrect temporal mixing.'
      },
      {
        realm: 'Family', topicName: 'Parenting expectations', operation: 'KEEP', sourceTargetKeys: ['family:parenting'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['family:parenting#M1'], primaryMeaningUnitRefs: ['family:parenting#M1'], meaningChecks: [same('family:parenting#M1', 'Parenting availability.')],
        proposedUnderstanding: 'The speaker would like a partner who can be available and caring for children as a mother.', reason: 'Preserve.'
      }
    ]
  }, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('cannot have a historical primary home')));
});

test('9.1 requires exactly one primary semantic home for every durable meaning unit', () => {
  const result = validateTopicRestructureDraft({
    validationContractVersion: '8.12.13.9.1',
    topicAudits: audits,
    proposedTopics: [
      {
        realm: 'Romantic relationships', topicName: 'History', operation: 'SPLIT', sourceTargetKeys: ['rel:history'], temporalScope: 'HISTORICAL',
        meaningUnitRefs: ['rel:history#M1'], primaryMeaningUnitRefs: ['rel:history#M1'], meaningChecks: [same('rel:history#M1', 'History.')],
        proposedUnderstanding: 'The speaker mostly had casual connections in the past.', reason: 'History.'
      },
      {
        realm: 'Romantic relationships', topicName: 'Readiness', operation: 'SPLIT', sourceTargetKeys: ['rel:history'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['rel:history#M2'], primaryMeaningUnitRefs: [], meaningChecks: [same('rel:history#M2', 'Readiness.')],
        proposedUnderstanding: 'Serious relationships currently feel heavy and risky.', reason: 'Readiness.'
      },
      {
        realm: 'Family', topicName: 'Parenting expectations', operation: 'KEEP', sourceTargetKeys: ['family:parenting'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['family:parenting#M1'], primaryMeaningUnitRefs: ['family:parenting#M1'], meaningChecks: [same('family:parenting#M1', 'Parenting availability.')],
        proposedUnderstanding: 'The speaker would like a partner who can be available and caring for children as a mother.', reason: 'Preserve.'
      }
    ]
  }, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('must have exactly one primary semantic home')));
});

test('9.1 rejects semantic strengthening such as parenting availability becoming a desire for family', () => {
  const result = validateTopicRestructureDraft({
    validationContractVersion: '8.12.13.9.1',
    topicAudits: audits,
    proposedTopics: [
      {
        realm: 'Romantic relationships', topicName: 'History', operation: 'SPLIT', sourceTargetKeys: ['rel:history'], temporalScope: 'HISTORICAL',
        meaningUnitRefs: ['rel:history#M1'], primaryMeaningUnitRefs: ['rel:history#M1'], meaningChecks: [same('rel:history#M1', 'History.')],
        proposedUnderstanding: 'The speaker mostly had casual connections in the past.', reason: 'History.'
      },
      {
        realm: 'Romantic relationships', topicName: 'Readiness', operation: 'SPLIT', sourceTargetKeys: ['rel:history'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['rel:history#M2'], primaryMeaningUnitRefs: ['rel:history#M2'], meaningChecks: [same('rel:history#M2', 'Readiness.')],
        proposedUnderstanding: 'Serious relationships currently feel heavy and risky.', reason: 'Readiness.'
      },
      {
        realm: 'Family', topicName: 'Family intentions', operation: 'RECLASSIFY', sourceTargetKeys: ['family:parenting'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['family:parenting#M1'], primaryMeaningUnitRefs: ['family:parenting#M1'],
        meaningChecks: [{ meaningUnitRef: 'family:parenting#M1', proposedMeaning: 'The speaker wants a partner who wants a family.', fidelity: 'STRENGTHENED', explanation: 'This adds a family intention not present in the source meaning.' }],
        proposedUnderstanding: 'The speaker wants a partner who wants a family.', reason: 'Unsafe strengthening.'
      }
    ]
  }, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('Semantic mutation STRENGTHENED')));
});

test('9.1 service and UI expose the temporal ownership and no-semantic-mutation contract', () => {
  const service = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte', import.meta.url), 'utf8');
  assert.match(service, /exactly one PRIMARY semantic home/);
  assert.match(service, /CURRENT meaning must not be moved into a HISTORICAL topic/);
  assert.match(service, /does NOT mean partner wants a family/);
  assert.match(service, /fidelity: 'SAME_MEANING \| STRENGTHENED \| WEAKENED \| INFERRED \| TEMPORAL_SHIFT'/);
  assert.match(page, /Temporal and semantic ownership validation/);
  assert.match(page, /Primary home/);
});

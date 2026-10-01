import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateTopicRestructureDraft } from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const persistence = fs.readFileSync('src/lib/server/datingPersistedLivingUnderstanding.ts', 'utf8');
const experiment = fs.readFileSync('src/lib/server/datingUnderstandingRevisionExperiment.ts', 'utf8');

const prior = [{
  targetKey: 'rel:dynamics',
  topicName: 'Romantic relationships / Desired relationship dynamics',
  proposedUnderstanding: 'The speaker wants closeness while maintaining individuality, voluntary mutual care without duty, and to feel seen along the journey.',
  sourceInteractionId: 's1'
}];

function same(ref, meaning) {
  return { meaningUnitRef: ref, proposedMeaning: meaning, fidelity: 'SAME_MEANING', primaryHomeFit: 'PURPOSE_CONTEXT_FIT', explanation: 'Meaning and purpose preserved.' };
}

function coherentRaw() {
  return {
    validationContractVersion: '8.12.13.9.2.2',
    semanticIdentityAuditComplete: false,
    topicAudits: [{
      targetKey: 'rel:dynamics',
      semanticConcepts: ['Closeness with individuality', 'Voluntary reciprocity', 'Feeling seen'],
      contaminationFlags: ['COHERENT_MULTI_DIMENSIONAL'],
      overlappingTargetKeys: [],
      recommendedOperation: 'MERGE',
      keepCoherent: false,
      titleFitsCurrentState: true,
      explanation: 'Several distinguishable dimensions share one enduring relationship-dynamics purpose.',
      meaningUnits: [
        { unitId: 'M1', sourceExcerpt: 'The speaker wants closeness while maintaining individuality,', temporalRole: 'CURRENT', purposeContext: 'Desired relationship dynamic balancing closeness and individuality.' },
        { unitId: 'M2', sourceExcerpt: 'voluntary mutual care without duty,', temporalRole: 'CURRENT', purposeContext: 'Desired reciprocal care dynamic within the relationship.' },
        { unitId: 'M3', sourceExcerpt: 'and to feel seen along the journey.', temporalRole: 'CURRENT', purposeContext: 'Desired relational experience of being seen within partnership.' }
      ]
    }],
    semanticOverlapGroups: [],
    proposedTopics: [{
      realm: 'Romantic relationships',
      topicName: 'Desired relationship dynamics',
      operation: 'MERGE',
      sourceTargetKeys: ['rel:dynamics'],
      temporalScope: 'CURRENT',
      meaningUnitRefs: ['rel:dynamics#M1', 'rel:dynamics#M2', 'rel:dynamics#M3'],
      primaryMeaningUnitRefs: ['rel:dynamics#M1', 'rel:dynamics#M2', 'rel:dynamics#M3'],
      meaningChecks: [
        same('rel:dynamics#M1', 'Closeness with individuality.'),
        same('rel:dynamics#M2', 'Voluntary reciprocal care without duty.'),
        same('rel:dynamics#M3', 'Feeling seen along the journey.')
      ],
      proposedUnderstanding: prior[0].proposedUnderstanding,
      reason: 'All three dimensions have the same primary semantic purpose: the desired way the relationship is experienced and conducted.'
    }]
  };
}

test('8.12.14.2 gives Living Understanding adoption a local 15 second transaction timeout', () => {
  assert.match(persistence, /const ADOPTION_TRANSACTION_TIMEOUT_MS = 15_000;/);
  assert.match(persistence, /\{ timeout: ADOPTION_TRANSACTION_TIMEOUT_MS \}\);/);
});

test('8.12.14.2 allows coherent multi-dimensional topics to retain one primary semantic home', () => {
  const result = validateTopicRestructureDraft(coherentRaw(), prior);
  assert.equal(result.validForReview, true, result.errors.join('\n'));
  assert.equal(result.errors.length, 0);
});

test('8.12.14.2 still rejects genuinely independent concepts left in one home', () => {
  const raw = coherentRaw();
  raw.topicAudits[0].contaminationFlags = ['MULTIPLE_INDEPENDENT_CONCEPTS'];
  raw.topicAudits[0].recommendedOperation = 'RENAME';
  raw.topicAudits[0].explanation = 'These meanings have materially different semantic purposes and require separate homes.';
  raw.proposedTopics[0].operation = 'RENAME';
  const result = validateTopicRestructureDraft(raw, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('were not separated into distinct primary semantic homes')));
});

test('8.12.14.2 rejects contradictory independent and coherent-multidimensional flags', () => {
  const raw = coherentRaw();
  raw.topicAudits[0].contaminationFlags = ['MULTIPLE_INDEPENDENT_CONCEPTS', 'COHERENT_MULTI_DIMENSIONAL'];
  const result = validateTopicRestructureDraft(raw, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('both independent and coherently multi-dimensional')));
});

test('8.12.14.2 prompt teaches coherent topic boundaries without weakening ownership rules', () => {
  assert.match(experiment, /COHERENT_MULTI_DIMENSIONAL/);
  assert.match(experiment, /Do not split merely because one rich topic has several related dimensions/);
  assert.match(experiment, /MULTIPLE_INDEPENDENT_CONCEPTS only when the concepts have materially different semantic purposes/);
  assert.match(experiment, /COHERENT_MULTI_DIMENSIONAL does not by itself require a split/);
});

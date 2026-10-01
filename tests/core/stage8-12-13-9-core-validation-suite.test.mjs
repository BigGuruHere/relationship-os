import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validateLongitudinalAnalysisDraft,
  validateLongitudinalOperationalDraft,
  validateSemanticDecompositionDraft,
  validateTopicRestructureDraft
} from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const targetTurns = [
  { id: 'T001', speaker: 'User', target: true, text: 'I still want a strong relationship.' },
  { id: 'T002', speaker: 'User', target: true, text: 'I want something close, but with more room for independence.' },
  { id: 'T003', speaker: 'User', target: true, text: 'I do not think I want more children anymore.' },
  { id: 'T004', speaker: 'User', target: true, text: 'Maybe I want children, but I am not sure.' },
  { id: 'T005', speaker: 'User', target: true, text: 'I like tennis, and I also want a serious relationship.' },
  { id: 'T006', speaker: 'User', target: true, text: 'Do not search yet. I want to keep talking about it.' },
  { id: 'T007', speaker: 'User', target: true, text: 'My friend says I am too picky, but I do not agree.' },
  { id: 'T008', speaker: 'User', target: true, text: 'Work is busy this week.' }
];
const contextTurns = [
  ...targetTurns,
  { id: 'A001', speaker: 'Agent', target: false, text: 'You clearly want children and should prioritize that.' },
  { id: 'O001', speaker: 'Other', target: false, text: 'He definitely wants children.' }
];

const relationshipSeed = {
  targetKey: 'rel:goal',
  topicName: 'Romantic relationships / Relationship goals',
  proposedUnderstanding: 'The speaker wants a strong romantic relationship and hopes to build a life with someone.',
  sourceInteractionId: 's1'
};
const familySeed = {
  targetKey: 'family:kids',
  topicName: 'Family / Having more children',
  proposedUnderstanding: 'The speaker previously wanted to have more children, although this was not a settled plan.',
  sourceInteractionId: 's1'
};

function analyse(topicEffects, priorSeeds = [relationshipSeed], newTopics = []) {
  return validateLongitudinalAnalysisDraft({ topicEffects, newTopics }, priorSeeds, targetTurns, contextTurns);
}

test('core case 1 - reinforcement preserves the topic and requires direct target-speaker evidence', () => {
  const result = analyse([{ targetKey: 'rel:goal', effect: 'REINFORCED', reason: 'Directly restated.', relevantTurnIds: ['T001'] }]);
  assert.equal(result.validForReview, true);
  assert.equal(result.topicEffects[0].effect, 'REINFORCED');
  assert.deepEqual(result.topicEffects[0].relevantTurnIds, ['T001']);
});

test('core case 2 - refinement can make an existing understanding more precise without replacing it', () => {
  const result = analyse([{ targetKey: 'rel:goal', effect: 'REFINED', reason: 'Adds individuality as a more precise condition.', relevantTurnIds: ['T002'] }]);
  assert.equal(result.validForReview, true);
  assert.equal(result.topicEffects[0].effect, 'REFINED');
});

test('core case 3 - direct contradiction is reviewable but cannot use a non-target speaker as evidence', () => {
  const invalid = analyse([{ targetKey: 'rel:goal', effect: 'CONTRADICTED', reason: 'Agent conflicts with prior understanding.', relevantTurnIds: ['A001'] }]);
  assert.equal(invalid.validForReview, false);
  assert.ok(invalid.errors.some(error => error.includes('non-target speaker')));

  const valid = analyse([{ targetKey: 'rel:goal', effect: 'CONTRADICTED', reason: 'Target speaker directly conflicts with prior understanding.', relevantTurnIds: ['T002'] }]);
  assert.equal(valid.validForReview, true);
});

test('core case 4 - supersession and operational retirement preserve the old proposition while proposing a current replacement', () => {
  const topicResult = analyse([
    { targetKey: 'rel:goal', effect: 'UNCHANGED', reason: 'Not addressed.', relevantTurnIds: [] },
    { targetKey: 'family:kids', effect: 'SUPERSEDED', reason: 'Explicit reversal.', relevantTurnIds: ['T003'] }
  ], [relationshipSeed, familySeed]);
  assert.equal(topicResult.validForReview, true);
  assert.equal(topicResult.topicEffects.find(row => row.targetKey === 'family:kids').effect, 'SUPERSEDED');

  const priorUnits = [{ unitId: 'U01', statement: 'The speaker wants to have more children.' }];
  const operational = validateLongitudinalOperationalDraft({
    existingOperationalKnowledge: [{ unitId: 'U01', action: 'POTENTIAL_RETIREMENT', proposedStatement: 'The speaker no longer wants to have more children.', reason: 'Explicit reversal.', evidenceTurnIds: ['T003'] }]
  }, priorUnits, targetTurns, contextTurns);
  assert.equal(operational.validForReview, true);
  assert.equal(operational.changes[0].action, 'POTENTIAL_RETIREMENT');
  assert.equal(priorUnits[0].statement, 'The speaker wants to have more children.');
});

test('core case 5 - uncertainty remains explicit in independently controllable knowledge', () => {
  const result = validateLongitudinalOperationalDraft({
    existingOperationalKnowledge: [],
    newOperationalKnowledge: [{
      kind: 'WANT',
      certainty: 'UNCERTAIN',
      statement: 'The speaker may want more children but is not sure.',
      operationalReasons: ['MATCHING'],
      evidenceTurnIds: ['T004']
    }]
  }, [], targetTurns, contextTurns);
  assert.equal(result.validForReview, true);
  assert.equal(result.additions[0].certainty, 'UNCERTAIN');
});

test('core case 6 - one utterance can support two semantic areas without forcing one compound topic', () => {
  const topics = [
    { id: 'leisure', realmName: 'Lifestyle', name: 'Leisure activities' },
    { id: 'relationship', realmName: 'Romantic relationships', name: 'Relationship goals' }
  ];
  const result = validateSemanticDecompositionDraft({
    areas: [
      { areaId: 'A01', realm: 'Lifestyle', existingTopicId: 'leisure', suggestedTopicName: '', impact: 'SIGNIFICANT', summary: 'Enjoys tennis.', reason: 'Leisure preference.', relevantTurnIds: ['T005'] },
      { areaId: 'A02', realm: 'Romantic relationships', existingTopicId: 'relationship', suggestedTopicName: '', impact: 'SIGNIFICANT', summary: 'Wants a serious relationship.', reason: 'Relationship goal.', relevantTurnIds: ['T005'] }
    ],
    operationalKnowledge: []
  }, topics, targetTurns, contextTurns);
  assert.equal(result.validForReview, true);
  assert.equal(result.areas.length, 2);
  assert.notEqual(result.areas[0].existingTopicId, result.areas[1].existingTopicId);
});

test('core case 7 - contaminated topics can be split without silently losing the original topic', () => {
  const prior = [{
    targetKey: 'rel:mixed',
    topicName: 'Romantic relationships / Desired partner qualities',
    proposedUnderstanding: 'The speaker values intelligence in a partner and also wants voluntary mutual care in the relationship.',
    sourceInteractionId: 's2'
  }];
  const result = validateTopicRestructureDraft({
    topicAudits: [{
      targetKey: 'rel:mixed',
      semanticConcepts: ['partner attributes', 'mutual-care relationship dynamic'],
      contaminationFlags: ['MULTIPLE_INDEPENDENT_CONCEPTS', 'BELONGS_ELSEWHERE'],
      overlappingTargetKeys: [],
      recommendedOperation: 'SPLIT',
      keepCoherent: false,
      titleFitsCurrentState: true,
      titleCurrentStateConcern: '',
      explanation: 'The concepts can evolve independently.'
    }],
    proposedTopics: [
      { realm: 'Romantic relationships', topicName: 'Desired partner qualities', operation: 'SPLIT', sourceTargetKeys: ['rel:mixed'], proposedUnderstanding: 'The speaker values intelligence and other partner attributes.', reason: 'Keep partner traits together.' },
      { realm: 'Romantic relationships', topicName: 'Relationship values', operation: 'SPLIT', sourceTargetKeys: ['rel:mixed'], proposedUnderstanding: 'The speaker values voluntary mutual care rather than obligation.', reason: 'Separate relationship dynamic.' }
    ]
  }, prior);
  assert.equal(result.validForReview, true);
  assert.equal(result.coverage[0].proposedTopicCount, 2);
});

test('core case 8 - temporary interaction instructions remain interaction state rather than durable person knowledge', () => {
  const result = validateLongitudinalOperationalDraft({
    existingOperationalKnowledge: [],
    newOperationalKnowledge: [],
    newInteractionState: [{ statement: 'Do not search yet; keep discussing the topic.', evidenceTurnIds: ['T006'] }]
  }, [], targetTurns, contextTurns);
  assert.equal(result.validForReview, true);
  assert.equal(result.additions.length, 0);
  assert.equal(result.interactionState.length, 1);
});

test('core case 9 - third-party and agent statements cannot become evidence about the target person', () => {
  const fromOther = analyse([{ targetKey: 'rel:goal', effect: 'REINFORCED', reason: 'Other person says so.', relevantTurnIds: ['O001'] }]);
  const fromAgent = analyse([{ targetKey: 'rel:goal', effect: 'REINFORCED', reason: 'Agent says so.', relevantTurnIds: ['A001'] }]);
  assert.equal(fromOther.validForReview, false);
  assert.equal(fromAgent.validForReview, false);
  assert.ok(fromOther.errors.some(error => error.includes('non-target speaker')));
  assert.ok(fromAgent.errors.some(error => error.includes('non-target speaker')));
});

test('core case 10 - unrelated later conversation leaves prior topics unchanged and cannot silently omit one', () => {
  const complete = analyse([
    { targetKey: 'rel:goal', effect: 'UNCHANGED', reason: 'Later source is about work.', relevantTurnIds: [] },
    { targetKey: 'family:kids', effect: 'UNCHANGED', reason: 'Later source is about work.', relevantTurnIds: [] }
  ], [relationshipSeed, familySeed]);
  assert.equal(complete.validForReview, true);
  assert.equal(complete.omittedTargetKeys.length, 0);

  const omitted = analyse([
    { targetKey: 'rel:goal', effect: 'UNCHANGED', reason: 'Later source is about work.', relevantTurnIds: [] }
  ], [relationshipSeed, familySeed]);
  assert.equal(omitted.validForReview, false);
  assert.deepEqual(omitted.omittedTargetKeys, ['family:kids']);
});

test('core suite prompt contracts preserve the architecture invariants used by the live model path', () => {
  const service = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  assert.match(service, /only target-speaker turns describe the target person directly/i);
  assert.match(service, /Preserve uncertainty/);
  assert.match(service, /Do not treat absence from the new source as contradiction or supersession/);
  assert.match(service, /Retirement requires explicit evidence/);
  assert.match(service, /OWN persistent matching, permission, disclosure, verification, retrieval or action rule/);
  assert.match(service, /STRUCTURAL ONLY/);
  assert.match(service, /exactly one PRIMARY semantic home/);
  assert.match(service, /Do not strengthen, weaken, infer, or temporally shift meaning/);
});

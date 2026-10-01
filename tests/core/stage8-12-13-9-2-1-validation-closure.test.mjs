import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateTopicRestructureDraft } from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const prior = [
  { targetKey: 'work:mixed', topicName: 'Work and career / Business priorities', proposedUnderstanding: 'Building his own business is important to him. He sometimes spends too much time working alone.', sourceInteractionId: 's3' },
  { targetKey: 'social:circle', topicName: 'Friendships and social life / Social Circle', proposedUnderstanding: 'He is considering joining a tennis club to meet people and build his social circle.', sourceInteractionId: 's3' },
  { targetKey: 'leisure:activities', topicName: 'Leisure and recreation / Preferred activities', proposedUnderstanding: 'He enjoys playing tennis for recreation.', sourceInteractionId: 's3' }
];

function same(ref, meaning, fit = 'PURPOSE_CONTEXT_FIT') {
  return { meaningUnitRef: ref, proposedMeaning: meaning, fidelity: 'SAME_MEANING', primaryHomeFit: fit, explanation: 'Meaning and purpose preserved.' };
}

function baseRaw() {
  return {
    validationContractVersion: '8.12.13.9.2.1',
    semanticIdentityAuditComplete: false,
    topicAudits: [
      {
        targetKey: 'work:mixed', semanticConcepts: ['Business importance', 'Working alone'], contaminationFlags: ['MULTIPLE_INDEPENDENT_CONCEPTS'], overlappingTargetKeys: [], recommendedOperation: 'SPLIT', keepCoherent: false, titleFitsCurrentState: true, explanation: 'Independent concepts.',
        meaningUnits: [
          { unitId: 'M1', sourceExcerpt: 'Building his own business is important to him.', temporalRole: 'CURRENT', purposeContext: 'Work priority concerning importance of building the business.' },
          { unitId: 'M2', sourceExcerpt: 'He sometimes spends too much time working alone.', temporalRole: 'CURRENT', purposeContext: 'Work pattern concerning time spent working alone.' }
        ]
      },
      {
        targetKey: 'social:circle', semanticConcepts: ['Tennis club as social tactic'], contaminationFlags: ['NONE'], overlappingTargetKeys: [], recommendedOperation: 'KEEP', keepCoherent: true, titleFitsCurrentState: true, explanation: 'Social goal.',
        meaningUnits: [{ unitId: 'M1', sourceExcerpt: 'He is considering joining a tennis club to meet people and build his social circle.', temporalRole: 'CURRENT', purposeContext: 'Social tactic and plan for meeting people and building the social circle.' }]
      },
      {
        targetKey: 'leisure:activities', semanticConcepts: ['Tennis recreation'], contaminationFlags: ['NONE'], overlappingTargetKeys: [], recommendedOperation: 'KEEP', keepCoherent: true, titleFitsCurrentState: true, explanation: 'Recreation preference.',
        meaningUnits: [{ unitId: 'M1', sourceExcerpt: 'He enjoys playing tennis for recreation.', temporalRole: 'CURRENT', purposeContext: 'Recreation preference and activity enjoyment.' }]
      }
    ],
    semanticOverlapGroups: [],
    proposedTopics: [
      {
        realm: 'Work and career', topicName: 'Business priorities', operation: 'SPLIT', sourceTargetKeys: ['work:mixed'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['work:mixed#M1'], primaryMeaningUnitRefs: ['work:mixed#M1'], meaningChecks: [same('work:mixed#M1', 'Building his own business is important.')], proposedUnderstanding: 'Building his own business is important to him.', reason: 'Keeps the work priority as a business priority.'
      },
      {
        realm: 'Work and career', topicName: 'Working alone', operation: 'SPLIT', sourceTargetKeys: ['work:mixed'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['work:mixed#M2'], primaryMeaningUnitRefs: ['work:mixed#M2'], meaningChecks: [same('work:mixed#M2', 'He sometimes spends too much time working alone.')], proposedUnderstanding: 'He sometimes spends too much time working alone.', reason: 'Keeps the work pattern as a working-alone pattern.'
      },
      {
        realm: 'Friendships and social life', topicName: 'Social Circle', operation: 'KEEP', sourceTargetKeys: ['social:circle'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['social:circle#M1'], primaryMeaningUnitRefs: ['social:circle#M1'], meaningChecks: [same('social:circle#M1', 'Considering a tennis club to meet people.')], proposedUnderstanding: prior[1].proposedUnderstanding, reason: 'The social tactic serves the goal of meeting people and building the social circle.'
      },
      {
        realm: 'Leisure and recreation', topicName: 'Preferred activities', operation: 'KEEP', sourceTargetKeys: ['leisure:activities'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['leisure:activities#M1'], primaryMeaningUnitRefs: ['leisure:activities#M1'], meaningChecks: [same('leisure:activities#M1', 'Enjoys tennis for recreation.')], proposedUnderstanding: prior[2].proposedUnderstanding, reason: 'The activity is explicitly an enjoyment and recreation preference.'
      }
    ]
  };
}

test('9.2.1 derives semantic identity completion without trusting the model boolean', () => {
  const result = validateTopicRestructureDraft(baseRaw(), prior);
  assert.equal(result.validForReview, true, result.errors.join('\n'));
  assert.equal(result.semanticIdentityComplete, true);
});

test('9.2.1 rejects MULTIPLE_INDEPENDENT_CONCEPTS when they remain in one primary home', () => {
  const raw = baseRaw();
  raw.topicAudits[0].recommendedOperation = 'RENAME';
  raw.proposedTopics = raw.proposedTopics.filter(topic => topic.topicName !== 'Working alone');
  raw.proposedTopics[0].operation = 'RENAME';
  raw.proposedTopics[0].topicName = 'Business and working alone';
  raw.proposedTopics[0].meaningUnitRefs = ['work:mixed#M1', 'work:mixed#M2'];
  raw.proposedTopics[0].primaryMeaningUnitRefs = ['work:mixed#M1', 'work:mixed#M2'];
  raw.proposedTopics[0].meaningChecks = [same('work:mixed#M1', 'Business matters.'), same('work:mixed#M2', 'Works alone too much.')];
  raw.proposedTopics[0].proposedUnderstanding = prior[0].proposedUnderstanding;
  raw.proposedTopics[0].reason = 'Broad work topic.';
  const result = validateTopicRestructureDraft(raw, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('were not separated into distinct primary semantic homes')));
  assert.ok(result.errors.some(error => error.includes('identifies multiple independent concepts but recommends RENAME')));
});

test('9.2.1 purpose-context backstop rejects a social tactic assigned to leisure on surface terms', () => {
  const raw = baseRaw();
  raw.proposedTopics[2].meaningUnitRefs = [];
  raw.proposedTopics[2].primaryMeaningUnitRefs = [];
  raw.proposedTopics[2].meaningChecks = [];
  raw.proposedTopics[3].sourceTargetKeys = ['leisure:activities', 'social:circle'];
  raw.proposedTopics[3].meaningUnitRefs = ['leisure:activities#M1', 'social:circle#M1'];
  raw.proposedTopics[3].primaryMeaningUnitRefs = ['leisure:activities#M1', 'social:circle#M1'];
  raw.proposedTopics[3].meaningChecks = [same('leisure:activities#M1', 'Enjoys tennis.'), same('social:circle#M1', 'Considering tennis club.')];
  raw.proposedTopics[3].proposedUnderstanding = 'He enjoys tennis and is considering a tennis club to meet people.';
  raw.proposedTopics[3].reason = 'Recreation preference and preferred activities.';
  const result = validateTopicRestructureDraft(raw, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('Primary-home purpose backstop found no semantic support for social:circle#M1')));
});

test('9.2.1 prompt and UI describe server-derived completion and closure rules', () => {
  const service = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte', import.meta.url), 'utf8');
  assert.match(service, /server derives completion independently/);
  assert.match(service, /at least two distinct primary semantic homes/);
  assert.match(service, /reason for each proposed topic must explicitly explain/);
  assert.match(page, /Completion is derived by the server/);
});

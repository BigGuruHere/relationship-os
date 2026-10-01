import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateTopicRestructureDraft } from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const prior = [
  {
    targetKey: 'social:circle',
    topicName: 'Friendships and social life / Social Circle',
    proposedUnderstanding: 'He wants a broader social life. He is considering joining a tennis club to meet people.',
    sourceInteractionId: 's3'
  },
  {
    targetKey: 'leisure:activities',
    topicName: 'Leisure and recreation / Preferred activities',
    proposedUnderstanding: 'He enjoys playing tennis and walking along the beach.',
    sourceInteractionId: 's3'
  },
  {
    targetKey: 'rel:goal',
    topicName: 'Romantic relationships / Desired relationship',
    proposedUnderstanding: 'He is open to meeting someone and seeing what develops.',
    sourceInteractionId: 's3'
  },
  {
    targetKey: 'rel:readiness',
    topicName: 'Romantic relationships / Relationship readiness',
    proposedUnderstanding: 'He remains open to meeting someone to see what develops, although he is unsure whether he is ready for a serious relationship.',
    sourceInteractionId: 's3'
  }
];

function audit(targetKey, units, operation = 'KEEP') {
  return {
    targetKey,
    semanticConcepts: units.map(unit => unit.sourceExcerpt),
    contaminationFlags: operation === 'KEEP' ? ['NONE'] : ['DUPLICATES_OTHER_TOPIC'],
    overlappingTargetKeys: [],
    recommendedOperation: operation,
    keepCoherent: operation === 'KEEP',
    titleFitsCurrentState: true,
    titleCurrentStateConcern: '',
    explanation: 'Fixture audit.',
    meaningUnitsComplete: false,
    meaningUnits: units
  };
}

const units = {
  social: [
    { unitId: 'M1', sourceExcerpt: 'He wants a broader social life.', temporalRole: 'CURRENT', purposeContext: 'Current goal to expand social connection.' },
    { unitId: 'M2', sourceExcerpt: 'He is considering joining a tennis club to meet people.', temporalRole: 'CURRENT', purposeContext: 'Tentative tactic for meeting people and building the social circle.' }
  ],
  leisure: [
    { unitId: 'M1', sourceExcerpt: 'He enjoys playing tennis and walking along the beach.', temporalRole: 'CURRENT', purposeContext: 'Activities enjoyed for recreation.' }
  ],
  goal: [
    { unitId: 'M1', sourceExcerpt: 'He is open to meeting someone and seeing what develops.', temporalRole: 'CURRENT', purposeContext: 'Current openness within the romantic relationship goal.' }
  ],
  readiness: [
    { unitId: 'M1', sourceExcerpt: 'He remains open to meeting someone to see what develops,', temporalRole: 'CURRENT', purposeContext: 'The same openness stance expressed while discussing readiness.' },
    { unitId: 'M2', sourceExcerpt: 'although he is unsure whether he is ready for a serious relationship.', temporalRole: 'CURRENT', purposeContext: 'Current uncertainty about serious-relationship readiness.' }
  ]
};

function same(ref, meaning, fit = 'PURPOSE_CONTEXT_FIT') {
  return { meaningUnitRef: ref, proposedMeaning: meaning, fidelity: 'SAME_MEANING', primaryHomeFit: fit, explanation: 'Meaning and purpose preserved.' };
}

function baseRaw() {
  return {
    validationContractVersion: '8.12.13.9.2',
    semanticIdentityAuditComplete: true,
    topicAudits: [
      audit('social:circle', units.social),
      audit('leisure:activities', units.leisure),
      { ...audit('rel:goal', units.goal, 'NARROW'), overlappingTargetKeys: ['rel:readiness'] },
      { ...audit('rel:readiness', units.readiness, 'NARROW'), overlappingTargetKeys: ['rel:goal'] }
    ],
    semanticOverlapGroups: [
      {
        groupId: 'G1',
        meaningUnitRefs: ['rel:goal#M1', 'rel:readiness#M1'],
        relationship: 'SUBSTANTIALLY_OVERLAPPING',
        canonicalMeaning: 'He is open to meeting someone and seeing what develops.'
      }
    ],
    proposedTopics: [
      {
        realm: 'Friendships and social life', topicName: 'Social Circle', operation: 'KEEP', sourceTargetKeys: ['social:circle'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['social:circle#M1', 'social:circle#M2'], primaryMeaningUnitRefs: ['social:circle#M1', 'social:circle#M2'],
        meaningChecks: [same('social:circle#M1', 'He wants a broader social life.'), same('social:circle#M2', 'He is considering a tennis club in order to meet people.')],
        proposedUnderstanding: prior[0].proposedUnderstanding, reason: 'Social purpose remains primary.'
      },
      {
        realm: 'Leisure and recreation', topicName: 'Preferred activities', operation: 'KEEP', sourceTargetKeys: ['leisure:activities'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['leisure:activities#M1'], primaryMeaningUnitRefs: ['leisure:activities#M1'],
        meaningChecks: [same('leisure:activities#M1', prior[1].proposedUnderstanding)], proposedUnderstanding: prior[1].proposedUnderstanding, reason: 'Recreation preference.'
      },
      {
        realm: 'Romantic relationships', topicName: 'Desired relationship', operation: 'NARROW', sourceTargetKeys: ['rel:goal', 'rel:readiness'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['rel:goal#M1', 'rel:readiness#M1'], primaryMeaningUnitRefs: ['rel:goal#M1', 'rel:readiness#M1'],
        meaningChecks: [same('rel:goal#M1', 'Open to meeting someone.'), same('rel:readiness#M1', 'Open to meeting someone.')],
        proposedUnderstanding: 'He is open to meeting someone and seeing what develops.', reason: 'One primary home for shared openness.'
      },
      {
        realm: 'Romantic relationships', topicName: 'Relationship readiness', operation: 'NARROW', sourceTargetKeys: ['rel:readiness'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['rel:readiness#M2'], primaryMeaningUnitRefs: ['rel:readiness#M2'],
        meaningChecks: [same('rel:readiness#M2', 'He is unsure whether he is ready for a serious relationship.')],
        proposedUnderstanding: 'He is unsure whether he is ready for a serious relationship.', reason: 'Readiness only.'
      }
    ]
  };
}

test('9.2 derives meaning coverage from exact source excerpts instead of trusting a model completeness boolean', () => {
  const raw = baseRaw();
  const result = validateTopicRestructureDraft(raw, prior);
  assert.equal(result.validForReview, true, result.errors.join('\n'));
  assert.ok(result.audits.every(item => item.meaningUnitsComplete));
});

test('9.2 rejects incomplete exact-excerpt coverage even when the model claims completeness', () => {
  const raw = baseRaw();
  raw.topicAudits[0].meaningUnitsComplete = true;
  raw.topicAudits[0].meaningUnits = [units.social[0]];
  const result = validateTopicRestructureDraft(raw, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('Meaning-unit coverage for Friendships and social life / Social Circle is incomplete')));
});

test('9.2 requires semantically overlapping units to converge on one primary home', () => {
  const raw = baseRaw();
  raw.proposedTopics[2].meaningUnitRefs = ['rel:goal#M1'];
  raw.proposedTopics[2].primaryMeaningUnitRefs = ['rel:goal#M1'];
  raw.proposedTopics[2].meaningChecks = [same('rel:goal#M1', 'Open to meeting someone.')];
  raw.proposedTopics[3].meaningUnitRefs = ['rel:readiness#M1', 'rel:readiness#M2'];
  raw.proposedTopics[3].primaryMeaningUnitRefs = ['rel:readiness#M1', 'rel:readiness#M2'];
  raw.proposedTopics[3].meaningChecks = [same('rel:readiness#M1', 'Open to meeting someone.'), same('rel:readiness#M2', 'Unsure about readiness.')];
  const result = validateTopicRestructureDraft(raw, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('Semantic overlap group G1 has multiple primary homes')));
});

test('9.2 rejects primary ownership chosen from a surface noun instead of proposition purpose', () => {
  const raw = baseRaw();
  raw.proposedTopics[0].meaningUnitRefs = ['social:circle#M1'];
  raw.proposedTopics[0].primaryMeaningUnitRefs = ['social:circle#M1'];
  raw.proposedTopics[0].meaningChecks = [same('social:circle#M1', 'Broader social life.')];
  raw.proposedTopics[1].sourceTargetKeys = ['leisure:activities', 'social:circle'];
  raw.proposedTopics[1].meaningUnitRefs = ['leisure:activities#M1', 'social:circle#M2'];
  raw.proposedTopics[1].primaryMeaningUnitRefs = ['leisure:activities#M1', 'social:circle#M2'];
  raw.proposedTopics[1].meaningChecks = [same('leisure:activities#M1', 'Enjoys tennis.'), same('social:circle#M2', 'Considering tennis club.', 'SURFACE_ONLY')];
  raw.proposedTopics[1].proposedUnderstanding = 'He enjoys tennis and is considering joining a tennis club to meet people.';
  const result = validateTopicRestructureDraft(raw, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('not grounded in purpose/context')));
});

test('9.2 requires a complete semantic identity audit', () => {
  const raw = baseRaw();
  raw.semanticIdentityAuditComplete = false;
  const result = validateTopicRestructureDraft(raw, prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('Semantic identity audit was not declared complete')));
});

test('9.2 service and UI expose coverage, semantic identity and purpose-context ownership', () => {
  const service = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte', import.meta.url), 'utf8');
  assert.match(service, /server will verify coverage from the excerpts themselves/);
  assert.match(service, /semanticOverlapGroups/);
  assert.match(service, /purposeContext/);
  assert.match(service, /SURFACE_ONLY/);
  assert.match(page, /Semantic identity validation/);
  assert.match(page, /Meaning coverage/);
  assert.match(page, /Purpose\/context/);
});

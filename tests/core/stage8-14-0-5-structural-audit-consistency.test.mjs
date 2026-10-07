// Stage 8.14.0.5 - legitimate overlap must not make a coherent KEEP audit self-contradictory.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateTopicRestructureDraft } from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const prior = [
  {
    targetKey: 'work:agent',
    topicName: 'Work and Projects / Intentional Networking Agent',
    proposedUnderstanding: 'The user is developing an idea for an agent that helps people clarify why they attend networking events.',
    sourceInteractionId: 'source-1'
  },
  {
    targetKey: 'values:connection',
    topicName: 'Values / Mutual and Genuine Connections',
    proposedUnderstanding: 'The user believes honest conversations about what people seek can make networking more genuine.',
    sourceInteractionId: 'source-1'
  }
];

function check(ref, proposedMeaning) {
  return {
    meaningUnitRef: ref,
    proposedMeaning,
    fidelity: 'SAME_MEANING',
    primaryHomeFit: 'PURPOSE_CONTEXT_FIT',
    explanation: 'Meaning remains in its own purpose/context.'
  };
}

function makeDraft(version = '8.14.0', relationship = 'LEGITIMATE_CROSS_TOPIC_RELEVANCE') {
  return {
    validationContractVersion: version,
    semanticIdentityAuditComplete: true,
    topicAudits: [
      {
        targetKey: 'work:agent',
        semanticConcepts: ['Agent approach'],
        contaminationFlags: ['NONE'],
        overlappingTargetKeys: ['values:connection'],
        recommendedOperation: 'KEEP',
        keepCoherent: false,
        titleFitsCurrentState: true,
        explanation: 'The shared networking theme has a distinct product role here.',
        meaningUnits: [{
          unitId: 'M1',
          sourceExcerpt: prior[0].proposedUnderstanding,
          temporalRole: 'CURRENT',
          purposeContext: 'Product concept and intended function.'
        }]
      },
      {
        targetKey: 'values:connection',
        semanticConcepts: ['Genuine connection'],
        contaminationFlags: ['NONE'],
        overlappingTargetKeys: ['work:agent'],
        recommendedOperation: 'KEEP',
        keepCoherent: false,
        titleFitsCurrentState: true,
        explanation: 'The shared networking theme has a distinct values role here.',
        meaningUnits: [{
          unitId: 'M1',
          sourceExcerpt: prior[1].proposedUnderstanding,
          temporalRole: 'CURRENT',
          purposeContext: 'Value placed on honest and genuine connection.'
        }]
      }
    ],
    semanticOverlapGroups: [{
      groupId: 'G1',
      meaningUnitRefs: ['work:agent#M1', 'values:connection#M1'],
      relationship,
      canonicalMeaning: 'Clarity about what people seek can relate to more intentional and genuine networking.'
    }],
    proposedTopics: [
      {
        targetKey: 'work:agent', realm: 'Work and Projects', topicName: 'Intentional Networking Agent', operation: 'KEEP',
        sourceTargetKeys: ['work:agent'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['work:agent#M1'], primaryMeaningUnitRefs: ['work:agent#M1'],
        meaningChecks: [check('work:agent#M1', 'The product concept helps people clarify why they attend networking events.')],
        proposedUnderstanding: prior[0].proposedUnderstanding,
        reason: 'Keep the coherent product concept.'
      },
      {
        targetKey: 'values:connection', realm: 'Values', topicName: 'Mutual and Genuine Connections', operation: 'KEEP',
        sourceTargetKeys: ['values:connection'], temporalScope: 'CURRENT',
        meaningUnitRefs: ['values:connection#M1'], primaryMeaningUnitRefs: ['values:connection#M1'],
        meaningChecks: [check('values:connection#M1', 'Honest conversations support genuine connection.')],
        proposedUnderstanding: prior[1].proposedUnderstanding,
        reason: 'Keep the coherent values topic.'
      }
    ]
  };
}

test('8.14.0 treats legitimate overlappingTargetKeys as compatible with coherent KEEP', () => {
  const result = validateTopicRestructureDraft(makeDraft(), prior);
  assert.equal(result.flexibleOverlapContract, true);
  assert.equal(result.audits[0].keepCoherent, true);
  assert.equal(result.audits[1].keepCoherent, true);
  assert.equal(result.validForReview, true, result.errors.join('\n'));
});

test('8.14.0 still rejects redundant duplication across distinct canonical homes', () => {
  const result = validateTopicRestructureDraft(makeDraft('8.14.0', 'REDUNDANT_DUPLICATION'), prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('multiple canonical homes')));
});

test('legacy structural contract still treats overlapping KEEP as incoherent', () => {
  const raw = makeDraft('8.12.15', 'SUBSTANTIALLY_OVERLAPPING');
  const result = validateTopicRestructureDraft(raw, prior);
  assert.equal(result.flexibleOverlapContract, false);
  assert.equal(result.audits[0].keepCoherent, false);
  assert.equal(result.validForReview, false);
});

test('initial and bounded-repair prompts explicitly align KEEP coherence with legitimate overlap', () => {
  const service = fs.readFileSync('src/lib/server/datingUnderstandingRevisionExperiment.ts', 'utf8');
  assert.match(service, /overlappingTargetKeys does not by itself make KEEP incoherent/);
  assert.match(service, /KEEP requires keepCoherent=true when there is no genuine contamination or title problem/);
});

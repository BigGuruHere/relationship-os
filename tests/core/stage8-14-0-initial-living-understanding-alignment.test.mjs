// Stage 8.14.0 - initial Living Understanding uses the same semantic-overlap philosophy as longitudinal updates.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateTopicRestructureDraft } from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const prior = [
  {
    targetKey: 'rel:readiness',
    topicName: 'Relationships / Readiness for a Serious Relationship',
    proposedUnderstanding: 'He feels increasingly ready for a serious relationship because maintaining independence would make commitment feel more attractive.',
    sourceInteractionId: 'source-1'
  },
  {
    targetKey: 'rel:dynamic',
    topicName: 'Relationships / Desired Relationship Dynamic',
    proposedUnderstanding: 'He wants a serious relationship where both partners maintain independent lives and deliberately create time together.',
    sourceInteractionId: 'source-1'
  }
];

function check(ref, meaning) {
  return {
    meaningUnitRef: ref,
    proposedMeaning: meaning,
    fidelity: 'SAME_MEANING',
    primaryHomeFit: 'PURPOSE_CONTEXT_FIT',
    explanation: 'The same autonomy theme is preserved for a distinct explanatory purpose.'
  };
}

function draft(relationship) {
  return {
    validationContractVersion: '8.14.0',
    semanticIdentityAuditComplete: true,
    topicAudits: [
      {
        targetKey: 'rel:readiness',
        semanticConcepts: ['Readiness shaped by autonomy'],
        contaminationFlags: ['COHERENT_MULTI_DIMENSIONAL'],
        overlappingTargetKeys: ['rel:dynamic'],
        recommendedOperation: 'NARROW',
        keepCoherent: false,
        titleFitsCurrentState: true,
        explanation: 'Readiness uses autonomy to explain why commitment feels more possible.',
        meaningUnits: [{
          unitId: 'M1',
          sourceExcerpt: prior[0].proposedUnderstanding,
          temporalRole: 'CURRENT',
          purposeContext: 'Relationship readiness and why autonomy makes commitment feel more attractive.'
        }]
      },
      {
        targetKey: 'rel:dynamic',
        semanticConcepts: ['Desired relationship dynamic with autonomy'],
        contaminationFlags: ['COHERENT_MULTI_DIMENSIONAL'],
        overlappingTargetKeys: ['rel:readiness'],
        recommendedOperation: 'NARROW',
        keepCoherent: false,
        titleFitsCurrentState: true,
        explanation: 'The desired dynamic describes how independent lives and chosen time together should work.',
        meaningUnits: [{
          unitId: 'M1',
          sourceExcerpt: prior[1].proposedUnderstanding,
          temporalRole: 'CURRENT',
          purposeContext: 'Desired relationship dynamic with independent lives and deliberate time together.'
        }]
      }
    ],
    semanticOverlapGroups: [{
      groupId: 'G1',
      meaningUnitRefs: ['rel:readiness#M1', 'rel:dynamic#M1'],
      relationship,
      canonicalMeaning: 'Maintaining independence within a serious relationship matters.'
    }],
    proposedTopics: [
      {
        targetKey: 'rel:readiness-v2',
        realm: 'Relationships',
        topicName: 'Readiness for a Serious Relationship',
        operation: 'NARROW',
        sourceTargetKeys: ['rel:readiness', 'rel:dynamic'],
        temporalScope: 'CURRENT',
        meaningUnitRefs: ['rel:readiness#M1', 'rel:dynamic#M1'],
        primaryMeaningUnitRefs: ['rel:readiness#M1'],
        meaningChecks: [
          check('rel:readiness#M1', 'Autonomy helps explain increasing readiness.'),
          check('rel:dynamic#M1', 'The desired independent dynamic helps explain readiness.')
        ],
        proposedUnderstanding: 'He feels increasingly ready for a serious relationship because a relationship that preserves independence and deliberately chosen time together makes commitment feel more attractive.',
        reason: 'Relationship readiness uses autonomy to explain why commitment feels more possible.'
      },
      {
        targetKey: 'rel:dynamic-v2',
        realm: 'Relationships',
        topicName: 'Desired Relationship Dynamic',
        operation: 'NARROW',
        sourceTargetKeys: ['rel:readiness', 'rel:dynamic'],
        temporalScope: 'CURRENT',
        meaningUnitRefs: ['rel:readiness#M1', 'rel:dynamic#M1'],
        primaryMeaningUnitRefs: ['rel:dynamic#M1'],
        meaningChecks: [
          check('rel:readiness#M1', 'Readiness reinforces why preserving autonomy matters in the relationship dynamic.'),
          check('rel:dynamic#M1', 'The desired dynamic keeps independent lives and deliberately chosen time together.')
        ],
        proposedUnderstanding: 'He wants a serious relationship where both partners maintain independent lives and deliberately create meaningful time together.',
        reason: 'The desired relationship dynamic describes how autonomy and deliberate togetherness should work.'
      }
    ]
  };
}

test('8.14.0 permits legitimate cross-topic relevance with distinct canonical anchors', () => {
  const result = validateTopicRestructureDraft(draft('LEGITIMATE_CROSS_TOPIC_RELEVANCE'), prior);
  assert.equal(result.flexibleOverlapContract, true);
  assert.equal(result.validForReview, true, result.errors.join('\n'));
  assert.equal(result.ownership.find(item => item.ref === 'rel:readiness#M1')?.primaryHome, 'Relationships / Readiness for a Serious Relationship');
  assert.equal(result.ownership.find(item => item.ref === 'rel:dynamic#M1')?.primaryHome, 'Relationships / Desired Relationship Dynamic');
});

test('8.14.0 still blocks redundant duplication from claiming multiple canonical homes', () => {
  const result = validateTopicRestructureDraft(draft('REDUNDANT_DUPLICATION'), prior);
  assert.equal(result.validForReview, false);
  assert.ok(result.errors.some(error => error.includes('multiple canonical homes')));
});

test('initial creation prompt adopts coherent-view overlap philosophy while legacy experiment remains available', () => {
  const service = fs.readFileSync('src/lib/server/datingUnderstandingRevisionExperiment.ts', 'utf8');
  const server = fs.readFileSync('src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', 'utf8');
  assert.match(service, /workflowMode === 'INITIAL' \? '8\.14\.0' : '8\.12\.15'/);
  assert.match(service, /Topics are coherent views of a person, not mutually exclusive containers/);
  assert.match(service, /Repair REDUNDANT_DUPLICATION and ACTUAL_TOPIC_CONTAMINATION/);
  assert.match(service, /Preserve LEGITIMATE_CROSS_TOPIC_RELEVANCE and SHARED_UNDERLYING_THEME/);
  assert.match(server, /initialCreationMode \? 'INITIAL' : 'EXPERIMENT'/);
});

test('normal initial-v1 UI hides operational-knowledge diagnostics but still carries them internally', () => {
  const page = fs.readFileSync('src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte', 'utf8');
  assert.match(page, /\{#if !data\.initialCreationMode && form\.semanticAnalysis\.analysis\.operationalUnits\.length\}/);
  assert.match(page, /\{#if !data\.initialCreationMode\}\s*<h3>Independently controllable knowledge proposed by the decomposition<\/h3>/);
  assert.match(page, /name="priorOperationalUnitsJson" value=\{serialiseOperationalUnits\(form\.operationalUnits \?\? \[\]\)\}/);
  assert.match(page, /Shared meaning may remain in more than one topic when each use has a distinct explanatory purpose/);
});

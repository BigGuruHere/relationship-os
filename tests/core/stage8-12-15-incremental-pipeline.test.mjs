import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateTopicRestructureDraft } from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const prior = [
  { targetKey: 'goal', topicName: 'Romantic relationships / Desired relationship', proposedUnderstanding: 'The speaker is open to meeting someone and seeing what develops.', sourceInteractionId: 's1' },
  { targetKey: 'ready', topicName: 'Romantic relationships / Relationship readiness', proposedUnderstanding: 'They remain open to meeting someone and seeing what develops, but are unsure whether they are ready.', sourceInteractionId: 's2' }
];

function draft(version) {
  return {
    validationContractVersion: version,
    topicAudits: [
      { targetKey:'goal', semanticConcepts:['Openness'], contaminationFlags:['DUPLICATES_OTHER_TOPIC'], overlappingTargetKeys:['ready'], recommendedOperation:'NARROW', keepCoherent:false, titleFitsCurrentState:true, explanation:'Relationship openness is duplicated in readiness context.', meaningUnits:[{unitId:'M1',sourceExcerpt:prior[0].proposedUnderstanding,temporalRole:'CURRENT',purposeContext:'Current relationship openness.'}] },
      { targetKey:'ready', semanticConcepts:['Openness','Readiness'], contaminationFlags:['MULTIPLE_INDEPENDENT_CONCEPTS','DUPLICATES_OTHER_TOPIC'], overlappingTargetKeys:['goal'], recommendedOperation:'SPLIT', keepCoherent:false, titleFitsCurrentState:true, explanation:'Separate duplicate openness.', meaningUnits:[{unitId:'M1',sourceExcerpt:'They remain open to meeting someone and seeing what develops,',temporalRole:'CURRENT',purposeContext:'Repeats current relationship openness as readiness context.'},{unitId:'M2',sourceExcerpt:'but are unsure whether they are ready.',temporalRole:'CURRENT',purposeContext:'Current romantic relationship readiness uncertainty.'}] }
    ],
    semanticOverlapGroups:[{groupId:'G1',meaningUnitRefs:['goal#M1','ready#M1'],relationship:'EQUIVALENT',canonicalMeaning:'The speaker is open to meeting someone and seeing what develops.'}],
    proposedTopics:[
      {realm:'Romantic relationships',topicName:'Desired relationship',operation:'NARROW',sourceTargetKeys:['goal'],temporalScope:'CURRENT',meaningUnitRefs:['goal#M1'],primaryMeaningUnitRefs:['goal#M1'],meaningChecks:[{meaningUnitRef:'goal#M1',proposedMeaning:'Open to meeting someone.',fidelity:'SAME_MEANING',primaryHomeFit:'PURPOSE_CONTEXT_FIT',explanation:'Same meaning.'}],proposedUnderstanding:'The speaker is open to meeting someone and seeing what develops.',reason:'Primary home for relationship openness.'},
      {realm:'Romantic relationships',topicName:'Relationship readiness',operation:'SPLIT',sourceTargetKeys:['ready'],temporalScope:'CURRENT',meaningUnitRefs:['ready#M1','ready#M2'],primaryMeaningUnitRefs:['ready#M2'],meaningChecks:[{meaningUnitRef:'ready#M1',proposedMeaning:'Open to meeting someone.',fidelity:'SAME_MEANING',primaryHomeFit:'PURPOSE_CONTEXT_FIT',explanation:'Cross reference only.'},{meaningUnitRef:'ready#M2',proposedMeaning:'Unsure whether ready.',fidelity:'SAME_MEANING',primaryHomeFit:'PURPOSE_CONTEXT_FIT',explanation:'Readiness home.'}],proposedUnderstanding:'They are unsure whether they are ready for a serious relationship.',reason:'Primary home for current romantic relationship readiness uncertainty.'}
    ]
  };
}

test('8.12.15 resolves ownership metadata from a declared identity group without duplicating prose', () => {
  const result = validateTopicRestructureDraft(draft('8.12.15'), prior);
  assert.equal(result.validForReview, true, result.errors.join('\n'));
  const item = result.ownership.find(row => row.ref === 'ready#M1');
  assert.equal(item.primaryHome, 'Romantic relationships / Desired relationship');
  assert.ok(['OVERLAP_GROUP','OVERLAP_GROUP_IDENTITY'].includes(item.primaryHomeSource));
});

test('8.12.15 adds encrypted non-authoritative checkpoints and retry-only structural workflow', () => {
  const schema = fs.readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../../src/lib/server/datingLivingUnderstandingDraft.ts', import.meta.url), 'utf8');
  const route = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte', import.meta.url), 'utf8');
  assert.match(schema, /model LivingUnderstandingDraft/);
  assert.match(service, /stateEnc: encrypt/);
  assert.match(service, /requireSourceReflection/);
  assert.match(route, /retryRestructuring/);
  assert.match(route, /saveLivingUnderstandingDraft\(scope, 'STRUCTURE_READY'/);
  assert.match(page, /Retry only the structural stage/);
  assert.match(page, /short-lived encrypted working checkpoint/);
});

test('8.12.15 draft table has owner, context and contact custody guards', () => {
  const migration = fs.readFileSync(new URL('../../prisma/migrations/20261002010000_stage8_13_0_longitudinal_living_understanding_foundation/migration.sql', import.meta.url), 'utf8');
  assert.match(migration, /LivingUnderstandingDraft_context_owner_guard/);
  assert.match(migration, /LivingUnderstandingDraft_context_reassignment_guard/);
  assert.match(migration, /LivingUnderstandingDraft_context_reference_guard/);
  assert.match(migration, /FOREIGN KEY \("contactId"\) REFERENCES "Contact"/);
});

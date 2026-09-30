import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validateSemanticDecompositionDraft,
  validateOperationalUnitsFromForm,
  consolidateSemanticAreasForRevision
} from '../../src/lib/server/datingUnderstandingRevisionPolicy.mjs';

const topics = [
  { id: 'topic-relationship', label: 'Romantic relationships / Desired relationship', realmName: 'Romantic relationships', topicName: 'Desired relationship' },
  { id: 'topic-partner', label: 'Romantic relationships / Preferred partner', realmName: 'Romantic relationships', topicName: 'Preferred partner' }
];
const targetTurns = [
  { id: 'T002', speaker: 'User', text: 'I want a strong relationship.', target: true },
  { id: 'T004', speaker: 'User', text: 'I would probably like children again.', target: true },
  { id: 'T006', speaker: 'User', text: 'I value someone intelligent and health conscious.', target: true }
];
const allTurns = [
  { id: 'T001', speaker: 'Agent', text: 'What do you want?', target: false },
  ...targetTurns
];

test('semantic decomposition maps narrow existing topics and can suggest a new topic', () => {
  const result = validateSemanticDecompositionDraft({
    areas: [
      { existingTopicId: 'topic-relationship', impact: 'SIGNIFICANT', reason: 'Relationship goal', relevantTurnIds: ['T002'] },
      { existingTopicId: 'topic-partner', impact: 'SIGNIFICANT', reason: 'Partner qualities', relevantTurnIds: ['T006'] },
      { existingTopicId: '', suggestedRealm: 'Family', suggestedTopic: 'Children', impact: 'POSSIBLE', reason: 'Family intention', relevantTurnIds: ['T004'] }
    ],
    operationalKnowledge: [
      { kind: 'WANT', certainty: 'DIRECT', statement: 'Wants a strong relationship.', operationalReasons: ['MATCHING', 'PERMISSION'], areaIndexes: [1], evidenceTurnIds: ['T002'] },
      { kind: 'WANT', certainty: 'UNCERTAIN', statement: 'Probably wants children again.', operationalReasons: ['MATCHING', 'DISCLOSURE'], areaIndexes: [1, 3], evidenceTurnIds: ['T004'] }
    ]
  }, topics, targetTurns, allTurns);

  assert.equal(result.areas.length, 3);
  assert.equal(result.areas[0].existingTopicId, 'topic-relationship');
  assert.equal(result.areas[2].proposedNewTopic, true);
  assert.equal(result.areas[2].label, 'Family / Children');
  assert.deepEqual(result.operationalUnits[1].areaIds, ['A01', 'A03']);
  assert.equal(result.validForReview, true);
});

test('semantic decomposition rejects non-target speaker evidence', () => {
  const result = validateSemanticDecompositionDraft({
    areas: [{ existingTopicId: 'topic-relationship', impact: 'SIGNIFICANT', reason: 'Bad evidence', relevantTurnIds: ['T001'] }],
    operationalKnowledge: []
  }, topics, targetTurns, allTurns);
  assert.equal(result.areas[0].evidenceValid, false);
  assert.ok(result.errors.some(item => item.includes('non-target speaker')));
});

test('operational knowledge must have an operational reason and can link to multiple areas', () => {
  const result = validateSemanticDecompositionDraft({
    areas: [
      { existingTopicId: 'topic-relationship', impact: 'SIGNIFICANT', reason: 'Goal', relevantTurnIds: ['T002'] },
      { existingTopicId: '', suggestedRealm: 'Family', suggestedTopic: 'Children', impact: 'POSSIBLE', reason: 'Children', relevantTurnIds: ['T004'] }
    ],
    operationalKnowledge: [
      { kind: 'WANT', certainty: 'UNCERTAIN', statement: 'Probably wants children again.', operationalReasons: ['MATCHING'], areaIndexes: [1, 2], evidenceTurnIds: ['T004'] },
      { kind: 'OTHER', certainty: 'DIRECT', statement: 'Nuance only.', operationalReasons: [], areaIndexes: [1], evidenceTurnIds: ['T002'] }
    ]
  }, topics, targetTurns, allTurns);
  assert.equal(result.operationalUnits.length, 1);
  assert.deepEqual(result.operationalUnits[0].areaIds, ['A01', 'A02']);
  assert.ok(result.errors.some(item => item.includes('operational reason')));
});

test('hidden operational units are revalidated against selected area and source turns', () => {
  const result = validateOperationalUnitsFromForm([
    { unitId: 'K01', kind: 'WANT', certainty: 'DIRECT', statement: 'Wants a strong relationship.', operationalReasons: ['MATCHING'], areaIds: ['A01', 'A02'], evidenceTurnIds: ['T002'] }
  ], [{ areaId: 'A01' }], targetTurns, allTurns);
  assert.equal(result.units.length, 1);
  assert.deepEqual(result.units[0].areaIds, ['A01']);
  assert.equal(result.units[0].evidenceTurns[0].text, 'I want a strong relationship.');
});



test('duplicate semantic areas targeting one existing topic consolidate before revision', () => {
  const groups = consolidateSemanticAreasForRevision([
    { areaId: 'A01', existingTopicId: 'topic-relationship', realm: 'Romantic relationships', topicName: 'Desired relationship', impact: 'POSSIBLE', reason: 'Relationship goal', relevantTurnIds: ['T002'] },
    { areaId: 'A03', existingTopicId: 'topic-relationship', realm: 'Romantic relationships', topicName: 'Desired relationship', impact: 'SIGNIFICANT', reason: 'Additional relationship material', relevantTurnIds: ['T004', 'T002'] },
    { areaId: 'A04', existingTopicId: 'topic-partner', realm: 'Romantic relationships', topicName: 'Preferred partner', impact: 'SIGNIFICANT', reason: 'Partner qualities', relevantTurnIds: ['T006'] }
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].sourceAreaIds, ['A01', 'A03']);
  assert.deepEqual(groups[0].relevantTurnIds, ['T002', 'T004']);
  assert.equal(groups[0].impact, 'SIGNIFICANT');
  assert.equal(groups[0].existingTopicId, 'topic-relationship');
  assert.deepEqual(groups[1].sourceAreaIds, ['A04']);
});

test('duplicate proposed realm/topic targets consolidate without creating a stored topic', () => {
  const groups = consolidateSemanticAreasForRevision([
    { areaId: 'A02', existingTopicId: '', realm: 'Family', topicName: 'Having more children', impact: 'POSSIBLE', relevantTurnIds: ['T004'] },
    { areaId: 'A05', existingTopicId: '', realm: ' family ', topicName: 'Having More Children', impact: 'SUPPORTING', relevantTurnIds: ['T006'] }
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].sourceAreaIds, ['A02', 'A05']);
  assert.deepEqual(groups[0].relevantTurnIds, ['T004', 'T006']);
  assert.equal(groups[0].existingTopicId, '');
});

test('stage 8.12.13.7 service and UI describe selective operational atomicity and read-only suggested topics', () => {
  const service = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  const page = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte', import.meta.url), 'utf8');
  const route = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', import.meta.url), 'utf8');
  assert.match(service, /identifySemanticAreasReadOnly/);
  assert.match(service, /Create an operational unit only when the knowledge may need independent verification, matching, permissioning, retrieval, disclosure, or action/);
  assert.match(service, /One operational unit may belong to multiple semantic areas/);
  assert.match(service, /Do not generate a comprehensive list of new atomic claims/);
  assert.match(service, /Use each existing topic at most once in the areas array/);
  assert.match(page, /SUGGESTED NEW TOPIC - NOT CREATED/);
  assert.match(page, /not every useful piece of understanding needs to become an atomic record/);
  assert.match(route, /reviseTopics/);
  assert.match(route, /consolidateSemanticAreasForRevision/);
  assert.match(page, /one topic receives only one proposed current understanding/);
});

test('stage 8.12.13.7.2 semantic revision is topic-bounded and never falls back to all target turns', () => {
  const service = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  assert.match(service, /selected semantic area has no validated target-speaker evidence turns/);
  assert.match(service, /A supplied source turn may contain several different ideas/);
  assert.match(service, /OTHER AREAS FROM THIS SOURCE - EXCLUDE THEIR MAIN MEANING/);
  const boundedSection = service.split('export async function reviseSemanticAreaReadOnly')[1].split('// Kept for direct Stage 8.12.13.5 regression comparisons only.')[0];
  assert.match(boundedSection, /const topicTurns = selectedIds\.map\(id => targetById\.get\(id\)!\)\.filter\(Boolean\)/);
  assert.doesNotMatch(boundedSection, /selectedIds\.length \?.*: data\.packet\.targetTurns/);
});

test('stage 8.12.13.7.2 passes sibling semantic areas as exclusion boundaries, not evidence', () => {
  const route = fs.readFileSync(new URL('../../src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', import.meta.url), 'utf8');
  assert.match(route, /excludedAreaSummaries/);
  assert.match(route, /sibling-area descriptions as exclusion boundaries, never as evidence/);
});

test('stage 8.12.13.7.2 asks for permissionable operational units without atomising stylistically', () => {
  const service = fs.readFileSync(new URL('../../src/lib/server/datingUnderstandingRevisionExperiment.ts', import.meta.url), 'utf8');
  assert.match(service, /If a proposed unit combines ideas that could reasonably have different matching, permission, disclosure, verification, retrieval, or action rules, split them/);
  assert.match(service, /Do not split merely for stylistic granularity/);
});

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const roadmap = readFileSync(
  new URL('../../docs/stage8/STAGE8_9_MULTI_APP_RELATIONSHIP_INTELLIGENCE_ROADMAP.md', import.meta.url),
  'utf8'
);

test('Stage 8.8.14 distinguishes existing foundations from unfinished capabilities', () => {
  // IT: Prevent future work from mistaking a sound implementation pattern for completed consent or network projection infrastructure.
  assert.match(roadmap, /Existing foundation versus completed future capability/i);
  assert.match(roadmap, /not yet a multi-subject, participant-consented, recipient-specific, revocable, network-safe projection service/i);
  assert.match(roadmap, /Stage 8\.9 extends this proven boundary/i);
});

test('Stage 8.8.14 preserves dyadic Introductions without making them universal', () => {
  // IT: Dating may rely on exactly two sides while later teams and events receive separate participant-bearing structures.
  assert.match(roadmap, /current `Introduction` remains deliberately dyadic/i);
  assert.match(roadmap, /Do not widen `IntroductionSide` by adding more alphabetic enum values/i);
  assert.match(roadmap, /Do not use `IntroductionParticipant` as the universal participant model/i);
  assert.match(roadmap, /respondentParticipantId/);
  assert.match(roadmap, /subjectParticipantId/);
});

test('Stage 8.8.14 adds Value Orchestration and Event Intelligence after Outcome learning', () => {
  // IT: The later application pilots must remain behind the earlier custody, consent, projection, and learning stages.
  const expectedStages = [
    'Stage 8.9 - Multi-app ContextSpace boundary',
    'Stage 8.13 - Consent and disclosure foundation',
    'Stage 8.16 - Matchable projections and network-safe embeddings',
    'Stage 9.2 - Outcome learning and multi-app reuse',
    'Stage 9.3 - Fixed-participant Value Orchestration pilot',
    'Stage 9.4 - Event Intelligence pilot'
  ];
  let prior = -1;
  for (const stage of expectedStages) {
    const index = roadmap.indexOf(stage);
    assert.ok(index > prior, `${stage} must exist after the preceding dependency`);
    prior = index;
  }
});

test('Stage 8.8.14 keeps custody, real-world subjects, activities, and opportunity contexts separate', () => {
  // IT: A ContextSpace is a security boundary and must never be repurposed as a team, event, or relationship subject.
  assert.match(roadmap, /Subject, custody, relationship, activity, and context are distinct/i);
  assert.match(roadmap, /`ContextSpace` remains the custody and application boundary/i);
  assert.match(roadmap, /An Event is an opportunity context, not a ContextSpace/i);
});

test('Stage 8.8.14 is documentation-only and adds no migration', () => {
  // IT: Preserve the Stage 8.8.12 database and runtime baseline until implementation begins in a separately reviewed stage.
  const migrations = readdirSync(new URL('../../prisma/migrations', import.meta.url))
    .filter((name) => /^\d/.test(name))
    .sort();
  // IT: Later roadmap stages may migrate. The 8.8.14 documentation release itself did not.
  assert.equal(migrations.filter((name) => name.includes('stage8_8_14')).length, 0);
});

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const roadmap = readFileSync(
  new URL('../../docs/stage8/STAGE8_9_MULTI_APP_RELATIONSHIP_INTELLIGENCE_ROADMAP.md', import.meta.url),
  'utf8'
);

test('Stage 8.8.13 records one Core with isolated app layers', () => {
  // IT: Lock the platform decision so later app work cannot silently collapse Business and Dating custody.
  assert.match(roadmap, /one domain-neutral Core with multiple isolated app layers/i);
  assert.match(roadmap, /applications share capabilities, not unrestricted knowledge/i);
  assert.match(roadmap, /deny cross-context and cross-domain reads by default/i);
});

test('Stage 8.8.13 preserves the AI-native evidence-to-memory architecture', () => {
  // IT: Source evidence stays canonical while claims, operational state, and summaries have distinct roles.
  assert.match(roadmap, /### 3\.1 Evidence and events/);
  assert.match(roadmap, /### 3\.2 Claims and observations/);
  assert.match(roadmap, /### 3\.3 Operational state/);
  assert.match(roadmap, /### 3\.4 Purpose-specific memory/);
  assert.match(roadmap, /summary is a first-pass briefing, not the source of truth/i);
});

test('Stage 8.8.13 sequences voice, feedback, knowledge, consent, matching, and learning behind evidence gates', () => {
  // IT: The roadmap must not permit matching or live voice to jump ahead of feedback, privacy, and consent validation.
  const expectedStages = [
    'Stage 8.9 - Multi-app ContextSpace boundary',
    'Stage 8.10 - Dating app shell and single-sided voice Outcome pilot',
    'Stage 8.11 - Multi-perspective Introduction feedback',
    'Stage 8.12 - Knowledge reconciliation and Dating memory',
    'Stage 8.13 - Consent and disclosure foundation',
    'Stage 8.14 - Manual PotentialMatch',
    'Stage 8.15 - Participant experience and progressive bilateral disclosure',
    'Stage 8.16 - Matchable projections and network-safe embeddings',
    'Stage 9.0 - Controlled domain-specific matching',
    'Stage 9.1 - Conversational voice agent',
    'Stage 9.2 - Outcome learning and multi-app reuse'
  ];
  let prior = -1;
  for (const stage of expectedStages) {
    const index = roadmap.indexOf(stage);
    assert.ok(index > prior, `${stage} must exist after the preceding stage`);
    prior = index;
  }
});

test('Stage 8.8.13 is documentation-only and adds no migration', () => {
  // IT: Preserve the Stage 8.8.12 database baseline until implementation begins in a separately reviewed stage.
  const migrations = readdirSync(new URL('../../prisma/migrations', import.meta.url))
    .filter((name) => /^\d/.test(name))
    .sort();
  // IT: Later roadmap stages may migrate. The 8.8.13 documentation release itself did not.
  assert.equal(migrations.filter((name) => name.includes('stage8_8_13')).length, 0);
});

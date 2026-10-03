import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const service = fs.readFileSync('src/lib/server/datingPersistedLivingUnderstanding.ts', 'utf8');
const drafts = fs.readFileSync('src/lib/server/datingLivingUnderstandingDraft.ts', 'utf8');
const migration = fs.readFileSync('prisma/migrations/20261002010000_stage8_13_0_longitudinal_living_understanding_foundation/migration.sql', 'utf8');
const migrations = fs.readdirSync('prisma/migrations');

test('8.13.0 removes the unreleased 8.12.14/15 migration chain', () => {
  assert.equal(migrations.includes('20261001013000_stage8_12_14_persisted_living_understanding'), false);
  assert.equal(migrations.includes('20261001013100_stage8_12_14_1_index_name_alignment'), false);
  assert.equal(migrations.includes('20261001054500_stage8_12_15_living_understanding_drafts'), false);
  assert.equal(migrations.includes('20261002010000_stage8_13_0_longitudinal_living_understanding_foundation'), true);
});

test('revision membership is separate from immutable topic-version creation', () => {
  const version = schema.match(/model LivingUnderstandingTopicVersion \{[\s\S]*?\n\}/)?.[0] ?? '';
  const membership = schema.match(/model LivingUnderstandingRevisionTopic \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(version, /\brevisionId String\b/);
  assert.match(version, /createdInRevisionId String/);
  assert.match(version, /versionNumber Int/);
  assert.match(membership, /revisionId String/);
  assert.match(membership, /topicVersionId String/);
  assert.match(membership, /topicIdentityId String/);
  assert.match(migration, /LivingUnderstandingRevisionTopic_version_custody_fk/);
});

test('unchanged topics are carried forward server-side using the same topicVersionId', () => {
  assert.match(service, /for \(const prior of baselineMemberships\)/);
  assert.match(service, /if \(!change\)/);
  assert.match(service, /topicVersionId: prior\.topicVersionId/);
  assert.match(service, /affected topics alone receive a new immutable topic version/);
});

test('changed topics create a new version and topic-specific relational provenance', () => {
  assert.match(service, /livingUnderstandingTopicVersion\.createMany/);
  assert.match(service, /versionNumber: \(changedMaxByIdentity\.get\(prior\.topicIdentityId\) \?\? 0\) \+ 1/);
  assert.match(service, /livingUnderstandingTopicVersionSource\.createMany/);
  assert.match(schema, /model LivingUnderstandingTopicVersionSource \{/);
  assert.match(schema, /relationshipType String @default\("INFORMED"\)/);
});

test('baseline concurrency and idempotency are explicit persistence invariants', () => {
  assert.match(service, /findUnique\([\s\S]*where: \{ adoptionKey \}/);
  assert.match(service, /STALE_BASELINE/);
  assert.match(service, /previousRevisionId: latest\?\.id \?\? null/);
  assert.match(schema, /previousRevisionId String\? @unique/);
});

test('current authoritative baseline is loaded from revision membership, not UnderstandingTopic', () => {
  assert.match(service, /getAuthoritativeLivingUnderstandingBaseline = getCurrentLivingUnderstanding/);
  assert.match(service, /memberships:/);
  const currentFunction = service.slice(service.indexOf('export async function getCurrentLivingUnderstanding'), service.indexOf('export const getAuthoritativeLivingUnderstandingBaseline'));
  assert.doesNotMatch(currentFunction, /prisma\.understandingTopic/i);
});

test('drafts can bind to source and authoritative baseline and stale drafts fail closed', () => {
  assert.match(schema, /sourceInteractionId String\?/);
  assert.match(schema, /baselineRevisionId String\?/);
  assert.match(schema, /baselineRevisionNumber Int\?/);
  assert.match(schema, /completedAt DateTime\?/);
  assert.match(drafts, /validateBinding/);
  assert.match(drafts, /checkpoint baseline is stale/);
  assert.match(drafts, /predates the current authoritative Living Understanding and cannot be resumed/);
  assert.match(drafts, /completedAt: now/);
});

test('database custody guards cover new membership and provenance tables', () => {
  assert.match(migration, /LivingUnderstandingRevisionTopic_context_owner_guard/);
  assert.match(migration, /LivingUnderstandingRevisionTopic_context_reference_guard/);
  assert.match(migration, /LivingUnderstandingTopicVersionSource_context_owner_guard/);
  assert.match(migration, /LivingUnderstandingTopicVersionSource_context_reference_guard/);
  assert.match(migration, /LivingUnderstandingDraft_context_reference_guard/);
});

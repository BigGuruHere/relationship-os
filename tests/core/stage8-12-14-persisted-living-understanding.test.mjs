import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Stage 8.12.14 persistence was development-only and is superseded by the canonical Stage 8.13.0
// migration. Keep this historical regression file focused on the invariants that must survive.
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const service = fs.readFileSync('src/lib/server/datingPersistedLivingUnderstanding.ts', 'utf8');
const route = fs.readFileSync('src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', 'utf8');
const experimentUi = fs.readFileSync('src/routes/dating/people/[id]/understanding/revision-experiment/+page.svelte', 'utf8');
const mainUi = fs.readFileSync('src/routes/dating/people/[id]/understanding/+page.svelte', 'utf8');
const crypto = fs.readFileSync('src/lib/crypto.ts', 'utf8');
const migration = fs.readFileSync('prisma/migrations/20261002010000_stage8_13_0_longitudinal_living_understanding_foundation/migration.sql', 'utf8');

test('persisted Living Understanding keeps immutable revisions and topic versions', () => {
  assert.match(schema, /model LivingUnderstandingRevision \{/);
  assert.match(schema, /model LivingUnderstandingTopicIdentity \{/);
  assert.match(schema, /model LivingUnderstandingTopicVersion \{/);
  assert.match(schema, /model LivingUnderstandingRevisionTopic \{/);
  assert.match(schema, /model LivingUnderstandingTopicVersionSource \{/);
  assert.match(schema, /revisionNumber Int/);
  assert.match(schema, /understandingEnc String/);
  const block = schema.match(/model LivingUnderstandingTopicVersion \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(block, /embedding/i);
});

test('authoritative text remains encrypted and embeddings are not authoritative storage', () => {
  assert.match(service, /encrypt\(topic\.proposedUnderstanding, TEXT_AAD\)/);
  assert.match(service, /decrypt\(row\.topicVersion\.understandingEnc, TEXT_AAD\)/);
  assert.match(mainUi, /This text is authoritative\. Matching and embeddings remain derived layers\./);
});

test('approval token remains scoped, signed, expiring and sources are re-authorised', () => {
  assert.match(crypto, /buildScopedMacToken/);
  assert.match(service, /timingSafeEqual/);
  assert.match(service, /payload\.userId !== scope\.userId/);
  assert.match(service, /MAX_TOKEN_AGE_MS/);
  assert.match(service, /requireSourceReflection\(scope, id, tx\)/);
});

test('only validator-clean restructuring can issue an adoption token', () => {
  assert.match(service, /analysis\?\.validForReview/);
  assert.match(service, /analysis\.errors\?\.length/);
  assert.match(route, /restructuring\.analysis\.validForReview && !restructuring\.analysis\.errors\.length/);
});

test('operator explicitly approves persistence and no sharing permission is implied', () => {
  assert.match(experimentUi, /I have reviewed this validated structure and approve saving it as the current Living Understanding/);
  assert.match(experimentUi, /This does not grant matching, sharing or disclosure permission/);
  assert.match(route, /form\.get\('approve'\) !== 'YES'/);
});

test('repeated submission remains idempotent via adoption key', () => {
  assert.match(schema, /adoptionKey String @unique/);
  assert.match(service, /findUnique\(\{\s*where: \{ adoptionKey \}/);
  assert.match(service, /alreadyAdopted: true/);
});

test('canonical migration enforces revision membership and topic-version custody', () => {
  assert.match(migration, /LivingUnderstandingRevisionTopic_revision_custody_fk/);
  assert.match(migration, /LivingUnderstandingRevisionTopic_version_custody_fk/);
  assert.match(migration, /LivingUnderstandingTopicVersion_created_revision_custody_fk/);
  assert.match(migration, /LivingUnderstandingTopicVersionSource_version_custody_fk/);
  assert.match(migration, /LivingUnderstandingRevision_context_owner_guard/);
  assert.match(migration, /LivingUnderstandingTopicVersionSource_context_reference_guard/);
  assert.match(migration, /relish_prevent_context_reassignment/);
});

test('current Living Understanding resolves through revision membership', () => {
  assert.match(service, /memberships:/);
  assert.match(service, /topicVersionId/);
  assert.match(mainUi, /Current Living Understanding/);
  assert.match(mainUi, /Revision history/);
});

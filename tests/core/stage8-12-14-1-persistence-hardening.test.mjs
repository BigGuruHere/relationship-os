import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const contextPolicy = fs.readFileSync('src/lib/server/core/contextSpace.ts', 'utf8');
const service = fs.readFileSync('src/lib/server/datingPersistedLivingUnderstanding.ts', 'utf8');
const route = fs.readFileSync('src/routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts', 'utf8');
const migration = fs.readFileSync('prisma/migrations/20261002010000_stage8_13_0_longitudinal_living_understanding_foundation/migration.sql', 'utf8');
const dbScript = fs.readFileSync('scripts/check-stage8-13-0-living-understanding-db.ts', 'utf8');

const livingModels = [
  'LivingUnderstandingRevision',
  'LivingUnderstandingTopicIdentity',
  'LivingUnderstandingTopicVersion',
  'LivingUnderstandingRevisionTopic',
  'LivingUnderstandingRevisionSource',
  'LivingUnderstandingTopicVersionSource',
  'LivingUnderstandingDraft'
];

test('canonical Living Understanding models are covered by central ContextSpace scoping', () => {
  for (const model of livingModels) assert.match(contextPolicy, new RegExp(`['"]${model}['"]`));
});

test('Stage 8.13.0 is one forward migration from the production boundary', () => {
  assert.match(migration, /first production migration for persisted Living Understanding/);
  assert.match(migration, /CREATE TABLE "LivingUnderstandingRevision"/);
  assert.match(migration, /CREATE TABLE "LivingUnderstandingDraft"/);
  assert.doesNotMatch(migration, /^\s*(DROP\s+TABLE|TRUNCATE\b)/im);
});

test('private source provenance is re-authorised inside the authoritative transaction', () => {
  const txStart = service.indexOf('return prisma.$transaction(async tx =>');
  const sourceAuth = service.indexOf('requireSourceReflection(scope, id, tx)');
  const revisionCreate = service.indexOf('tx.livingUnderstandingRevision.create');
  assert.ok(txStart >= 0 && sourceAuth > txStart && revisionCreate > sourceAuth);
});

test('development save failures expose bounded diagnostics while production stays generic', () => {
  assert.match(service, /describeLivingUnderstandingPersistenceError/);
  assert.match(route, /process\.env\.NODE_ENV !== 'production'/);
  assert.match(route, /Living Understanding save failed in development:/);
  assert.match(route, /Living Understanding could not be saved\. No stored knowledge was changed\./);
  assert.doesNotMatch(service, /JSON\.stringify\(err\)/);
});

test('Stage 8.13 DB gate covers carry-forward, idempotency, stale baseline and cleanup', () => {
  assert.match(dbScript, /ALLOW_DATING_DEV_DB_TEST/);
  assert.match(dbScript, /persistLongitudinalLivingUnderstandingRevision/);
  assert.match(dbScript, /topicVersionId/);
  assert.match(dbScript, /alreadyAdopted/);
  assert.match(dbScript, /STALE_BASELINE/);
  assert.match(dbScript, /contact\.deleteMany/);
});

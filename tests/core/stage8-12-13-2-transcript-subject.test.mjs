// PURPOSE: Regression for PostgreSQL's subject-required constraint and transcript importer.
// LIMIT: SQL/source checks do not replace the gated live development DB test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const migration = readFileSync(new URL('../../prisma/migrations/20260927110000_stage8_12_13_2_transcript_subject_constraint/migration.sql', import.meta.url), 'utf8');
const service = readFileSync(new URL('../../src/lib/server/datingTranscriptImport.ts', import.meta.url), 'utf8');
test('only workspace transcript originals may lack an individual subject', () => {
  assert.match(migration, /DROP CONSTRAINT "Interaction_subject_required"/);
  assert.match(migration, /ADD CONSTRAINT "Interaction_subject_required" CHECK/);
  assert.match(migration, /"contactId" IS NOT NULL OR "personId" IS NOT NULL OR "companyId" IS NOT NULL/);
  assert.match(migration, /"channel" = 'DATING_CONVERSATION_TRANSCRIPT'/);
  assert.match(migration, /"sourceType" = 'WORKSPACE'/);
  assert.match(migration, /"externalRef" LIKE 'dating:transcript:%'/);
  assert.doesNotMatch(migration, /DISABLE TRIGGER|DROP TRIGGER|DROP TABLE/);
  assert.match(service, /ownerUserId: scope\.userId, domainKey: 'dating'/);
  assert.match(service, /contactId: excerpt\.contactId/);
});

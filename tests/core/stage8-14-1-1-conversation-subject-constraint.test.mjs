import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migrationPath = 'prisma/migrations/20261007033000_stage8_14_1_1_conversation_subject_constraint/migration.sql';
const importerPath = 'src/lib/server/datingTranscriptImport.ts';
const ingestPath = 'src/lib/server/core/conversationIngestion.ts';

test('Stage 8.14.1.1 permits subjectless canonical conversation originals without weakening ordinary Interaction subjects', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migration, /DROP CONSTRAINT "Interaction_subject_required"/);
  assert.match(migration, /"contactId" IS NOT NULL OR "personId" IS NOT NULL OR "companyId" IS NOT NULL/);
  assert.match(migration, /"channel" = 'DATING_CONVERSATION_TRANSCRIPT'/);
  assert.match(migration, /"sourceType" = 'WORKSPACE'/);
  assert.match(migration, /"externalRef" LIKE 'dating:transcript:%'/);
  assert.match(migration, /"channel" = 'CONVERSATION_TRANSCRIPT'/);
  assert.match(migration, /"sourceType" IN \('IMPORT', 'API'\)/);
  assert.match(migration, /"externalRef" LIKE 'conversation:%'/);
});

test('canonical importer and constraint stay aligned on channel, source type and external reference shape', () => {
  const importer = fs.readFileSync(importerPath, 'utf8');
  const ingest = fs.readFileSync(ingestPath, 'utf8');
  assert.match(importer, /channel: CONVERSATION_TRANSCRIPT_CHANNEL/);
  assert.match(importer, /sourceTypeForConversationIngest\(metadata\.ingestMethod\)/);
  assert.match(ingest, /CONVERSATION_TRANSCRIPT_CHANNEL = 'CONVERSATION_TRANSCRIPT'/);
  assert.match(ingest, /return `conversation:\$\{metadata\.provider\.toLowerCase\(\)\}:\$\{digest\(metadata\.externalConversationId\)\}`/);
  assert.match(ingest, /return `conversation:content:\$\{contentFingerprint\}`/);
  assert.match(ingest, /\? 'API' : 'IMPORT'/);
});

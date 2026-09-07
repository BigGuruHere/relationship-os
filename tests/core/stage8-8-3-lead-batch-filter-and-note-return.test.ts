// PURPOSE: Verify Stage 8.8.3 keeps import batches separate from Sources and preserves queue context after lead-note actions.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { splitLeadSourcesForFilters, isKnownImportBatch } from '../../src/lib/leadSourceKinds.ts';

test('ordinary sources and import batches are split without losing either kind', () => {
  const result = splitLeadSourcesForFilters([
    { id: 'sam', name: 'Sam referral', kind: 'SOURCE' },
    { id: 'rto-1', name: 'RTO Hot 50 - Batch 1', kind: 'IMPORT_BATCH' },
    { id: 'legacy', name: 'Legacy source' }
  ]);

  assert.deepEqual(result.sources.map((row) => row.id), ['sam', 'legacy']);
  assert.deepEqual(result.importBatches.map((row) => row.id), ['rto-1']);
  assert.equal(isKnownImportBatch('rto-1', result.importBatches), true);
  assert.equal(isKnownImportBatch('sam', result.importBatches), false);
});

test('Prisma and migration explicitly classify import batches and safely backfill Stage 8.8 imports', () => {
  const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
  const migration = fs.readFileSync('prisma/migrations/20260907133500_stage8_8_3_import_batch_filtering/migration.sql', 'utf8');

  assert.match(schema, /enum LeadSourceKind\s*\{[\s\S]*SOURCE[\s\S]*IMPORT_BATCH[\s\S]*\}/);
  assert.match(schema, /kind LeadSourceKind @default\(SOURCE\)/);
  assert.match(migration, /ADD COLUMN "kind" "LeadSourceKind" NOT NULL DEFAULT 'SOURCE'/);
  assert.match(migration, /SET "kind" = 'IMPORT_BATCH'/);
  assert.match(migration, /ml\."source" = 'IMPORTED'/);
  assert.match(migration, /INNER JOIN "CompanyExternalIdentifier"/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|TRUNCATE/i);
});

test('importer creates batch-kind LeadSources and returns the dedicated batch filter URL', () => {
  const server = fs.readFileSync('src/routes/leads/import/+page.server.ts', 'utf8');
  const leadServer = fs.readFileSync('src/lib/server/marketLeads.ts', 'utf8');

  assert.match(server, /resolveImportBatchLeadSourceId\(userId, batchName\)/);
  assert.match(server, /batchUrl: `\/leads\?batch=\$\{encodeURIComponent\(leadSourceId\)\}`/);
  assert.match(leadServer, /kind: 'IMPORT_BATCH'/);
});

test('Leads filter renders a separate Batch dropdown while Source stays source-focused', () => {
  const listServer = fs.readFileSync('src/routes/leads/+page.server.ts', 'utf8');
  const listPage = fs.readFileSync('src/routes/leads/+page.svelte', 'utf8');

  assert.match(listServer, /splitLeadSourcesForFilters\(customLeadSources\)/);
  assert.match(listServer, /leadSourceOptions: buildLeadSourceOptions\(ordinaryLeadSources\)/);
  assert.match(listServer, /importBatches:/);
  assert.match(listPage, /<select name="source"/);
  assert.match(listPage, /<select name="batch"/);
  assert.match(listPage, />All batches<\/option>/);
});

test('create, edit, and delete lead-note forms all preserve the current working-list return target', () => {
  const page = fs.readFileSync('src/routes/leads/[id]/+page.svelte', 'utf8');
  const server = fs.readFileSync('src/routes/leads/[id]/+page.server.ts', 'utf8');

  assert.equal((page.match(/name="returnTo" value=\{data\.returnTo \|\| '\/leads'\}/g) || []).length >= 4, true);

  const noteActionBlock = server.slice(server.indexOf('createLeadNote:'), server.indexOf('createTask:'));
  assert.equal((noteActionBlock.match(/safeLeadListReturnTo\(form\.get\('returnTo'\)\)/g) || []).length, 3);
  assert.equal((noteActionBlock.match(/buildLeadDetailReturnUrl\(params\.id, returnTo\)/g) || []).length, 3);
  assert.doesNotMatch(noteActionBlock, /redirect\(303, `\/leads\/\$\{params\.id\}`\)/);
});

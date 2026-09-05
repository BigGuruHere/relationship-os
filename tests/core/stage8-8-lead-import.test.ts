// PURPOSE: Verify Stage 8.8 selected lead batch import parsing, identity and append-only research semantics.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { guessCsvHeader, parseCsv, valueForHeader } from '../../src/lib/csv.ts';
import { buildImportedResearchNote, normaliseExternalScheme, normaliseExternalValue } from '../../src/lib/leadImport.ts';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync('prisma/migrations/20260904184000_stage8_8_lead_batch_import/migration.sql', 'utf8');
const importer = readFileSync('src/lib/server/leadImport.ts', 'utf8');
const importRoute = readFileSync('src/routes/leads/import/+page.server.ts', 'utf8');
const importPage = readFileSync('src/routes/leads/import/+page.svelte', 'utf8');
const leadPage = readFileSync('src/routes/leads/+page.svelte', 'utf8');
const companyPageServer = readFileSync('src/routes/companies/[id]/+page.server.ts', 'utf8');

const sampleRow = {
  rowNumber: 7,
  companyName: 'ABC Training Pty Ltd',
  externalCode: '001234',
  companyPhone: '03 9000 0000',
  website: 'https://example.com',
  geography: 'Victoria',
  personName: 'Jane Smith',
  roleTitle: 'Director',
  email: 'jane@example.com',
  phone: '0400 000 000',
  research: 'Owner appears open to succession and the course mix has narrowed.',
  researchProvider: 'Claude',
  researchDate: '2026-09-03',
  sourceUrl: 'https://training.gov.au/example'
};

test('CSV parser preserves quoted commas, escaped quotes and multiline research', () => {
  const csv = 'RTO Name,Registration Number,AI Research\r\n"ABC, Training",001234,"First line\nSecond line with ""quote"""\r\n';
  const table = parseCsv(csv);
  assert.deepEqual(table.headers, ['RTO Name', 'Registration Number', 'AI Research']);
  assert.equal(table.rows.length, 1);
  assert.equal(valueForHeader(table.headers, table.rows[0], 'RTO Name'), 'ABC, Training');
  assert.equal(valueForHeader(table.headers, table.rows[0], 'Registration Number'), '001234');
  assert.equal(valueForHeader(table.headers, table.rows[0], 'AI Research'), 'First line\nSecond line with "quote"');
});

test('CSV header guessing recognises common RTO and research headings without hiding the mapping', () => {
  const headers = ['RTO Name', 'Registration Number', 'State', 'Claude Research'];
  assert.equal(guessCsvHeader(headers, ['company name', 'rto name']), 'RTO Name');
  assert.equal(guessCsvHeader(headers, ['registration number', 'rto number']), 'Registration Number');
  assert.equal(guessCsvHeader(headers, ['ai research', 'claude research']), 'Claude Research');
});

test('external reference normalisation preserves meaningful leading zeroes and creates a stable scheme', () => {
  assert.equal(normaliseExternalScheme(' ASQA RTO '), 'ASQA_RTO');
  assert.equal(normaliseExternalScheme('aged-care provider'), 'AGED_CARE_PROVIDER');
  assert.equal(normaliseExternalValue('  001234  '), '001234');
});

test('imported research note is appendable lead evidence with batch and spreadsheet provenance', () => {
  const note = buildImportedResearchNote({ batchName: 'RTO Hot 50 - Sep 2026 - Batch 1', sourceFileName: 'rto_hot_50_sep.csv', row: sampleRow, externalScheme: 'ASQA_RTO' });
  assert.match(note, /Import batch: RTO Hot 50 - Sep 2026 - Batch 1/);
  assert.match(note, /Import file: rto_hot_50_sep.csv/);
  assert.match(note, /Spreadsheet row: 7/);
  assert.match(note, /External reference: ASQA_RTO \/ 001234/);
  assert.match(note, /Research provider: Claude/);
  assert.match(note, /Owner appears open to succession/);
});

test('CompanyExternalIdentifier is context-scoped, encrypted and unique by owner + context + scheme + value index', () => {
  const block = schema.match(/model CompanyExternalIdentifier \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(block, /contextSpaceId String @default\("00000000-0000-0000-0000-000000000000"\)/);
  assert.match(block, /company\s+Company @relation/);
  assert.match(block, /scheme\s+String/);
  assert.match(block, /valueEnc\s+String/);
  assert.match(block, /valueIdx\s+String/);
  assert.match(block, /@@unique\(\[userId, contextSpaceId, scheme, valueIdx\], map: "CompanyExternalIdentifier_userId_contextSpaceId_scheme_valueIdx"\)/);
  assert.match(schema, /externalIdentifiers CompanyExternalIdentifier\[\]/);
});

test('new external identifier table has owner, reassignment and cross-context Company guards', () => {
  assert.match(migration, /CompanyExternalIdentifier_context_owner_guard/);
  assert.match(migration, /relish_enforce_context_owner/);
  assert.match(migration, /CompanyExternalIdentifier_context_reassignment_guard/);
  assert.match(migration, /relish_prevent_context_reassignment/);
  assert.match(migration, /CompanyExternalIdentifier_context_reference_guard/);
  assert.match(migration, /relish_enforce_context_reference'\('companyId', 'Company'\)|relish_enforce_context_reference"\('companyId', 'Company'\)/);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b|\bDROP\s+TABLE\b|\bTRUNCATE\b/i);
});

test('importer reuses company identity, makes the same batch idempotent and appends research only to new leads', () => {
  assert.match(importer, /companyExternalIdentifier\.findFirst/);
  assert.match(importer, /scheme: externalScheme, valueIdx/);
  assert.match(importer, /company\.findMany/);
  assert.match(importer, /nameIdx: buildIndexToken\(companyName\)/);
  assert.match(importer, /sameName\.length > 1/);
  assert.match(importer, /Multiple existing Companies match the exact name/);
  assert.match(importer, /companyId, leadSourceId: options\.leadSourceId/);
  assert.match(importer, /skippedExistingBatchLeads \+= 1/);
  assert.match(importer, /marketLeadNote\.create/);
  assert.match(importer, /channel: 'research'/);
  assert.doesNotMatch(importer, /prisma\.contact\.create/);
  assert.doesNotMatch(importer, /marketLeadNote\.(update|updateMany|upsert)/);
});

test('import route uses existing lead machinery for batch, project and workstream instead of adding a LeadList model', () => {
  assert.match(importRoute, /resolveLeadSourceId\(userId, '', batchName\)/);
  assert.match(importRoute, /sourceFileName: file\.name/);
  assert.match(importRoute, /projectWorkstream\.findFirst/);
  assert.match(importRoute, /importSelectedLeadBatch/);
  assert.doesNotMatch(schema, /model LeadList\b/);
  assert.match(leadPage, /href="\/leads\/import"/);
  assert.match(importPage, /Batch \/ calling-list name/);
});

test('company page surfaces external identifiers and prior imported lead research without copying research into CompanyNote', () => {
  assert.match(companyPageServer, /companyExternalIdentifier\.findMany/);
  assert.match(companyPageServer, /channel: 'research'/);
  assert.match(companyPageServer, /leadResearchHistory/);
  assert.doesNotMatch(importer, /companyNote\.create/);
});

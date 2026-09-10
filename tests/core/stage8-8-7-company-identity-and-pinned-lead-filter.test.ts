// PURPOSE: Verify Stage 8.8.7 optional Company identity controls and the lightweight pinned lead working filter.
// IT: Identifiers strengthen identity when present, while Companies without them remain valid; lead pins are UI state, not CRM truth.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  areCompanyNamesSimilarForDuplicateWarning,
  companyIdentifierComparisonKey,
  normaliseCompanyIdentifierScheme,
  normaliseCompanyNameForDuplicateWarning
} from '../../src/lib/companyIdentity.ts';

test('company name warning key catches common Australian legal-suffix variants without fuzzy merging', () => {
  assert.equal(normaliseCompanyNameForDuplicateWarning('ABC Training Pty Ltd'), normaliseCompanyNameForDuplicateWarning('ABC Training'));
  assert.equal(normaliseCompanyNameForDuplicateWarning('ABC & Sons Proprietary Limited'), 'abc and sons');
  assert.notEqual(normaliseCompanyNameForDuplicateWarning('ABC Health'), normaliseCompanyNameForDuplicateWarning('ABC Healthcare'));
});

test('company name warning catches close spelling mistakes but ignores weak fragments', () => {
  assert.equal(areCompanyNamesSimilarForDuplicateWarning('Coca Cola', 'Coka Cola'), true);
  assert.equal(areCompanyNamesSimilarForDuplicateWarning('Coca Cola', 'Coac Cola'), true);
  assert.equal(areCompanyNamesSimilarForDuplicateWarning('Melbourne Training Institute', 'Melbourne Trainng Institute'), true);
  assert.equal(areCompanyNamesSimilarForDuplicateWarning('Coca Cola', 'Coka'), false);
  assert.equal(areCompanyNamesSimilarForDuplicateWarning('Coca Cola', 'Cola'), false);
  assert.equal(areCompanyNamesSimilarForDuplicateWarning('ABC Health', 'ABC Healthcare'), false);
});

test('identifier helpers preserve optional schemes and compare ABN/ACN formatting safely', () => {
  assert.equal(normaliseCompanyIdentifierScheme('asqa rto'), 'ASQA_RTO');
  assert.equal(companyIdentifierComparisonKey('ABN', '12 345 678 901'), companyIdentifierComparisonKey('ABN', '12345678901'));
  assert.notEqual(companyIdentifierComparisonKey('ASQA_RTO', '12-34'), companyIdentifierComparisonKey('ASQA_RTO', '1234'));
});

test('Company create UI makes the external identifier explicitly optional', () => {
  const page = fs.readFileSync('src/routes/companies/+page.svelte', 'utf8');
  assert.match(page, /External identifier <span class="muted small">\(optional\)<\/span>/);
  assert.match(page, /Companies can still be created with only a name\./);
  assert.match(page, /name="identifierScheme"/);
  assert.match(page, /name="identifierValue"/);
  assert.match(page, /name="identifierSourceUrl"/);
});

test('Company create blocks an authoritative identifier duplicate but only warns for similar names', () => {
  const server = fs.readFileSync('src/routes/companies/+page.server.ts', 'utf8');
  assert.match(server, /title: 'Company identifier already exists'/);
  assert.match(server, /allowCreateAnyway: false/);
  assert.match(server, /normaliseCompanyNameForDuplicateWarning/);
  assert.match(server, /'similar company name'/);
  assert.match(server, /allowCreateAnyway: true/);
  assert.match(server, /contextSpaceId/);
});

test('Company detail page can add and remove external identifiers after creation', () => {
  const page = fs.readFileSync('src/routes/companies/[id]/+page.svelte', 'utf8');
  const server = fs.readFileSync('src/routes/companies/[id]/+page.server.ts', 'utf8');
  assert.match(page, /action="\?\/addExternalIdentifier"/);
  assert.match(page, /action="\?\/removeExternalIdentifier"/);
  assert.match(page, /A Company does not need an identifier to be valid\./);
  assert.match(server, /addExternalIdentifier:/);
  assert.match(server, /removeExternalIdentifier:/);
  assert.match(server, /companyExternalIdentifier\.create/);
  assert.match(server, /companyExternalIdentifier\.deleteMany/);
});

test('lead filters start collapsed and expose one pinnable working list above the filters', () => {
  const page = fs.readFileSync('src/routes/leads/+page.svelte', 'utf8');
  assert.match(page, /let filtersExpanded = false/);
  assert.match(page, /Pinned working list/);
  assert.match(page, /Pin current filter/);
  assert.match(page, /on:click=\{unpinFilter\}>Unpin/);
  assert.match(page, /\{#if filtersExpanded\}[\s\S]*<form method="GET" class="filter-row">/);
});

test('pinned lead filter is browser-persisted but keyed per owner and ContextSpace', () => {
  const page = fs.readFileSync('src/routes/leads/+page.svelte', 'utf8');
  const server = fs.readFileSync('src/routes/leads/+page.server.ts', 'utf8');
  assert.match(page, /localStorage\.setItem\(data\.pinStorageKey/);
  assert.match(page, /localStorage\.removeItem\(data\.pinStorageKey/);
  assert.match(server, /pinStorageKey: `relish\.leads\.pinnedFilter\.\$\{userId\}\.\$\{contextSpaceId\}`/);
});

test('Stage 8.8.7 reuses existing CompanyExternalIdentifier storage and adds no migration', () => {
  const migrations = fs.readdirSync('prisma/migrations').filter((name) => /^\d/.test(name)).sort();
  assert.equal(migrations.at(-1), '20260907144000_stage8_8_5_lead_next_action_options');
});

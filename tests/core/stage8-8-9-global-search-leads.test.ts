// PURPOSE: Verify Stage 8.8.9 adds MarketLead and MarketLeadNote coverage to the main Search page.
// IT: Lead search stays custody-scoped and searches encrypted lead text only after tenant/context filtering.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('src/routes/search/+page.server.ts', 'utf8');
const page = fs.readFileSync('src/routes/search/+page.svelte', 'utf8');

test('main Search exposes Leads as a first-class scope and result section', () => {
  assert.match(server, /type Scope = 'all' \| 'contacts' \| 'leads'/);
  assert.match(page, /<option value="leads">Leads<\/option>/);
  assert.match(page, /<h3>Leads \(\{data\.results\.leads\.length\}\)<\/h3>/);
  assert.match(page, /href=\{`\/leads\/\$\{l\.id\}`\}/);
});

test('lead search uses exact deterministic indexes plus bounded partial search', () => {
  assert.match(server, /prisma\.marketLead\.findMany/);
  assert.match(server, /\{ titleIdx: token \}/);
  assert.match(server, /\{ nameIdx: token \}/);
  assert.match(server, /\{ companyNameIdx: token \}/);
  assert.match(server, /LEAD_SCAN_LIMIT = 5000/);
  assert.match(server, /leadMatches\(row\)/);
});

test('lead search covers operational and descriptive lead fields', () => {
  for (const field of [
    'market_lead.title',
    'market_lead.name',
    'market_lead.company_name',
    'market_lead.email',
    'market_lead.phone',
    'market_lead.website',
    'market_lead.linkedin',
    'market_lead.role_title',
    'market_lead.geography',
    'market_lead.address',
    'market_lead.description',
    'market_lead.notes',
    'market_lead.next_action'
  ]) {
    assert.match(server, new RegExp(field.replace('.', '\\.')));
  }
});

test('separate MarketLeadNote records are searchable from All/Leads and Notes scope', () => {
  assert.match(server, /prisma\.marketLeadNote\.findMany/);
  assert.match(server, /market_lead_note\.body/);
  assert.match(server, /market_lead_note\.summary/);
  assert.match(server, /if \(scope === 'notes'\)/);
  assert.match(page, /<h3>Lead notes \(\{data\.results\.leadNotes\.length\}\)<\/h3>/);
  assert.match(page, /href=\{`\/leads\/\$\{n\.marketLeadId\}`\}/);
});

test('new lead search is explicitly owner and ContextSpace scoped before decrypt scanning', () => {
  assert.match(server, /const contextSpaceId = contextSpaceIdForOwner\(userId\)/);
  assert.match(server, /where: \{ userId, contextSpaceId \}/);
  assert.match(server, /where: \{ userId, contextSpaceId, id: \{ in:/);
});

test('Stage 8.8.9 is code-only with no new Prisma migration', () => {
  const migrations = fs.readdirSync('prisma/migrations').filter((name) => /^\d/.test(name)).sort();
  // IT: Test the historical release itself rather than assuming the repository can never gain a later migration.
  assert.equal(migrations.filter((name) => name.includes('stage8_8_9')).length, 0);
});

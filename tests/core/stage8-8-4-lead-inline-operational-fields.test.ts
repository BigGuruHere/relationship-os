// PURPOSE: Verify Stage 8.8.4 keeps fast lead edits narrow, autosaved and separate from identity/contact editing.
// SECURITY: Only explicitly approved operational fields may use the quick update action.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isQuickMarketLeadField, parseQuickLeadConfidence, QUICK_MARKET_LEAD_FIELDS } from '../../src/lib/leadQuickFields.ts';

test('quick lead fields contain only the approved operational fields', () => {
  assert.deepEqual([...QUICK_MARKET_LEAD_FIELDS], [
    'usualCommunicationMethod',
    'contactAttemptStatus',
    'lastContactedAt',
    'buyerStatus',
    'sellerStatus',
    'confidence',
    'nextAction'
  ]);

  for (const disallowed of ['name', 'companyName', 'email', 'phone', 'website', 'linkedin', 'roleTitle', 'address', 'status', 'source']) {
    assert.equal(isQuickMarketLeadField(disallowed), false, `${disallowed} must remain Edit Lead only`);
  }
});

test('quick confidence accepts only whole numbers from 0 to 100', () => {
  assert.equal(parseQuickLeadConfidence('0'), 0);
  assert.equal(parseQuickLeadConfidence('50'), 50);
  assert.equal(parseQuickLeadConfidence('100'), 100);
  assert.equal(parseQuickLeadConfidence('-1'), null);
  assert.equal(parseQuickLeadConfidence('101'), null);
  assert.equal(parseQuickLeadConfidence('50x'), null);
  assert.equal(parseQuickLeadConfidence('50.5'), null);
  assert.equal(parseQuickLeadConfidence(''), null);
});

test('Details panel renders autosaving controls for all approved fields and keeps priority in its existing stepper', () => {
  const page = fs.readFileSync('src/routes/leads/[id]/+page.svelte', 'utf8');

  assert.equal((page.match(/action="\?\/quickField"/g) || []).length, 7);
  for (const field of QUICK_MARKET_LEAD_FIELDS) {
    assert.match(page, new RegExp(`value="${field}"`));
  }
  assert.equal((page.match(/action="\?\/quickPriority"/g) || []).length, 1);
  assert.match(page, /<strong>Priority<\/strong><div class="priority-inline-wrap">/);
  assert.match(page, /on:change=\{submitQuickControl\}/);
  assert.match(page, /use:enhance=\{enhanceQuickField\('/);
});

test('server action is tenant-scoped and rejects fields outside the quick allowlist', () => {
  const server = fs.readFileSync('src/routes/leads/[id]/+page.server.ts', 'utf8');
  const block = server.slice(server.indexOf('quickField:'), server.indexOf('update: async'));

  assert.match(block, /isQuickMarketLeadField\(field\)/);
  assert.match(block, /where: \{ id: params\.id, userId \}/);
  assert.match(block, /prisma\.marketLead\.updateMany/);
  assert.match(block, /usualCommunicationMethod/);
  assert.match(block, /contactAttemptStatus/);
  assert.match(block, /lastContactedAt/);
  assert.match(block, /buyerStatus/);
  assert.match(block, /sellerStatus/);
  assert.match(block, /parseQuickLeadConfidence/);
  assert.match(block, /nextActionEnc/);
});

test('full Edit Lead form uses current quick values so a later save cannot restore stale operational data', () => {
  const page = fs.readFileSync('src/routes/leads/[id]/+page.svelte', 'utf8');

  assert.match(page, /selected=\{quickCommunicationMethod === opt\.value\}/);
  assert.match(page, /selected=\{quickContactAttemptStatus === opt\.value\}/);
  assert.match(page, /selected=\{quickBuyerStatus === opt\.value\}/);
  assert.match(page, /selected=\{quickSellerStatus === opt\.value\}/);
  assert.match(page, /value=\{quickLastContactedAt\}/);
  assert.match(page, /value=\{quickConfidence\}/);
  assert.match(page, /value=\{quickNextAction\}/);
});

// PURPOSE: Verify Stage 8.8.8 typo-aware Company duplicate warnings.
// IT: Similar names are advisory only; identifiers remain authoritative and fragment matches stay quiet.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { areCompanyNamesSimilarForDuplicateWarning } from '../../src/lib/companyIdentity.ts';

test('one-character company-name typos trigger a possible duplicate warning', () => {
  assert.equal(areCompanyNamesSimilarForDuplicateWarning('Coca Cola', 'Coka Cola'), true);
});

test('adjacent transposition is treated as one likely typo', () => {
  assert.equal(areCompanyNamesSimilarForDuplicateWarning('Coca Cola', 'Coac Cola'), true);
});

test('short fragments do not create noisy possible-duplicate warnings', () => {
  assert.equal(areCompanyNamesSimilarForDuplicateWarning('Coca Cola', 'Coka'), false);
  assert.equal(areCompanyNamesSimilarForDuplicateWarning('Coca Cola', 'Cola'), false);
});

test('fuzzy name detection stays warning-only in Company creation', () => {
  const server = fs.readFileSync('src/routes/companies/+page.server.ts', 'utf8');
  assert.match(server, /areCompanyNamesSimilarForDuplicateWarning\(existingName, name\)/);
  assert.match(server, /title: 'Possible duplicate company found'/);
  assert.match(server, /allowCreateAnyway: true/);
});

// IT: Source contract regression tests. Database/browser validation remains required.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
test('admission changes are scoped to one owned contact revision chain', () => {
  const source = read('src/lib/server/core/noteRevisions.ts');
  assert.match(source, /changeNoteLivingUnderstandingAdmission/);
  assert.match(source, /contextSpaceId: context\.contextSpaceId, contactId/);
  assert.match(source, /groupCurrentNotes\(rows\)/);
  assert.match(source, /livingUnderstandingRevisionSource\.count/);
  assert.match(source, /requires a reviewed LU reassessment/);
  assert.match(source, /'WITHDRAWN'/);
});
test('corrections inherit note LU admission rather than silently opt in', () => {
  const source = read('src/lib/server/core/noteRevisions.ts');
  assert.match(source, /admission\?\.luAdmission === 'ELIGIBLE'/);
  assert.match(source, /luAdmission: admission/);
});

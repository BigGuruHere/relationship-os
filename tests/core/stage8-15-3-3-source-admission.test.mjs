// IT: Source-contract checks. These do not replace database or browser tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
test('schema and forward migration preserve an explicit admission decision', () => {
  assert.match(read('prisma/schema.prisma'), /luAdmission String @default\("ELIGIBLE"\)/);
  assert.match(read('prisma/migrations/20261014120000_stage8_15_3_3_source_lu_admission/migration.sql'), /CHECK \(.*STORED_ONLY.*ELIGIBLE.*WITHDRAWN/);
});
test('CRM notes default to stored-only and offer opt-in', () => {
  const server = read('src/routes/contacts/[id]/interactions/new/+page.server.ts');
  const page = read('src/routes/contacts/[id]/interactions/new/+page.svelte');
  assert.match(server, /luAdmission: z\.enum\(\['STORED_ONLY', 'ELIGIBLE'\]\)\.default\('STORED_ONLY'\)/);
  assert.match(server, /luAdmission: parsed\.data\.luAdmission/);
  assert.match(page, /name="luAdmission" value="ELIGIBLE"/);
});
test('Core guards LU preparation and approval for excluded sources', () => {
  const lu = read('src/lib/server/datingLongitudinalLivingUnderstanding.ts');
  assert.match(lu, /async function requireLivingUnderstandingAdmission/);
  assert.match(lu, /source\.luAdmission !== 'ELIGIBLE'/);
  assert.match(lu, /requireLivingUnderstandingAdmission\(scope, sourceInteractionId\)/);
  assert.match(lu, /requireLivingUnderstandingAdmission\(scope, payload\.sourceInteractionId\)/);
});

// Source-level regression checks for Stage 8.22.1. Run with node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
test('new default-scoped records use an explicitly owned default space', () => {
  const code = read('src/lib/server/core/contextSpace.ts');
  assert.match(code, /defaultContextSpaceId: true/);
  assert.match(code, /id: account\.defaultContextSpaceId, ownerUserId/);
  for (const file of ['src/lib/connections.ts']) {
    assert.match(read(file), /requireConfiguredDefaultContextSpaceIdForOwner/);
  }
});
test('operator recovery inspects transcript evidence under named participant custody', () => {
  const code = read('src/lib/server/pilotMonitor/dorianRecovery.ts');
  assert.match(code, /reason: 'PILOT_PHONE_REVIEW'/);
  assert.match(code, /inspectEvidenceInCustody\(viewer, session, \(\) => evidenceExists\(prisma, session\)\)/);
  assert.match(code, /inspectEvidenceInCustody\(viewer, session, \(\) => evidenceExists\(tx, session\)\)/);
});

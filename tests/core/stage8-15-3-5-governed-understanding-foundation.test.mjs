// IT: Stage 8.15.3.5 source-level contract checks; live DB checks remain required.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync('prisma/migrations/20261014160000_stage8_15_3_5_governed_understanding_scopes/migration.sql','utf8');
const model = (name) => schema.split(`model ${name} {`)[1]?.split('\n}')[0] ?? '';
test('scope records owner, context and explicit subject', () => {
  const scope = model('GovernedUnderstandingScope');
  for (const key of ['userId String','contextSpaceId String','kind GovernedUnderstandingSubjectKind','contactId String?','relatingId String?']) assert.ok(scope.includes(key), key);
  assert.match(migration,/GovernedUnderstandingScope_subject_shape_chk/);
  assert.match(migration,/stage81535_scope_owner/);
});
test('one source may link to different scopes but never across custody', () => {
  const source = model('GovernedUnderstandingScopeSource');
  assert.match(source,/@@unique\(\[scopeId, interactionId\]\)/);
  assert.match(migration,/stage81535_scope_source_custody/);
  assert.match(migration,/stage81535_prevent_linked_interaction_reparent/);
});
test('historical LU revision and shared Person remain unchanged in shape', () => {
  const rev = model('LivingUnderstandingRevision');
  assert.match(rev,/contactId String/);
  assert.match(rev,/revisionNumber Int/);
  assert.doesNotMatch(model('Person'), /nameEnc|emailEnc|profileEnc/);
});

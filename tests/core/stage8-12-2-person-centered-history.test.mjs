// Stage 8.12.2: focused, dependency-free structural boundary checks.
// These supplement the opt-in PostgreSQL integration test; they do not prove live custody.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const history = read('src/lib/server/datingPersonHistory.ts');
const route = read('src/routes/dating/people/[id]/+page.server.ts');
const ui = read('src/routes/dating/people/[id]/+page.svelte');
const schema = read('prisma/schema.prisma');
test('personal reflection does not require introduction or touchpoint', () => {
  assert.match(history, /touchpointId = input\.touchpointId \|\| null/);
  assert.match(ui, /No touchpoint - a personal reflection/);
  assert.match(history, /channel: PERSONAL_CHANNEL/);
});
test('every read and write is custody scoped, touchpoint reflection checks attendance', () => {
  assert.match(history, /requireDatingHistoryContact\(scope\)/);
  assert.match(history, /assertAttendedTouchpoint\(scope, touchpointId\)/);
  assert.match(history, /contextSpaceId: scope.contextSpaceId/);
  assert.match(route, /contextDomainKey !== 'dating'/);
});
test('encounters support multiple attendees independent of groups', () => {
  assert.match(history, /uniqueIds\.map\(contactId => \(\{ contactId \}\)\)/);
  assert.match(ui, /Independent touchpoint/);
  assert.match(schema, /model TouchpointParticipant \{/);
  assert.match(schema, /model RelatingParticipant \{/);
});
test('person timeline links introduction without depending on its existence', () => {
  assert.match(history, /prisma\.introductionParticipant\.findMany/);
  assert.match(ui, /No introductions recorded/);
  assert.match(ui, /No encounters recorded yet/);
});
test('private reflection is explicitly operator-recorded, encrypted, and not automatically a confirmed claim', () => {
  assert.match(history, /encrypt\(JSON\.stringify\(payload\), AAD\)/);
  assert.match(history, /actor: 'OPERATOR'/);
  assert.doesNotMatch(history, /knowledgeClaim\.create/);
  assert.match(ui, /neither|Neither/);
});

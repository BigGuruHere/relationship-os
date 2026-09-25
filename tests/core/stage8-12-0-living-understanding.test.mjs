// Stage 8.12.0 smoke checks deliberately distinguish source guards from real DB integration tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const server = readFileSync('src/lib/server/datingLivingUnderstanding.ts','utf8');
const route = readFileSync('src/routes/dating/people/[id]/understanding/+page.server.ts','utf8');
const ui = readFileSync('src/routes/dating/people/[id]/understanding/+page.svelte','utf8');
test('each participant lookup includes owner and active Dating custody', () => {
  assert.match(server, /ownerUserId: scope\.userId, domainKey: 'dating'/);
  assert.match(server, /contactId: scope\.contactId/);
  assert.match(route, /contextDomainKey !== 'dating'/);
});
test('source and subsequent reviews are encrypted append-only events', () => {
  assert.match(server, /event: 'PROPOSE'/);
  assert.match(server, /event: 'REVIEW'/);
  assert.match(server, /encrypt\(JSON\.stringify\(entry\), AAD\)/);
  assert.match(server, /encrypt\(JSON\.stringify\(event\), AAD\)/);
});
test('confirmed knowledge references the originating source and stays context-local', () => {
  assert.match(server, /sourceInteractionId: reviewEvent\.id/);
  assert.match(server, /authority: 'THIRD_PARTY_REPORTED'/);
  assert.match(server, /contextSpaceId: scope\.contextSpaceId/);
  assert.match(server, /status: 'SUPERSEDED'/);
});
test('UI distinguishes operator confirmation from participant confirmation and disclosure', () => {
  assert.match(ui, /not independently verified by the participant/);
  assert.match(ui, /does not grant permission/);
  assert.match(ui, /Not sure yet/);
});

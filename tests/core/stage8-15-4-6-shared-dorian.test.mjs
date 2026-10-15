import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = x => readFileSync(x, 'utf8');
test('Shared Dorian requires server-issued session token and General custody', () => {
 const src = read('src/lib/server/integrations/elevenlabs/networkSession.ts');
 assert.match(src, /randomBytes\(32\)/);
 assert.match(src, /networkSessionHash\(token\)/);
 assert.match(src, /domainKey: 'general'/);
 assert.match(src, /conversationId: null/);
});
test('Shared webhook never silently falls back to deployment owner', () => {
 const src = read('src/routes/api/webhooks/elevenlabs/+server.ts');
 assert.match(src, /Missing or invalid Network participant session/);
 assert.match(src, /targetUserId = shared\?\.userId/);
 assert.match(src, /targetContextSpaceId = shared\?\.contextSpaceId/);
});
test('Shared voice entry requires authenticated POST', () => {
 const src = read('src/routes/network/dorian/+page.server.ts');
 assert.match(src, /export const actions/);
 assert.match(src, /if \(!locals\.user\)/);
 const ui = read('src/routes/network/dorian/+page.svelte');
 assert.match(ui, /method="POST" action="\?\/start"/);
});

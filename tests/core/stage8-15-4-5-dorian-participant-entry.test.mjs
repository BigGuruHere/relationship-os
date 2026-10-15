import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load = readFileSync('src/routes/network/dorian/+page.server.ts', 'utf8');
const ui = readFileSync('src/routes/network/dorian/+page.svelte', 'utf8');
const network = readFileSync('src/routes/network/+page.svelte', 'utf8');
test('Dorian entry authenticates and requires General custody', () => {
 assert.match(load, /if \(!locals\.user\)/);
 assert.match(load, /locals\.contextDomainKey === 'general'/);
});
test('Only a participant-owned deployment is eligible', () => {
 assert.match(load, /userId, contextSpaceId, provider: 'ELEVENLABS'/);
 assert.match(load, /agentDefinition: \{ key: 'DORIAN' \}/);
 assert.match(load, /bindings\.length !== 1/);
});
test('Self-contact must be unambiguous and custody local', () => {
 assert.match(load, /where: \{ userId, contextSpaceId, linkedUserId: userId \}/);
 assert.match(load, /contacts\.length !== 1/);
});
test('Widget remains unavailable without eligibility; no invitation-derived identity', () => {
 assert.match(ui, /if \(!data\.launch && !form\?\.sharedLaunch\) return/);
 assert.match(ui, /status === 'READY' && data\.launch/);
 assert.match(network, /href="\/network\/dorian"/);
 assert.doesNotMatch(load, /inviterUserId|NetworkConnectionOrigin/);
});

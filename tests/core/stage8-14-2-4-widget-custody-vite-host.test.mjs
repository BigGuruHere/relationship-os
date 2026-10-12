// Stage 8.14.2.4 - widget harness same-owner custody entry + configurable Vite tunnel host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const harnessServer = read('../../src/routes/settings/agents/test/+page.server.ts');
const vite = read('../../vite.config.ts');

test('widget harness enters the selected deployment ContextSpace before Contact resolution', () => {
  assert.match(harnessServer, /runWithWorkspaceCustody/);
  assert.match(harnessServer, /userId: locals\.user\.id, contextSpaceId: binding\.contextSpaceId/);
  assert.match(harnessServer, /resolveHarnessParticipant\(locals\.user!\.id, binding\.contextSpaceId, participantId\)/);
});

test('Vite permits a configurable ngrok development hostname', () => {
  assert.match(vite, /loadEnv/);
  assert.match(vite, /DEV_ALLOWED_HOSTS/);
  assert.match(vite, /DEV_ALLOWED_HOST/);
  assert.match(vite, /creative-basilisk-painfully\.ngrok-free\.app/);
  assert.match(vite, /allowedHosts/);
});

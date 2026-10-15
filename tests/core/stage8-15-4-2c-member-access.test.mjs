// SECURITY: Stage 8.15.4.2c regression checks for privileged route coverage and custody counters.
// These tests are static policy checks. A live DB and browser access matrix is still required.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const policy = read('src/lib/server/core/capabilities.ts');
const hook = read('src/hooks.server.ts');
const layout = read('src/routes/+layout.server.ts');
test('ContextSpace management requires ADMIN and owner-specific page checks remain independent', () => {
  assert.match(policy, /within\('\/settings\/context-spaces'\)/);
  assert.match(policy, /return 'ADMIN'/);
  assert.match(hook, /requiredCapabilityForPath\(event\.url\.pathname\)/);
  assert.match(hook, /throw error\(403/);
  assert.match(read('src/routes/settings/users/+page.server.ts'), /locals\.user\.role !== 'owner'/);
});
test('General operator workspace and broker API use request-time capability gates', () => {
  assert.match(policy, /within\('\/general'\).*return 'OPERATOR'/);
  assert.match(policy, /'\/api\/task-commercial-links'/);
  assert.match(hook, /effectiveCapabilities\(account\.role, account\.capabilityGrants/);
});
test('Shared layout counts are scoped to the selected context', () => {
  assert.match(layout, /userId: locals\.user\.id, contextSpaceId: locals\.contextSpaceId, reconnectEveryDays/);
  assert.match(layout, /userId: locals\.user\.id, contextSpaceId: locals\.contextSpaceId, completedAt/);
  assert.match(layout, /contextSpaceId: locals\.contextSpaceId,\s*status:/);
});

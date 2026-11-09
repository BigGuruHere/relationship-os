// Explicit retirement checks replace acceptance tests for deleted commercial screens.
// Shared custody/agent policy tests remain active in their original suites.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
const routes = ['broker','leads','companies','deals','agents','workstreams','contacts','tasks','projects',
  'search','actions','wants','offers','introductions','reminders','reconnect','api/leads',
  'api/task-commercial-links','api/guest/start','api/guest/claim-linkedin','guest/welcome','thank-you','u/[slug]/lead'];
const read = p => readFileSync(p, 'utf8');
test('retired Brokerage screens are physically absent, including direct API and guest intake routes', () => {
  for (const route of routes) {
    const path = 'src/routes/' + route;
    const files = existsSync(path) ? readdirSync(path, { recursive: true, withFileTypes: true }).filter(e => e.isFile()) : [];
    assert.equal(files.length, 0, path);
  }
});
test('no remaining authentication handler imports the retired account-matching writer', () => {
  for (const path of ['auth/register/+page.server.ts','auth/login/+page.server.ts',
    'auth/google/callback/+server.ts','api/auth/magic-link/+server.ts']) {
    assert.doesNotMatch(read('src/routes/' + path), /linkLeadsForUser|\$lib\/leads\/link/);
  }
  assert.equal(existsSync('src/lib/leads/link.ts'), false);
  assert.equal(existsSync('src/lib/leads/reciprocal.ts'), false);
});
test('an obsolete Brokerage environment switch or grant cannot reactivate code or navigation', () => {
  for (const path of ['src/hooks.server.ts','src/lib/server/core/capabilities.ts','src/routes/+layout.svelte',
    'src/routes/+layout.server.ts','src/routes/settings/users/+page.server.ts']) {
    assert.doesNotMatch(read(path), /RELISH_BROKERAGE_ENABLED|brokerageEnabled|['"]BROKER['"]/);
  }
});
test('Relish agent setup does not recreate commercial agents or their grants', () => {
  const setup = read('src/lib/server/agents/agentSetup.ts');
  for (const key of ['broker_brief_agent','outreach_agent','opportunity_scoring_agent','contact_enrichment_agent'])
    assert.equal(setup.includes(key), false, key);
  assert.match(setup, /dating_outcome_extractor/);
  assert.match(setup, /allowContactMethods: false/);
  assert.match(setup, /requiresApprovalDefault: true/);
});

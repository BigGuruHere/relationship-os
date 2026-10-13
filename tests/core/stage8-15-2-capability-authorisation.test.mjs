// PURPOSE: Verify independent account capabilities and server-owned privileged route policy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { effectiveCapabilities, hasCapability, requiredCapabilityForPath } from '../../src/lib/server/core/capabilities.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('member privilege defaults are deny-by-default and grants compose independently', () => {
  assert.deepEqual(effectiveCapabilities('member'), ['MEMBER']);
  assert.deepEqual(effectiveCapabilities('guest', ['ADMIN']), []);
  assert.deepEqual(effectiveCapabilities('member', ['BROKER', 'OPERATOR', 'UNKNOWN', 'BROKER']), ['MEMBER', 'BROKER', 'OPERATOR']);
  assert.deepEqual(effectiveCapabilities('owner'), ['MEMBER', 'OPERATOR', 'ADMIN', 'BROKER']);
  assert.equal(hasCapability(effectiveCapabilities('member'), 'OPERATOR'), false);
});

test('privileged paths deny without grants; segment boundaries do not over-match', () => {
  for (const route of ['/general/admin/reviews', '/general/reviews', '/general/people/123', '/general/conversations/import']) {
    assert.equal(requiredCapabilityForPath(route), 'OPERATOR');
  }
  assert.equal(requiredCapabilityForPath('/settings/agents'), 'ADMIN');
  for (const route of ['/leads', '/api/leads/123', '/companies/123', '/deals/new', '/agents/scoring']) {
    assert.equal(requiredCapabilityForPath(route), 'BROKER');
  }
  assert.equal(requiredCapabilityForPath('/general'), null);
  assert.equal(requiredCapabilityForPath('/contacts/123'), null);
  assert.equal(requiredCapabilityForPath('/leaders'), null);
  assert.equal(requiredCapabilityForPath('/general/people-else'), null);
});

test('enforcement is in server hook before route resolution, not only navigation', () => {
  const hook = read('../../src/hooks.server.ts');
  const prisma = read('../../prisma/schema.prisma');
  assert.match(hook, /requiredCapabilityForPath\(event\.url\.pathname\)/);
  assert.match(hook, /throw error\(403/);
  assert.match(hook, /capabilityGrants: \{ select:/);
  assert.match(prisma, /model UserCapabilityGrant/);
  assert.match(prisma, /@@unique\(\[userId, capability\]\)/);
});

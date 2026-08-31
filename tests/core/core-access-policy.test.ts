// tests/core/core-access-policy.test.ts
// PURPOSE: Lock down Stage 8.1 tenant and agent-context predicates before broader Core extraction.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAgentCoreAccess,
  createWorkspaceCoreAccess,
  workspaceEntityWhere
} from '../../src/lib/server/core/accessPolicy.ts';

test('workspace Core access always scopes canonical entity lookup by current userId', () => {
  const access = createWorkspaceCoreAccess('user-a', 'contact-view');
  assert.deepEqual(workspaceEntityWhere(access, 'contact-7'), {
    id: 'contact-7',
    userId: 'user-a'
  });
});

test('agent Core access records tenant, agent identity, and purpose', () => {
  assert.deepEqual(createAgentCoreAccess({
    userId: 'user-a',
    agentDefinitionId: 'agent-2',
    purpose: 'read_entity_context'
  }), {
    workspaceUserId: 'user-a',
    actorType: 'AGENT',
    actorId: 'agent-2',
    purpose: 'read_entity_context'
  });
});

test('agent Core access fails closed without an agent definition id', () => {
  assert.throws(() => createAgentCoreAccess({
    userId: 'user-a',
    agentDefinitionId: null,
    purpose: 'read_entity_context'
  }), /agent definition id/i);
});

test('Core access fails closed without a purpose', () => {
  assert.throws(() => createAgentCoreAccess({
    userId: 'user-a',
    agentDefinitionId: 'agent-2',
    purpose: ''
  }), /purpose/i);
});

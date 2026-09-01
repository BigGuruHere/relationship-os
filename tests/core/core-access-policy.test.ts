// PURPOSE: Lock down owner + ContextSpace predicates for Core access.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAgentCoreAccess,
  createWorkspaceCoreAccess,
  workspaceEntityWhere
} from '../../src/lib/server/core/accessPolicy.ts';

test('workspace Core access scopes canonical lookup by owner and default ContextSpace', () => {
  const access = createWorkspaceCoreAccess('user-a', 'contact-view');
  assert.deepEqual(workspaceEntityWhere(access, 'contact-7'), {
    id: 'contact-7',
    userId: 'user-a',
    contextSpaceId: 'user-a'
  });
});

test('workspace Core access can target an explicit non-default ContextSpace', () => {
  const access = createWorkspaceCoreAccess('user-a', 'contact-view', 'context-b');
  assert.equal(access.contextSpaceId, 'context-b');
  assert.equal(workspaceEntityWhere(access, 'contact-7').contextSpaceId, 'context-b');
});

test('agent Core access records owner, custody context, agent identity, and purpose', () => {
  assert.deepEqual(createAgentCoreAccess({
    userId: 'user-a',
    contextSpaceId: 'context-a',
    agentDefinitionId: 'agent-2',
    purpose: 'read_entity_context'
  }), {
    workspaceUserId: 'user-a',
    contextSpaceId: 'context-a',
    actorType: 'AGENT',
    actorId: 'agent-2',
    purpose: 'read_entity_context'
  });
});

test('agent Core access fails closed without a ContextSpace', () => {
  assert.throws(() => createAgentCoreAccess({
    userId: 'user-a',
    contextSpaceId: '',
    agentDefinitionId: 'agent-2',
    purpose: 'read_entity_context'
  }), /context space id/i);
});

test('agent Core access fails closed without an agent definition id', () => {
  assert.throws(() => createAgentCoreAccess({
    userId: 'user-a',
    contextSpaceId: 'context-a',
    agentDefinitionId: null,
    purpose: 'read_entity_context'
  }), /agent definition id/i);
});

test('Core access fails closed without a purpose', () => {
  assert.throws(() => createAgentCoreAccess({
    userId: 'user-a',
    contextSpaceId: 'context-a',
    agentDefinitionId: 'agent-2',
    purpose: ''
  }), /purpose/i);
});

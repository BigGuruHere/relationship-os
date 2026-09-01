// src/lib/server/core/accessPolicy.ts
// PURPOSE: Fail-closed access context for Core relationship-data reads and references.
// SECURITY: User.id is ownership; ContextSpace.id is custody. Core lookups require both.

export type CoreActorType = 'WORKSPACE_USER' | 'AGENT';

export type CoreAccessContext = {
  workspaceUserId: string;
  contextSpaceId: string;
  actorType: CoreActorType;
  actorId: string;
  purpose: string;
};

function required(value: string | null | undefined, label: string) {
  const clean = String(value ?? '').trim();
  if (!clean) throw new Error(`Missing Core access ${label}.`);
  return clean;
}

export function createWorkspaceCoreAccess(userId: string, purpose = 'workspace', contextSpaceId?: string | null): CoreAccessContext {
  const workspaceUserId = required(userId, 'workspace user id');
  return {
    workspaceUserId,
    contextSpaceId: required(contextSpaceId ?? workspaceUserId, 'context space id'),
    actorType: 'WORKSPACE_USER',
    actorId: workspaceUserId,
    purpose: required(purpose, 'purpose')
  };
}

export function createAgentCoreAccess(input: {
  userId: string;
  contextSpaceId: string;
  agentDefinitionId?: string | null;
  purpose: string;
}): CoreAccessContext {
  return {
    workspaceUserId: required(input.userId, 'workspace user id'),
    contextSpaceId: required(input.contextSpaceId, 'context space id'),
    actorType: 'AGENT',
    actorId: required(input.agentDefinitionId, 'agent definition id'),
    purpose: required(input.purpose, 'purpose')
  };
}

// IT: Canonical entity lookups always include owner + custody context + entity id.
export function workspaceEntityWhere(context: CoreAccessContext, entityId: string) {
  return {
    id: required(entityId, 'entity id'),
    userId: required(context.workspaceUserId, 'workspace user id'),
    contextSpaceId: required(context.contextSpaceId, 'context space id')
  };
}

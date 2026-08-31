// src/lib/server/core/accessPolicy.ts
// PURPOSE: Fail-closed access context for Core relationship-data reads and references.
// SECURITY: The current tenant boundary remains User.id. Person identity never grants cross-tenant data access.

export type CoreActorType = 'WORKSPACE_USER' | 'AGENT';

export type CoreAccessContext = {
  workspaceUserId: string;
  actorType: CoreActorType;
  actorId: string;
  purpose: string;
};

function required(value: string | null | undefined, label: string) {
  const clean = String(value ?? '').trim();
  if (!clean) throw new Error(`Missing Core access ${label}.`);
  return clean;
}

export function createWorkspaceCoreAccess(userId: string, purpose = 'workspace') : CoreAccessContext {
  const workspaceUserId = required(userId, 'workspace user id');
  return { workspaceUserId, actorType: 'WORKSPACE_USER', actorId: workspaceUserId, purpose: required(purpose, 'purpose') };
}

export function createAgentCoreAccess(input: { userId: string; agentDefinitionId?: string | null; purpose: string }): CoreAccessContext {
  return {
    workspaceUserId: required(input.userId, 'workspace user id'),
    actorType: 'AGENT',
    actorId: required(input.agentDefinitionId, 'agent definition id'),
    purpose: required(input.purpose, 'purpose')
  };
}

// IT: Canonical entity lookups must always include the current workspace/tenant id.
export function workspaceEntityWhere(context: CoreAccessContext, entityId: string) {
  return {
    id: required(entityId, 'entity id'),
    userId: required(context.workspaceUserId, 'workspace user id')
  };
}

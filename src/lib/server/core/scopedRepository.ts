// src/lib/server/core/scopedRepository.ts
// PURPOSE: Dependency-injectable ContextSpace-scoped repository primitives used by Relish Core.
// SECURITY: Every canonical lookup is constructed with entity id + owner user id + custody context id.

export type WorkspaceScopedContext = { workspaceUserId: string; contextSpaceId: string };

function required(value: string | null | undefined, label: string) {
  const clean = String(value ?? '').trim();
  if (!clean) throw new Error(`Missing Core access ${label}.`);
  return clean;
}

export function scopedEntityWhere(context: WorkspaceScopedContext, entityId: string) {
  return {
    id: required(entityId, 'entity id'),
    userId: required(context.workspaceUserId, 'workspace user id'),
    contextSpaceId: required(context.contextSpaceId, 'context space id')
  };
}

type Delegate = { findFirst(args: any): Promise<any> };
export type ScopedRepositoryDb = {
  contact: Delegate;
  company: Delegate;
  deal: Delegate;
  project: Delegate;
  interaction: Delegate;
  want: Delegate;
  offer: Delegate;
  objective: Delegate;
  knowledgeClaim: Delegate;
};

export function createScopedRelationshipRepository(db: ScopedRepositoryDb) {
  const find = (delegate: Delegate, context: WorkspaceScopedContext, entityId: string, select: any) =>
    delegate.findFirst({ where: scopedEntityWhere(context, entityId), select });

  return {
    findContact: (context: WorkspaceScopedContext, id: string, select: any) => find(db.contact, context, id, select),
    findCompany: (context: WorkspaceScopedContext, id: string, select: any) => find(db.company, context, id, select),
    findDeal: (context: WorkspaceScopedContext, id: string, select: any) => find(db.deal, context, id, select),
    findProject: (context: WorkspaceScopedContext, id: string, select: any) => find(db.project, context, id, select),
    findInteraction: (context: WorkspaceScopedContext, id: string, select: any) => find(db.interaction, context, id, select),
    findWant: (context: WorkspaceScopedContext, id: string, select: any) => find(db.want, context, id, select),
    findOffer: (context: WorkspaceScopedContext, id: string, select: any) => find(db.offer, context, id, select),
    findObjective: (context: WorkspaceScopedContext, id: string, select: any) => find(db.objective, context, id, select),
    findKnowledgeClaim: (context: WorkspaceScopedContext, id: string, select: any) => find(db.knowledgeClaim, context, id, select)
  };
}

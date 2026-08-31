// src/lib/server/core/relationshipRepository.ts
// PURPOSE: Scoped repository for canonical relationship records used by agents/Core services.
// SECURITY: Tenant-owned records are only read through the shared scoped repository primitive.

import type { Prisma } from '@prisma/client';
import { prisma } from '$lib/db';
import type { CoreAccessContext } from '$lib/server/core/accessPolicy';
import { createScopedRelationshipRepository } from '$lib/server/core/scopedRepository';

const scoped = createScopedRelationshipRepository(prisma as any);

export function findCoreContact<T extends Prisma.ContactSelect>(context: CoreAccessContext, contactId: string, select: T) {
  return scoped.findContact(context, contactId, select);
}

export function findCoreCompany<T extends Prisma.CompanySelect>(context: CoreAccessContext, companyId: string, select: T) {
  return scoped.findCompany(context, companyId, select);
}

export function findCoreDeal<T extends Prisma.DealSelect>(context: CoreAccessContext, dealId: string, select: T) {
  return scoped.findDeal(context, dealId, select);
}

export function findCoreProject<T extends Prisma.ProjectSelect>(context: CoreAccessContext, projectId: string, select: T) {
  return scoped.findProject(context, projectId, select);
}

export function findCoreInteraction<T extends Prisma.InteractionSelect>(context: CoreAccessContext, interactionId: string, select: T) {
  return scoped.findInteraction(context, interactionId, select);
}

export function findCoreWant<T extends Prisma.WantSelect>(context: CoreAccessContext, wantId: string, select: T) {
  return scoped.findWant(context, wantId, select);
}

export function findCoreOffer<T extends Prisma.OfferSelect>(context: CoreAccessContext, offerId: string, select: T) {
  return scoped.findOffer(context, offerId, select);
}

export function findCoreObjective<T extends Prisma.ObjectiveSelect>(context: CoreAccessContext, objectiveId: string, select: T) {
  return scoped.findObjective(context, objectiveId, select);
}

export function findCoreKnowledgeClaim<T extends Prisma.KnowledgeClaimSelect>(context: CoreAccessContext, claimId: string, select: T) {
  return scoped.findKnowledgeClaim(context, claimId, select);
}

// IT: Person identity is shared, but access remains anchored to this workspace through either
// the workspace owner's account or a Contact already visible inside the workspace.
export function findAccessibleCorePerson<T extends Prisma.PersonSelect>(context: CoreAccessContext, personId: string, select: T) {
  return prisma.person.findFirst({
    where: {
      id: personId,
      OR: [
        { accounts: { some: { id: context.workspaceUserId } } },
        { contacts: { some: { userId: context.workspaceUserId } } }
      ]
    },
    select
  });
}

type CanonicalRefs = {
  contactId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
  projectId?: string | null;
};

// IT: Validate optional foreign keys before an agent creates a record that references canonical workspace data.
export async function assertOwnedCanonicalRefs(context: CoreAccessContext, refs: CanonicalRefs) {
  const checks: Promise<unknown>[] = [];
  if (refs.contactId) checks.push(findCoreContact(context, refs.contactId, { id: true }));
  if (refs.companyId) checks.push(findCoreCompany(context, refs.companyId, { id: true }));
  if (refs.dealId) checks.push(findCoreDeal(context, refs.dealId, { id: true }));
  if (refs.projectId) checks.push(findCoreProject(context, refs.projectId, { id: true }));

  const results = await Promise.all(checks);
  if (results.some((result) => !result)) {
    throw new Error('One or more referenced relationship records were not found in this workspace.');
  }
}

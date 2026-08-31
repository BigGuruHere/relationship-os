// src/lib/server/core/relationshipRepository.ts
// PURPOSE: Scoped repository for canonical relationship records used by agents/Core services.
// SECURITY: Callers provide a CoreAccessContext; this module always adds workspace userId to canonical entity predicates.

import type { Prisma } from '@prisma/client';
import { prisma } from '$lib/db';
import { workspaceEntityWhere, type CoreAccessContext } from '$lib/server/core/accessPolicy';

export function findCoreContact<T extends Prisma.ContactSelect>(context: CoreAccessContext, contactId: string, select: T) {
  return prisma.contact.findFirst({ where: workspaceEntityWhere(context, contactId), select });
}

export function findCoreCompany<T extends Prisma.CompanySelect>(context: CoreAccessContext, companyId: string, select: T) {
  return prisma.company.findFirst({ where: workspaceEntityWhere(context, companyId), select });
}

export function findCoreDeal<T extends Prisma.DealSelect>(context: CoreAccessContext, dealId: string, select: T) {
  return prisma.deal.findFirst({ where: workspaceEntityWhere(context, dealId), select });
}

export function findCoreProject<T extends Prisma.ProjectSelect>(context: CoreAccessContext, projectId: string, select: T) {
  return prisma.project.findFirst({ where: workspaceEntityWhere(context, projectId), select });
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

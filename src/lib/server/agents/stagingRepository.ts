// src/lib/server/agents/stagingRepository.ts
// PURPOSE: Tenant-scoped repository helpers for AI staging records.
// SECURITY: Every lookup includes userId + agentRunId + record id before a staged record can be reviewed or promoted.

import { prisma } from '$lib/db';
import { approvedStagingOwnershipWhere, stagingOwnershipWhere } from '$lib/server/agents/stagingPolicy';

export function getOwnedResearchCandidate(userId: string, candidateId: string, agentRunId: string) {
  return prisma.researchCandidate.findFirst({
    where: stagingOwnershipWhere(userId, candidateId, agentRunId)
  });
}


// IT: Promotion helpers are deliberately separate from general ownership lookups. They fail closed
//     at the database predicate by requiring APPROVED in addition to tenant/run ownership.
export function getApprovedContactEnrichmentForPromotion(userId: string, enrichmentId: string, agentRunId: string) {
  return prisma.contactEnrichment.findFirst({
    where: approvedStagingOwnershipWhere(userId, enrichmentId, agentRunId)
  });
}

export function getApprovedResearchCandidateForPromotion(userId: string, candidateId: string, agentRunId: string) {
  return prisma.researchCandidate.findFirst({
    where: approvedStagingOwnershipWhere(userId, candidateId, agentRunId)
  });
}

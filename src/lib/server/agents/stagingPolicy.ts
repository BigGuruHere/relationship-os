// src/lib/server/agents/stagingPolicy.ts
// PURPOSE: Keep ownership and promotion rules for AI staging records explicit and testable.
// SECURITY: Staged research/enrichment data must always be scoped to the owning user and agent run.

export type StagingOwnership = {
  id: string;
  userId: string;
  agentRunId: string;
};

// IT: Build the complete tenant/run ownership predicate in one place so callers cannot accidentally
//     look up an agent staging record by id alone.
export function stagingOwnershipWhere(userId: string, recordId: string, agentRunId: string): StagingOwnership {
  return {
    id: recordId,
    userId,
    agentRunId
  };
}

// IT: Promotion means copying an AI-staged value into canonical CRM data. Only an explicit APPROVED
//     state may cross that trust boundary.
export function isApprovedForPromotion(status: string | null | undefined) {
  return String(status || '').toUpperCase() === 'APPROVED';
}

// IT: Promotion lookups add APPROVED to the ownership predicate so the repository itself cannot
//     return an unapproved row to a promotion workflow.
export function approvedStagingOwnershipWhere(userId: string, recordId: string, agentRunId: string) {
  return {
    ...stagingOwnershipWhere(userId, recordId, agentRunId),
    status: 'APPROVED'
  } as const;
}

// IT: Field-level enrichment groups may contain a mix of approved/rejected/proposed rows.
//     Only approved rows may contribute values when a new contact is assembled.
export function approvedEnrichmentGroupWhere(userId: string, agentRunId: string, groupKey: string) {
  return {
    userId,
    agentRunId,
    groupKey,
    status: 'APPROVED'
  } as const;
}

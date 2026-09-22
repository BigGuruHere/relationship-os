// src/lib/server/agents/tools/createApprovalRequest.ts
// PURPOSE: Create human approval requests for risky or source-of-truth-changing actions.

import { prisma } from '$lib/db';
import type { ToolDefinition } from '$lib/server/agents/types';
import { auditJson, normalizeAgentAuditDataClass } from '$lib/server/agents/sensitiveAudit';

type CreateApprovalRequestInput = {
  actionType: string;
  entityType?: string;
  entityId?: string;
  proposedActionJson?: unknown;
  proposedDiffJson?: unknown;
};

type CreateApprovalRequestOutput = {
  id: string;
  createdEntityType: 'approval_request';
  createdEntityId: string;
};

export const createApprovalRequestTool: ToolDefinition<CreateApprovalRequestInput, CreateApprovalRequestOutput> = {
  key: 'create_approval_request',
  description: 'Creates a human approval request.',
  requiresApproval: false,
  execute: async (input, context) => {
    if (!input.actionType?.trim()) throw new Error('Approval action type is required.');

    const auditDataClass = normalizeAgentAuditDataClass(context.auditDataClass);
    const approval = await prisma.approvalRequest.create({
      data: {
        userId: context.userId,
        contextSpaceId: context.contextSpaceId || context.userId,
        agentRunId: context.agentRunId,
        agentStepId: context.agentStepId ?? null,
        actionType: input.actionType.trim(),
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        proposedActionJson: auditJson(input.proposedActionJson ?? {}, auditDataClass) as any,
        proposedDiffJson: auditJson(input.proposedDiffJson ?? {}, auditDataClass) as any,
        status: 'pending'
      }
    });

    return { id: approval.id, createdEntityType: 'approval_request', createdEntityId: approval.id };
  }
};

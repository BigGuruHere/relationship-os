// src/lib/server/agents/tools/createApprovalRequest.ts
// PURPOSE: Create human approval requests for risky or source-of-truth-changing actions.

import { prisma } from '$lib/db';
import type { ToolDefinition } from '$lib/server/agents/types';

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

    const approval = await prisma.approvalRequest.create({
      data: {
        userId: context.userId,
        contextSpaceId: context.contextSpaceId || context.userId,
        agentRunId: context.agentRunId,
        agentStepId: context.agentStepId ?? null,
        actionType: input.actionType.trim(),
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        proposedActionJson: (input.proposedActionJson ?? {}) as any,
        proposedDiffJson: (input.proposedDiffJson ?? {}) as any,
        status: 'pending'
      }
    });

    return { id: approval.id, createdEntityType: 'approval_request', createdEntityId: approval.id };
  }
};

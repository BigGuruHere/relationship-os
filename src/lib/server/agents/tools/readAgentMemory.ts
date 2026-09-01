// src/lib/server/agents/tools/readAgentMemory.ts
// PURPOSE: Gives an agent a purpose-scoped, derived relationship-memory projection from Relish Core.

import { prisma } from '$lib/db';
import { createAgentCoreAccess } from '$lib/server/core/accessPolicy';
import { buildAgentMemoryProjection, type AgentMemorySubjectType } from '$lib/server/core/agentMemory';
import type { ToolDefinition } from '$lib/server/agents/types';

type ReadAgentMemoryInput = {
  subjectType: AgentMemorySubjectType;
  subjectId: string;
};

export const readAgentMemoryTool: ToolDefinition<ReadAgentMemoryInput, any> = {
  key: 'read_agent_memory',
  description: 'Builds a purpose-scoped, derived memory projection for an accessible Contact or Person.',
  requiresApproval: false,
  execute: async (input, context) => {
    const access = createAgentCoreAccess({
      userId: context.userId,
      contextSpaceId: context.contextSpaceId || context.userId,
      agentDefinitionId: context.agentDefinitionId,
      purpose: 'read_agent_memory'
    });
    const projection = await buildAgentMemoryProjection({
      context: access,
      subjectType: input.subjectType,
      subjectId: input.subjectId
    });

    await prisma.agentRunEntity.create({
      data: {
        agentRunId: context.agentRunId,
        entityType: input.subjectType,
        entityId: input.subjectId,
        role: 'memory_input'
      }
    });

    return projection;
  }
};

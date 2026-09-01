// src/lib/server/agents/tools/readEntityContext.ts
// PURPOSE: Compatibility tool key backed by the Stage 8.5.2 fail-closed Core entity projection.
// SECURITY: No post-query filtering. The data policy builds the Prisma select before any canonical read.

import { prisma } from '$lib/db';
import { createAgentCoreAccess } from '$lib/server/core/accessPolicy';
import { loadAgentAccessProfile } from '$lib/server/core/agentDataAccess';
import { buildAgentEntityContextProjection } from '$lib/server/core/agentEntityProjection';
import type { ToolDefinition } from '$lib/server/agents/types';

type ReadEntityContextInput = {
  entityType: 'contact' | 'company' | 'deal' | 'project';
  entityId: string;
};

export const readEntityContextTool: ToolDefinition<ReadEntityContextInput, any> = {
  key: 'read_entity_context',
  description: 'Reads a purpose-scoped contact, company, deal, or project projection from Relish Core.',
  requiresApproval: false,
  execute: async (input, context) => {
    const access = createAgentCoreAccess({
      userId: context.userId,
      contextSpaceId: context.contextSpaceId || context.userId,
      agentDefinitionId: context.agentDefinitionId,
      purpose: 'read_entity_context'
    });
    const { policy } = await loadAgentAccessProfile(access);
    const result = await buildAgentEntityContextProjection({ context: access, policy, input });

    await prisma.agentRunEntity.create({
      data: {
        agentRunId: context.agentRunId,
        entityType: input.entityType,
        entityId: input.entityId,
        role: 'input'
      }
    });

    return result;
  }
};

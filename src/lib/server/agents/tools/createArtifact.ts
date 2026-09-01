// src/lib/server/agents/tools/createArtifact.ts
// PURPOSE: Store encrypted durable agent outputs as Relish artifacts.

import { prisma } from '$lib/db';
import { encrypt } from '$lib/crypto';
import type { AgentEntityType, ToolDefinition } from '$lib/server/agents/types';

type CreateAgentArtifactInput = {
  artifactType: string;
  title: string;
  content?: string;
  summary?: string;
  structuredJson?: unknown;
  entityType?: AgentEntityType;
  entityId?: string;
};

type CreateAgentArtifactOutput = {
  id: string;
  createdEntityType: 'agent_artifact';
  createdEntityId: string;
};

export const createAgentArtifactTool: ToolDefinition<CreateAgentArtifactInput, CreateAgentArtifactOutput> = {
  key: 'create_agent_artifact',
  description: 'Stores an encrypted durable artifact produced by an agent.',
  requiresApproval: false,
  execute: async (input, context) => {
    if (!input.title?.trim()) throw new Error('Artifact title is required.');
    if (!input.artifactType?.trim()) throw new Error('Artifact type is required.');

    const artifact = await prisma.agentArtifact.create({
      data: {
        userId: context.userId,
        contextSpaceId: context.contextSpaceId || context.userId,
        agentRunId: context.agentRunId,
        agentStepId: context.agentStepId ?? null,
        artifactType: input.artifactType,
        title: input.title.trim(),
        contentEnc: input.content ? encrypt(input.content, 'agent_artifact.content') : null,
        summaryEnc: input.summary ? encrypt(input.summary, 'agent_artifact.summary') : null,
        structuredJson: (input.structuredJson ?? {}) as any,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null
      }
    });

    if (input.entityType && input.entityId) {
      await prisma.agentRunEntity.create({
        data: {
          agentRunId: context.agentRunId,
          entityType: input.entityType,
          entityId: input.entityId,
          role: 'created_artifact_for'
        }
      });
    }

    return {
      id: artifact.id,
      createdEntityType: 'agent_artifact',
      createdEntityId: artifact.id
    };
  }
};

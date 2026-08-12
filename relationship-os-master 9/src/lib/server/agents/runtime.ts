// src/lib/server/agents/runtime.ts
// PURPOSE: Stage 1 agent runtime helpers. Creates durable runs and marks completion/failure.

import { prisma } from '$lib/db';
import { ensureCoreAgentSetup } from '$lib/server/agents/agentSetup';

type StartAgentRunInput = {
  userId: string;
  agentKey: string;
  triggerType?: string;
  triggerEntityType?: string;
  triggerEntityId?: string;
  inputJson?: Record<string, unknown>;
};

export async function startAgentRun(input: StartAgentRunInput) {
  await ensureCoreAgentSetup(input.userId);

  const agent = await prisma.agentDefinition.findUnique({
    where: {
      userId_key: {
        userId: input.userId,
        key: input.agentKey
      }
    },
    include: {
      promptVersions: {
        where: { isActive: true },
        orderBy: { version: 'desc' },
        take: 1
      }
    }
  });

  if (!agent) {
    throw new Error(`Agent not found: ${input.agentKey}`);
  }

  const activePrompt = agent.promptVersions[0] ?? null;

  // IT: Create a durable run record before doing any AI work.
  const run = await prisma.agentRun.create({
    data: {
      userId: input.userId,
      agentDefinitionId: agent.id,
      promptVersionId: activePrompt?.id ?? null,
      status: 'running',
      triggerType: input.triggerType ?? 'manual',
      triggerEntityType: input.triggerEntityType ?? null,
      triggerEntityId: input.triggerEntityId ?? null,
      inputJson: input.inputJson ?? {},
      startedAt: new Date()
    }
  });

  return { agent, activePrompt, run };
}

export async function completeAgentRun(agentRunId: string, resultJson?: unknown) {
  return prisma.agentRun.update({
    where: { id: agentRunId },
    data: {
      status: 'completed',
      resultJson: (resultJson ?? {}) as any,
      completedAt: new Date()
    }
  });
}

export async function failAgentRun(agentRunId: string, error: unknown) {
  return prisma.agentRun.update({
    where: { id: agentRunId },
    data: {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date()
    }
  });
}

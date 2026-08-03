// src/lib/server/agents/agentLogger.ts
// PURPOSE: Small helpers for safely creating and completing visible agent steps.

import { prisma } from '$lib/db';

export async function createAgentStep(params: {
  agentRunId: string;
  stepKey: string;
  stepName: string;
  inputJson?: unknown;
}) {
  return prisma.agentStep.create({
    data: {
      agentRunId: params.agentRunId,
      stepKey: params.stepKey,
      stepName: params.stepName,
      status: 'running',
      inputJson: (params.inputJson ?? {}) as any,
      startedAt: new Date()
    }
  });
}

export async function completeAgentStep(agentStepId: string, outputJson?: unknown) {
  return prisma.agentStep.update({
    where: { id: agentStepId },
    data: {
      status: 'completed',
      outputJson: (outputJson ?? {}) as any,
      completedAt: new Date()
    }
  });
}

export async function failAgentStep(agentStepId: string, error: unknown) {
  return prisma.agentStep.update({
    where: { id: agentStepId },
    data: {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date()
    }
  });
}

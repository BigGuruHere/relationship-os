// src/lib/server/agents/agentLogger.ts
// PURPOSE: Small helpers for safely creating and completing visible agent steps.

import { prisma } from '$lib/db';
import { auditJson, normalizeAgentAuditDataClass, safeAgentAuditError } from '$lib/server/agents/sensitiveAudit';

async function stepAuditDataClass(params: { agentRunId?: string; agentStepId?: string }) {
  if (params.agentRunId) {
    const run = await prisma.agentRun.findFirst({ where: { id: params.agentRunId }, select: { auditDataClass: true } });
    if (!run) throw new Error('Agent run not found for step audit.');
    return normalizeAgentAuditDataClass(run.auditDataClass);
  }
  const step = await prisma.agentStep.findFirst({
    where: { id: params.agentStepId },
    select: { run: { select: { auditDataClass: true } } }
  });
  if (!step) throw new Error('Agent step not found for audit.');
  return normalizeAgentAuditDataClass(step.run.auditDataClass);
}

export async function createAgentStep(params: {
  agentRunId: string;
  stepKey: string;
  stepName: string;
  inputJson?: unknown;
}) {
  const auditDataClass = await stepAuditDataClass({ agentRunId: params.agentRunId });
  return prisma.agentStep.create({
    data: {
      agentRunId: params.agentRunId,
      stepKey: params.stepKey,
      stepName: params.stepName,
      status: 'running',
      inputJson: auditJson(params.inputJson ?? {}, auditDataClass) as any,
      startedAt: new Date()
    }
  });
}

export async function completeAgentStep(agentStepId: string, outputJson?: unknown) {
  const auditDataClass = await stepAuditDataClass({ agentStepId });
  return prisma.agentStep.update({
    where: { id: agentStepId },
    data: {
      status: 'completed',
      outputJson: auditJson(outputJson ?? {}, auditDataClass) as any,
      completedAt: new Date()
    }
  });
}

export async function failAgentStep(agentStepId: string, error: unknown) {
  const auditDataClass = await stepAuditDataClass({ agentStepId });
  return prisma.agentStep.update({
    where: { id: agentStepId },
    data: {
      status: 'failed',
      errorMessage: safeAgentAuditError(error, auditDataClass),
      completedAt: new Date()
    }
  });
}

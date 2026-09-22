// src/lib/server/agents/runtime.ts
// PURPOSE: Stage 1 agent runtime helpers. Creates durable runs and marks completion/failure.

import { prisma } from '$lib/db';
import { ensureCoreAgentSetup } from '$lib/server/agents/agentSetup';
import { contextSpaceIdForOwner } from '$lib/server/core/contextSpace';
import { assertAgentDeploymentAllowed } from '$lib/server/agents/deploymentPolicy';
import { auditJson, normalizeAgentAuditDataClass, safeAgentAuditError, type AgentAuditDataClass } from '$lib/server/agents/sensitiveAudit';

type StartAgentRunInput = {
  userId: string;
  contextSpaceId?: string;
  agentKey: string;
  triggerType?: string;
  triggerEntityType?: string;
  triggerEntityId?: string;
  inputJson?: Record<string, unknown>;
  auditDataClass?: AgentAuditDataClass;
};

export async function startAgentRun(input: StartAgentRunInput) {
  await ensureCoreAgentSetup(input.userId);
  const contextSpaceId = input.contextSpaceId ?? contextSpaceIdForOwner(input.userId);
  const auditDataClass = normalizeAgentAuditDataClass(input.auditDataClass);

  const agent = await prisma.agentDefinition.findUnique({
    where: {
      userId_key: {
        userId: input.userId,
        key: input.agentKey
      }
    },
    include: {
      // SECURITY: Deployment permission is separate from data and tool permissions.
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

  const targetContext = await prisma.contextSpace.findFirst({
    where: { id: contextSpaceId, ownerUserId: input.userId },
    select: { id: true, ownerUserId: true, domainKey: true }
  });
  if (!targetContext) throw new Error('Agent ContextSpace target not found.');
  assertAgentDeploymentAllowed(agent, targetContext, input.userId);

  const activePrompt = agent.promptVersions[0] ?? null;

  // IT: Create a durable run record before doing any AI work.
  const run = await prisma.agentRun.create({
    data: {
      userId: input.userId,
      contextSpaceId,
      agentDefinitionId: agent.id,
      promptVersionId: activePrompt?.id ?? null,
      status: 'running',
      auditDataClass,
      triggerType: input.triggerType ?? 'manual',
      triggerEntityType: input.triggerEntityType ?? null,
      triggerEntityId: input.triggerEntityId ?? null,
      inputJson: auditJson(input.inputJson ?? {}, auditDataClass),
      startedAt: new Date()
    }
  });

  return { agent, activePrompt, run };
}

export async function completeAgentRun(agentRunId: string, resultJson?: unknown) {
  const existing = await prisma.agentRun.findFirst({ where: { id: agentRunId }, select: { auditDataClass: true } });
  if (!existing) throw new Error('Agent run not found.');
  return prisma.agentRun.update({
    where: { id: agentRunId },
    data: {
      status: 'completed',
      resultJson: auditJson(resultJson ?? {}, normalizeAgentAuditDataClass(existing.auditDataClass)) as any,
      completedAt: new Date()
    }
  });
}

export async function failAgentRun(agentRunId: string, error: unknown) {
  const existing = await prisma.agentRun.findFirst({ where: { id: agentRunId }, select: { auditDataClass: true } });
  if (!existing) throw new Error('Agent run not found.');
  const auditDataClass = normalizeAgentAuditDataClass(existing.auditDataClass);
  return prisma.agentRun.update({
    where: { id: agentRunId },
    data: {
      status: 'failed',
      errorMessage: safeAgentAuditError(error, auditDataClass),
      completedAt: new Date()
    }
  });
}

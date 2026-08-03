// src/lib/server/agents/toolRegistry.ts
// PURPOSE: Registered tool execution layer. Agents call these tools instead of writing directly everywhere.

import { prisma } from '$lib/db';
import type { ToolContext, ToolDefinition } from '$lib/server/agents/types';
import { readEntityContextTool } from '$lib/server/agents/tools/readEntityContext';
import { createAgentArtifactTool } from '$lib/server/agents/tools/createArtifact';
import { createResearchCandidateTool } from '$lib/server/agents/tools/createResearchCandidate';
import { createOpportunityScoreTool } from '$lib/server/agents/tools/createOpportunityScore';
import { createApprovalRequestTool } from '$lib/server/agents/tools/createApprovalRequest';
import { createTaskTool } from '$lib/server/agents/tools/createTask';
import { researchWebSearchTool } from '$lib/server/agents/tools/researchWebSearch';
import { createResearchSourceTool } from '$lib/server/agents/tools/createResearchSource';

const tools = new Map<string, ToolDefinition<any, any>>();

export function registerAgentTool<Input, Output>(tool: ToolDefinition<Input, Output>) {
  tools.set(tool.key, tool);
}

function ensureRegistered() {
  if (tools.size > 0) return;
  registerAgentTool(readEntityContextTool);
  registerAgentTool(createAgentArtifactTool);
  registerAgentTool(createResearchCandidateTool);
  registerAgentTool(createOpportunityScoreTool);
  registerAgentTool(createApprovalRequestTool);
  registerAgentTool(createTaskTool);
  registerAgentTool(researchWebSearchTool);
  registerAgentTool(createResearchSourceTool);
}

export async function executeAgentTool<Input, Output>(
  key: string,
  input: Input,
  context: ToolContext
): Promise<Output> {
  ensureRegistered();
  const tool = tools.get(key);

  if (!tool) {
    throw new Error(`Agent tool not found: ${key}`);
  }

  const run = await prisma.agentRun.findFirst({
    where: { id: context.agentRunId, userId: context.userId },
    select: { id: true, agentDefinitionId: true }
  });

  if (!run) {
    throw new Error('Agent run not found or not owned by this user.');
  }

  const dbTool = await prisma.agentToolDefinition.findUnique({
    where: {
      userId_key: {
        userId: context.userId,
        key
      }
    },
    select: {
      id: true,
      isEnabled: true,
      requiresApproval: true,
      permissions: {
        where: { agentDefinitionId: run.agentDefinitionId },
        select: { permissionLevel: true, requiresApproval: true }
      }
    }
  });

  if (!dbTool?.isEnabled) {
    throw new Error(`Agent tool is disabled or missing: ${key}`);
  }

  const permission = dbTool.permissions[0];
  if (!permission || !['execute', 'write', 'read', 'propose'].includes(permission.permissionLevel)) {
    throw new Error(`Agent does not have permission to use tool: ${key}`);
  }

  const needsApproval = tool.requiresApproval || dbTool.requiresApproval || permission.requiresApproval;
  if (needsApproval) {
    await prisma.approvalRequest.create({
      data: {
        userId: context.userId,
        agentRunId: context.agentRunId,
        agentStepId: context.agentStepId ?? null,
        actionType: `tool:${key}`,
        proposedActionJson: input as any,
        status: 'pending'
      }
    });
    throw new Error(`Tool requires approval before execution: ${key}`);
  }

  const call = await prisma.agentToolCall.create({
    data: {
      userId: context.userId,
      agentRunId: context.agentRunId,
      agentStepId: context.agentStepId ?? null,
      toolKey: key,
      status: 'running',
      inputJson: input as any,
      startedAt: new Date()
    }
  });

  try {
    const output = await tool.execute(input, { ...context, agentDefinitionId: run.agentDefinitionId });
    const created = output as any;

    await prisma.agentToolCall.update({
      where: { id: call.id },
      data: {
        status: 'success',
        outputJson: output as any,
        createdEntityType: created?.createdEntityType ?? null,
        createdEntityId: created?.createdEntityId ?? null,
        completedAt: new Date()
      }
    });

    return output as Output;
  } catch (error) {
    await prisma.agentToolCall.update({
      where: { id: call.id },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date()
      }
    });
    throw error;
  }
}

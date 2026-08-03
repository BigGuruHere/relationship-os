// src/routes/agents/runs/[id]/+page.server.ts
// PURPOSE: Detailed run console showing steps, tool calls, model calls, artifacts, approvals, and linked entities.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { loadAgentArtifacts } from '$lib/server/agents/artifacts';

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;

  const run = await prisma.agentRun.findFirst({
    where: { id: params.id, userId },
    select: {
      id: true,
      status: true,
      triggerType: true,
      triggerEntityType: true,
      triggerEntityId: true,
      inputJson: true,
      resultJson: true,
      errorMessage: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      agentDefinition: { select: { id: true, key: true, name: true, description: true, category: true, defaultModelProvider: true, defaultModelName: true } },
      promptVersion: { select: { id: true, version: true, createdAt: true } },
      steps: {
        select: { id: true, stepKey: true, stepName: true, status: true, inputJson: true, outputJson: true, errorMessage: true, startedAt: true, completedAt: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      },
      toolCalls: {
        select: { id: true, toolKey: true, status: true, inputJson: true, outputJson: true, errorMessage: true, createdEntityType: true, createdEntityId: true, startedAt: true, completedAt: true, createdAt: true, agentStepId: true },
        orderBy: { createdAt: 'asc' }
      },
      modelInvocations: {
        select: { id: true, provider: true, model: true, purpose: true, status: true, inputTokens: true, outputTokens: true, requestJsonRedacted: true, responseJsonRedacted: true, structuredOutputJson: true, errorMessage: true, createdAt: true, agentStepId: true },
        orderBy: { createdAt: 'asc' }
      },
      approvals: {
        select: { id: true, actionType: true, status: true, entityType: true, entityId: true, proposedActionJson: true, reviewerNote: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'asc' }
      },
      entities: {
        select: { id: true, entityType: true, entityId: true, role: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!run) throw redirect(303, '/agents/runs');

  const artifacts = await loadAgentArtifacts({ userId, agentRunId: run.id, take: 20 });

  return { run, artifacts };
};

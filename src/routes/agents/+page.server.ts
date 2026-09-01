// src/routes/agents/+page.server.ts
// PURPOSE: Stage 1 agent dashboard.

import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { ensureCoreAgentSetup } from '$lib/server/agents/agentSetup';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;
  const contextSpaceId = locals.contextSpaceId || userId;

  await ensureCoreAgentSetup(userId);

  const agents = await prisma.agentDefinition.findMany({
    where: { userId },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      category: true,
      status: true,
      personaKey: true,
      purposeKey: true,
      deploymentScope: true,
      authorityLevel: true,
      defaultModelProvider: true,
      defaultModelName: true,
      updatedAt: true,
      _count: { select: { runs: { where: { contextSpaceId } } } },
      runs: {
        where: { contextSpaceId },
        select: { id: true, status: true, createdAt: true, completedAt: true, triggerEntityType: true, triggerEntityId: true },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }]
  });

  const recentRuns = await prisma.agentRun.findMany({
    where: { userId },
    select: {
      id: true,
      status: true,
      triggerType: true,
      triggerEntityType: true,
      triggerEntityId: true,
      createdAt: true,
      completedAt: true,
      errorMessage: true,
      agentDefinition: { select: { name: true, key: true } },
      _count: { select: { artifacts: true, steps: true, toolCalls: true, modelInvocations: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  return { agents, recentRuns };
};

export const actions: Actions = {
  ensureDefaults: async ({ locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    await ensureCoreAgentSetup(locals.user.id);
    throw redirect(303, '/agents');
  }
};

// src/routes/agents/runs/+page.server.ts
// PURPOSE: List agent runs for auditing.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { ensureCoreAgentSetup } from '$lib/server/agents/agentSetup';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const userId = locals.user.id;
  await ensureCoreAgentSetup(userId);

  const status = url.searchParams.get('status') || '';
  const where: any = { userId };
  if (status) where.status = status;

  const runs = await prisma.agentRun.findMany({
    where,
    select: {
      id: true,
      status: true,
      triggerType: true,
      triggerEntityType: true,
      triggerEntityId: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      errorMessage: true,
      agentDefinition: { select: { name: true, key: true, category: true } },
      _count: { select: { steps: true, toolCalls: true, modelInvocations: true, artifacts: true, approvals: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  return { runs, status };
};

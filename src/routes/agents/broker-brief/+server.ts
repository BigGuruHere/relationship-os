// src/routes/agents/broker-brief/+server.ts
// PURPOSE: Start Broker Brief Agent from any entity page and redirect to the run log.

import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runBrokerBriefAgent } from '$lib/server/agents/agents/brokerBriefAgent';
import type { AgentEntityType } from '$lib/server/agents/types';

const ENTITY_TYPES = new Set(['contact', 'company', 'deal', 'project']);

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const form = await request.formData();
  const entityType = String(form.get('entityType') || '').trim() as AgentEntityType;
  const entityId = String(form.get('entityId') || '').trim();
  const briefingPurpose = String(form.get('briefingPurpose') || '').trim();

  if (!ENTITY_TYPES.has(entityType) || !entityId) {
    throw error(400, 'Missing or invalid entity details for broker briefing.');
  }

  const run = await runBrokerBriefAgent({
    userId: locals.user.id,
    entityType,
    entityId,
    briefingPurpose: briefingPurpose || undefined
  });

  throw redirect(303, `/agents/runs/${run.id}`);
};

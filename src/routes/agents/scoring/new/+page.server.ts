// src/routes/agents/scoring/new/+page.server.ts
// PURPOSE: Manual entry point for Stage 4 Opportunity Scoring Agent.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { runOpportunityScoringAgent } from '$lib/server/agents/agents/opportunityScoringAgent';
import type { AgentEntityType } from '$lib/server/agents/types';

const ENTITY_TYPES = new Set(['', 'contact', 'company', 'deal', 'project', 'research_candidate']);

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  return {};
};

export const actions: Actions = {
  run: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const form = await request.formData();

    const entityType = String(form.get('entityType') || '').trim() as AgentEntityType | 'research_candidate' | '';
    const entityId = String(form.get('entityId') || '').trim();
    const targetName = String(form.get('targetName') || '').trim();
    const sector = String(form.get('sector') || '').trim();
    const scoringGoal = String(form.get('scoringGoal') || '').trim();
    const buyerMandate = String(form.get('buyerMandate') || '').trim();
    const targetContext = String(form.get('targetContext') || '').trim();

    if (!ENTITY_TYPES.has(entityType)) return fail(400, { error: 'Unsupported entity type.' });
    if (entityType && !entityId) return fail(400, { error: 'Entity ID is required when an entity type is selected.' });
    if (!entityType && !targetName && !targetContext) return fail(400, { error: 'Add an entity, target name, or target context to score.' });

    const run = await runOpportunityScoringAgent({
      userId: locals.user.id,
      entityType: entityType || undefined,
      entityId: entityId || undefined,
      targetName,
      sector,
      scoringGoal,
      buyerMandate,
      targetContext
    });

    throw redirect(303, `/agents/runs/${run.id}`);
  }
};

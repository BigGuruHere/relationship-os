// src/routes/agents/enrichment/new/+page.server.ts
// PURPOSE: Manual entry point for Stage 5 Contact Enrichment Agent.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { runContactEnrichmentAgent } from '$lib/server/agents/agents/contactEnrichmentAgent';
import type { AgentEntityType } from '$lib/server/agents/types';

const ENTITY_TYPES = new Set(['', 'contact', 'company', 'research_candidate']);

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
    const companyName = String(form.get('companyName') || '').trim();
    const sourceText = String(form.get('sourceText') || '').trim();
    const enrichmentGoal = String(form.get('enrichmentGoal') || '').trim();
    const enableWebResearch = form.get('enableWebResearch') === 'on';
    const researchProvider = String(form.get('researchProvider') || 'auto').trim();

    if (!ENTITY_TYPES.has(entityType)) return fail(400, { error: 'Unsupported entity type.' });
    if (entityType && !entityId) return fail(400, { error: 'Entity ID is required when an entity type is selected.' });
    if (!entityType && !targetName && !companyName && !sourceText) return fail(400, { error: 'Add an entity, target name, company name, or source text.' });

    const run = await runContactEnrichmentAgent({
      userId: locals.user.id,
      entityType: entityType || undefined,
      entityId: entityId || undefined,
      targetName,
      companyName,
      sourceText,
      enrichmentGoal,
      enableWebResearch,
      researchProvider
    });

    throw redirect(303, `/agents/runs/${run.id}`);
  }
};

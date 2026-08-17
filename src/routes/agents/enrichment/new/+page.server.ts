// src/routes/agents/enrichment/new/+page.server.ts
// PURPOSE: Manual entry point for Stage 5 Contact Enrichment Agent.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { runContactEnrichmentAgent } from '$lib/server/agents/agents/contactEnrichmentAgent';
import type { AgentEntityType } from '$lib/server/agents/types';

const ENTITY_TYPES = new Set(['', 'contact', 'company', 'research_candidate']);
const ENRICHMENT_MODES = new Set(['contact', 'company', 'find_contacts']);

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const rawEntityType = String(url.searchParams.get('entityType') || '').trim();
  const rawMode = String(url.searchParams.get('mode') || '').trim();
  const enableWebResearchParam = url.searchParams.get('enableWebResearch');

  const entityType = ENTITY_TYPES.has(rawEntityType) ? rawEntityType : '';
  const mode = ENRICHMENT_MODES.has(rawMode)
    ? rawMode
    : entityType === 'company'
      ? 'company'
      : 'contact';

  return {
    defaults: {
      mode,
      entityType,
      entityId: String(url.searchParams.get('entityId') || '').trim(),
      targetName: String(url.searchParams.get('targetName') || '').trim(),
      companyName: String(url.searchParams.get('companyName') || '').trim(),
      sourceText: String(url.searchParams.get('sourceText') || '').trim(),
      enrichmentGoal: String(url.searchParams.get('enrichmentGoal') || '').trim(),
      researchProvider: String(url.searchParams.get('researchProvider') || 'auto').trim(),
      // IT: Entity option screens default to web research on, but callers can pass enableWebResearch=false.
      enableWebResearch: enableWebResearchParam === null ? true : enableWebResearchParam !== 'false'
    }
  };
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
    const mode = String(form.get('mode') || (entityType === 'company' ? 'company' : 'contact')).trim();
    const enableWebResearch = form.get('enableWebResearch') === 'on';
    const researchProvider = String(form.get('researchProvider') || 'auto').trim();

    if (!ENTITY_TYPES.has(entityType)) return fail(400, { error: 'Unsupported entity type.' });
    if (!ENRICHMENT_MODES.has(mode)) return fail(400, { error: 'Unsupported enrichment mode.' });
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
      researchProvider,
      mode: mode as any
    });

    throw redirect(303, `/agents/runs/${run.id}`);
  }
};

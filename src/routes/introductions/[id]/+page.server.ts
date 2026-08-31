// src/routes/introductions/[id]/+page.server.ts
// PURPOSE: Review one real Introduction and append Outcome evidence over time.
// SECURITY: Every operation is tenant scoped by locals.user.id.

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { loadIntroduction, createOutcomeFromForm, updateIntroductionStatusFromForm } from '$lib/server/introductions';
import { INTRODUCTION_STATUSES, OUTCOME_COMMERCIALITY, OUTCOME_STATUSES, YES_NO_UNKNOWN } from '$lib/introductions';
import { KNOWLEDGE_AUTHORITIES, KNOWLEDGE_SOURCE_TYPES } from '$lib/provenance';

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const introduction = await loadIntroduction(locals.user.id, params.id);
  if (!introduction) throw redirect(303, '/introductions');

  return {
    introduction,
    introductionStatuses: INTRODUCTION_STATUSES,
    outcomeStatuses: OUTCOME_STATUSES,
    outcomeCommerciality: OUTCOME_COMMERCIALITY,
    yesNoUnknown: YES_NO_UNKNOWN,
    knowledgeAuthorities: KNOWLEDGE_AUTHORITIES,
    knowledgeSourceTypes: KNOWLEDGE_SOURCE_TYPES
  };
};

export const actions: Actions = {
  updateStatus: async ({ params, locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      await updateIntroductionStatusFromForm(locals.user.id, params.id, await request.formData());
    } catch (err: any) {
      return fail(400, { error: err?.message || 'Could not update introduction.' });
    }
    throw redirect(303, `/introductions/${params.id}`);
  },

  addOutcome: async ({ params, locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    try {
      await createOutcomeFromForm(locals.user.id, params.id, await request.formData());
    } catch (err: any) {
      return fail(400, { error: err?.message || 'Could not record outcome.' });
    }
    throw redirect(303, `/introductions/${params.id}`);
  }
};

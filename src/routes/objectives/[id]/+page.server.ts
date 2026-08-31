// src/routes/objectives/[id]/+page.server.ts
// PURPOSE: Minimal Stage 8.4 Objective detail/edit surface.
// SECURITY: All reads/writes use the workspace-scoped Core access context.

import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createWorkspaceCoreAccess } from '$lib/server/core/accessPolicy';
import { loadObjective, updateObjectiveFromForm } from '$lib/server/core/knowledge';

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:objective-detail');
  const objective = await loadObjective(context, params.id);
  if (!objective) throw error(404, 'Objective not found');
  return { objective };
};

export const actions: Actions = {
  save: async ({ locals, params, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const context = createWorkspaceCoreAccess(locals.user.id, 'workspace:objective-edit');
    try {
      await updateObjectiveFromForm(context, params.id, await request.formData());
    } catch (err: any) {
      return fail(400, { error: err?.message || 'Failed to save objective.' });
    }
    throw redirect(303, `/objectives/${params.id}`);
  }
};

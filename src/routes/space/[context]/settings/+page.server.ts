// Stage 8.17 - Settings are scoped to this specific context, not a global profile.
import type { PageServerLoad } from './$types';
import { requireRelishWorkspace } from '$lib/server/core/relishWorkspace';
import { loadContextProfile } from '$lib/server/core/relishWorkspaceData';
export const load: PageServerLoad = async ({ locals, params }) => {
  const space = await requireRelishWorkspace(locals, params.context);
  return { profile: space.configured ? await loadContextProfile(locals.user!.id, space.name) : null };
};

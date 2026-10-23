// Stage 8.17 - Only established Friendship connections and explicitly shared pilot requests.
import type { PageServerLoad } from './$types';
import { requireRelishWorkspace } from '$lib/server/core/relishWorkspace';
import { loadContextPeople } from '$lib/server/core/relishWorkspaceData';
export const load: PageServerLoad = async ({ locals, params }) => {
  const space = await requireRelishWorkspace(locals, params.context);
  return { people: space.configured ? await loadContextPeople(locals.user!.id, space.name) : [] };
};

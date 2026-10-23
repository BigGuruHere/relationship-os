// Stage 8.17 - The URL, not the user's input or a query parameter, selects custody.
import type { LayoutServerLoad } from './$types';
import { requireRelishWorkspace } from '$lib/server/core/relishWorkspace';
export const load: LayoutServerLoad = async ({ locals, params }) => ({
  workspace: await requireRelishWorkspace(locals, params.context)
});

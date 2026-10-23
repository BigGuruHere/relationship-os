// Stage 8.17 - Landing page enters the participant's Relish context, not legacy broker CRM.
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { visibleRelishWorkspaces } from '$lib/server/core/relishWorkspace';
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const spaces = await visibleRelishWorkspaces(locals.user.id, locals.user.role || 'member');
  if (!spaces.length) throw error(403, 'No Relish context is available for this account.');
  throw redirect(303, '/space/' + spaces[0].name);
};

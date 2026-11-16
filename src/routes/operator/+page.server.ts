// Stage 8.17 - Operator surfaces are accessible through one restricted index.
import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { foundationDorianAvailable } from '$lib/server/foundation/dorianCallConfig';
import { hasCapability } from '$lib/server/core/capabilities';
export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (!hasCapability(locals.capabilities, 'OPERATOR')) throw error(403, 'Operator access required.');
  return { dorianReview: locals.user.role === 'owner' && foundationDorianAvailable(locals, url) };
};

// IT: The authenticated Relish landing page is owner-level, not tied to one ContextSpace.
// SECURITY: Authentication is still required; context-specific data remains in scoped routes.
import { redirect } from '@sveltejs/kit';
import { foundationDorianAvailable } from '$lib/server/foundation/dorianCallConfig';
import { accountDomain } from '$lib/server/foundation/provisioning';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  return { dorianAvailable: foundationDorianAvailable(locals, url) &&
    await accountDomain(locals.user.id) === 'ACTIVE' };
};

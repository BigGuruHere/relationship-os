// PURPOSE: Stage 8.9 boundary landing page for the isolated Dating application domain.
// SECURITY: No Business fallback is allowed. Missing Dating custody is shown as setup-required.

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/auth/login');
	return {
		configured: locals.contextDomainKey === 'dating' && Boolean(locals.contextSpaceId),
		contextSpaceId: locals.contextSpaceId ?? null
	};
};

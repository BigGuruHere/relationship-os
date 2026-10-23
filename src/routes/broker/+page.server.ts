// Stage 8.17 - Broker navigation is separate from the consumer-facing Business context.
import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { hasCapability } from '$lib/server/core/capabilities';
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (!hasCapability(locals.capabilities, 'BROKER')) throw error(403, 'Broker access required.');
  return {};
};

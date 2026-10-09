// PURPOSE: General relationship workspace for broad Dorian conversations and Living Understanding.
// SECURITY: Every read is scoped to the authenticated owner's active General ContextSpace.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listContextPeople } from '$lib/server/core/participantDirectory';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'general' || !locals.contextSpaceId) {
    return { configured: false, people: [] };
  }
  return {
    configured: true,
    people: await listContextPeople({ userId: locals.user.id, contextSpaceId: locals.contextSpaceId }, 'general')
  };
};

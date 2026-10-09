// PURPOSE: General participant view centred on imported conversations and Living Understanding.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadConversationParticipant } from '$lib/server/core/participantDirectory';

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'general' || !locals.contextSpaceId) throw redirect(303, '/settings/context-spaces');
  try {
    return await loadConversationParticipant({ userId: locals.user.id, contextSpaceId: locals.contextSpaceId, contactId: params.id }, 'general');
  } catch (error: any) {
    if (error?.message === 'Person is not accessible in this ContextSpace.') throw redirect(303, '/general/people');
    throw error;
  }
};

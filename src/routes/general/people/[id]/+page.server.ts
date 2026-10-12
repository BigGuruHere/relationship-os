// PURPOSE: General participant view centred on imported conversations and Living Understanding.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadConversationParticipant, updateContextPersonPhone } from '$lib/server/core/participantDirectory';
import { describeLivingUnderstandingReviewHandoff } from '$lib/server/core/livingUnderstandingReviewHandoff';

function requireGeneral(locals: App.Locals) {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'general' || !locals.contextSpaceId) throw redirect(303, '/settings/context-spaces');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId };
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const scope = requireGeneral(locals);
  try {
    const participant = await loadConversationParticipant({ ...scope, contactId: params.id }, 'general');
    const sourceReviewStates = await Promise.all(participant.sources.map(async source => ({
      sourceId: source.id,
      ...(await describeLivingUnderstandingReviewHandoff({ ...scope, contactId: params.id }, 'general', source.id))
    })));
    const reviewBySourceId = Object.fromEntries(sourceReviewStates.map(item => [item.sourceId, item]));
    return { ...participant, reviewBySourceId };
  } catch (error: any) {
    if (error?.message === 'Person is not accessible in this ContextSpace.') throw redirect(303, '/general/people');
    throw error;
  }
};

export const actions: Actions = {
  updatePhone: async ({ locals, params, request }) => {
    const scope = requireGeneral(locals);
    const form = await request.formData();
    const phone = String(form.get('phone') || '');
    try {
      await updateContextPersonPhone({ ...scope, contactId: params.id }, 'general', phone);
      return { phoneSaved: true };
    } catch (error: any) {
      return fail(400, { phoneError: error?.message || 'Could not update phone.', phoneValue: phone });
    }
  }
};

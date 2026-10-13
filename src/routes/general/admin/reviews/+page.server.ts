// PURPOSE: Human supervision inbox for conversation evidence awaiting Living Understanding review.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listLivingUnderstandingReviewInbox } from '$lib/server/core/livingUnderstandingReviewInbox';
import { dismissLivingUnderstandingReview, restoreLivingUnderstandingReview } from '$lib/server/core/livingUnderstandingReviewDisposition';

function requireGeneral(locals: App.Locals) {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'general' || !locals.contextSpaceId) throw redirect(303, '/settings/context-spaces');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId };
}

export const load: PageServerLoad = async ({ locals }) => {
  const scope = requireGeneral(locals);
  const items = await listLivingUnderstandingReviewInbox(scope, 'general');
  return {
    pending: items.filter(item => item.state !== 'DISMISSED'),
    dismissed: items.filter(item => item.state === 'DISMISSED')
  };
};

export const actions: Actions = {
  dismiss: async ({ locals, request }) => {
    const scope = requireGeneral(locals);
    const form = await request.formData();
    const sourceInteractionId = String(form.get('sourceInteractionId') || '').trim();
    const contactId = String(form.get('contactId') || '').trim();
    if (!sourceInteractionId || !contactId) return fail(400, { reviewError: 'Missing review source.' });
    try { await dismissLivingUnderstandingReview({ ...scope, contactId }, sourceInteractionId); }
    catch (error: any) { return fail(400, { reviewError: error?.message || 'Could not dismiss this review.' }); }
    throw redirect(303, '/general/admin/reviews');
  },
  restore: async ({ locals, request }) => {
    const scope = requireGeneral(locals);
    const form = await request.formData();
    const sourceInteractionId = String(form.get('sourceInteractionId') || '').trim();
    const contactId = String(form.get('contactId') || '').trim();
    if (!sourceInteractionId || !contactId) return fail(400, { reviewError: 'Missing review source.' });
    try { await restoreLivingUnderstandingReview({ ...scope, contactId }, sourceInteractionId); }
    catch (error: any) { return fail(400, { reviewError: error?.message || 'Could not restore this review.' }); }
    throw redirect(303, '/general/admin/reviews');
  }
};

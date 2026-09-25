// PURPOSE: Stage 8.12.0 - participant-specific Living Understanding pilot.
// SECURITY: Require the request's Dating ContextSpace and scope every operation by owner + context + contact.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { listDatingUnderstanding, createDatingUnderstanding, reviewDatingUnderstanding } from '$lib/server/datingLivingUnderstanding';

function requireDating(locals: App.Locals, contactId: string) {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) throw redirect(303, '/settings/context-spaces');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId, contactId };
}
export const load: PageServerLoad = async ({ locals, params }) => {
  const scope = requireDating(locals, params.id);
  const contact = await prisma.contact.findFirst({ where: { id: scope.contactId, userId: scope.userId, contextSpaceId: scope.contextSpaceId }, select: { id: true, fullNameEnc: true } });
  if (!contact) throw redirect(303, '/dating/people');
  return { personId: scope.contactId, name: await contactDisplayName(contact), entries: await listDatingUnderstanding(scope) };
};
export const actions: Actions = {
  propose: async ({ locals, params, request }) => {
    const scope = requireDating(locals, params.id);
    const form = await request.formData();
    try { await createDatingUnderstanding(scope, { statement: String(form.get('statement') || ''), note: String(form.get('note') || ''), decision: String(form.get('decision') || 'PENDING') }); }
    catch (e: any) { return fail(400, { error: e?.message || 'Could not save proposed understanding.' }); }
    throw redirect(303, `/dating/people/${params.id}/understanding`);
  },
  review: async ({ locals, params, request }) => {
    const scope = requireDating(locals, params.id);
    const form = await request.formData();
    try { await reviewDatingUnderstanding(scope, {
      proposalId: String(form.get('proposalId') || ''), statement: String(form.get('statement') || ''),
      decision: String(form.get('decision') || ''), note: String(form.get('note') || '')
    }); }
    catch (e: any) { return fail(400, { error: e?.message || 'Could not review this understanding.' }); }
    throw redirect(303, `/dating/people/${params.id}/understanding`);
  }
};

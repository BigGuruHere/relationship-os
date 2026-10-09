// PURPOSE: Manage minimal participant identities inside the General ContextSpace.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createContextPerson, listContextPeople } from '$lib/server/core/participantDirectory';

function requireGeneral(locals: App.Locals) {
  if (!locals.user) throw redirect(303, '/auth/login');
  if (locals.contextDomainKey !== 'general' || !locals.contextSpaceId) throw redirect(303, '/settings/context-spaces');
  return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId };
}
export const load: PageServerLoad = async ({ locals }) => {
  const scope = requireGeneral(locals);
  return { people: await listContextPeople(scope, 'general') };
};
export const actions: Actions = {
  create: async ({ locals, request }) => {
    const scope = requireGeneral(locals);
    const form = await request.formData();
    const name = String(form.get('name') || '');
    try { await createContextPerson(scope, 'general', name); }
    catch (error: any) { return fail(400, { error: error?.message || 'Could not create person.', values: { name } }); }
    throw redirect(303, '/general/people');
  }
};

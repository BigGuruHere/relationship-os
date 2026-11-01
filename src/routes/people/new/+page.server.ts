import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { createCoreContact, validateContactDetails } from '$lib/server/core/contacts';
import { ensurePrivatePeopleSpace, runWithWorkspaceCustody } from '$lib/server/core/myPeople';
import { createWorkspaceCoreAccess } from '$lib/server/core/accessPolicy';
export const load: PageServerLoad = ({ locals }) => { if (!locals.user) throw redirect(303, '/auth/login'); return {}; };
export const actions: Actions = {
  default: async ({ locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');
    const fd = await request.formData();
    const values = { name: String(fd.get('name') || ''), email: String(fd.get('email') || ''), phone: String(fd.get('phone') || '') };
    let input;
    try { input = validateContactDetails(values); } catch (e) { return fail(400, { error: (e as Error).message, values }); }
    const space = await ensurePrivatePeopleSpace(locals.user.id);
    const context = createWorkspaceCoreAccess(locals.user.id, 'people:create', space.id);
    const person = await runWithWorkspaceCustody({ userId: locals.user.id, contextSpaceId: space.id }, () => createCoreContact(context, input));
    throw redirect(303, '/people/' + person.id);
  }
};

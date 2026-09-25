// PURPOSE: Manage minimal person identities required by the controlled Stage 8.10 Dating pilot.
// SECURITY: This route fails closed unless the request has an owned Dating ContextSpace.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createDatingPerson, listDatingPeople } from '$lib/server/datingPilotDirectory';

function requireDating(locals: App.Locals) {
	if (!locals.user) throw redirect(303, '/auth/login');
	if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) {
		throw redirect(303, '/settings/context-spaces');
	}
	return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId };
}

export const load: PageServerLoad = async ({ locals }) => {
	const context = requireDating(locals);
	return { people: await listDatingPeople(context.userId, context.contextSpaceId) };
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const context = requireDating(locals);
		const form = await request.formData();
		try {
			await createDatingPerson({
				...context,
				name: String(form.get('name') || '')
			});
		} catch (error: any) {
			return fail(400, {
				error: error?.message || 'Could not create Dating person.',
				values: { name: String(form.get('name') || '') }
			});
		}
		throw redirect(303, '/dating/people');
	}
};

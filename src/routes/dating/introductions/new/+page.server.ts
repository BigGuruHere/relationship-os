// PURPOSE: Create a dyadic Introduction for the controlled Stage 8.10 Dating pilot.
// SECURITY: Participant Contacts are resolved only inside the active Dating ContextSpace.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listDatingPeople } from '$lib/server/datingPilotDirectory';
import { createIntroductionFromForm } from '$lib/server/introductions';

function requireDating(locals: App.Locals) {
	if (!locals.user) throw redirect(303, '/auth/login');
	if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) {
		throw redirect(303, '/settings/context-spaces');
	}
	return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId };
}

export const load: PageServerLoad = async ({ locals }) => {
	const context = requireDating(locals);
	return { people: await listDatingPeople(context.userId) };
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const context = requireDating(locals);
		const source = await request.formData();
		const partyAContactId = String(source.get('partyAContactId') || '').trim();
		const partyBContactId = String(source.get('partyBContactId') || '').trim();
		if (!partyAContactId || !partyBContactId || partyAContactId === partyBContactId) {
			return fail(400, { error: 'Select two different Dating people.' });
		}

		const form = new FormData();
		form.set('partyAContactId', partyAContactId);
		form.set('partyBContactId', partyBContactId);
		form.set('reason', String(source.get('reason') || 'Dating pilot reflection').trim());
		form.set('status', 'CONNECTED');
		form.set('authority', 'WORKSPACE_RECORDED');
		form.set('sourceType', 'MANUAL');
		const occurredAt = String(source.get('occurredAt') || '').trim();
		if (occurredAt) form.set('occurredAt', occurredAt);

		try {
			const introduction = await createIntroductionFromForm(context.userId, form);
			throw redirect(303, `/dating/introductions/${introduction.id}`);
		} catch (error: any) {
			if (error?.status) throw error;
			return fail(400, { error: error?.message || 'Could not create Dating Introduction.' });
		}
	}
};

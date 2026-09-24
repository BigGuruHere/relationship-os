// PURPOSE: Capture one respondent's private voice reflection and create a provisional extraction.
// SECURITY: Consent confirmation and respondent selection are mandatory before encrypted storage or model processing.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadIntroduction } from '$lib/server/introductions';
import { runDatingOutcomeExtraction } from '$lib/server/datingOutcomePilot';

function requireDating(locals: App.Locals) {
	if (!locals.user) throw redirect(303, '/auth/login');
	if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) {
		throw redirect(303, '/settings/context-spaces');
	}
	return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId };
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const context = requireDating(locals);
	const introduction = await loadIntroduction(context.userId, params.id);
	if (!introduction) throw redirect(303, '/dating');
	return { introduction };
};

export const actions: Actions = {
	create: async ({ locals, params, request }) => {
		const context = requireDating(locals);
		const form = await request.formData();
		const consentConfirmed = String(form.get('consentConfirmed') || '') === 'true';
		if (!consentConfirmed) {
			return fail(400, {
				error: 'Confirm permission and informed consent before processing this reflection.'
			});
		}
		try {
			const result = await runDatingOutcomeExtraction({
				...context,
				introductionId: params.id,
				respondentParticipantId: String(form.get('respondentParticipantId') || ''),
				transcript: String(form.get('transcript') || ''),
				privateLearningAllowed: String(form.get('privateLearningAllowed') || '') === 'true',
				futureMatchingAllowed: String(form.get('futureMatchingAllowed') || '') === 'true',
				shareWithOtherAllowed: String(form.get('shareWithOtherAllowed') || '') === 'true'
			});
			throw redirect(303, `/dating/feedback/${result.approvalId}`);
		} catch (error: any) {
			if (error?.status) throw error;
			return fail(400, { error: error?.message || 'Could not process this private reflection.' });
		}
	}
};

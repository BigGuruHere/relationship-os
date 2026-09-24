// PURPOSE: Mandatory human review gate for one private Dating Outcome proposal.
// SECURITY: Approval or rejection is restricted to the owning user inside the source Dating ContextSpace.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	approveDatingOutcomeReview,
	loadDatingOutcomeReview,
	rejectDatingOutcomeReview
} from '$lib/server/datingOutcomePilot';
import { OUTCOME_STATUSES, YES_NO_UNKNOWN } from '$lib/introductions';
import { DATING_NEXT_STEP_OPTIONS } from '$lib/datingNextStep';

function requireDating(locals: App.Locals) {
	if (!locals.user) throw redirect(303, '/auth/login');
	if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) {
		throw redirect(303, '/settings/context-spaces');
	}
	return { userId: locals.user.id, contextSpaceId: locals.contextSpaceId };
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const context = requireDating(locals);
	const review = await loadDatingOutcomeReview({ ...context, approvalId: params.id });
	if (!review) throw redirect(303, '/dating');
	return {
		review,
		outcomeStatuses: OUTCOME_STATUSES,
		yesNoUnknown: YES_NO_UNKNOWN,
		nextStepOptions: DATING_NEXT_STEP_OPTIONS,
		desireOptions: [
			{ value: 'YES', label: 'Yes' },
			{ value: 'NO', label: 'No' },
			{ value: 'UNSURE', label: 'Unsure' },
			{ value: 'NOT_STATED', label: 'Not stated' }
		]
	};
};

export const actions: Actions = {
	approve: async ({ locals, params, request }) => {
		const context = requireDating(locals);
		try {
			const result = await approveDatingOutcomeReview({
				...context,
				approvalId: params.id,
				form: await request.formData()
			});
			throw redirect(303, `/dating/introductions/${result.introductionId}`);
		} catch (error: any) {
			if (error?.status) throw error;
			return fail(400, { error: error?.message || 'Could not approve this Outcome.' });
		}
	},

	reject: async ({ locals, params, request }) => {
		const context = requireDating(locals);
		const form = await request.formData();
		try {
			await rejectDatingOutcomeReview({
				userId: context.userId,
				approvalId: params.id,
				reviewerNote: String(form.get('reviewerNote') || '')
			});
		} catch (error: any) {
			return fail(400, { error: error?.message || 'Could not reject this proposal.' });
		}
		throw redirect(303, '/dating');
	}
};

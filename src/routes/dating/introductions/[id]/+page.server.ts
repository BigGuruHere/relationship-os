// PURPOSE: Review one Dating Introduction and its approved whole-Introduction Outcomes.
// SECURITY: The active Dating ContextSpace scopes the Introduction and all related records.

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { loadIntroduction } from '$lib/server/introductions';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/auth/login');
	if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) {
		throw redirect(303, '/settings/context-spaces');
	}
	const introduction = await loadIntroduction(locals.user.id, params.id);
	if (!introduction) throw redirect(303, '/dating');

	const reviews = await prisma.approvalRequest.findMany({
		where: {
			userId: locals.user.id,
			actionType: 'dating_outcome_review',
			run: { triggerEntityType: 'Introduction', triggerEntityId: params.id }
		},
		select: { id: true, status: true, createdAt: true, approvedAt: true, rejectedAt: true },
		orderBy: { createdAt: 'desc' }
	});
	return { introduction, reviews };
};

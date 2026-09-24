// PURPOSE: Stage 8.10 Dating pilot dashboard inside the isolated Dating ContextSpace.
// SECURITY: No Business fallback is allowed and all counts are resolved inside active Dating custody.

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { listDatingPeople, datingPartyLabel } from '$lib/server/datingPilotDirectory';
import { loadIntroductions } from '$lib/server/introductions';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/auth/login');
	if (locals.contextDomainKey !== 'dating' || !locals.contextSpaceId) {
		return { configured: false, people: [], introductions: [], pendingReviews: [] };
	}

	const [people, introductions, pendingReviews] = await Promise.all([
		listDatingPeople(locals.user.id),
		loadIntroductions(locals.user.id, 100),
		prisma.approvalRequest.findMany({
			where: {
				userId: locals.user.id,
				actionType: 'dating_outcome_review',
				status: 'pending'
			},
			select: { id: true, createdAt: true },
			orderBy: { createdAt: 'desc' },
			take: 50
		})
	]);

	return {
		configured: true,
		people,
		introductions: introductions.map((introduction: any) => ({
			id: introduction.id,
			occurredAt: introduction.occurredAt,
			statusLabel: introduction.statusLabel,
			partyA: datingPartyLabel(introduction.partyA),
			partyB: datingPartyLabel(introduction.partyB),
			outcomeCount: introduction.outcomes.length
		})),
		pendingReviews
	};
};

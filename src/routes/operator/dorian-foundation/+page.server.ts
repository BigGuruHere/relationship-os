import { error } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { foundationDorianAvailable } from '$lib/server/foundation/dorianCallConfig';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
	if (!foundationDorianAvailable(locals, url) || locals.user?.role !== 'owner')
		throw error(404, 'Review unavailable.');
	setHeaders({ 'cache-control': 'private, no-store' });
	const calls = await prisma.dorianFoundationCall.findMany({
		orderBy: { createdAt: 'desc' }, take: 50,
		select: { id: true, createdAt: true, state: true, sourceId: true, phoneChannelId: true }
	});
	return { calls: calls.map(({ id, createdAt, state, sourceId, phoneChannelId }) =>
		({ id, at: createdAt.toISOString(), state, channel: phoneChannelId ? 'Telephone' : 'App', canReview: Boolean(sourceId) })) };
};

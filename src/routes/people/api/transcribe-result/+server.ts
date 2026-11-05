import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requirePeopleAccess } from '$lib/server/core/myPeople';
import { peopleRouteDomain, foundationPage } from '$lib/server/foundation/peopleRouting';
import { resolveDraftProcessing } from '$lib/server/foundation/drafts';
import { GET as poll } from '../../../api/transcribe-result/+server';
import { _getJob } from '../../../api/upload-chunk/+server';
export const GET: RequestHandler = async (event) => {
	if (
		event.locals.user &&
		(await peopleRouteDomain(event.locals.user.id, '/people/api/transcribe-result')) ===
			'FOUNDATION'
	) {
		const scope = await foundationPage(() => resolveDraftProcessing(event.locals));
		await scope.authorize();
		// Retain a completed result until its TTL so a lost polling response can be retried safely.
		const job = _getJob(
			event.url.searchParams.get('jobId') || '',
			event.locals.user.id,
			scope.key,
			true
		);
		const headers = { 'cache-control': 'private, no-store' };
		if (!job)
			return json(
				{ error: 'Transcription unavailable. Please record again.' },
				{ status: 404, headers }
			);
		if (job.status === 'error')
			return json(
				{ status: 'error', message: 'Transcription failed. Please record again.' },
				{ status: 503, headers }
			);
		return json(
			{ status: job.status, ...(job.status === 'done' ? { transcript: job.transcript } : {}) },
			{ headers }
		);
	}
	await requirePeopleAccess(event.locals);
	return poll(event);
};

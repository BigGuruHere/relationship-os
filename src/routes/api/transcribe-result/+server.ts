import { transcriptionCorrelationId, transcriptionEvent } from '$lib/server/transcriptionDiagnostics';
// PURPOSE: Poll the upload job and return transcription once ready.
// SECURITY: Requires login. Does not expose any internal state on errors.
// NOTES: Imports _getJob from upload-chunk - underscore export is allowed by SvelteKit.

import type { RequestHandler } from '@sveltejs/kit';
import { json, redirect } from '@sveltejs/kit';
// IMPORTANT - use the underscored export
import { _getJob as getJob } from '../upload-chunk/+server';

export const GET: RequestHandler = async ({ locals, url }) => {
	// require login
	if (!locals.user) throw redirect(303, '/auth/login');
	if (!locals.contextSpaceId) return new Response('context required', { status: 400 });

	const jobId = url.searchParams.get('jobId') ?? '';
	if (!jobId) {
		return new Response('jobId required', { status: 400 });
	}

	// read job state from in-memory map in upload-chunk
	const job = getJob(jobId, locals.user.id, locals.contextSpaceId);
	if (!job) {
		// job not found - likely expired or never created
		transcriptionEvent('poll.missing', transcriptionCorrelationId(url.searchParams.get('correlationId')), { httpStatus: 404 }, true);
		return new Response('job not found', { status: 404 });
	}

	// pending - let client keep polling
	if (job.status === 'queued' || job.status === 'processing') {
		return json({ status: job.status });
	}

	// failed - return message
	if (job.status === 'error') {
		transcriptionEvent('poll.result', job.correlationId, { httpStatus: 500, errorCategory: 'processing' }, true);
		return json({ status: 'error', message: job.error ?? 'transcription failed', correlationId: job.correlationId }, { status: 500 });
	}

	// done - return transcript payload
	// shape: { status: 'done', transcript: string, meta?: any }
	transcriptionEvent('poll.result', job.correlationId, { httpStatus: 200, characterCount: job.transcript?.length ?? 0, emptyContent: !job.transcript?.length });
	return json({ status: 'done', transcript: job.transcript ?? '', correlationId: job.correlationId });
};

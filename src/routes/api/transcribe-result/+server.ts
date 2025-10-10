// PURPOSE: Poll the upload job and return transcription once ready.
// SECURITY: Requires login. Does not expose any internal state on errors.
// NOTES: Imports _getJob from upload-chunk - underscore export is allowed by SvelteKit.

import type { RequestHandler } from './$types';
import { json, redirect } from '@sveltejs/kit';
// IMPORTANT - use the underscored export
import { _getJob as getJob } from '../upload-chunk/+server';

export const GET: RequestHandler = async ({ locals, url }) => {
  // require login
  if (!locals.user) throw redirect(303, '/auth/login');

  const jobId = url.searchParams.get('jobId') ?? '';
  if (!jobId) {
    return new Response('jobId required', { status: 400 });
  }

  // read job state from in-memory map in upload-chunk
  const job = getJob(jobId);
  if (!job) {
    // job not found - likely expired or never created
    return new Response('job not found', { status: 404 });
  }

  // pending - let client keep polling
  if (job.status === 'pending' || job.status === 'processing') {
    return json({ status: job.status });
  }

  // failed - return message
  if (job.status === 'error') {
    return json({ status: 'error', message: job.message ?? 'transcription failed' }, { status: 500 });
  }

  // done - return transcript payload
  // shape: { status: 'done', transcript: string, meta?: any }
  return json({ status: 'done', transcript: job.transcript ?? '' });
};

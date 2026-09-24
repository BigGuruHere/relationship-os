// PURPOSE: Allow voice uploads only in the active Dating trust context.
// SECURITY: Do not let a Workspace session use a Dating-prefixed endpoint.
import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { POST as uploadChunk } from '../../../api/upload-chunk/+server';

export const POST: RequestHandler = (event) => {
  if (!event.locals.user) throw redirect(303, '/auth/login');
  if (event.locals.contextDomainKey !== 'dating' || !event.locals.contextSpaceId) {
    return json({ error: 'Dating ContextSpace required' }, { status: 403 });
  }
  return uploadChunk(event);
};

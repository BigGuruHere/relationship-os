// PURPOSE: Poll voice transcription jobs only within the active Dating context.
// SECURITY: The shared handler also verifies the job's exact user and ContextSpace.
import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GET as transcribeResult } from '../../../api/transcribe-result/+server';

export const GET: RequestHandler = (event) => {
  if (!event.locals.user) throw redirect(303, '/auth/login');
  if (event.locals.contextDomainKey !== 'dating' || !event.locals.contextSpaceId) {
    return json({ error: 'Dating ContextSpace required' }, { status: 403 });
  }
  return transcribeResult(event);
};

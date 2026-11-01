import type { RequestHandler } from './$types';
import { requirePeopleAccess } from '$lib/server/core/myPeople';
import { POST as upload } from '../../../api/upload-chunk/+server';
// Reuse the same bounded assembly/transcription implementation with private-route custody.
export const POST: RequestHandler = async event => { await requirePeopleAccess(event.locals); return upload(event); };

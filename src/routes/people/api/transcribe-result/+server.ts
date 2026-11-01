import type { RequestHandler } from './$types';
import { requirePeopleAccess } from '$lib/server/core/myPeople';
import { GET as poll } from '../../../api/transcribe-result/+server';
export const GET: RequestHandler = async event => { await requirePeopleAccess(event.locals); return poll(event); };

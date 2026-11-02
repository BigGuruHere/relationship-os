import type { RequestHandler } from './$types';
import { requirePeopleAccess } from '$lib/server/core/myPeople';
import { receiveTranscriptionDiagnostics } from '$lib/server/transcriptionBrowserDiagnostics';
export const POST: RequestHandler = async (event) => {
	await requirePeopleAccess(event.locals);
	return receiveTranscriptionDiagnostics(event);
};

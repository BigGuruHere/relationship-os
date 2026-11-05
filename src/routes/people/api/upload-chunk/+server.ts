import type { RequestHandler } from './$types';
import { requirePeopleAccess } from '$lib/server/core/myPeople';
import { peopleRouteDomain, foundationPage } from '$lib/server/foundation/peopleRouting';
import { resolveDraftProcessing } from '$lib/server/foundation/drafts';
import { POST as upload, _upload } from '../../../api/upload-chunk/+server';
export const POST: RequestHandler = async (event) => {
	if (
		event.locals.user &&
		(await peopleRouteDomain(event.locals.user.id, '/people/api/upload-chunk')) === 'FOUNDATION'
	) {
		const scope = await foundationPage(() => resolveDraftProcessing(event.locals));
		return _upload(event, scope);
	}
	await requirePeopleAccess(event.locals);
	return upload(event);
};

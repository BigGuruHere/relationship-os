import { peopleRouteDomain, foundationPage } from '$lib/server/foundation/peopleRouting';
import { resolveDraftProcessing } from '$lib/server/foundation/drafts';
import { resolveFoundationAccess } from '$lib/server/foundation/policy';
import { readPerson } from '$lib/server/foundation/subjects';
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requirePeopleContact } from '$lib/server/core/myPeople';
import { summarizeText } from '$lib/ai';
export const POST: RequestHandler = async ({ locals, params, request }) => {
	let processing;
	if (
		locals.user &&
		(await peopleRouteDomain(locals.user.id, '/people/' + params.id + '/notes/summarize')) ===
			'FOUNDATION'
	) {
		await foundationPage(async () =>
			readPerson(await resolveFoundationAccess(locals, 'READ'), params.id)
		);
		processing = await resolveDraftProcessing(locals);
	} else await requirePeopleContact(locals, params.id);
	let text: string;
	try {
		const body = await request.json();
		text = typeof body.text === 'string' ? body.text.trim() : '';
	} catch {
		return json({ error: 'Enter a note to summarise.' }, { status: 400 });
	}
	if (!text || text.length > 100000)
		return json({ error: 'Enter a note of up to 100,000 characters.' }, { status: 400 });
	try {
		await processing?.authorize();
		const result = await summarizeText(text);
		await processing?.authorize();
		if (!result.summary?.trim())
			return json({ error: 'No summary was returned. Your note is unchanged.' }, { status: 502 });
		return json({ summary: result.summary });
	} catch {
		return json(
			{ error: 'Summary unavailable. You can still save your note without it.' },
			{ status: 503 }
		);
	}
};

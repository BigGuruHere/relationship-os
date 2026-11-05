import { randomUUID } from 'node:crypto';
import { peopleRouteDomain, foundationPage } from '$lib/server/foundation/peopleRouting';
import { resolveFoundationAccess } from '$lib/server/foundation/policy';
import { readPerson } from '$lib/server/foundation/subjects';
import { appendOwnerNote, FoundationConflict } from '$lib/server/foundation/evidence';
import { transcriptionDebugEnabled } from '$lib/server/transcriptionDiagnostics';
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { requirePeopleContact } from '$lib/server/core/myPeople';
import { privateContactDetails } from '$lib/server/core/contacts';
import { createCoreInteraction } from '$lib/server/core/interactions';
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/auth/login');
	if (
		(await peopleRouteDomain(locals.user.id, '/people/' + params.id + '/notes/new')) ===
		'FOUNDATION'
	) {
		const contact = await foundationPage(async () =>
			readPerson(await resolveFoundationAccess(locals, 'READ'), params.id)
		);
		return { contact, foundation: true, saveKey: randomUUID(), transcriptionDebug: false };
	}
	const { contact } = await requirePeopleContact(locals, params.id);
	return {
		contact: privateContactDetails(contact),
		transcriptionDebug: transcriptionDebugEnabled()
	};
};
export const actions: Actions = {
	save: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/auth/login');
		if (
			(await peopleRouteDomain(locals.user.id, '/people/' + params.id + '/notes/new')) ===
			'FOUNDATION'
		) {
			await foundationPage(async () =>
				readPerson(await resolveFoundationAccess(locals, 'READ'), params.id)
			);
			const fd = await request.formData();
			const draft = {
				text: String(fd.get('text') || '').trim(),
				summary: String(fd.get('summary') || '').trim(),
				channel: fd.get('channel') === 'voice note' ? 'voice note' : 'note',
				saveKey: String(fd.get('saveKey') || '')
			};
			if (
				!draft.text ||
				draft.text.length > 64000 ||
				draft.summary.length > 20000 ||
				!/^[0-9a-f-]{36}$/i.test(draft.saveKey)
			)
				return fail(400, {
					error: 'Enter a note of up to 64,000 characters and retry this form.',
					draft
				});
			// Keep one stable retry key per draft. The person ID scopes it without accepting client custody.
			let end = Math.min(draft.text.length, 8000);
			if (
				/[\uD800-\uDBFF]/.test(draft.text.charAt(end - 1)) &&
				/[\uDC00-\uDFFF]/.test(draft.text.charAt(end))
			)
				end--;
			try {
				await appendOwnerNote(await resolveFoundationAccess(locals, 'RECORD_EVIDENCE'), {
					key: 'people-note:' + params.id + ':' + draft.saveKey,
					expectedVersion: 0,
					text: draft.text,
					summary: draft.summary,
					captureKind: draft.channel === 'voice note' ? 'VOICE_NOTE' : 'OWNER_NOTE',
					start: 0,
					end,
					quote: draft.text.slice(0, end),
					subjectIds: [params.id],
					allowPrivateAnalysis: false
				});
			} catch (e) {
				return fail(e instanceof FoundationConflict ? 409 : 503, {
					error:
						e instanceof FoundationConflict
							? 'This draft was already saved with different text. Open the person to check it before starting a new note.'
							: 'Could not save your note. Your text is below; please retry.',
					draft
				});
			}
			throw redirect(303, '/people/' + params.id);
		}
		const { context, contact } = await requirePeopleContact(locals, params.id);
		const fd = await request.formData();
		const text = String(fd.get('text') || '').trim();
		const summary = String(fd.get('summary') || '').trim();
		const channel = fd.get('channel') === 'voice note' ? 'OWNER_VOICE_NOTE' : 'OWNER_NOTE';
		if (!text || text.length > 100000 || summary.length > 20000)
			return fail(400, {
				error: 'Enter a note of up to 100,000 characters.',
				draft: { text, summary, channel: channel === 'OWNER_VOICE_NOTE' ? 'voice note' : 'note' }
			});
		// Authenticated owner authors an observation. Storage never implies LU, matching or disclosure permission.
		try {
			await createCoreInteraction(context, {
				contactId: contact.id,
				channel,
				rawText: text,
				summary,
				sourceType: 'WORKSPACE',
				luAdmission: 'STORED_ONLY',
				createEmbedding: false
			});
		} catch {
			// Return the draft on storage failure; never log private observations.
			return fail(500, {
				error: 'Could not save your note. Your text is below; please retry.',
				draft: { text, summary, channel: channel === 'OWNER_VOICE_NOTE' ? 'voice note' : 'note' }
			});
		}
		// A private observation does not imply a new conversation: leave lastContactedAt unchanged.
		throw redirect(303, '/people/' + contact.id);
	}
};

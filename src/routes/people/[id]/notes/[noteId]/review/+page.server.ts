import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { decrypt, encrypt } from '$lib/crypto';
import { resolveDraftProcessing } from '$lib/server/foundation/drafts';
import {
	approveNoteReview, FoundationConflict, readCurrentStatement, readNoteForReview, reviewProposals
} from '$lib/server/foundation/evidence';
import { FoundationDenied } from '$lib/server/foundation/internal';
import { noteReviewAvailable, proposeNoteReview } from '$lib/server/foundation/noteReview';
import { foundationPage, peopleRouteDomain } from '$lib/server/foundation/peopleRouting';
import { resolveFoundationAccess } from '$lib/server/foundation/policy';
import { readPerson } from '$lib/server/foundation/subjects';
import type { Actions, PageServerLoad } from './$types';

const purpose = 'foundation-note-review:v1';
const proposalToken = z.strictObject({
	session: z.string(), personId: z.string(), noteId: z.string(), vaultId: z.string(),
	epoch: z.number().int(), version: z.number().int(), expiresAt: z.number(),
	proposals: reviewProposals
});

async function context(locals: App.Locals, url: URL, params: { id: string; noteId: string }) {
	if (!noteReviewAvailable(locals, url) || !locals.user || !locals.sessionId ||
		await peopleRouteDomain(locals.user.id, url.pathname) !== 'FOUNDATION')
		throw error(404, 'Note review unavailable.');
	const access = await foundationPage(() => resolveFoundationAccess(locals, 'READ_NOTES'));
	const note = await foundationPage(() => readNoteForReview(access, params.id, params.noteId));
	return { access, note, session: locals.sessionId };
}

function requireOrigin(request: Request, url: URL) {
	if (request.headers.get('origin') !== url.origin) throw error(403, 'Submit from the note review page.');
}

export const load: PageServerLoad = async ({ locals, params, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const { note } = await context(locals, url, params);
	const person = await foundationPage(async () => readPerson(await resolveFoundationAccess(locals, 'READ'), params.id));
	const approved = [];
	if (note.review) {
		const access = await foundationPage(() => resolveFoundationAccess(locals, 'READ_STATEMENT'));
		for (const entry of note.review.entries) {
			try {
				const statement = await readCurrentStatement(access, entry.statementId);
				approved.push({ bucket: entry.bucket, text: statement.text, mode: statement.mode,
					quote: note.text.slice(entry.start, entry.end) });
			} catch (cause) {
				if (!(cause instanceof FoundationDenied)) throw cause;
			}
		}
	}
	return { text: note.text, person: { id: person.id, name: person.name }, reviewed: Boolean(note.review), approved };
};

export const actions: Actions = {
	analyse: async ({ locals, params, url, request, fetch, setHeaders }) => {
		requireOrigin(request, url);
		setHeaders({ 'cache-control': 'private, no-store' });
		const { access, note, session } = await context(locals, url, params);
		if (note.review) return fail(409, { message: 'This note version has already been reviewed.' });
		try {
			const person = await readPerson(await resolveFoundationAccess(locals, 'READ'), params.id);
			const processing = await resolveDraftProcessing(locals);
			await processing.authorize();
			const proposals = await proposeNoteReview(note.text, person.name, fetch);
			await processing.authorize();
			const current = await readNoteForReview(access, params.id, params.noteId);
			if (current.version !== note.version) return fail(409, { message: 'The note changed. Review the current version.' });
			return { proposals, token: encrypt(JSON.stringify({
				session, personId: params.id, noteId: params.noteId, vaultId: access.vaultId, epoch: access.epoch,
				version: note.version, expiresAt: Date.now() + 30 * 60_000, proposals
			}), purpose) };
		} catch (cause) {
			if (cause instanceof FoundationDenied) throw error(404, 'Note review unavailable.');
			return fail(503, { message: 'Could not suggest updates. You can try again.' });
		}
	},
	approve: async ({ locals, params, url, request, setHeaders }) => {
		requireOrigin(request, url);
		setHeaders({ 'cache-control': 'private, no-store' });
		const { access, session } = await context(locals, url, params);
		const form = await request.formData();
		let claims;
		try {
			const raw = form.get('proposalToken');
			if (typeof raw !== 'string' || raw.length > 40000) throw new Error();
			claims = proposalToken.parse(JSON.parse(decrypt(raw, purpose)));
			if (claims.session !== session || claims.personId !== params.id || claims.noteId !== params.noteId ||
				claims.vaultId !== access.vaultId || claims.epoch !== access.epoch || claims.expiresAt <= Date.now())
				throw new Error();
		} catch {
			return fail(409, { message: 'These suggestions expired. Generate them again.' });
		}
		const checked = new Set(form.getAll('selected'));
		const selected = claims.proposals.filter((_, index) => checked.has(String(index)));
		if (!selected.length) return fail(400, { message: 'Choose at least one update to save.',
			proposals: claims.proposals, token: String(form.get('proposalToken')) });
		try {
			const review = await resolveFoundationAccess(locals, 'REVIEW_NOTE');
			if (review.epoch !== claims.epoch || review.vaultId !== claims.vaultId) throw new FoundationDenied();
			await approveNoteReview(review, params.id, params.noteId, claims.version, selected);
		} catch (cause) {
			if (cause instanceof FoundationConflict)
				return fail(409, { message: 'This note changed or was already reviewed. Open its current version.' });
			if (cause instanceof FoundationDenied) throw error(404, 'Note review unavailable.');
			return fail(503, { message: 'Could not save the selected updates. Try again.',
				proposals: claims.proposals, token: String(form.get('proposalToken')) });
		}
		throw redirect(303, url.pathname);
	}
};

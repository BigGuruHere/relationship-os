import { randomUUID } from 'node:crypto';
import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/db';
import { readPersonConversation } from '$lib/server/foundation/conversations';
import { requeueDorianAnalysis } from '$lib/server/foundation/dorianCalls';
import { foundationDorianAvailable } from '$lib/server/foundation/dorianCallConfig';
import { FoundationConflict } from '$lib/server/foundation/evidenceRecords';
import { FoundationDenied } from '$lib/server/foundation/internal';
import {
	approveLuCandidate, readLatestLuFailedReview, readLuCandidateForReview, readPersonLuHistory, stableTopicKey
} from '$lib/server/foundation/livingUnderstanding';
import { proposalView, readKey } from '$lib/server/foundation/luReview';
import { resolveDorianCallAccess } from '$lib/server/foundation/policy';
import type { Actions, PageServerLoad } from './$types';

const uuid = z.uuid();
const decision = z.enum(['APPROVE', 'DEFER', 'REJECT']);
const revisionNumber = z.coerce.number().int().positive().max(2_147_483_647);

function operator(locals: App.Locals, url: URL, id: string) {
	if (!foundationDorianAvailable(locals, url) || locals.user?.role !== 'owner' || !uuid.safeParse(id).success)
		throw error(404, 'Review unavailable.');
	return { kind: 'operator' as const, actorId: locals.user.id };
}

export const load: PageServerLoad = async ({ locals, url, params, setHeaders }) => {
	const grant = operator(locals, url, params.id);
	setHeaders({ 'cache-control': 'private, no-store' });
	try {
		const read = await resolveDorianCallAccess(params.id, grant, 'READ_CONVERSATION');
		const { subjectId, sourceId, candidateId } = read.dorian!;
		if (!sourceId) throw new FoundationDenied();
		const call = await prisma.dorianFoundationCall.findUniqueOrThrow({ where: { id: params.id }, select: { state: true } });
		const [store, historyAccess] = await Promise.all([
			resolveDorianCallAccess(params.id, grant, 'STORE_LU_CANDIDATE'),
			resolveDorianCallAccess(params.id, grant, 'READ_LU')
		]);
		const conversation = await readPersonConversation(read, subjectId, sourceId);
		const candidate = candidateId && (call.state === 'READY' || call.state === 'NO_CHANGE')
			? await readLuCandidateForReview(store, subjectId, sourceId, candidateId)
				.then(proposalView).catch((cause: unknown) => {
					if (cause instanceof FoundationDenied || cause instanceof FoundationConflict) return null;
					throw cause;
				})
			: null;
		const failed = call.state === 'HELD'
			? await readLatestLuFailedReview(store, subjectId, sourceId, conversation.sourceVersion) : null;
		const historySelection = {
			group: 'self' as const, revision: revisionNumber.safeParse(url.searchParams.get('revision')).data,
			topic: uuid.safeParse(url.searchParams.get('topic')).data,
			evidence: uuid.safeParse(url.searchParams.get('evidence')).data
		};
		return {
			kind: 'conversation' as const, person: { id: subjectId, name: 'Participant' }, conversation,
			candidate, stale: call.state === 'READY' && !candidate, enabled: true,
			failedReview: failed && { ...failed, message: 'Analysis held this update for inspection.' },
			history: await readPersonLuHistory(historyAccess, subjectId, historySelection),
			historySelection, requestKey: randomUUID(), status: decision.safeParse(url.searchParams.get('status')).data,
			canRetry: conversation.completeness === 'COMPLETE' &&
				(call.state === 'FAILED' || call.state === 'HELD' || (call.state === 'READY' && !candidate))
		};
	} catch (cause) {
		if (cause instanceof FoundationDenied) throw error(404, 'Review unavailable.');
		throw cause;
	}
};

export const actions: Actions = {
	decide: async ({ locals, url, params, request }) => {
		const grant = operator(locals, url, params.id);
		if (request.headers.get('origin') !== url.origin) throw error(403, 'Submit from the review page.');
		const fields = await request.formData();
		const choice = decision.safeParse(fields.get('decision'));
		const candidate = uuid.safeParse(url.searchParams.get('candidate'));
		const selected = fields.getAll('selected').map(readKey);
		if (!choice.success || !candidate.success || selected.length > 768 ||
			selected.some((key) => !key) || (choice.data === 'APPROVE') !== Boolean(selected.length))
			return fail(400, { message: 'Choose valid updates to review.' });
		const keys = selected.filter((key) => key !== null);
		try {
			const access = await resolveDorianCallAccess(params.id, grant, 'APPROVE_LU');
			const { subjectId, sourceId } = access.dorian!;
			if (!sourceId) throw new FoundationDenied();
			await approveLuCandidate(access, candidate.data, {
				requestKey: 'dorian-operator-review:' + candidate.data, decision: choice.data, selected: keys
			}, { personId: subjectId, sourceId });
		} catch (cause) {
			if (cause instanceof FoundationDenied || cause instanceof FoundationConflict)
				return fail(409, { message: 'The suggestions changed or expired. Reload this conversation to review again.',
					checked: keys.map(stableTopicKey) });
			throw cause;
		}
		throw redirect(303, url.pathname + '?status=' + choice.data);
	},
	retry: async ({ locals, url, params, request }) => {
		const grant = operator(locals, url, params.id);
		if (request.headers.get('origin') !== url.origin) throw error(403, 'Submit from the review page.');
		try {
			const access = await resolveDorianCallAccess(params.id, grant, 'STORE_LU_CANDIDATE');
			const { subjectId, sourceId, candidateId } = access.dorian!;
			if (!sourceId) throw new FoundationDenied();
			// Keep a current READY proposal available to the reviewer. A stale one can be regenerated.
			if (candidateId) {
				const valid = await readLuCandidateForReview(access, subjectId, sourceId, candidateId)
					.then(() => true).catch((cause: unknown) => {
						if (cause instanceof FoundationDenied || cause instanceof FoundationConflict) return false;
						throw cause;
					});
				if (valid) return fail(409, { message: 'Review the current suggestions first.' });
			}
			await requeueDorianAnalysis(access);
		} catch (cause) {
			if (cause instanceof FoundationDenied || cause instanceof FoundationConflict)
				return fail(409, { message: 'This conversation cannot be queued again.' });
			throw cause;
		}
		throw redirect(303, url.pathname);
	}
};

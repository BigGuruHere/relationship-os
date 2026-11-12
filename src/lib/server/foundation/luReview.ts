// Presentation and form handling for the owner-only conversation review.
import { randomUUID } from 'node:crypto';
import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { readPersonConversation, reviseConversationSource } from './conversations';
import { FoundationConflict } from './evidence';
import { FoundationDenied } from './internal';
import {
	approveLuCandidate, readLuCandidateForReview, readPersonLuHistory, reviewGroups, stableTopicKey
} from './livingUnderstanding';
import { assessFoundationConversation, editFoundationProposal } from './luAssessment';
import { noteReviewAvailable } from './noteReview';
import { foundationPage, peopleRouteDomain } from './peopleRouting';
import { resolveFoundationAccess } from './policy';
import { readPerson } from './subjects';
import { AssessmentError } from '../livingUnderstanding/semanticAssessment';

export function conversationReviewAvailable(locals: App.Locals, url: URL) {
	return noteReviewAvailable(locals, url) && process.env.RELISH_FOUNDATION_LU_REVIEW === 'YES';
}

const id = z.uuid();
const number = z.coerce.number().int().min(1).max(2147483647);
const groupSchema = z.enum(reviewGroups);
const decisionSchema = z.enum(['APPROVE', 'DEFER', 'REJECT']);
const topicKey = z.tuple([id, id, z.string().min(1).max(200)]);

type ReviewEvent = {
	locals: App.Locals;
	params: { id: string; noteId: string };
	url: URL;
};

async function reviewContext(event: ReviewEvent) {
	const { locals, params, url } = event;
	if (!noteReviewAvailable(locals, url) || !locals.user ||
		await peopleRouteDomain(locals.user.id, url.pathname) !== 'FOUNDATION' ||
		!id.safeParse(params.noteId).success)
		throw error(404, 'Conversation review unavailable.');
	const access = await foundationPage(() => resolveFoundationAccess(locals, 'READ_CONVERSATION'));
	return foundationPage(() => readPersonConversation(access, params.id, params.noteId));
}

function proposalView(receipt: Awaited<ReturnType<typeof readLuCandidateForReview>>) {
	const { packet, prior } = receipt.input;
	return {
		id: receipt.candidateId,
		noChange: receipt.outcome === 'NO_CHANGE',
		groups: receipt.candidate.streams.map((stream) => {
			const subject = packet.subjects.find((item) => item.id === stream.subjectId);
			const group = stream.subjectId === packet.scope.selfSubjectId ? 'self' as const
				: subject?.kind === 'RELATIONSHIP' ? 'relationship' as const : 'person' as const;
			const topics = stream.topics.filter((topic) => topic.effect !== 'UNCHANGED').map((topic) => {
				const key = stableTopicKey({ ...stream, topicKey: topic.key });
				const before = prior.find((item) => item.versionId === topic.previousVersionId);
				return {
					key, area: topic.area, title: topic.title, prose: topic.prose,
					timeScope: topic.timeScope, effect: topic.effect,
					before: before?.prose,
					ownerEdited: receipt.provenance.ownerEdits?.some((edit) => edit.topic === key) ?? false,
					meanings: receipt.candidate.meanings.filter((meaning) => topic.meaningIds.includes(meaning.id))
						.map((meaning) => ({
							text: meaning.text, basis: meaning.basis, kind: meaning.kind,
							uncertainty: meaning.expressedUncertainty, asserter: meaning.asserter.kind,
							evidence: meaning.evidence.map(({ quote, turnId, role }) => ({
								quote, role, speaker: packet.turns.find((turn) => turn.id === turnId)?.speakerId
							}))
						}))
				};
			});
			return { group, topics };
		}).filter((group) => group.topics.length)
	};
}

export async function loadConversationLuReview(event: ReviewEvent) {
	const { locals, params, url } = event;
	const conversation = await reviewContext(event);
	const person = await foundationPage(async () =>
		readPerson(await resolveFoundationAccess(locals, 'READ'), params.id));
	const candidateId = id.safeParse(url.searchParams.get('candidate'));
	const candidate = await (async () => {
		if (!candidateId.success) return null;
		try {
			const access = await resolveFoundationAccess(locals, 'STORE_LU_CANDIDATE');
			return proposalView(await readLuCandidateForReview(access, params.id, params.noteId, candidateId.data));
		} catch (cause) {
			if (cause instanceof FoundationDenied || cause instanceof FoundationConflict) return null;
			throw cause;
		}
	})();
	const group = groupSchema.safeParse(url.searchParams.get('group')).data;
	const revision = number.safeParse(url.searchParams.get('revision')).data;
	const topic = id.safeParse(url.searchParams.get('topic')).data;
	const evidence = id.safeParse(url.searchParams.get('evidence')).data;
	const history = await foundationPage(async () =>
		readPersonLuHistory(await resolveFoundationAccess(locals, 'READ_LU'), params.id,
			{ group, revision, topic, evidence }));
	return {
		kind: 'conversation' as const, person: { id: person.id, name: person.name }, conversation,
		candidate, stale: url.searchParams.has('candidate') && !candidate,
		enabled: conversationReviewAvailable(locals, url),
		requestKey: randomUUID(),
		status: decisionSchema.safeParse(url.searchParams.get('status')).data,
		history, historySelection: { group, revision, topic }
	};
}

type FormEvent = ReviewEvent & { request: Request; setHeaders: (headers: Record<string, string>) => void };

async function writeContext(event: FormEvent) {
	if (event.request.headers.get('origin') !== event.url.origin)
		throw error(403, 'Submit from the conversation review page.');
	if (event.url.searchParams.get('conversation') !== '1' || !conversationReviewAvailable(event.locals, event.url))
		throw error(404, 'Conversation review unavailable.');
	event.setHeaders({ 'cache-control': 'private, no-store' });
	const conversation = await reviewContext(event);
	return { conversation, fields: await event.request.formData() };
}

function reviewRedirect(url: URL, next: Record<string, string>) {
	throw redirect(303, url.pathname + '?' + new URLSearchParams({ conversation: '1', ...next }));
}

function readKey(value: FormDataEntryValue | null) {
	if (typeof value !== 'string' || value.length > 320) return null;
	try {
		const [subjectId, perspectiveId, topicKeyValue] = topicKey.parse(JSON.parse(value));
		return { subjectId, perspectiveId, topicKey: topicKeyValue };
	} catch {
		return null;
	}
}

export const conversationLuActions = {
	assessConversation: async (event: FormEvent) => {
		const { locals, params, url, request } = event;
		const { conversation, fields } = await writeContext(event);
		const requestKey = id.safeParse(fields.get('requestKey'));
		const expected = number.safeParse(fields.get('sourceVersion'));
		if (!requestKey.success || !expected.success || conversation.completeness !== 'COMPLETE')
			return fail(400, { message: 'A complete saved transcript is required to analyse this conversation.' });
		try {
			const access = await resolveFoundationAccess(locals, 'REVISE_CONVERSATION_SOURCE');
			const source = await reviseConversationSource(access, params.id, params.noteId, expected.data, 'PRIVATE_ANALYSIS');
			const result = await assessFoundationConversation(locals, params.id, params.noteId, requestKey.data,
				{ signal: request.signal, sourceVersionId: source.id });
			return reviewRedirect(url, { candidate: result.candidateId });
		} catch (cause) {
			if (cause instanceof FoundationConflict || cause instanceof FoundationDenied)
				return fail(409, { message: 'The transcript or understanding changed. Review the current version and try again.' });
			if (cause instanceof AssessmentError) {
				// Use an independent reference and fixed reason codes. Never log private
				// source identifiers, transcript content, prompts or provider responses.
				const reference = randomUUID();
				console.warn(JSON.stringify({
					component: 'relish.lu.review', operation: 'analyse', reference,
					stage: cause.diagnostic?.stage ?? 'prepare',
					attempt: cause.diagnostic?.attempt ?? 0, reason: cause.reason
				}));
				const unavailable = cause.reason.startsWith('MODEL_');
				const message = unavailable
					? 'Analysis is temporarily unavailable. You can retry.'
					: 'Relish could not validate updates from this conversation. You can retry.';
				return fail(unavailable ? 503 : 422, {
					message: message + ' Reference: ' + reference, retryKey: requestKey.data
				});
			}
			throw cause;
		}
	},
	editProposal: async (event: FormEvent) => {
		const { locals, params, url, request } = event;
		const { fields } = await writeContext(event);
		const candidate = id.safeParse(url.searchParams.get('candidate'));
		const key = readKey(fields.get('topic'));
		const prose = z.string().trim().min(1).max(6500).safeParse(fields.get('prose'));
		if (!candidate.success || !key || !prose.success)
			return fail(400, { message: 'Enter a paragraph of up to 6,500 characters.' });
		const binding = { personId: params.id, sourceId: params.noteId, candidateId: candidate.data };
		const draft = { topic: stableTopicKey(key), prose: prose.data };
		try {
			const result = await editFoundationProposal(locals, binding, key, prose.data, request.signal);
			return reviewRedirect(url, { candidate: result.candidateId });
		} catch (cause) {
			if (cause instanceof FoundationConflict || cause instanceof FoundationDenied)
				return fail(409, { message: 'These suggestions changed or expired. Your edit is available to copy.', draft });
			if (cause instanceof AssessmentError && cause.reason.startsWith('MODEL_'))
				return fail(503, { message: 'Validation is temporarily unavailable. Your wording is still here.', draft });
			if (cause instanceof AssessmentError)
				return fail(422, { message: 'Relish could not validate this wording against the evidence. You can revise it and try again.', draft });
			throw cause;
		}
	},
	decide: async (event: FormEvent) => {
		const { locals, params, url } = event;
		const { fields } = await writeContext(event);
		const candidate = id.safeParse(url.searchParams.get('candidate'));
		const decision = decisionSchema.safeParse(fields.get('decision'));
		const checked = fields.getAll('selected');
		const selected = checked.slice(0, 769).map(readKey).filter((key) => key !== null);
		if (!candidate.success || !decision.success || checked.length > 768 || selected.length !== checked.length)
			return fail(400, { message: 'Choose valid updates to review.' });
		if (decision.data === 'APPROVE' && !selected.length)
			return fail(400, { message: 'Choose at least one update to approve.' });
		try {
			const access = await resolveFoundationAccess(locals, 'APPROVE_LU');
			await approveLuCandidate(access, candidate.data, {
				requestKey: 'conversation-review:' + candidate.data, decision: decision.data,
				selected: decision.data === 'APPROVE' ? selected : []
			}, { personId: params.id, sourceId: params.noteId });
			return reviewRedirect(url, { status: decision.data });
		} catch (cause) {
			if (cause instanceof FoundationConflict || cause instanceof FoundationDenied)
				return fail(409, { message: 'These suggestions changed or expired. Review the current understanding before analysing again.',
					checked: selected.map(stableTopicKey) });
			throw cause;
		}
	}
};

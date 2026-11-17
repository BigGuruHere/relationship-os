import { assessSelfTopics, isSelfTopicPromptVersion, type SelfTopicCheckpoint } from '../livingUnderstanding/selfTopicAssessment';
// Application orchestration for the internal Foundation assessment operation.
// The review route grants admission and records the owner decision separately.
import { createHash } from 'node:crypto';
import { parseCandidate } from '../livingUnderstanding/contracts';
import { FoundationConflict } from './evidence';
import { requiredEnv } from '$lib/server/config/requiredEnv';
import { generateFoundationStructured } from '$lib/server/agents/modelGateway';
import {
	assessConversation,
	compareConversationWriting,
	auditOwnerWording,
	AssessmentError,
	type AssessmentModel,
	type AssessmentTrace,
	type AssessmentStagePanel
} from '../livingUnderstanding/semanticAssessment';
import { resolveFoundationAccess, type FoundationAccess } from './policy';
import {
	prepareLuAssessment,
	readLuCandidateForReview,
	stableTopicKey,
	resumeLuAssessment,
	resumeLuStructuralReview,
	storeLuCandidate,
	storeLuFailedReview,
	verifyLuAssessment
} from './livingUnderstanding';

const extractionTimeoutMs = 90_000;
const modelTimeoutMs = 45_000;
const assessmentTimeoutMs = 240_000;

function privateAssessmentModel(assessmentDeadline?: AbortSignal): AssessmentModel {
	// Pin the configured rich LU model for all steps of one assessment.
	let model: string;
	try {
		model = requiredEnv('DATING_REVISION_MODEL');
	} catch {
		throw new AssessmentError('MODEL_UNAVAILABLE');
	}
	return async (request) => {
		const timeout = AbortSignal.timeout(request.stage === 'decompose' ? extractionTimeoutMs : modelTimeoutMs);
		const deadlines = [timeout];
		if (assessmentDeadline) deadlines.push(assessmentDeadline);
		if (request.signal) deadlines.push(request.signal);
		const signal = AbortSignal.any(deadlines);
		signal.throwIfAborted();
		return generateFoundationStructured({
			model,
			systemPrompt: request.systemPrompt,
			userPrompt: request.userPrompt,
			outputSchema: request.outputSchema,
			signal
		});
	};
}

export async function compareFoundationConversationWriting(
	locals: Pick<App.Locals, 'user'>,
	personId: string,
	sourceId: string,
	sourceVersionId: string,
	signal: AbortSignal
) {
	signal.throwIfAborted();
	const access = await resolveFoundationAccess(locals, 'PREPARE_LU');
	const input = await prepareLuAssessment(access, personId, sourceId);
	if (input.packet.source.versionId !== sourceVersionId) throw new FoundationConflict();
	const authorize = () => verifyLuAssessment(access, personId, input);
	const deadline = AbortSignal.timeout(assessmentTimeoutMs);
	const comparison = await compareConversationWriting(input, privateAssessmentModel(deadline), authorize, signal);
	signal.throwIfAborted();
	await authorize();
	return comparison;
}

export async function assessFoundationConversation(
	locals: Pick<App.Locals, 'user'>,
	personId: string,
	sourceId: string,
	requestKey: string,
	options: { signal?: AbortSignal; sourceVersionId?: string; trace?: AssessmentTrace; stageReview?: AssessmentStagePanel[]; failureReference?: string; method?: 'SELF_TOPICS' } = {}
) {
	const prepare = await resolveFoundationAccess(locals, 'PREPARE_LU');
	const store = await resolveFoundationAccess(locals, 'STORE_LU_CANDIDATE');
	return runFoundationConversationAssessment(prepare, store, personId, sourceId, requestKey, options);
}

// Both entry points run the same assessor and candidate writer under issued authority.
export async function runFoundationConversationAssessment(
	prepare: FoundationAccess,
	store: FoundationAccess,
	personId: string,
	sourceId: string,
	requestKey: string,
	options: Parameters<typeof assessFoundationConversation>[4]
) {
	options ??= {};
	const { signal } = options;
	signal?.throwIfAborted();
	const input = await prepareLuAssessment(prepare, personId, sourceId);
	if (options.sourceVersionId && input.packet.source.versionId !== options.sourceVersionId)
		throw new FoundationConflict();
	// Bind retries to the analysis method so earlier drafts cannot resume under a new workflow.
	const assessmentKey = options.method === 'SELF_TOPICS' ? 'self-topics:' + requestKey : requestKey;
	const existing = await resumeLuAssessment(store, personId, input, assessmentKey);
	if (existing) return { candidateId: existing.candidateId, outcome: existing.outcome };
	// Resume only the consented browser workflow with a compatible server-side checkpoint.
	const selfTopics = options.method === 'SELF_TOPICS';
	const checkpoint = selfTopics && store.dorian
		? await resumeLuStructuralReview(store, personId, input)
		: undefined;
	let structuralCheckpoint: SelfTopicCheckpoint | undefined;
	// A bounded repair shares the attempt's overall model deadline.
	const assessmentDeadline = AbortSignal.timeout(assessmentTimeoutMs);
	const model = privateAssessmentModel(assessmentDeadline);
	const authorize = () => verifyLuAssessment(prepare, personId, input);
	const assessment = selfTopics
		? assessSelfTopics(input, model, authorize, signal, options.trace, options.stageReview,
			store.dorian ? { checkpoint, save: (value) => { structuralCheckpoint = value; } } : undefined)
		: assessConversation(input, model, authorize, signal, options.trace, options.stageReview);
	const result = await assessment.catch(async (cause: unknown) => {
		if (cause instanceof AssessmentError && options.stageReview?.length) {
			// Persist under the current transcript and baseline. The failed receipt
			// is separate from the retry key and cannot be proposed or approved.
			if (options.failureReference) {
				await storeLuFailedReview(store, personId, input, {
					reference: options.failureReference, reason: cause.reason,
					stageReview: options.stageReview, reviewFindings: cause.reviewFindings
				}, structuralCheckpoint);
			} else await verifyLuAssessment(prepare, personId, input);
		}
		throw cause;
	});
	signal?.throwIfAborted();
	if (assessmentDeadline.aborted) throw new AssessmentError('MODEL_TIMEOUT');
	return storeLuCandidate(
		store,
		personId,
		{ ...input.packet, unresolvedMentions: result.unresolvedMentions },
		result.candidate,
		{ requestKey: assessmentKey, prior: input.prior, provenance: result.provenance }
	);
}

export async function editFoundationProposal(
	locals: Pick<App.Locals, 'user'>,
	binding: { personId: string; sourceId: string; candidateId: string },
	destination: Parameters<typeof auditOwnerWording>[2],
	prose: string,
	signal?: AbortSignal
) {
	const { personId, sourceId, candidateId } = binding;
	const store = await resolveFoundationAccess(locals, 'STORE_LU_CANDIDATE');
	const prepare = await resolveFoundationAccess(locals, 'PREPARE_LU');
	const current = await readLuCandidateForReview(store, personId, sourceId, candidateId);
	const { input, provenance } = current;
	const topicKey = stableTopicKey(destination);
	const topic = current.candidate.streams.find((item) =>
		item.subjectId === destination.subjectId && item.perspectiveId === destination.perspectiveId)
		?.topics.find((item) => item.key === destination.topicKey && item.effect !== 'UNCHANGED');
	if (!topic) throw new FoundationConflict();
	if (topic.prose === prose) return { candidateId };

	// The same wording submitted again resumes its validated draft.
	const key = 'owner-wording:' + createHash('sha256')
		.update(JSON.stringify([candidateId, topicKey, prose])).digest('hex');
	const existing = await resumeLuAssessment(store, personId, input, key);
	if (existing) return { candidateId: existing.candidateId };
	topic.prose = prose;
	const candidate = parseCandidate(current.candidate, input.packet);
	const audit = await auditOwnerWording(input, candidate, destination, privateAssessmentModel(),
		() => verifyLuAssessment(prepare, personId, input), signal, isSelfTopicPromptVersion(provenance.promptVersion));
	signal?.throwIfAborted();
	return storeLuCandidate(store, personId, { ...input.packet, unresolvedMentions: current.unresolvedMentions },
		candidate, {
			requestKey: key, prior: input.prior,
			provenance: {
				...provenance,
				ownerEdits: [
					...(provenance.ownerEdits ?? []).filter((edit) => edit.topic !== topicKey),
					{ topic: topicKey, fromCandidateId: candidateId, ...audit }
				]
			}
		});
}

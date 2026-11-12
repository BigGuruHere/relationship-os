// Application orchestration for the internal Foundation assessment operation.
// The review route grants admission and records the owner decision separately.
import { createHash } from 'node:crypto';
import { parseCandidate } from '../livingUnderstanding/contracts';
import { FoundationConflict } from './evidence';
import { requiredEnv } from '$lib/server/config/requiredEnv';
import { generateFoundationStructured } from '$lib/server/agents/modelGateway';
import {
	assessConversation,
	auditOwnerWording,
	AssessmentError,
	type AssessmentModel
} from '../livingUnderstanding/semanticAssessment';
import { resolveFoundationAccess } from './policy';
import {
	prepareLuAssessment,
	readLuCandidateForReview,
	stableTopicKey,
	resumeLuAssessment,
	storeLuCandidate,
	verifyLuAssessment
} from './livingUnderstanding';

function privateAssessmentModel(): AssessmentModel {
	// Pin the configured rich LU model for all steps of one assessment.
	let model: string;
	try {
		model = requiredEnv('DATING_REVISION_MODEL');
	} catch {
		throw new AssessmentError('MODEL_UNAVAILABLE');
	}
	return async (request) => {
		const timeout = AbortSignal.timeout(45_000);
		return generateFoundationStructured({
			model,
			systemPrompt: request.systemPrompt,
			userPrompt: request.userPrompt,
			outputSchema: request.outputSchema,
			signal: request.signal ? AbortSignal.any([timeout, request.signal]) : timeout
		});
	};
}

export async function assessFoundationConversation(
	locals: Pick<App.Locals, 'user'>,
	personId: string,
	sourceId: string,
	requestKey: string,
	options: { signal?: AbortSignal; sourceVersionId?: string } = {}
) {
	const { signal } = options;
	signal?.throwIfAborted();
	const prepare = await resolveFoundationAccess(locals, 'PREPARE_LU');
	const store = await resolveFoundationAccess(locals, 'STORE_LU_CANDIDATE');
	const input = await prepareLuAssessment(prepare, personId, sourceId);
	if (options.sourceVersionId && input.packet.source.versionId !== options.sourceVersionId)
		throw new FoundationConflict();
	const existing = await resumeLuAssessment(store, personId, input, requestKey);
	if (existing) return { candidateId: existing.candidateId, outcome: existing.outcome };
	const result = await assessConversation(
		input,
		privateAssessmentModel(),
		() => verifyLuAssessment(prepare, personId, input),
		signal
	);
	signal?.throwIfAborted();
	return storeLuCandidate(
		store,
		personId,
		{ ...input.packet, unresolvedMentions: result.unresolvedMentions },
		result.candidate,
		{ requestKey, prior: input.prior, provenance: result.provenance }
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
		() => verifyLuAssessment(prepare, personId, input), signal);
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

// Application orchestration for the internal Foundation assessment operation.
// Owner review and activation are separate delivery stages.
import { requiredEnv } from '$lib/server/config/requiredEnv';
import { generateFoundationStructured } from '$lib/server/agents/modelGateway';
import {
	assessConversation,
	type AssessmentModel
} from '../livingUnderstanding/semanticAssessment';
import { resolveFoundationAccess } from './policy';
import {
	prepareLuAssessment,
	resumeLuAssessment,
	storeLuCandidate,
	verifyLuAssessment
} from './livingUnderstanding';

function privateAssessmentModel(): AssessmentModel {
	// Pin the configured rich LU model for all steps of one assessment.
	const model = requiredEnv('DATING_REVISION_MODEL');
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
	options: { signal?: AbortSignal } = {}
) {
	const { signal } = options;
	signal?.throwIfAborted();
	const prepare = await resolveFoundationAccess(locals, 'PREPARE_LU');
	const store = await resolveFoundationAccess(locals, 'STORE_LU_CANDIDATE');
	const input = await prepareLuAssessment(prepare, personId, sourceId);
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

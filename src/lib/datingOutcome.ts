// PURPOSE: Browser-independent Stage 8.10 Dating Outcome proposal contract and normalisation.
// SECURITY: This module handles plain values only. Server routes remain responsible for encryption and access control.

export const DATING_OUTCOME_CONSENT_VERSION = 'dating_voice_outcome_v1';
export const DATING_OUTCOME_PROPOSAL_SCHEMA = 'dating_outcome_proposal.v1';

const OUTCOME_STATUSES = new Set([
	'UNKNOWN',
	'NO_RESPONSE',
	'DECLINED',
	'CONNECTED',
	'CONTINUING',
	'SUCCESSFUL',
	'ENDED'
]);
const CONTINUE_VALUES = new Set(['YES', 'NO', 'UNSURE', 'NOT_STATED']);

type ProposalSection = { summary: string; evidence: string[] };

export type DatingOutcomeProposal = {
	schemaVersion: typeof DATING_OUTCOME_PROPOSAL_SCHEMA;
	proposalVersion: number;
	introductionId: string;
	respondentParticipantId: string;
	sourceInteractionId: string;
	consent: {
		version: typeof DATING_OUTCOME_CONSENT_VERSION;
		confirmedAt: string;
		privateLearningAllowed: boolean;
		futureMatchingAllowed: boolean;
		shareWithOtherAllowed: boolean;
	};
	personalExperience: ProposalSection;
	selfLearning: ProposalSection;
	otherPersonExperience: ProposalSection;
	relationshipDynamic: ProposalSection;
	desireToContinue: ProposalSection & { value: 'YES' | 'NO' | 'UNSURE' | 'NOT_STATED' };
	wholeOutcome: {
		status: string;
		useful: boolean | null;
		continued: boolean | null;
		result: string;
		notes: string;
	};
	confidence: number;
};

export function cleanDatingText(value: unknown, max = 4000) {
	return String(value ?? '')
		.replace(/\u0000/g, '')
		.trim()
		.slice(0, max);
}

function section(value: any): ProposalSection {
	return {
		summary: cleanDatingText(value?.summary),
		evidence: Array.isArray(value?.evidence)
			? value.evidence
					.map((item: unknown) => cleanDatingText(item, 500))
					.filter(Boolean)
					.slice(0, 8)
			: []
	};
}

function optionalBoolean(value: unknown): boolean | null {
	if (value === true || value === 'true' || value === 'YES' || value === 'yes') return true;
	if (value === false || value === 'false' || value === 'NO' || value === 'no') return false;
	return null;
}

export function normaliseDatingOutcomeProposal(
	value: any,
	metadata: {
		proposalVersion: number;
		introductionId: string;
		respondentParticipantId: string;
		sourceInteractionId: string;
		consentConfirmedAt: string;
		privateLearningAllowed: boolean;
		futureMatchingAllowed: boolean;
		shareWithOtherAllowed: boolean;
	}
): DatingOutcomeProposal {
	const desireValue = cleanDatingText(value?.desireToContinue?.value, 32).toUpperCase();
	const outcomeStatus = cleanDatingText(value?.wholeOutcome?.status, 32).toUpperCase();
	const confidenceNumber = Number(value?.confidence);
	return {
		schemaVersion: DATING_OUTCOME_PROPOSAL_SCHEMA,
		proposalVersion: Math.max(1, Math.trunc(metadata.proposalVersion || 1)),
		introductionId: metadata.introductionId,
		respondentParticipantId: metadata.respondentParticipantId,
		sourceInteractionId: metadata.sourceInteractionId,
		consent: {
			version: DATING_OUTCOME_CONSENT_VERSION,
			confirmedAt: metadata.consentConfirmedAt,
			privateLearningAllowed: metadata.privateLearningAllowed,
			futureMatchingAllowed: metadata.futureMatchingAllowed,
			shareWithOtherAllowed: metadata.shareWithOtherAllowed
		},
		personalExperience: section(value?.personalExperience),
		selfLearning: section(value?.selfLearning),
		otherPersonExperience: section(value?.otherPersonExperience),
		relationshipDynamic: section(value?.relationshipDynamic),
		desireToContinue: {
			...section(value?.desireToContinue),
			value: (CONTINUE_VALUES.has(desireValue)
				? desireValue
				: 'NOT_STATED') as DatingOutcomeProposal['desireToContinue']['value']
		},
		wholeOutcome: {
			status: OUTCOME_STATUSES.has(outcomeStatus) ? outcomeStatus : 'UNKNOWN',
			useful: optionalBoolean(value?.wholeOutcome?.useful),
			continued: optionalBoolean(value?.wholeOutcome?.continued),
			result: cleanDatingText(value?.wholeOutcome?.result),
			notes: cleanDatingText(value?.wholeOutcome?.notes)
		},
		confidence: Number.isFinite(confidenceNumber) ? Math.max(0, Math.min(1, confidenceNumber)) : 0
	};
}

function formBoolean(form: FormData, key: string) {
	return String(form.get(key) || '') === 'true';
}

export function reviewedDatingOutcomeProposal(base: DatingOutcomeProposal, form: FormData) {
	return normaliseDatingOutcomeProposal(
		{
			personalExperience: {
				summary: form.get('personalExperience'),
				evidence: base.personalExperience.evidence
			},
			selfLearning: { summary: form.get('selfLearning'), evidence: base.selfLearning.evidence },
			otherPersonExperience: {
				summary: form.get('otherPersonExperience'),
				evidence: base.otherPersonExperience.evidence
			},
			relationshipDynamic: {
				summary: form.get('relationshipDynamic'),
				evidence: base.relationshipDynamic.evidence
			},
			desireToContinue: {
				value: form.get('desireToContinue'),
				summary: form.get('desireToContinueSummary'),
				evidence: base.desireToContinue.evidence
			},
			wholeOutcome: {
				status: form.get('outcomeStatus'),
				useful: form.get('useful'),
				continued: form.get('continued'),
				result: form.get('result'),
				notes: form.get('notes')
			},
			confidence: base.confidence
		},
		{
			proposalVersion: base.proposalVersion + 1,
			introductionId: base.introductionId,
			respondentParticipantId: base.respondentParticipantId,
			sourceInteractionId: base.sourceInteractionId,
			consentConfirmedAt: base.consent.confirmedAt,
			privateLearningAllowed: formBoolean(form, 'privateLearningAllowed'),
			futureMatchingAllowed: formBoolean(form, 'futureMatchingAllowed'),
			shareWithOtherAllowed: formBoolean(form, 'shareWithOtherAllowed')
		}
	);
}

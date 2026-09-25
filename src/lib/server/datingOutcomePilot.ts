// PURPOSE: Run the Stage 8.10 single-sided Dating voice Outcome pilot.
// SECURITY: Raw transcripts and structured proposals remain encrypted. Ordinary agent audit JSON contains metadata only.
// DATA: Proposals are append-only AgentArtifacts. Only an explicit human approval creates a canonical Outcome.

import { prisma } from '$lib/db';
import { decrypt, encrypt } from '$lib/crypto';
import { createCoreInteraction, loadCoreInteraction } from '$lib/server/core/interactions';
import { createWorkspaceCoreAccess } from '$lib/server/core/accessPolicy';
import { startAgentRun, completeAgentRun, failAgentRun } from '$lib/server/agents/runtime';
import { createAgentStep, completeAgentStep, failAgentStep } from '$lib/server/agents/agentLogger';
import { generateStructured } from '$lib/server/agents/modelGateway';
import { executeAgentTool } from '$lib/server/agents/toolRegistry';
import { DATING_OUTCOME_OUTPUT_SCHEMA } from '$lib/server/agents/agentSetup';
import { loadIntroduction } from '$lib/server/introductions';
import { normaliseDatingPrivateNextStep, type DatingPrivateNextStep } from '$lib/datingNextStep';
import { reviewDatingElements, type DatingElementReview } from '$lib/datingElementReview';
import {
	cleanDatingText,
	DATING_OUTCOME_CONSENT_VERSION,
	DATING_OUTCOME_PROPOSAL_SCHEMA,
	normaliseDatingOutcomeProposal,
	reviewedDatingOutcomeProposal,
	type DatingOutcomeProposal
} from '$lib/datingOutcome';

type RunDatingOutcomeInput = {
	userId: string;
	contextSpaceId: string;
	introductionId: string;
	respondentParticipantId: string;
	transcript: string;
	privateLearningAllowed: boolean;
	futureMatchingAllowed: boolean;
	shareWithOtherAllowed: boolean;
};

export async function runDatingOutcomeExtraction(input: RunDatingOutcomeInput) {
	const transcript = cleanDatingText(input.transcript, 50000);
	if (!transcript) throw new Error('A transcript is required.');

	const introduction = await prisma.introduction.findFirst({
		where: { id: input.introductionId, userId: input.userId },
		select: {
			id: true,
			participants: {
				select: { id: true, side: true, contactId: true },
				orderBy: { side: 'asc' }
			}
		}
	});
	if (!introduction) throw new Error('Introduction not found in the Dating space.');
	const respondent = introduction.participants.find(
		(item) => item.id === input.respondentParticipantId
	);
	if (!respondent?.contactId) throw new Error('Select a respondent with a Dating person record.');

	const interaction = await createCoreInteraction(
		createWorkspaceCoreAccess(input.userId, 'dating:voice-outcome-source', input.contextSpaceId),
		{
			contactId: respondent.contactId,
			channel: 'dating_voice_reflection',
			sourceType: 'WORKSPACE',
			rawText: transcript,
			summary: 'Private Dating reflection awaiting structured review.',
			createEmbedding: false
		}
	);

	let runId = '';
	let stepId = '';
	let approvalId = '';
	try {
		const { agent, activePrompt, run } = await startAgentRun({
			userId: input.userId,
			contextSpaceId: input.contextSpaceId,
			agentKey: 'dating_outcome_extractor',
			triggerType: 'voice_callback',
			triggerEntityType: 'Introduction',
			triggerEntityId: input.introductionId,
			auditDataClass: 'sensitive',
			inputJson: {
				sourceInteractionId: interaction.id,
				respondentParticipantId: respondent.id,
				transcriptChars: transcript.length,
				consentVersion: DATING_OUTCOME_CONSENT_VERSION
			}
		});
		runId = run.id;

		const step = await createAgentStep({
			agentRunId: run.id,
			stepKey: 'extract_dating_outcome',
			stepName: 'Extract private Dating Outcome proposal',
			inputJson: { sourceInteractionId: interaction.id, transcriptChars: transcript.length }
		});
		stepId = step.id;

		const response = await generateStructured<any>({
			userId: input.userId,
			agentRunId: run.id,
			agentStepId: step.id,
			provider: agent.defaultModelProvider,
			model: agent.defaultModelName,
			purpose: 'dating_outcome_extraction',
			systemPrompt: activePrompt?.systemPrompt || agent.systemPrompt,
			userPrompt: [
				activePrompt?.instructions || agent.instructions || '',
				'',
				`The respondent is participant ${respondent.side}. Refer to both people only as the respondent and the other person.`,
				'',
				'Private reflection transcript:',
				transcript
			].join('\n'),
			outputSchema: DATING_OUTCOME_OUTPUT_SCHEMA,
			auditDataClass: 'sensitive'
		});
		if (!response.structured) throw new Error('The extractor returned no structured proposal.');

		const existingVersions = await prisma.agentArtifact.count({
			where: {
				userId: input.userId,
				artifactType: 'dating_outcome_proposal',
				entityType: 'introduction',
				entityId: input.introductionId
			}
		});
		const proposal = normaliseDatingOutcomeProposal(response.structured, {
			proposalVersion: existingVersions + 1,
			introductionId: input.introductionId,
			respondentParticipantId: respondent.id,
			sourceInteractionId: interaction.id,
			consentConfirmedAt: new Date().toISOString(),
			privateLearningAllowed: input.privateLearningAllowed,
			futureMatchingAllowed: input.futureMatchingAllowed,
			shareWithOtherAllowed: input.shareWithOtherAllowed
		});

		const toolContext = {
			userId: input.userId,
			contextSpaceId: input.contextSpaceId,
			agentRunId: run.id,
			agentStepId: step.id,
			auditDataClass: 'sensitive' as const
		};
		const artifact = await executeAgentTool<any, { id: string }>(
			'create_agent_artifact',
			{
				artifactType: 'dating_outcome_proposal',
				title: `Dating Outcome proposal v${proposal.proposalVersion}`,
				content: JSON.stringify(proposal),
				summary: 'Private provisional extraction awaiting human review.',
				structuredJson: {
					schemaVersion: proposal.schemaVersion,
					proposalVersion: proposal.proposalVersion
				},
				entityType: 'introduction',
				entityId: input.introductionId
			},
			toolContext
		);

		const approval = await executeAgentTool<any, { id: string }>(
			'create_approval_request',
			{
				actionType: 'dating_outcome_review',
				entityType: 'agent_artifact',
				entityId: artifact.id,
				proposedActionJson: {
					action: 'review_then_create_outcome',
					proposalVersion: proposal.proposalVersion,
					sourceInteractionId: interaction.id
				}
			},
			toolContext
		);
		approvalId = approval.id;

		// IT: Opaque identifiers provide traceability without copying private content into audit JSON.
		await prisma.agentRunEntity.createMany({
			data: [
				{
					agentRunId: run.id,
					entityType: 'interaction',
					entityId: interaction.id,
					role: 'source_evidence'
				},
				{
					agentRunId: run.id,
					entityType: 'introduction_participant',
					entityId: respondent.id,
					role: 'respondent'
				}
			]
		});

		await completeAgentStep(step.id, {
			proposalVersion: proposal.proposalVersion,
			artifactId: artifact.id,
			approvalId: approval.id
		});
		await completeAgentRun(run.id, {
			proposalVersion: proposal.proposalVersion,
			approvalId: approval.id
		});
		return { approvalId: approval.id, interactionId: interaction.id, runId: run.id };
	} catch (error) {
		// IT: A failure after proposal creation must not leave an actionable pending review.
		if (approvalId) {
			await prisma.approvalRequest
				.updateMany({
					where: { id: approvalId, userId: input.userId, status: 'pending' },
					data: {
						status: 'rejected',
						rejectedAt: new Date(),
						reviewerNote: 'Extraction failed before the proposal was ready for review.'
					}
				})
				.catch(() => undefined);
		}
		if (stepId) await failAgentStep(stepId, error).catch(() => undefined);
		if (runId) await failAgentRun(runId, error).catch(() => undefined);
		throw error;
	}
}

export async function loadDatingOutcomeReview(params: {
	userId: string;
	contextSpaceId: string;
	approvalId: string;
}) {
	const approval = await prisma.approvalRequest.findFirst({
		where: {
			id: params.approvalId,
			userId: params.userId,
			actionType: 'dating_outcome_review'
		},
		select: {
			id: true,
			status: true,
			entityId: true,
			agentRunId: true,
			reviewerNote: true,
			createdAt: true
		}
	});
	if (!approval?.entityId || !approval.agentRunId) return null;

	const artifact = await prisma.agentArtifact.findFirst({
		where: {
			id: approval.entityId,
			userId: params.userId,
			agentRunId: approval.agentRunId,
			artifactType: 'dating_outcome_proposal'
		},
		select: { id: true, contentEnc: true, createdAt: true }
	});
	if (!artifact?.contentEnc) return null;

	let proposal: DatingOutcomeProposal;
	try {
		proposal = JSON.parse(
			decrypt(artifact.contentEnc, 'agent_artifact.content')
		) as DatingOutcomeProposal;
	} catch {
		throw new Error('The encrypted Dating Outcome proposal could not be read.');
	}
	if (proposal.schemaVersion !== DATING_OUTCOME_PROPOSAL_SCHEMA) {
		throw new Error('Unsupported Dating Outcome proposal version.');
	}

	const [interaction, introduction] = await Promise.all([
		loadCoreInteraction(
			createWorkspaceCoreAccess(
				params.userId,
				'dating:voice-outcome-review',
				params.contextSpaceId
			),
			proposal.sourceInteractionId
		),
		loadIntroduction(params.userId, proposal.introductionId)
	]);
	if (!interaction || !introduction) return null;
	const respondent = introduction.participants.find(
		(item: any) => item.id === proposal.respondentParticipantId
	);
	const other = introduction.participants.find(
		(item: any) => item.id !== proposal.respondentParticipantId
	);

	// Only read the approved private choice within the same owner, custody and agent run.
	// Older approved reviews may not have a next-step field, which is intentional.
	let privateNextStep: DatingPrivateNextStep | null = null;
	let approvedReflection: DatingOutcomeProposal | null = null;
	let elementReviews: DatingElementReview[] | null = null;
	if (approval.status === 'approved') {
		const reviewed = await prisma.agentArtifact.findFirst({
			where: {
				id: { not: artifact.id }, userId: params.userId,
				contextSpaceId: params.contextSpaceId, agentRunId: approval.agentRunId,
				artifactType: 'dating_outcome_reviewed', entityType: 'introduction',
				entityId: proposal.introductionId
			},
			select: { contentEnc: true }, orderBy: { createdAt: 'desc' }
		});
		if (reviewed?.contentEnc) {
			const approvedProposal = JSON.parse(decrypt(reviewed.contentEnc, 'agent_artifact.content'));
			privateNextStep = approvedProposal.privateNextStep ?? null;
			elementReviews = approvedProposal.elementReviews ?? null;
			approvedReflection = approvedProposal as DatingOutcomeProposal;
		}
	}
	return {
		approval,
		artifact,
		proposal,
		privateNextStep,
		approvedReflection,
		elementReviews,
		transcript: interaction.text,
		introduction,
		respondent,
		other
	};
}

export async function approveDatingOutcomeReview(params: {
	userId: string;
	contextSpaceId: string;
	approvalId: string;
	form: FormData;
}) {
	const review = await loadDatingOutcomeReview(params);
	if (!review) throw new Error('Dating Outcome review not found.');
	if (review.approval.status !== 'pending')
		throw new Error('This proposal has already been reviewed.');
	const agentRunId = review.approval.agentRunId;
	if (!agentRunId) throw new Error('Dating Outcome review has no source agent run.');
	const proposal = reviewedDatingOutcomeProposal(review.proposal, params.form);
	// Persist the respondent's decision only inside the encrypted reviewed artifact.
	// Never convert this choice into outreach, a mutual preference, or disclosure consent.
	const privateNextStep = normaliseDatingPrivateNextStep(
		params.form.get('privateNextStep'), params.form.get('privateNextStepNote')
	);
	// An overall approval no longer confirms every element. Each requires a separate decision.
	const elementReview = reviewDatingElements(review.proposal, proposal, params.form);
	const reviewedContent = { ...elementReview.proposal, privateNextStep, elementReviews: elementReview.elements };

	return prisma.$transaction(async (tx) => {
		const reviewedArtifact = await tx.agentArtifact.create({
			data: {
				userId: params.userId,
				contextSpaceId: params.contextSpaceId,
				agentRunId,
				artifactType: 'dating_outcome_reviewed',
				title: 'Sensitive reviewed Dating Outcome',
				contentEnc: encrypt(JSON.stringify(reviewedContent), 'agent_artifact.content'),
				summaryEnc: encrypt(
					'Human-reviewed private Dating Outcome proposal.',
					'agent_artifact.summary'
				),
				structuredJson: {
					redacted: true,
					schemaVersion: proposal.schemaVersion,
					proposalVersion: proposal.proposalVersion
				},
				entityType: 'introduction',
				entityId: proposal.introductionId
			},
			select: { id: true }
		});

		const outcome = elementReview.createOutcome ? await tx.outcome.create({
			data: {
				userId: params.userId,
				contextSpaceId: params.contextSpaceId,
				introductionId: proposal.introductionId,
				status: elementReview.proposal.wholeOutcome.status as any,
				commerciality: 'NON_COMMERCIAL',
				useful: elementReview.proposal.wholeOutcome.useful,
				continued: elementReview.proposal.wholeOutcome.continued,
				resultEnc: elementReview.proposal.wholeOutcome.result
					? encrypt(elementReview.proposal.wholeOutcome.result, 'outcome.result')
					: null,
				notesEnc: elementReview.proposal.wholeOutcome.notes
					? encrypt(elementReview.proposal.wholeOutcome.notes, 'outcome.notes')
					: null,
				evidenceEnc: encrypt(
					`Human-approved private voice reflection proposal v${proposal.proposalVersion}. One-sided report by IntroductionParticipant ${proposal.respondentParticipantId}; not mutual confirmation.`,
					'outcome.evidence'
				),
				authority: 'SELF_DECLARED',
				sourceType: 'INTERACTION',
				sourceInteractionId: proposal.sourceInteractionId
			},
			select: { id: true }
		}) : null;

		const updated = await tx.approvalRequest.updateMany({
			where: { id: params.approvalId, userId: params.userId, status: 'pending' },
			data: {
				status: 'approved',
				approvedAt: new Date(),
				reviewerNote: `Reviewed artifact ${reviewedArtifact.id}; ${outcome ? `created Outcome ${outcome.id}` : 'whole Outcome was not confirmed'}.`
			}
		});
		if (updated.count !== 1) throw new Error('This proposal was reviewed by another request.');

		if (outcome) {
			await tx.agentRunEntity.create({
				data: {
					agentRunId,
					entityType: 'outcome',
					entityId: outcome.id,
					role: 'created_after_human_approval'
				}
			});
		}
		return { outcomeId: outcome?.id ?? null, introductionId: proposal.introductionId };
	});
}

export async function rejectDatingOutcomeReview(params: {
	userId: string;
	approvalId: string;
	reviewerNote?: string;
}) {
	const result = await prisma.approvalRequest.updateMany({
		where: {
			id: params.approvalId,
			userId: params.userId,
			actionType: 'dating_outcome_review',
			status: 'pending'
		},
		data: {
			status: 'rejected',
			rejectedAt: new Date(),
			reviewerNote:
				cleanDatingText(params.reviewerNote, 1000) || 'Rejected during mandatory review.'
		}
	});
	if (result.count !== 1) throw new Error('Dating Outcome review is not pending.');
}

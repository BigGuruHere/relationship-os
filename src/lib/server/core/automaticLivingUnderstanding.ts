// Stage 8.14.4 - automatically prepare a validated longitudinal LU candidate after trusted conversation ingestion.
// SECURITY: This creates only an encrypted WORKING draft. It never mutates authoritative Living Understanding.
import { reviewLivingUnderstandingImpact, approveLivingUnderstandingImpact, createLongitudinalImpactApprovalTokenForValidatedProposal } from '$lib/server/datingLongitudinalLivingUnderstanding';
import { completeLivingUnderstandingDraft, loadLatestLivingUnderstandingDraftForSource, loadLivingUnderstandingDraft, saveLivingUnderstandingDraft } from '$lib/server/datingLivingUnderstandingDraft';
import type { Scope } from '$lib/server/datingUnderstandingTopics';

function stripApprovalToken(proposal: any) {
  const { approvalToken: _approvalToken, ...rest } = proposal || {};
  return rest;
}

function stageRows(proposal: any) {
  return [
    { key: 'IMPACT_ANALYSIS', title: 'Impact analysis', status: 'COMPLETE', data: proposal.pipelineTrace?.impactAnalysis ?? {} },
    { key: 'TOPIC_PROPOSAL', title: 'Topic proposal', status: 'COMPLETE', data: proposal.pipelineTrace?.topicProposal ?? {} },
    { key: 'SEMANTIC_VALIDATION', title: 'Semantic validation', status: 'COMPLETE', data: proposal.pipelineTrace?.semanticValidation ?? {} },
    { key: 'BOUNDED_REPAIR', title: 'Bounded repair', status: proposal.pipelineTrace?.boundedRepair?.repairCount ? 'REPAIRED' : 'NOT_REQUIRED', data: proposal.pipelineTrace?.boundedRepair ?? {} },
    { key: 'FINAL_CANDIDATE', title: 'Final candidate revision', status: 'READY_FOR_APPROVAL', data: proposal.pipelineTrace?.finalCandidate ?? {} }
  ];
}

export function automaticLivingUnderstandingPreparationEnabled() {
  const raw = String(process.env.LU_AUTO_PREPARE_AFTER_INGEST ?? 'YES').trim().toUpperCase();
  return !['NO', 'FALSE', '0', 'OFF'].includes(raw);
}

export async function prepareAutomaticLivingUnderstandingImpact(scope: Scope, sourceInteractionId: string) {
  const existing = await loadLatestLivingUnderstandingDraftForSource(scope, sourceInteractionId);
  if (existing?.stage === 'AUTO_PROPOSAL_READY' && existing.impactProposal) {
    return { status: 'READY' as const, reused: true, draft: existing };
  }

  const proposal = await reviewLivingUnderstandingImpact(scope, sourceInteractionId);
  const storedProposal = stripApprovalToken(proposal);
  const pipelineStages = stageRows(proposal);
  const draft = await saveLivingUnderstandingDraft(scope, 'AUTO_PROPOSAL_READY', {
    longitudinalSeed: [{
      targetKey: `authoritative-revision:${proposal.baselineRevisionId}`,
      topicName: `Automatic authoritative v${proposal.baselineRevisionNumber} impact review`,
      proposedUnderstanding: `Prepared ${proposal.affectedTopics.length} affected topic(s), ${proposal.newTopics.length} new topic(s), and ${proposal.unchangedTopics.length} unchanged topic(s) for human approval.`,
      sourceInteractionId,
      sourceInteractionIds: [sourceInteractionId]
    }],
    priorOperationalUnits: [],
    chainHistory: [{
      sourceInteractionId,
      stage: 'AUTO_PROPOSAL_READY',
      preparedAt: new Date().toISOString(),
      affectedTopicCount: proposal.affectedTopics.length,
      newTopicCount: proposal.newTopics.length,
      repairedTopicCount: proposal.boundaryReview.repairedTopicCount
    }],
    pipelineStages,
    impactProposal: storedProposal,
    preparedAt: new Date().toISOString(),
    preparationMode: 'AUTOMATIC_AFTER_INGEST'
  }, '', {
    sourceInteractionId,
    baselineRevisionId: proposal.baselineRevisionId,
    baselineRevisionNumber: proposal.baselineRevisionNumber
  });

  return { status: 'READY' as const, reused: false, draft: await loadLivingUnderstandingDraft(scope, draft.id) };
}

export async function approvePreparedLivingUnderstandingImpact(scope: Scope, draftId: string) {
  const draft = await loadLivingUnderstandingDraft(scope, draftId);
  if (draft.stage !== 'AUTO_PROPOSAL_READY' || !draft.impactProposal) {
    throw new Error('The automatically prepared Living Understanding proposal is unavailable.');
  }
  const proposal: any = draft.impactProposal;
  if (proposal.sourceInteractionId !== draft.sourceInteractionId || proposal.baselineRevisionId !== draft.baselineRevisionId || proposal.baselineRevisionNumber !== draft.baselineRevisionNumber) {
    throw new Error('The automatically prepared Living Understanding proposal no longer matches its bound source and baseline.');
  }
  const approvalToken = createLongitudinalImpactApprovalTokenForValidatedProposal(scope, {
    baselineRevisionId: proposal.baselineRevisionId,
    baselineRevisionNumber: proposal.baselineRevisionNumber,
    sourceInteractionId: proposal.sourceInteractionId,
    changes: (proposal.affectedTopics ?? []).map((topic: any) => ({
      topicIdentityId: topic.topicIdentityId,
      proposedUnderstanding: topic.proposedUnderstanding,
      temporalScope: topic.temporalScope,
      operation: topic.effect,
      relationshipType: topic.effect === 'REINFORCED' ? 'REINFORCED' : 'INFORMED'
    })),
    newTopics: (proposal.newTopics ?? []).map((topic: any) => ({
      realm: topic.realm,
      topicName: topic.topicName,
      proposedUnderstanding: topic.proposedUnderstanding,
      temporalScope: topic.temporalScope
    }))
  });
  const result = await approveLivingUnderstandingImpact(scope, approvalToken);
  await completeLivingUnderstandingDraft(scope, draftId);
  return result;
}

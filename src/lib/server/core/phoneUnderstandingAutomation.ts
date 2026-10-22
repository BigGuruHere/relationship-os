// Stage 8.15.4.7f - Reuse Relish's existing validated, source-attributed LU pipeline.
// This is private learning only. It never changes matching, disclosure or sharing permissions.
import { prisma } from '$lib/db';
import { LivingUnderstandingNoChangeError } from '$lib/server/datingLongitudinalLivingUnderstanding';
import { getCurrentLivingUnderstanding, adoptLivingUnderstanding, createLivingUnderstandingAdoptionToken } from '$lib/server/datingPersistedLivingUnderstanding';
import { identifySemanticAreasReadOnly, reviseSemanticAreaReadOnly, restructureLivingUnderstandingReadOnly } from '$lib/server/datingUnderstandingRevisionExperiment';
import { consolidateSemanticAreasForRevision } from '$lib/server/datingUnderstandingRevisionPolicy.mjs';
import { prepareAutomaticLivingUnderstandingImpact, approvePreparedLivingUnderstandingImpact } from './automaticLivingUnderstanding';
import { describeLivingUnderstandingReviewHandoff } from './livingUnderstandingReviewHandoff';

type Scope = {userId:string; contextSpaceId:string; contactId:string};

export function phoneAutomaticLearningEnabled() {
  // Explicit pilot opt-in, not a default migration for all existing users.
  return process.env.RELISH_PHONE_AUTO_LU === 'YES';
}

export async function processPhoneUnderstanding(scope:Scope, sourceInteractionId:string) {
  // Existing authoritative source binding is checked before AI work or approval.
  const handoff = await describeLivingUnderstandingReviewHandoff(scope,'general',sourceInteractionId);
  if (handoff.state === 'ALREADY_APPLIED' || handoff.state === 'DISMISSED') return { status: 'COMPLETE' as const, detail:handoff.state };
  if (handoff.state === 'IMPACT_REVIEW_READY') {
    // The reviewer explicitly signals a valid no-change result with a typed exception.
    // Other failures must still propagate and leave the caller in FAILED state.
    let prepared;
    try {
      prepared = await prepareAutomaticLivingUnderstandingImpact(scope,sourceInteractionId);
    } catch (error) {
      if (error instanceof LivingUnderstandingNoChangeError) {
        return {status:'COMPLETE' as const, detail:'NO_CHANGE' as const};
      }
      throw error;
    }
    const proposal:any = prepared.draft.impactProposal;
    if (!proposal) throw new Error('The validated impact draft is missing.');
    // A conversation that only reinforces unchanged topics needs no empty authoritative revision.
    if (!proposal.affectedTopics?.length && !proposal.newTopics?.length) return {status:'COMPLETE' as const, detail:'NO_CHANGE'};
    await approvePreparedLivingUnderstandingImpact(scope,prepared.draft.id);
    return {status:'COMPLETE' as const,detail:'IMPACT_APPLIED'};
  }
  if (handoff.state !== 'INITIAL_REVIEW_READY') throw new Error('Unexpected Living Understanding handoff.');
  if (await getCurrentLivingUnderstanding(scope)) throw new Error('The initial baseline changed during processing.');
  const decomposition = await identifySemanticAreasReadOnly(scope,sourceInteractionId,true);
  if (!decomposition.analysis.validForReview || decomposition.analysis.errors.length) throw new Error('Initial semantic analysis was not validated.');
  const groups:any[] = consolidateSemanticAreasForRevision(decomposition.analysis.areas);
  if (!groups.length) return {status:'COMPLETE' as const, detail:'NO_CHANGE'};
  // Topic-specific evidence is validated inside the existing revision service.
  const revisions = [];
  for (const target of groups) {
    const own = new Set(target.sourceAreaIds);
    const excluded = decomposition.analysis.areas.filter((area:any)=>!own.has(area.areaId))
      .map((area:any)=>`${area.realm} / ${area.topicName}: ${area.reason}`).slice(0,12);
    revisions.push(await reviseSemanticAreaReadOnly(scope,sourceInteractionId,{
      ...target, excludedAreaSummaries:excluded
    },true));
  }
  const seeds = revisions.map(item=>({
    targetKey:item.targetKey,topicId:item.topicId,topicName:item.topicName,
    proposedNewTopic:item.proposedNewTopic,proposedUnderstanding:item.draft.summary,
    sourceInteractionId:item.sourceInteractionId,sourceDate:item.sourceDate,
    semanticBoundary:item.semanticBoundary,excludedTopicHints:item.excludedTopicHints
  }));
  // The INITIAL structural contract checks overlap, contamination and source traceability.
  const restructuring = await restructureLivingUnderstandingReadOnly(scope,seeds,[],'INITIAL');
  if (!restructuring.analysis.validForReview || restructuring.analysis.errors.length) {
    throw new Error('Initial structural review requires attention.');
  }
  const token = createLivingUnderstandingAdoptionToken(scope,restructuring);
  await adoptLivingUnderstanding(scope,token);
  return {status:'COMPLETE' as const, detail:'INITIAL_APPLIED'};
}

export async function finishPhoneUnderstanding(conversationId:string, status:'READY'|'FAILED') {
  // Guarded by the exact conversation, so a stale webhook cannot unlock a newer call.
  await prisma.networkPhoneCaller.updateMany({
    where:{understandingConversationId:conversationId},
    data:{understandingState:status,understandingStateAt:new Date()}
  });
}

export async function beginPhoneUnderstanding(conversationId:string) {
  await prisma.networkPhoneCaller.updateMany({
    where:{understandingConversationId:conversationId,understandingState:'IN_CALL'},
    data:{understandingState:'PROCESSING',understandingStateAt:new Date()}
  });
}

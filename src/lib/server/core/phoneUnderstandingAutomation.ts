import { setDorianCallUnderstanding, expireDorianCallUnderstanding } from './dorianVoiceCallLifecycle';
// Stage 8.15.4.7f - Reuse Relish's existing validated, source-attributed LU pipeline.
// This is private learning only. It never changes matching, disclosure or sharing permissions.
import { prisma } from '$lib/db';
import { continuityAction, UNCONFIRMED_ACTIVE_CALL_LEASE_MS } from './phoneContinuityPolicy.mjs';
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

export async function processPhoneUnderstanding(scope:Scope, sourceInteractionId:string, domainKey: 'business' | 'general' | 'dating' = 'general') {
  // Existing authoritative source binding is checked before AI work or approval.
  const handoff = await describeLivingUnderstandingReviewHandoff(scope,domainKey,sourceInteractionId);
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

// The ten-minute continuity window begins at call completion, not call initiation.
export const PHONE_CONTINUITY_WINDOW_MS = 10 * 60 * 1000;

export async function markPhoneCallEnded(conversationId: string, endedAt = new Date()) {
  // The provider adapter already persisted completion in the independent ledger.
  // This helper only closes the caller's compatibility state, not the provider call.
  // A signed provider post-call event proves completion. Only update the matching call.
  await prisma.networkPhoneCaller.updateMany({
    where: { understandingConversationId: conversationId, understandingCallEndedAt: null },
    data: { understandingCallEndedAt: endedAt }
  });
  // Completion does NOT mean LU is queued. Hold a short, distinct ingestion
  // state until participant evidence is durably stored. The worker must only
  // claim PROCESSING; otherwise it can race the webhook and fail on missing data.
  await prisma.networkPhoneCaller.updateMany({
    where: { understandingConversationId: conversationId, understandingState: 'IN_CALL' },
    data: { understandingState: 'AWAITING_INGEST', understandingStateAt: new Date() }
  });
}

export async function finishPhoneUnderstanding(conversationId:string, status:'READY'|'FAILED') {
  // A completed or failed LU job cannot leave the caller's gate held.
  await setDorianCallUnderstanding(conversationId, status === 'READY' ? 'COMPLETED' : 'FAILED');
  // A failure remains recorded on NetworkDorianSession, never blocks future conversations.
  // Conversation ID matching protects newer calls against delayed worker callbacks.
  await prisma.networkPhoneCaller.updateMany({
    where:{understandingConversationId:conversationId},
    data:{understandingState:'READY',understandingConversationId:null,understandingCallEndedAt:null,understandingStateAt:new Date()}
  });
}

export async function releasePhoneContinuityWithoutUnderstanding(conversationId: string) {
  // A provider-confirmed empty call has no Living Understanding job to finish.
  // Preserve the difference between NOT_REQUIRED and successfully COMPLETED LU.
  await prisma.dorianVoiceCallLifecycle.updateMany({
    where: { conversationId, mode: 'PARTICIPANT',
      understandingState: { in: ['PENDING', 'PROCESSING'] } },
    data: { understandingState: 'NOT_REQUIRED' }
  });
  // Never release a different/newer call that has since claimed this caller.
  await prisma.networkPhoneCaller.updateMany({
    where: { understandingConversationId: conversationId },
    data: { understandingState: 'READY', understandingConversationId: null,
      understandingCallEndedAt: null, understandingStateAt: new Date() }
  });
}

export async function beginPhoneUnderstanding(conversationId:string) {
  // Stage 8.22.4: enter the understanding gate ONLY after a signed completion
  // and after participant transcript evidence is committed. An initiation
  // request never reserves this state.
  const session = await prisma.networkDorianSession.findUnique({
    where: { conversationId }, select: { userId: true, pilotEntryId: true }
  });
  const call = await prisma.dorianVoiceCallLifecycle.findUnique({
    where: { conversationId }, select: { callState: true, endedAt: true, mode: true, understandingState: true }
  });
  if (!session || session.pilotEntryId || call?.callState !== 'ENDED' ||
      call.mode !== 'PARTICIPANT' || !call.endedAt) {
    throw new Error('Cannot queue phone understanding without verified completed participant evidence.');
  }
  // Duplicate post-call callbacks cannot requeue a terminal LU outcome.
  if (call.understandingState !== 'PENDING') return false;
  const claimed = await prisma.networkPhoneCaller.updateMany({
    where: { userId: session.userId, understandingState: 'READY' },
    data: { understandingState: 'PROCESSING', understandingConversationId: conversationId,
      understandingCallEndedAt: call.endedAt, understandingStateAt: new Date() }
  });
  // Concurrent valid calls can finish in either order. The durable ledger
  // retains PENDING and the worker claims the next call after the first job.
  return claimed.count === 1;
}

export async function releaseExpiredPhoneContinuityLock(callerId: string) {
  const cutoff = new Date(Date.now() - PHONE_CONTINUITY_WINDOW_MS);
  // Never release an IN_CALL row merely because its initiation is old.
  // Only a provider-confirmed end time can start the ten-minute deadline.
  const previous = await prisma.networkPhoneCaller.findUnique({
    where: { id: callerId }, select: { understandingConversationId: true } });
  const previousConversationId = previous?.understandingConversationId;
  if (!previousConversationId) return false;
  const released = await prisma.networkPhoneCaller.updateMany({
    where: { id: callerId, understandingConversationId: previousConversationId,
      understandingState: { in: ['IN_CALL','AWAITING_INGEST','PROCESSING','WORKING','FAILED'] },
      understandingCallEndedAt: { lte: cutoff } },
    data: { understandingState: 'READY', understandingConversationId: null,
      understandingCallEndedAt: null, understandingStateAt: new Date() }
  });
  if (released.count) {
    // An expired gate has no authority to stop the late worker. Preserve its work,
    // but do not let it mark newer calls complete or re-lock the caller.
    if (previousConversationId) await expireDorianCallUnderstanding(previousConversationId);
    console.info('[phone-continuity] Released expired completion-based gate.');
  }
  return released.count > 0;
}

// Stage 8.22.3c: local-first recovery. No provider API calls are made during initiation.
// A signed post-call webhook is the completion authority; understanding remains a
// separate, Relish-owned process. This also repairs crashes between the two local
// writes in the webhook's completion path.
export async function reconcilePhoneContinuityFromLocalLedger(callerId: string) {
  const caller = await prisma.networkPhoneCaller.findUnique({ where: { id: callerId },
    select: { understandingState: true, understandingConversationId: true,
      understandingCallEndedAt: true, understandingStateAt: true } });
  if (!caller || caller.understandingState === 'READY' || !caller.understandingConversationId) return;
  const conversationId = caller.understandingConversationId;
  const call = await prisma.dorianVoiceCallLifecycle.findUnique({
    where: { conversationId },
    select: { callState: true, endedAt: true, startedAt: true, understandingState: true }
  });

  if (call?.callState === 'ENDED' && call.endedAt) {
    // A crash between ledger closure and caller transition must never strand a gate.
    if (!caller.understandingCallEndedAt || caller.understandingState === 'IN_CALL') {
      await markPhoneCallEnded(conversationId, call.endedAt);
    }
    const action = continuityAction(call);
    if (action === 'RELEASE') {
      // A terminal or no-work outcome has no reason to block another conversation.
      await prisma.networkPhoneCaller.updateMany({
        where: { id: callerId, understandingConversationId: conversationId },
        data: { understandingState: 'READY', understandingConversationId: null,
          understandingCallEndedAt: null, understandingStateAt: new Date() }
      });
      console.info('[phone-continuity] Released terminal locally completed call.', { conversationId });
    }
    return;
  }

  if (call?.callState === 'UNCONFIRMED') {
    // A previously recovered uncertain call never acquires the gate again.
    await prisma.networkPhoneCaller.updateMany({
      where: { id: callerId, understandingConversationId: conversationId },
      data: { understandingState: 'READY', understandingConversationId: null,
        understandingCallEndedAt: null, understandingStateAt: new Date() }
    });
    return;
  }

  // An absent completion event cannot establish the actual hang-up time.
  // As a LAST RESORT, expire an unconfirmed active-call lease after two hours,
  // retaining a distinct UNCONFIRMED ledger state, NOT fabricating an end time.
  // This is deliberately independent of the 10 minutes counted from confirmed end.
  const startedAt = call?.startedAt ?? caller.understandingStateAt;
  if (caller.understandingState === 'IN_CALL' &&
      continuityAction(call || { callState: 'STARTED', startedAt }) === 'ABANDON_UNCONFIRMED') {
    const released = await prisma.networkPhoneCaller.updateMany({
      where: { id: callerId, understandingConversationId: conversationId,
        understandingState: 'IN_CALL', understandingCallEndedAt: null,
        understandingStateAt: { lte: new Date(Date.now() - UNCONFIRMED_ACTIVE_CALL_LEASE_MS) } },
      data: { understandingState: 'READY', understandingConversationId: null,
        understandingCallEndedAt: null, understandingStateAt: new Date() }
    });
    if (released.count) {
      await prisma.dorianVoiceCallLifecycle.updateMany({
        where: { conversationId, callState: 'STARTED' },
        data: { callState: 'UNCONFIRMED', understandingState: 'EXPIRED' }
      });
      console.warn('[phone-continuity] Unconfirmed call lease expired without completion event.', {
        conversationId, reason: 'MISSING_COMPLETION_EVENT'
      });
    }
  }
}

import { conversationalPolicyEnabled, callerHasAcceptedCurrentTerms } from '$lib/server/core/relishCallPolicy';
// PURPOSE: Receive ElevenLabs post-call transcription webhooks into the ContextSpace selected by the stable Relish agent deployment.
// SECURITY: HMAC verification occurs before parsing. Agent binding resolution occurs before workspace custody is entered. The endpoint never runs AI.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runWithExternalWorkspaceCustody, runWithWorkspaceCustody } from '$lib/server/core/contextSpace';
import { storeConversationOriginal, attachConversationParticipant } from '$lib/server/core/conversationInbox';
import { inspectElevenLabsSignature, normalizeElevenLabsConversation } from '$lib/server/integrations/elevenlabs/conversation';
import { resolveElevenLabsIdentity } from '$lib/server/integrations/elevenlabs/identity';
import { resolveElevenLabsAgentDeployment } from '$lib/server/integrations/elevenlabs/deployment';
import { elevenLabsErrorLog, elevenLabsLog, elevenLabsPayloadLog, elevenLabsTraceId } from '$lib/server/integrations/elevenlabs/debug';
import { describeLivingUnderstandingReviewHandoff } from '$lib/server/core/livingUnderstandingReviewHandoff';
import { configuredSharedBindingId, resolveSharedNetworkSession } from '$lib/server/integrations/elevenlabs/networkSession';
import { automaticLivingUnderstandingPreparationEnabled, prepareAutomaticLivingUnderstandingImpact } from '$lib/server/core/automaticLivingUnderstanding';
import { phoneAutomaticLearningEnabled, beginPhoneUnderstanding, finishPhoneUnderstanding } from '$lib/server/core/phoneUnderstandingAutomation';
import { prisma } from '$lib/db';
import { recordPilotEvent } from '$lib/server/pilot';
import { requiredEnv, requiredPositiveIntEnv } from '$lib/server/config/requiredEnv';

export const POST: RequestHandler = async ({ request }) => {
  const traceId = elevenLabsTraceId('el-post');
  const rawBody = await request.text();
  elevenLabsLog(traceId, 'REQUEST', 'Post-call webhook received.', {
    method: request.method,
    path: new URL(request.url).pathname,
    contentType: request.headers.get('content-type'),
    bodyBytes: Buffer.byteLength(rawBody, 'utf8'),
    hasSignature: Boolean(request.headers.get('elevenlabs-signature'))
  });

  // A missing post-call signing secret is a deployment error, not an alternative authentication mode.
  const secret = requiredEnv('ELEVENLABS_POST_CALL_WEBHOOK_SECRET');
  const secretSource = 'ELEVENLABS_POST_CALL_WEBHOOK_SECRET';
  let signatureCheck;
  try {
    signatureCheck = inspectElevenLabsSignature(rawBody, request.headers.get('elevenlabs-signature'), secret, Math.floor(Date.now() / 1000), requiredPositiveIntEnv('ELEVENLABS_WEBHOOK_MAX_AGE_SECONDS'));
  } catch (error) {
    elevenLabsErrorLog(traceId, 'AUTH', 'Unable to verify post-call signature.', error);
    return json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }
  if (!signatureCheck.valid) {
    elevenLabsLog(traceId, 'AUTH', 'Post-call webhook signature rejected.', {
      reason: signatureCheck.reason,
      timestamp: signatureCheck.timestamp,
      ageSeconds: signatureCheck.ageSeconds,
      scheme: signatureCheck.scheme,
      secretSource
    });
    return json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }
  elevenLabsLog(traceId, 'AUTH', 'Post-call webhook signature accepted.', {
    timestamp: signatureCheck.timestamp,
    ageSeconds: signatureCheck.ageSeconds,
    scheme: signatureCheck.scheme,
    secretSource
  });

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch (error) {
    elevenLabsErrorLog(traceId, 'PARSE', 'Post-call webhook body was not valid JSON.', error);
    return json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  elevenLabsLog(traceId, 'RECEIVED', 'Post-call event parsed.', {
    type: event?.type || null,
    conversationId: event?.data?.conversation_id || null,
    agentId: event?.data?.agent_id || null,
    agentName: event?.data?.agent_name || null,
    hasProviderUserId: Boolean(event?.data?.user_id),
    transcriptRows: Array.isArray(event?.data?.transcript) ? event.data.transcript.length : 0
  });
  // SECURITY: Do not log raw webhook payloads: they may include participant session tokens and transcripts.

  if (event?.type !== 'post_call_transcription') {
    elevenLabsLog(traceId, 'RESPONSE', 'Webhook event ignored because it is not post_call_transcription.', { type: event?.type || null });
    return json({ status: 'ignored' });
  }

  // Authenticated empty/abandoned calls are ordinary telephony outcomes, not ingestion failures.
  // Do not create an Interaction or schedule retries for them.
  const spokenRows = Array.isArray(event?.data?.transcript)
    ? event.data.transcript.some((row: any) => row?.role === 'user' && String(row?.message ?? '').trim())
    : false;
  if (!spokenRows) {
    // Empty calls have no evidence to interpret. Release only their own processing gate.
    if (phoneAutomaticLearningEnabled() && typeof event?.data?.conversation_id === 'string') {
      await finishPhoneUnderstanding(event.data.conversation_id, 'READY');
    }
    elevenLabsLog(traceId, 'RESPONSE', 'Signed post-call event has no participant speech; no transcript stored.', {
      status: 'ignored_no_participant_speech',
      conversationId: event?.data?.conversation_id || null
    });
    return json({ status: 'ignored_no_participant_speech' });
  }

  try {
    const normalized = normalizeElevenLabsConversation(event.data || {}, 'ELEVENLABS_WEBHOOK');
    elevenLabsLog(traceId, 'NORMALIZE', 'Conversation normalized into Relish provider-independent transcript.', {
      conversationId: normalized.metadata.externalConversationId,
      occurredAt: normalized.metadata.occurredAt,
      agentId: normalized.agentId || null,
      hasCallerPhone: Boolean(normalized.callerPhone),
      hasCalledNumber: Boolean(normalized.calledNumber),
      hasProviderUserId: Boolean(normalized.userId),
      speakers: normalized.parsed.speakers,
      turns: normalized.parsed.turns.length,
      userTurns: normalized.parsed.turns.filter(turn => turn.speaker === 'User').length,
      agentTurns: normalized.parsed.turns.filter(turn => turn.speaker === 'Agent').length,
      dynamicVariableKeys: Object.keys(normalized.dynamicVariables || {})
    });
    // SECURITY: Do not emit transcript contents or token-bearing dynamic variables to logs.

    const deployment = await resolveElevenLabsAgentDeployment({
      agentId: normalized.agentId,
      calledNumber: normalized.calledNumber,
      at: normalized.metadata.occurredAt
    });
    elevenLabsLog(traceId, 'AGENT', 'Agent deployment resolution completed.', deployment);

    if (deployment.status === 'CONFLICT') {
      elevenLabsLog(traceId, 'RESPONSE', 'Rejecting post-call webhook because agent deployment identifiers conflict.', { status: 409 });
      return json({ error: 'Agent deployment identifiers conflict.' }, { status: 409 });
    }
    if (deployment.status !== 'RESOLVED' || !deployment.userId || !deployment.contextSpaceId || !deployment.domainKey) {
      elevenLabsLog(traceId, 'RESPONSE', 'Signed webhook accepted but agent deployment is unresolved.', {
        status: 202,
        agentId: normalized.agentId || null,
        calledNumber: normalized.calledNumber || null,
        warning: deployment.warning
      });
      return json({ status: 'unresolved_agent_deployment', agentId: normalized.agentId || null, calledNumber: normalized.calledNumber || null }, { status: 202 });
    }

    // For the configured shared agent, the deployment owner is NEVER the transcript owner.
    // The session token is an unguessable server-issued credential and must match this binding.
    const shared = deployment.bindingId === configuredSharedBindingId()
      ? await resolveSharedNetworkSession({
          bindingId: deployment.bindingId!, conversationId: normalized.metadata.externalConversationId,
          agentId: normalized.agentId, sessionToken: normalized.dynamicVariables.relish_network_session
        })
      : null;
    if (deployment.bindingId === configuredSharedBindingId() && !shared) {
      // A real inbound SIP call does not have a browser-issued Network session.
      // Treat it as unlinked, not as an authentication failure that could cause
      // webhook retries. Never fall back to the shared deployment owner's workspace.
      // Caller ID alone is not a secure identity proof.
      const isPhoneCall = Boolean(normalized.callerPhone || normalized.calledNumber);
      elevenLabsLog(traceId, 'RESPONSE', isPhoneCall
        ? 'Signed telephone call has no verified Relish participant session; transcript not imported.'
        : 'Shared browser call has no valid Network participant session; transcript not imported.', {
          status: isPhoneCall ? 'unlinked_phone_call' : 'missing_network_session',
          conversationId: normalized.metadata.externalConversationId,
          bindingId: deployment.bindingId
        });
      return isPhoneCall
        ? json({ status: 'unlinked_phone_call', conversationId: normalized.metadata.externalConversationId }, { status: 202 })
        : json({ error: 'Missing or invalid Network participant session.' }, { status: 403 });
    }
    // Stage 8.19: never store a new shared-Dorian transcript as Living Understanding
    // when the current policy has not been explicitly acknowledged through the tool.
    if (shared && conversationalPolicyEnabled() && !(await callerHasAcceptedCurrentTerms(shared.userId))) {
      await prisma.networkDorianSession.updateMany({ where: { id: shared.sessionId }, data: {
        understandingOutcome: 'NO_CHANGE', understandingOutcomeAt: new Date()
      } });
      // Release the provisional telephone readiness gate for an unaccepted conversation.
      // No understanding work is enqueued, so leaving IN_CALL would strand future calls.
      await prisma.networkPhoneCaller.updateMany({ where: {
        userId: shared.userId, understandingConversationId: normalized.metadata.externalConversationId,
        understandingState: 'IN_CALL'
      }, data: { understandingState: 'READY', understandingConversationId: null, understandingStateAt: new Date() } });
      console.warn('[relish-policy] conversation skipped: no current voice consent');
      return json({ status: 'policy_not_accepted' }, { status: 202 });
    }
    const targetUserId = shared?.userId ?? deployment.userId!;
    const targetContextSpaceId = shared?.contextSpaceId ?? deployment.contextSpaceId!;
    const targetDomainKey = shared ? shared.domainKey : deployment.domainKey!;
    const ingested = await runWithExternalWorkspaceCustody({ targetUserId, targetContextSpaceId, reason: 'ELEVENLABS_CONVERSATION_INGEST' }, async () => {
      elevenLabsLog(traceId, 'CUSTODY', 'Entered external workspace custody for conversation ingestion.', {
        userId: targetUserId,
        contextSpaceId: targetContextSpaceId,
        domainKey: targetDomainKey,
        agentKey: deployment.agentKey,
        bindingId: deployment.bindingId
      });

      const stored = await storeConversationOriginal({ userId: targetUserId, contextSpaceId: targetContextSpaceId }, targetDomainKey, normalized.parsed, {
        ...normalized.metadata,
        agentName: deployment.agentName || normalized.metadata.agentName
      });
      elevenLabsLog(traceId, 'STORE', 'Conversation original storage completed.', {
        transcriptId: stored.transcriptId,
        alreadyImported: stored.alreadyImported,
        conversationId: normalized.metadata.externalConversationId
      });

      const identity = await resolveElevenLabsIdentity({ userId: targetUserId, contextSpaceId: targetContextSpaceId }, {
        // Ignore untrusted third-party identity hints for shared sessions.
        ...(shared ? { relishContactId: shared.contactId } : {
        relishContactId: normalized.dynamicVariables.relish_contact_id,
        relishPersonId: normalized.dynamicVariables.relish_person_id,
        callerPhone: normalized.callerPhone,
        providerUserId: normalized.userId }),
      });
      elevenLabsLog(traceId, 'IDENTITY', 'Participant identity resolution completed.', identity);

      let participantSourceId: string | null = null;
      let livingUnderstandingReview: Awaited<ReturnType<typeof describeLivingUnderstandingReviewHandoff>> | null = null;
      if (identity.status === 'RESOLVED' && identity.contactId) {
        const attached = await attachConversationParticipant({ userId: targetUserId, contextSpaceId: targetContextSpaceId }, targetDomainKey, stored.transcriptId, identity.contactId);
        participantSourceId = attached.id;
        elevenLabsLog(traceId, 'ATTACH', 'Participant-specific conversation evidence attached.', {
          contactId: identity.contactId,
          personId: identity.personId,
          participantSourceId
        });
        livingUnderstandingReview = await describeLivingUnderstandingReviewHandoff(
          { userId: targetUserId, contextSpaceId: targetContextSpaceId, contactId: identity.contactId },
          targetDomainKey,
          participantSourceId
        );
        elevenLabsLog(traceId, 'LU_HANDOFF', 'Conversation is ready for the existing human-approved Living Understanding workflow.', {
          state: livingUnderstandingReview.state,
          baselineRevisionNumber: livingUnderstandingReview.baselineRevisionNumber,
          reviewUrl: livingUnderstandingReview.reviewUrl
        });
      } else {
        elevenLabsLog(traceId, 'ATTACH', 'Conversation retained without participant attachment.', {
          identityStatus: identity.status,
          identityMethod: identity.method
        });
      }

      return {
        response: {
          status: stored.alreadyImported ? 'already_imported' : 'imported',
          conversationId: normalized.metadata.externalConversationId,
          agentKey: deployment.agentKey,
          agentBindingId: deployment.bindingId,
          agentResolutionMethod: deployment.method,
          agentResolutionWarning: deployment.warning,
          participantAttached: Boolean(participantSourceId),
          identityStatus: identity.status,
          identityMethod: identity.method,
          livingUnderstandingReview
        },
        participantSourceId,
        contactId: identity.status === 'RESOLVED' ? identity.contactId : null
      };
    });

    // Signed provider callback is the only source for confirmed completion.
    // Retry callbacks share a database idempotency key and never inflate the funnel.
    if (shared?.pilotEntryId) {
      const entry = await prisma.pilotProfileEntry.findUnique({ where: { id: shared.pilotEntryId } });
      if (entry && entry.visitorUserId === shared.userId && entry.domainKey === shared.domainKey) {
        // Outbound SIP client-data skips initiation webhooks, so a spoken post-call
        // transcription is the first authoritative proof of a started conversation.
        await recordPilotEvent({ type: 'dorian.conversation_started', env: entry.environment,
          profileId: entry.profileId, ownerUserId: entry.ownerUserId,
          domainKey: entry.domainKey as 'general' | 'business' | 'dating',
          entryId: entry.id, visitorUserId: entry.visitorUserId, source: entry.entrySource,
          conversationId: normalized.metadata.externalConversationId,
          dedup: 'started:' + normalized.metadata.externalConversationId });
        await recordPilotEvent({ type: 'dorian.conversation_completed', env: entry.environment,
          profileId: entry.profileId, ownerUserId: entry.ownerUserId,
          domainKey: entry.domainKey as 'general' | 'business' | 'dating',
          entryId: entry.id, visitorUserId: entry.visitorUserId, source: entry.entrySource,
          conversationId: normalized.metadata.externalConversationId,
          dedup: 'conversation:' + normalized.metadata.externalConversationId });
      }
    }
    if (shared?.pilotEntryId) await prisma.pilotSmsInvitation.updateMany({
      where: { pilotEntryId: shared.pilotEntryId, conversationId: normalized.metadata.externalConversationId, status: 'CALLING' },
      data: { status: 'COMPLETED' }
    });
    let automaticLivingUnderstanding: any = null;
    if (phoneAutomaticLearningEnabled() && deployment.bindingId === configuredSharedBindingId() && ingested.contactId && ingested.participantSourceId) {
      // The transcript and attributed evidence are committed before we acknowledge.
      // AI interpretation is performed outside the webhook by the independent worker.
      // This prevents long model calls from holding the provider's HTTP connection open.
      if (shared?.pilotEntryId) {
        // The existing opt-in worker handles browser entries with the same durable
        // source evidence but a different context-specific processing queue.
        await prisma.networkDorianSession.updateMany({ where: { id: shared.sessionId,
          pilotEntryId: shared.pilotEntryId, conversationId: normalized.metadata.externalConversationId,
          understandingOutcome: null }, data: { understandingOutcome: 'QUEUED', understandingOutcomeAt: new Date() } });
      } else {
        await beginPhoneUnderstanding(normalized.metadata.externalConversationId);
      }
      automaticLivingUnderstanding = { status: 'QUEUED' };
      elevenLabsLog(traceId, 'LU_AUTOMATION', 'Evidence committed; understanding queued for worker.', {
        queued: true
      });
    } else if (
      automaticLivingUnderstandingPreparationEnabled() &&
      ingested.contactId &&
      ingested.participantSourceId &&
      ingested.response.livingUnderstandingReview?.state === 'IMPACT_REVIEW_READY'
    ) {
      const startedAt = Date.now();
      try {
        const prepared = await runWithWorkspaceCustody(
          { userId: targetUserId, contextSpaceId: targetContextSpaceId },
          () => prepareAutomaticLivingUnderstandingImpact(
            { userId: targetUserId, contextSpaceId: targetContextSpaceId, contactId: ingested.contactId! },
            ingested.participantSourceId!
          )
        );
        automaticLivingUnderstanding = {
          status: prepared.status,
          draftId: prepared.draft.id,
          reused: prepared.reused,
          durationMs: Date.now() - startedAt,
          reviewUrl: ingested.response.livingUnderstandingReview.reviewUrl
        };
        elevenLabsLog(traceId, 'LU_AUTOMATION', 'Living Understanding proposal prepared automatically and is awaiting human approval.', automaticLivingUnderstanding);
      } catch (error) {
        automaticLivingUnderstanding = { status: 'FAILED', durationMs: Date.now() - startedAt };
        // SECURITY/RELIABILITY: transcript ingestion is already complete. AI proposal failure must
        // not cause ElevenLabs to retry a successfully stored conversation. Manual review remains available.
        elevenLabsErrorLog(traceId, 'LU_AUTOMATION', 'Automatic Living Understanding preparation failed. Conversation remains safely imported and can be reviewed manually.', error);
      }
    }

    const response = { ...ingested.response, automaticLivingUnderstanding };
    elevenLabsLog(traceId, 'RESPONSE', 'Post-call processing complete. Sending acknowledgement to ElevenLabs.', response);
    elevenLabsPayloadLog(traceId, 'SENT', 'Full post-call response sent to ElevenLabs.', response);
    return json(response);
  } catch (error) {
    elevenLabsErrorLog(traceId, 'ERROR', 'Unhandled post-call bridge error.', error);
    throw error;
  }
};

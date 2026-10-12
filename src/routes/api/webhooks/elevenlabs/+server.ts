// PURPOSE: Receive ElevenLabs post-call transcription webhooks into the ContextSpace selected by the stable Relish agent deployment.
// SECURITY: HMAC verification occurs before parsing. Agent binding resolution occurs before workspace custody is entered. The endpoint never runs AI.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runWithExternalWorkspaceCustody } from '$lib/server/core/contextSpace';
import { storeConversationOriginal, attachConversationParticipant } from '$lib/server/core/conversationInbox';
import { inspectElevenLabsSignature, normalizeElevenLabsConversation } from '$lib/server/integrations/elevenlabs/conversation';
import { resolveElevenLabsIdentity } from '$lib/server/integrations/elevenlabs/identity';
import { resolveElevenLabsAgentDeployment } from '$lib/server/integrations/elevenlabs/deployment';
import { elevenLabsErrorLog, elevenLabsLog, elevenLabsPayloadLog, elevenLabsTraceId } from '$lib/server/integrations/elevenlabs/debug';

export const POST: RequestHandler = async ({ request }) => {
  const traceId = elevenLabsTraceId('el-post');
  const rawBody = await request.text();
  elevenLabsLog(traceId, 'REQUEST', 'Post-call webhook received.', {
    method: request.method,
    url: request.url,
    contentType: request.headers.get('content-type'),
    bodyBytes: Buffer.byteLength(rawBody, 'utf8'),
    hasSignature: Boolean(request.headers.get('elevenlabs-signature'))
  });

  const primarySecret = String(process.env.ELEVENLABS_WEBHOOK_SECRET || '').trim();
  const legacySecret = String(process.env.POST_CALL_WEBHOOK_SECRET || '').trim();
  const secret = primarySecret || legacySecret;
  const secretSource = primarySecret ? 'ELEVENLABS_WEBHOOK_SECRET' : (legacySecret ? 'POST_CALL_WEBHOOK_SECRET' : 'NONE');
  let signatureCheck;
  try {
    signatureCheck = inspectElevenLabsSignature(rawBody, request.headers.get('elevenlabs-signature'), secret);
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
    providerUserId: event?.data?.user_id || null,
    transcriptRows: Array.isArray(event?.data?.transcript) ? event.data.transcript.length : 0
  });
  elevenLabsPayloadLog(traceId, 'RECEIVED', 'Full signed post-call payload received from ElevenLabs.', event);

  if (event?.type !== 'post_call_transcription') {
    elevenLabsLog(traceId, 'RESPONSE', 'Webhook event ignored because it is not post_call_transcription.', { type: event?.type || null });
    return json({ status: 'ignored' });
  }

  try {
    const normalized = normalizeElevenLabsConversation(event.data || {}, 'ELEVENLABS_WEBHOOK');
    elevenLabsLog(traceId, 'NORMALIZE', 'Conversation normalized into Relish provider-independent transcript.', {
      conversationId: normalized.metadata.externalConversationId,
      occurredAt: normalized.metadata.occurredAt,
      agentId: normalized.agentId || null,
      callerPhone: normalized.callerPhone || null,
      calledNumber: normalized.calledNumber || null,
      providerUserId: normalized.userId || null,
      speakers: normalized.parsed.speakers,
      turns: normalized.parsed.turns.length,
      userTurns: normalized.parsed.turns.filter(turn => turn.speaker === 'User').length,
      agentTurns: normalized.parsed.turns.filter(turn => turn.speaker === 'Agent').length,
      dynamicVariableKeys: Object.keys(normalized.dynamicVariables || {})
    });
    elevenLabsPayloadLog(traceId, 'NORMALIZE', 'Normalized transcript and metadata.', {
      metadata: normalized.metadata,
      agentId: normalized.agentId,
      callerPhone: normalized.callerPhone,
      calledNumber: normalized.calledNumber,
      dynamicVariables: normalized.dynamicVariables,
      parsed: normalized.parsed
    });

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

    return runWithExternalWorkspaceCustody({ targetUserId: deployment.userId, targetContextSpaceId: deployment.contextSpaceId, reason: 'ELEVENLABS_CONVERSATION_INGEST' }, async () => {
      elevenLabsLog(traceId, 'CUSTODY', 'Entered external workspace custody for conversation ingestion.', {
        userId: deployment.userId,
        contextSpaceId: deployment.contextSpaceId,
        domainKey: deployment.domainKey,
        agentKey: deployment.agentKey,
        bindingId: deployment.bindingId
      });

      const stored = await storeConversationOriginal({ userId: deployment.userId!, contextSpaceId: deployment.contextSpaceId! }, deployment.domainKey!, normalized.parsed, {
        ...normalized.metadata,
        agentName: deployment.agentName || normalized.metadata.agentName
      });
      elevenLabsLog(traceId, 'STORE', 'Conversation original storage completed.', {
        transcriptId: stored.transcriptId,
        alreadyImported: stored.alreadyImported,
        conversationId: normalized.metadata.externalConversationId
      });

      const identity = await resolveElevenLabsIdentity({ userId: deployment.userId!, contextSpaceId: deployment.contextSpaceId! }, {
        relishContactId: normalized.dynamicVariables.relish_contact_id,
        relishPersonId: normalized.dynamicVariables.relish_person_id,
        callerPhone: normalized.callerPhone,
        providerUserId: normalized.userId
      });
      elevenLabsLog(traceId, 'IDENTITY', 'Participant identity resolution completed.', identity);

      let participantSourceId: string | null = null;
      if (identity.status === 'RESOLVED' && identity.contactId) {
        const attached = await attachConversationParticipant({ userId: deployment.userId!, contextSpaceId: deployment.contextSpaceId! }, deployment.domainKey!, stored.transcriptId, identity.contactId);
        participantSourceId = attached.id;
        elevenLabsLog(traceId, 'ATTACH', 'Participant-specific conversation evidence attached.', {
          contactId: identity.contactId,
          personId: identity.personId,
          participantSourceId
        });
      } else {
        elevenLabsLog(traceId, 'ATTACH', 'Conversation retained without participant attachment.', {
          identityStatus: identity.status,
          identityMethod: identity.method
        });
      }

      const response = {
        status: stored.alreadyImported ? 'already_imported' : 'imported',
        conversationId: normalized.metadata.externalConversationId,
        agentKey: deployment.agentKey,
        agentBindingId: deployment.bindingId,
        agentResolutionMethod: deployment.method,
        agentResolutionWarning: deployment.warning,
        participantAttached: Boolean(participantSourceId),
        identityStatus: identity.status,
        identityMethod: identity.method
      };
      elevenLabsLog(traceId, 'RESPONSE', 'Post-call processing complete. Sending acknowledgement to ElevenLabs.', response);
      elevenLabsPayloadLog(traceId, 'SENT', 'Full post-call response sent to ElevenLabs.', response);
      return json(response);
    });
  } catch (error) {
    elevenLabsErrorLog(traceId, 'ERROR', 'Unhandled post-call bridge error.', error);
    throw error;
  }
};

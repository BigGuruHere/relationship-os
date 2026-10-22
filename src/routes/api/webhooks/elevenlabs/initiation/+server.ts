import { configuredSharedBindingId } from '$lib/server/integrations/elevenlabs/networkSession';
import { startProvisionalPhoneCall, provisionalPhoneInitiationResponse } from '$lib/server/integrations/elevenlabs/phoneOnboarding';
// PURPOSE: ElevenLabs conversation-initiation bridge for inbound phone/SIP/widget calls.
// SECURITY: Header-authenticated. Agent deployment resolves the destination ContextSpace before any participant data is read.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { runWithExternalWorkspaceCustody } from '$lib/server/core/contextSpace';
import { buildElevenLabsInitiationData, verifyInitiationAuthorization } from '$lib/server/integrations/elevenlabs/initiation';
import { resolveElevenLabsAgentDeployment } from '$lib/server/integrations/elevenlabs/deployment';
import { elevenLabsErrorLog, elevenLabsLog, elevenLabsPayloadLog, elevenLabsTraceId } from '$lib/server/integrations/elevenlabs/debug';

export const POST: RequestHandler = async ({ request }) => {
  const traceId = elevenLabsTraceId('el-init');
  elevenLabsLog(traceId, 'REQUEST', 'Conversation initiation request received.', {
    method: request.method,
    path: new URL(request.url).pathname,
    contentType: request.headers.get('content-type'),
    hasAuthorization: Boolean(request.headers.get('authorization'))
  });

  if (!verifyInitiationAuthorization(request.headers.get('authorization'))) {
    elevenLabsLog(traceId, 'AUTH', 'Initiation authorization rejected.');
    return json({ error: 'Invalid initiation authorization.' }, { status: 401 });
  }
  elevenLabsLog(traceId, 'AUTH', 'Initiation authorization accepted.');

  let body: any;
  try {
    body = await request.json();
  } catch (error) {
    elevenLabsErrorLog(traceId, 'PARSE', 'Initiation body was not valid JSON.', error);
    return json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  elevenLabsLog(traceId, 'RECEIVED', 'Initiation identifiers received.', {
    agentId: body?.agent_id || null,
    hasCalledNumber: Boolean(body?.called_number),
    hasCallerId: Boolean(body?.caller_id),
    hasProviderUserId: Boolean(body?.user_id),
    hasRelishContactId: Boolean(body?.relish_contact_id),
    hasRelishPersonId: Boolean(body?.relish_person_id),
    conversationId: body?.conversation_id || null
  });
  // Never log initiation payloads that can contain session credentials.

  try {
    const deployment = await resolveElevenLabsAgentDeployment({
      agentId: body?.agent_id,
      calledNumber: body?.called_number
    });
    elevenLabsLog(traceId, 'AGENT', 'Agent deployment resolution completed.', deployment);

    if (deployment.status === 'CONFLICT') {
      elevenLabsLog(traceId, 'RESPONSE', 'Rejecting initiation because agent deployment identifiers conflict.', { status: 409 });
      return json({ error: 'Agent deployment identifiers conflict.' }, { status: 409 });
    }
    if (deployment.status !== 'RESOLVED' || !deployment.userId || !deployment.contextSpaceId) {
      elevenLabsLog(traceId, 'RESPONSE', 'No Relish agent deployment matched this initiation.', { status: 404, warning: deployment.warning });
      return json({ error: 'No Relish agent deployment matches this call.' }, { status: 404 });
    }

    // Shared Dorian inbound calls: provision separate non-login caller custody.
    // Never fall back to the deployment owner's private workspace.
    if (configuredSharedBindingId() && deployment.bindingId === configuredSharedBindingId()) {
      const prepared = await startProvisionalPhoneCall({
        callerId: body?.caller_id, conversationId: body?.conversation_id, bindingId: deployment.bindingId
      });
      if (!prepared) {
        elevenLabsLog(traceId, 'RESPONSE', 'Caller missing, duplicate or unsafe: generic response only.', { status: 200 });
        return json({ type: 'conversation_initiation_client_data', dynamic_variables: {
          // Unresolved callers must not receive a real session credential.
          relish_network_session: 'UNRESOLVED_NO_SESSION',
          relish_identity_status: 'UNRESOLVED',
          call_instruction: 'Do not use or disclose prior participant information.'
        } });
      }
      if (prepared.status === 'WAIT') {
        // Give a spoken processing notice, but never issue a session credential or private context.
        // A preferred name is only a provisional phone preference and is safe for this pilot greeting.
        // Ending the call requires the ElevenLabs built-in end_call tool and a system-prompt rule.
        const name = prepared.preferredName?.trim();
        const waitingMessage = `${name ? `Hi ${name}. ` : 'Hi there. '}I'm just processing our last call. Could you call me back in a few minutes?`;
        elevenLabsLog(traceId, 'RESPONSE', 'Previous call is not yet ready; processing-only greeting.', {
          status: 200, hasPreferredName: Boolean(name), sessionIssued: false
        });
        return json({
          type: 'conversation_initiation_client_data',
          dynamic_variables: {
            // ElevenLabs validates referenced dynamic variables before speaking.
            // This sentinel satisfies its variable contract but is deliberately NOT a
            // signed/issued Relish credential; every session-protected tool must reject it.
            relish_network_session: 'PROCESSING_NO_SESSION',
            relish_identity_status: 'PROCESSING',
            user_name: name || '',
            // This status is authoritative for the agent: do not take more turns.
            call_instruction: 'PROCESSING ONLY: After the first message, immediately invoke the ElevenLabs built-in end_call tool. Do not ask questions, discuss any other topic, or attempt Relish tool calls. No participant session was issued.'
          },
          conversation_config_override: { agent: { first_message: waitingMessage } }
        });
      }
      const response = provisionalPhoneInitiationResponse(prepared);
      elevenLabsLog(traceId, 'RESPONSE', 'Provisional caller session issued.', {
        status: 200, identityStatus: 'PROVISIONAL_PHONE', previousCalls: prepared.previousCalls
      });
      return json(response);
    }

    return runWithExternalWorkspaceCustody({
      targetUserId: deployment.userId,
      targetContextSpaceId: deployment.contextSpaceId,
      reason: 'ELEVENLABS_CONVERSATION_INITIATION'
    }, async () => {
      elevenLabsLog(traceId, 'CUSTODY', 'Entered external workspace custody.', {
        userId: deployment.userId,
        contextSpaceId: deployment.contextSpaceId,
        agentKey: deployment.agentKey,
        bindingId: deployment.bindingId
      });

      const built = await buildElevenLabsInitiationData({ userId: deployment.userId!, contextSpaceId: deployment.contextSpaceId! }, {
        callerPhone: body?.caller_id,
        providerUserId: body?.user_id,
        relishContactId: body?.relish_contact_id,
        relishPersonId: body?.relish_person_id
      }, deployment, {
        providerAgentId: body?.agent_id ? String(body.agent_id) : '',
        callType: body?.source === 'RELISH_WIDGET_TEST_HARNESS' ? 'WIDGET_TEST' : 'INBOUND_CALL',
        callInstruction: body?.call_instruction ? String(body.call_instruction) : '',
        agentWebsite: body?.agent_website ? String(body.agent_website) : ''
      });

      elevenLabsLog(traceId, 'IDENTITY', 'Participant identity resolution completed.', built.identity);
      elevenLabsLog(traceId, 'RESPONSE', 'Sending conversation initiation data to ElevenLabs.', {
        identityStatus: built.response.dynamic_variables.relish_identity_status,
        identityMethod: built.response.dynamic_variables.relish_identity_method,
        participantName: built.response.dynamic_variables.participant_name,
        relishContactId: built.response.dynamic_variables.relish_contact_id,
        relishPersonId: built.response.dynamic_variables.relish_person_id,
        livingUnderstandingRevision: built.response.dynamic_variables.relish_living_understanding_revision,
        livingUnderstandingCharacters: built.response.dynamic_variables.relish_living_understanding.length,
        agentKey: built.response.dynamic_variables.relish_agent_key,
        agentName: built.response.dynamic_variables.relish_agent_name,
        agentEnvironment: built.response.dynamic_variables.relish_agent_environment,
        agentResolutionMethod: built.response.dynamic_variables.relish_agent_resolution_method,
        agentResolutionWarning: built.response.dynamic_variables.relish_agent_resolution_warning
      });
      elevenLabsPayloadLog(traceId, 'SENT', 'Full initiation response sent to ElevenLabs.', built.response);
      return json(built.response);
    });
  } catch (error) {
    elevenLabsErrorLog(traceId, 'ERROR', 'Unhandled initiation bridge error.', error);
    throw error;
  }
};

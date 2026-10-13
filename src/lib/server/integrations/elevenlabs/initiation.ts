// PURPOSE: Build the bounded, agent-facing context package returned to ElevenLabs before a call.
// SECURITY: This is an agent view, not a dump of private source material or a disclosure permission.
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '$lib/db';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { getCurrentLivingUnderstanding } from '$lib/server/datingPersistedLivingUnderstanding';
import { resolveElevenLabsIdentity, type ConversationIdentityScope, type ElevenLabsIdentityHints } from './identity';
import { PERSON_CONVERSATION_SOURCE_CHANNEL } from '$lib/server/core/conversationIngestion';
import { decryptInteractionSummary } from '$lib/server/core/interactionEncryption';

export function verifyInitiationAuthorization(header: string | null, secret = process.env.ELEVENLABS_INITIATION_SECRET || '') {
  if (!secret) return false;
  const supplied = Buffer.from(String(header || '').trim());
  const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

type DeploymentContext = {
  bindingId?: string | null;
  agentDefinitionId?: string | null;
  agentKey?: string | null;
  agentName?: string | null;
  environment?: string | null;
  method?: string | null;
  warning?: string | null;
};

type DorianCompatibilityContext = {
  providerAgentId?: string | null;
  callType?: string | null;
  callInstruction?: string | null;
  agentWebsite?: string | null;
};

function boundedText(value: string, max = 12000) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

function legacyDorianVariables(input: {
  identityStatus: string;
  participantName?: string;
  stablePersonId?: string;
  livingUnderstanding?: string;
  previousCalls?: number;
  lastCallSummary?: string;
  deployment?: DeploymentContext;
  compatibility?: DorianCompatibilityContext;
}) {
  const agentKey = input.deployment?.agentKey || '';
  const defaultInstruction = input.identityStatus === 'RESOLVED'
    ? 'Continue a general exploratory conversation. Use the supplied memory and identity context as background. Do not recite it verbatim or disclose private information unnecessarily.'
    : 'Continue a general exploratory conversation without assuming a participant identity. Ask naturally for any context you need.';

  return {
    // Compatibility contract for the existing Dorian ElevenLabs agent. These are projections of
    // Relish state, not a second source of truth. Empty strings are deliberate safe defaults.
    memory_and_identity_context: input.livingUnderstanding || '',
    call_instruction: input.compatibility?.callInstruction || defaultInstruction,
    call_type: input.compatibility?.callType || 'INBOUND_CALL',
    user_name: input.participantName || '',
    previous_calls: String(input.previousCalls ?? 0),
    user_id: input.stablePersonId || '',
    agent_id: input.compatibility?.providerAgentId || '',
    last_call_summary: input.lastCallSummary || '',
    emotion_label: '',
    agent_website: input.compatibility?.agentWebsite || '',
    agent_type: agentKey || input.deployment?.agentName || ''
  };
}

export async function buildElevenLabsInitiationData(
  scope: ConversationIdentityScope,
  hints: ElevenLabsIdentityHints,
  deployment?: DeploymentContext,
  compatibility?: DorianCompatibilityContext
) {
  const identity = await resolveElevenLabsIdentity(scope, hints);
  const legacyBlank = legacyDorianVariables({
    identityStatus: identity.status,
    deployment,
    compatibility
  });
  const blank = {
    type: 'conversation_initiation_client_data',
    dynamic_variables: {
      ...legacyBlank,
      relish_identity_status: identity.status,
      relish_identity_method: identity.method || '',
      relish_contact_id: '', relish_person_id: '', participant_name: '',
      relish_living_understanding: '', relish_living_understanding_revision: '',
      relish_agent_binding_id: deployment?.bindingId || '', relish_agent_definition_id: deployment?.agentDefinitionId || '',
      relish_agent_key: deployment?.agentKey || '', relish_agent_name: deployment?.agentName || '',
      relish_agent_environment: deployment?.environment || '', relish_agent_resolution_method: deployment?.method || '',
      relish_agent_resolution_warning: deployment?.warning || ''
    }
  };
  if (identity.status !== 'RESOLVED' || !identity.contactId) return { response: blank, identity };

  const contact = await prisma.contact.findFirst({
    where: { id: identity.contactId, userId: scope.userId, contextSpaceId: scope.contextSpaceId },
    select: { id: true, personId: true, fullNameEnc: true }
  });
  if (!contact) return { response: blank, identity: { ...identity, status: 'UNRESOLVED' as const, contactId: null, personId: null } };

  const [name, living, previousCalls, latestCall] = await Promise.all([
    contactDisplayName(contact),
    getCurrentLivingUnderstanding({ ...scope, contactId: contact.id }),
    prisma.interaction.count({
      where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: contact.id, channel: PERSON_CONVERSATION_SOURCE_CHANNEL }
    }),
    prisma.interaction.findFirst({
      where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: contact.id, channel: PERSON_CONVERSATION_SOURCE_CHANNEL },
      select: { summaryEnc: true },
      orderBy: { occurredAt: 'desc' }
    })
  ]);
  const topics = (living?.topics ?? []).slice(0, 16);
  const context = boundedText(topics.map(topic => `${topic.realm} / ${topic.topicName}: ${topic.understanding}`).join('\n'));
  const stablePersonId = contact.personId || contact.id;
  const legacy = legacyDorianVariables({
    identityStatus: 'RESOLVED',
    participantName: name,
    stablePersonId,
    livingUnderstanding: context,
    previousCalls,
    lastCallSummary: boundedText(decryptInteractionSummary(latestCall?.summaryEnc), 1600),
    deployment,
    compatibility
  });

  return {
    identity,
    response: {
      type: 'conversation_initiation_client_data',
      dynamic_variables: {
        ...legacy,
        relish_identity_status: 'RESOLVED',
        relish_identity_method: identity.method || '',
        relish_contact_id: contact.id,
        relish_person_id: contact.personId || '',
        participant_name: name,
        relish_living_understanding: context,
        relish_living_understanding_revision: living ? String(living.revisionNumber) : '',
        relish_agent_binding_id: deployment?.bindingId || '',
        relish_agent_definition_id: deployment?.agentDefinitionId || '',
        relish_agent_key: deployment?.agentKey || '',
        relish_agent_name: deployment?.agentName || '',
        relish_agent_environment: deployment?.environment || '',
        relish_agent_resolution_method: deployment?.method || '',
        relish_agent_resolution_warning: deployment?.warning || ''
      }
    }
  };
}

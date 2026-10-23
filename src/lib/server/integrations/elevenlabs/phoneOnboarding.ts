// Stage 8.15.4.7b: provisional caller custody for shared inbound Dorian calls.
// Caller ID permits a continuity hint; it NEVER authenticates an existing Google/Relish account.
// Caller ID never authenticates an existing registered account or another user's data.
// Within a private provisional phone identity, prior LU is available only with explicit
// RELISH_PHONE_LU_CONTEXT opt-in and cautious conversational name confirmation.
// Automatic learning is separately opt-in, with a durable per-caller gate.
import { randomBytes } from 'node:crypto';
import { prisma } from '$lib/db';
import { encrypt, decrypt, buildScopedIndexToken, buildIndexToken } from '$lib/crypto';
import { networkSessionHash } from './networkSession';
import { normalizePhoneForIdentity } from './phone';
import { ensureOwnedDomainContextSpace } from '$lib/server/core/contextSpaceDirectory';
import { PERSON_CONVERSATION_SOURCE_CHANNEL } from '$lib/server/core/conversationIngestion';
import { phoneAutomaticLearningEnabled } from '$lib/server/core/phoneUnderstandingAutomation';
import { runWithWorkspaceCustody } from '$lib/server/core/contextSpace';
import { getCurrentLivingUnderstanding } from '$lib/server/datingPersistedLivingUnderstanding';
import { decryptInteractionSummary } from '$lib/server/core/interactionEncryption';
import { resolvePhoneDefaultContext } from './phoneDefaultContext';

// Explicit pilot opt-in: a recognised phone number is a continuity signal, not verified identity.
const phoneLivingContextEnabled = () => process.env.RELISH_PHONE_LU_CONTEXT === 'YES';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const phoneIndex = (phone: string) => buildScopedIndexToken(phone, 'network:provisional-phone:v1');
const acceptedConversation = (id: unknown): id is string => typeof id === 'string' && /^conv_[a-zA-Z0-9_-]{8,100}$/.test(id);

// Stage 8.18: SMS inbound and voice inbound share the same provisional telephone identity.
// This creates no call credential, no owner access and never resolves registered identities.
export async function ensureProvisionalPhoneCaller(value: unknown, initialDomainKey: 'general' | 'business' | 'dating' = 'general') {
  const phone = normalizePhoneForIdentity(value);
  if (!phone) return null;
  const idx = phoneIndex(phone);
  // Never search User or existing Contact by caller ID; avoid claiming a registered user's identity.
  let caller = await prisma.networkPhoneCaller.findUnique({ where: { phoneIndex: idx } });
  if (!caller) {
    try {
      // Everything is created in one transaction. Concurrent first calls are recovered via unique phoneIndex.
      caller = await prisma.$transaction(async tx => {
        const user = await tx.user.create({ data: { person: { create: {} } }, select: { id: true, personId: true } });
        const space = await ensureOwnedDomainContextSpace(tx, {
          ownerUserId: user.id,
          domainKey: initialDomainKey,
          displayName: initialDomainKey === 'general' ? 'Friendship' : initialDomainKey === 'business' ? 'Business' : 'Dating'
        });
        // The first QR/SMS domain becomes this caller's initial, private workspace.
        const contact = await tx.contact.create({ data: {
          userId: user.id, contextSpaceId: space.id, linkedUserId: user.id, personId: user.personId,
          fullNameEnc: encrypt('Telephone caller', 'contact.full_name'),
          fullNameIdx: buildIndexToken('Telephone caller'),
          phoneEnc: encrypt(phone, 'contact.phone'), phoneIdx: buildIndexToken(phone), source: 'MANUAL'
        }, select: { id: true } });
        await tx.user.update({ where: { id: user.id }, data: { defaultContextSpaceId: space.id } });
        return tx.networkPhoneCaller.create({ data: {
          phoneIndex: idx, phoneEnc: encrypt(phone, 'network.phone'),
          userId: user.id, contextSpaceId: space.id, contactId: contact.id
        } });
      });
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error;
      caller = await prisma.networkPhoneCaller.findUnique({ where: { phoneIndex: idx } });
      if (!caller) throw error;
    }
  }
  return caller;
}

export async function startProvisionalPhoneCall(input: {
  callerId: unknown; conversationId: unknown; bindingId: string;
}) {
  const phone = normalizePhoneForIdentity(input.callerId);
  if (!phone || !acceptedConversation(input.conversationId)) return null;
  const caller = await ensureProvisionalPhoneCaller(phone);
  if (!caller) return null;
  // Stage 8.18b: select the verified participant-owned default, not the old fixed General row.
  // No owner workspace or unverified context can be substituted when validation fails.
  const selected = await resolvePhoneDefaultContext(caller);
  if (!selected) return null;
  const owner = await prisma.user.findUnique({ where: { id: caller.userId },
    select: { email_Idx: true, oauthAccounts: { select: { id: true }, take: 1 } } });
  if (!owner || owner.email_Idx || owner.oauthAccounts.length) return null;
  // An earlier QR/SMS conversation may still be awaiting the automatic LU worker.
  // Do not speak over unfinished understanding; use the existing processing greeting.
  if (phoneAutomaticLearningEnabled()) {
    const pendingPilot = await prisma.networkDorianSession.findFirst({ where: {
      userId: selected.userId, contextSpaceId: selected.contextSpaceId,
      pilotEntryId: { not: null },
      OR: [ { understandingOutcome: { in: ['QUEUED', 'WORKING'] } },
        { understandingOutcome: null, expiresAt: { gt: new Date() } } ]
    }, select: { id: true } });
    if (pendingPilot) return { status: 'WAIT' as const };
  }
  const existingSession = await prisma.networkDorianSession.findUnique({ where: { conversationId: input.conversationId } });
  if (existingSession) return null; // duplicate initiation must never mint another credential
  // A session initiation is not proof that a meaningful call completed. For greetings,
  // count ingested participant-owned conversation evidence instead of attempted calls.
  // Phone-number recognition is provisional; callers must confirm identity conversationally.
  // Read a provisional caller's preferred name only from their own verified workspace.
  // A Contact ID by itself is insufficient for Relish's fail-closed ContextSpace guard.
  const nameContact = await prisma.contact.findFirst({
    where: {
      id: selected.contactId,
      userId: selected.userId,
      contextSpaceId: selected.contextSpaceId,
      linkedUserId: caller.userId
    },
    select: { fullNameEnc: true }
  });
  let preferredName = '';
  try {
    const stored = nameContact?.fullNameEnc ? decrypt(nameContact.fullNameEnc, 'contact.full_name') : '';
    if (stored !== 'Telephone caller') preferredName = stored.slice(0, 80);
  } catch { /* Fail closed if encrypted display name cannot be read. */ }
  const previousCalls = await prisma.interaction.count({ where: {
    userId: selected.userId, contextSpaceId: selected.contextSpaceId,
    contactId: selected.contactId, channel: PERSON_CONVERSATION_SOURCE_CHANNEL
  } });
  // Read only the current authoritative understanding, and only within this provisional
  // participant's custody. Never consult the deployment owner's workspace or draft reviews.
  // A failed read must not issue a token with stale or incorrectly scoped context.
  // Keep short-term continuity distinct from longitudinal Living Understanding.
  // Only read completed, imported participant evidence in this caller's custody.
  let lastCallSummary = '';
  if (previousCalls > 0) {
    try {
      const latestSummarisedCall = await runWithWorkspaceCustody({
        userId: selected.userId, contextSpaceId: selected.contextSpaceId
      }, () => prisma.interaction.findFirst({
        where: {
          userId: selected.userId, contextSpaceId: selected.contextSpaceId,
          contactId: selected.contactId, channel: PERSON_CONVERSATION_SOURCE_CHANNEL,
          summaryEnc: { not: null }
        },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        select: { summaryEnc: true }
      }));
      // Use the established encryption helper, including legacy-AAD compatibility.
      // Never include unsummarised transcripts or encrypted payloads in prompts.
      lastCallSummary = decryptInteractionSummary(latestSummarisedCall?.summaryEnc).trim().slice(0, 1600);
    } catch {
      // A custody/database read failure should not silently deliver untrusted context.
      return { status: 'WAIT' as const, preferredName };
    }
  }
  let livingContext = '';
  let livingRevision = '';
  if (phoneLivingContextEnabled() && previousCalls > 0) {
    try {
      const living = await runWithWorkspaceCustody({
        userId: selected.userId, contextSpaceId: selected.contextSpaceId
      }, () => getCurrentLivingUnderstanding({
        userId: selected.userId, contextSpaceId: selected.contextSpaceId,
        contactId: selected.contactId
      }));
      if (living) {
        // Keep initiation payload bounded; source provenance remains in Relish, not in the prompt.
        livingContext = living.topics.slice(0, 12).map(topic =>
          `${topic.realm} / ${topic.topicName}: ${topic.understanding}`
        ).join('\n').slice(0, 6000);
        livingRevision = String(living.revisionNumber);
      }
    } catch {
      // Fail closed on an unexpected custody/decryption/database error.
      // The caller is not locked because no IN_CALL claim has been attempted yet.
      return { status: 'WAIT' as const, preferredName };
    }
  }
  const token = randomBytes(32).toString('base64url');
  try {
    // Row update is an atomic per-caller claim. Two simultaneous incoming calls cannot
    // both move READY -> IN_CALL. Only the winning request receives a session token.
    const claimed = phoneAutomaticLearningEnabled() ? await prisma.networkPhoneCaller.updateMany({
      where: { id: caller.id, understandingState: 'READY' },
      data: { understandingState: 'IN_CALL', understandingConversationId: input.conversationId,
        understandingStateAt: new Date() }
    }) : { count: 1 };
    if (claimed.count !== 1) return { status: 'WAIT' as const, preferredName };
    try {
      await prisma.networkDorianSession.create({ data: {
        tokenHash: networkSessionHash(token), userId: selected.userId,
        contextSpaceId: selected.contextSpaceId, contactId: selected.contactId,
        agentBindingId: input.bindingId, conversationId: input.conversationId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS)
      } });
    } catch (error) {
      // A failed session insert must never leave the participant locked unnecessarily.
      if (phoneAutomaticLearningEnabled()) await prisma.networkPhoneCaller.updateMany({
        where: { id: caller.id, understandingConversationId: input.conversationId, understandingState: 'IN_CALL' },
        data: { understandingState: 'READY', understandingConversationId: null, understandingStateAt: new Date() }
      });
      throw error;
    }
  } catch (error) {
    // Concurrent initiation for the same provider conversation can race after the
    // preceding findUnique. The database unique constraint is the final arbiter.
    // Never return a fresh token for a losing request or cause an avoidable 500.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return null;
    throw error;
  }
  return { status: 'READY' as const, token, previousCalls, preferredName, livingContext,
    livingRevision, lastCallSummary, domainKey: selected.domainKey };
}

export function provisionalPhoneInitiationResponse(input: {token: string; previousCalls: number; preferredName?: string; livingContext?: string; livingRevision?: string; lastCallSummary?: string; domainKey?: string}) {
  const returning = input.previousCalls > 0;
  return {
    type: 'conversation_initiation_client_data',
    dynamic_variables: {
      relish_network_session: input.token,
      relish_identity_status: 'PROVISIONAL_PHONE',
      call_type: 'INBOUND_PHONE',
      previous_calls: String(input.previousCalls),
      user_name: input.preferredName || '',
      last_call_summary: input.lastCallSummary || '',
      relish_active_context: input.domainKey || 'general',
      memory_and_identity_context: input.livingContext || '',
      living_understanding: input.livingContext || '',
      living_understanding_revision: input.livingRevision || '',
      // Development-pilot opt-in supplies bounded private LU to this phone continuity identity.
      // Caller ID does not authenticate the human: never use this for third-party disclosure.
      call_instruction: returning
        ? input.livingContext
          ? 'This is the participant’s private ' + (input.domainKey || 'general') + ' context. This telephone number has previous conversations. First confirm the caller\'s preferred name, if available. Use the provided Living Understanding naturally as background, not as a script. Do not recite or volunteer sensitive details or disclose them to others. Treat the understanding as provisional and welcome corrections. The caller can correct their name using save_preferred_name.'
          : 'This is the private ' + (input.domainKey || 'general') + ' context. A previous conversation was completed from this number. A preferred name is a provisional conversational preference, NOT authentication. If a name is available, check whether you are speaking to that person before using it further. Never disclose previous subjects or private memories. The caller can correct their name using the save_preferred_name tool.'
        : 'There is no completed conversation recorded for this number. Introduce Dorian, ask for a preferred name, and use the save_preferred_name tool when the caller gives it. Do not imply you know their identity.'
    },
    conversation_config_override: { agent: { first_message: returning
      ? 'Hi there, good to speak with you again. May I ask who is calling?'
      : "Hi there. This is Dorian Kreed, your AI conversation partner. How can I help you today?" } }
  };
}

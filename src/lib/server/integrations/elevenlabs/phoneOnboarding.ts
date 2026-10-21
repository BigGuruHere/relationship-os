// Stage 8.15.4.7b: provisional caller custody for shared inbound Dorian calls.
// Caller ID permits a continuity hint; it NEVER authenticates an existing Google/Relish account.
// No private account data or prior Living Understanding is sent to a phone-only caller.
import { randomBytes } from 'node:crypto';
import { prisma } from '$lib/db';
import { encrypt, decrypt, buildScopedIndexToken, buildIndexToken } from '$lib/crypto';
import { networkSessionHash } from './networkSession';
import { normalizePhoneForIdentity } from './phone';
import { ensureOwnedDomainContextSpace } from '$lib/server/core/contextSpaceDirectory';
import { PERSON_CONVERSATION_SOURCE_CHANNEL } from '$lib/server/core/conversationIngestion';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const phoneIndex = (phone: string) => buildScopedIndexToken(phone, 'network:provisional-phone:v1');
const acceptedConversation = (id: unknown): id is string => typeof id === 'string' && /^conv_[a-zA-Z0-9_-]{8,100}$/.test(id);

export async function startProvisionalPhoneCall(input: {
  callerId: unknown; conversationId: unknown; bindingId: string;
}) {
  const phone = normalizePhoneForIdentity(input.callerId);
  if (!phone || !acceptedConversation(input.conversationId)) return null;
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
          domainKey: 'general',
          displayName: 'General'
        });
        const contact = await tx.contact.create({ data: {
          userId: user.id, contextSpaceId: space.id, linkedUserId: user.id, personId: user.personId,
          fullNameEnc: encrypt('Telephone caller', 'contact.full_name'),
          fullNameIdx: buildIndexToken('Telephone caller'),
          phoneEnc: encrypt(phone, 'contact.phone'), phoneIdx: buildIndexToken(phone), source: 'MANUAL'
        }, select: { id: true } });
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
  // Verify mapping survived and remains isolated from an authenticated/merged account.
  const [space, contact, owner] = await Promise.all([
    prisma.contextSpace.findFirst({ where: { id: caller.contextSpaceId, ownerUserId: caller.userId, domainKey: 'general' }, select: { id: true } }),
    prisma.contact.findFirst({ where: { id: caller.contactId, userId: caller.userId, contextSpaceId: caller.contextSpaceId, linkedUserId: caller.userId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: caller.userId }, select: { email_Idx: true, oauthAccounts: { select: { id: true }, take: 1 } } })
  ]);
  if (!space || !contact || !owner || owner.email_Idx || owner.oauthAccounts.length) return null;
  const existingSession = await prisma.networkDorianSession.findUnique({ where: { conversationId: input.conversationId } });
  if (existingSession) return null; // duplicate initiation must never mint another credential
  // A session initiation is not proof that a meaningful call completed. For greetings,
  // count ingested participant-owned conversation evidence instead of attempted calls.
  // We intentionally do NOT retrieve prior text, names or private understanding from caller ID.
  // Read a provisional caller's preferred name only from their own verified workspace.
  // A Contact ID by itself is insufficient for Relish's fail-closed ContextSpace guard.
  const nameContact = await prisma.contact.findFirst({
    where: {
      id: caller.contactId,
      userId: caller.userId,
      contextSpaceId: caller.contextSpaceId,
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
    userId: caller.userId, contextSpaceId: caller.contextSpaceId,
    contactId: caller.contactId, channel: PERSON_CONVERSATION_SOURCE_CHANNEL
  } });
  const token = randomBytes(32).toString('base64url');
  try {
    await prisma.networkDorianSession.create({ data: {
      tokenHash: networkSessionHash(token), userId: caller.userId,
      contextSpaceId: caller.contextSpaceId, contactId: caller.contactId,
      agentBindingId: input.bindingId, conversationId: input.conversationId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    } });
  } catch (error) {
    // Concurrent initiation for the same provider conversation can race after the
    // preceding findUnique. The database unique constraint is the final arbiter.
    // Never return a fresh token for a losing request or cause an avoidable 500.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return null;
    throw error;
  }
  return { token, previousCalls, preferredName };
}

export function provisionalPhoneInitiationResponse(input: {token: string; previousCalls: number; preferredName?: string}) {
  const returning = input.previousCalls > 0;
  return {
    type: 'conversation_initiation_client_data',
    dynamic_variables: {
      relish_network_session: input.token,
      relish_identity_status: 'PROVISIONAL_PHONE',
      call_type: 'INBOUND_PHONE',
      previous_calls: String(input.previousCalls),
      user_name: input.preferredName || '',
      last_call_summary: '',
      memory_and_identity_context: '',
      // Continuity is limited to a non-sensitive completed-conversation count.
      // Caller ID is NOT authentication, so do not supply summaries or private memory.
      call_instruction: returning
        ? 'A previous conversation was completed from this number. A preferred name is a provisional conversational preference, NOT authentication. If a name is available, check whether you are speaking to that person before using it further. Never disclose previous subjects or private memories. The caller can correct their name using the save_preferred_name tool.'
        : 'There is no completed conversation recorded for this number. Introduce Dorian, ask for a preferred name, and use the save_preferred_name tool when the caller gives it. Do not imply you know their identity.'
    },
    conversation_config_override: { agent: { first_message: returning
      ? input.preferredName ? `Hello, welcome back to Dorian. Am I speaking with ${input.preferredName}?` : 'Hello, welcome back to Dorian. What would you like to talk about today?'
      : "Hello, I'm Dorian. What should I call you?" } }
  };
}

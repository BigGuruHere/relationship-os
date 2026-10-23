// PURPOSE: Resolve a shared Dorian agent's signed webhook into the actual participant's custody.
// SECURITY: Never accept contact/user/context ids from ElevenLabs dynamic variables as authority.
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { ensureNetworkSelfContact } from '$lib/server/core/networkSelfContact';
import { prepareNetworkDorianContext } from './networkPreparation';
import { runWithWorkspaceCustody } from '$lib/server/core/contextSpace';
import { pilotDomainForKind } from '$lib/server/pilot';

export const networkSessionHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function configuredSharedBindingId() {
  return String(process.env.RELISH_NETWORK_DORIAN_BINDING_ID || '').trim();
}
export async function startSharedNetworkSession(userId: string, contextSpaceId: string, pilot?: {
  pilotEntryId: string; domainKey: 'business' | 'general' | 'dating';
  profileName: string; profileKind: string;
}) {
  const bindingId = configuredSharedBindingId();
  if (!bindingId) return null;
  const binding = await prisma.agentProviderBinding.findFirst({
    where: { id: bindingId, provider: 'ELEVENLABS', isActive: true, providerAgentIdEnc: { not: null },
      validFrom: { lte: new Date() }, OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
      agentDefinition: { key: 'DORIAN' } },
    select: { id: true, providerAgentIdEnc: true }
  });
  if (!binding?.providerAgentIdEnc) return null;
  // SECURITY: The pilot entry, owner and domain are server-resolved and rechecked here.
  if (pilot) {
    const entry = await prisma.pilotProfileEntry.findFirst({ where: {
      id: pilot.pilotEntryId, visitorUserId: userId, domainKey: pilot.domainKey
    }, include: { profile: { select: { kind: true, isPublished: true } } } });
    if (!entry?.profile.isPublished || pilotDomainForKind(entry.profile.kind) !== pilot.domainKey) return null;
  }
  const domainKey = pilot?.domainKey || 'general';
  if (pilot && process.env.RELISH_PHONE_AUTO_LU === 'YES') {
    // Avoid racing two automatic LU revisions of the same participant's private context.
    const pending = await prisma.networkDorianSession.findFirst({ where: {
      userId, contextSpaceId, pilotEntryId: { not: null },
      OR: [ { understandingOutcome: { in: ['QUEUED', 'WORKING'] } },
        { understandingOutcome: null, expiresAt: { gt: new Date() } } ]
    }, select: { id: true } });
    if (pending) return { status: 'UNDERSTANDING_PENDING' as const };
  }
  const verifiedSpace = await prisma.contextSpace.findFirst({ where: {
    id: contextSpaceId, ownerUserId: userId, domainKey
  }, select: { id: true } });
  if (!verifiedSpace) return null;
  // Resolve/create a workspace-local compatibility contact for the authenticated identity.
  // Failure remains closed: never issue a session against an unverified identity.
  let selfContactId: string;
  try {
    selfContactId = await runWithWorkspaceCustody({ userId, contextSpaceId }, async () => {
      if (domainKey === 'general') return ensureNetworkSelfContact({ userId, contextSpaceId });
      // Other domains use the same canonical Person but independent self-contacts and custody.
      const { ensurePilotSelfContact } = await import('$lib/server/pilot');
      const own = await ensurePilotSelfContact(userId, domainKey);
      if (own.contextSpaceId !== contextSpaceId) throw new Error('Pilot ContextSpace mismatch.');
      return own.contactId;
    });
  } catch {
    return { status: 'NO_SELF_IDENTITY' as const };
  }
  // Prepare the legacy-compatible voice context within the participant's verified custody.
  // An unavailable context is an explicit failure, never a fallback to the binding owner.
  const participantContext = await runWithWorkspaceCustody({ userId, contextSpaceId }, () =>
    prepareNetworkDorianContext({ userId, contextSpaceId, contactId: selfContactId }));
  // Only the public name and kind may enter the context-specific prompt, never owner LU.
  const pilotInstruction = pilot ? `This is a ${pilot.profileKind === 'personal' ? 'friendship' : pilot.profileKind} introduction arising from a public profile. Have an exploratory, natural conversation about what matters to the participant and whether they wish to get to know ${pilot.profileName.slice(0, 90) || 'the owner'} better. The owner cannot read this conversation. Never imply that a mutual connection or information-sharing permission exists.` : '';
  const token = randomBytes(32).toString('base64url');
  const session = await prisma.networkDorianSession.create({ data: {
    tokenHash: networkSessionHash(token), userId, contextSpaceId, contactId: selfContactId,
    agentBindingId: binding.id, pilotEntryId: pilot?.pilotEntryId || null, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
  }});
  return {
    status: 'READY' as const,
    sessionId: session.id,
    agentId: decrypt(binding.providerAgentIdEnc, 'agentProviderBinding.providerAgentId'),
    dynamicVariables: JSON.stringify({
      ...participantContext,
      ...(pilot ? { call_instruction: pilotInstruction, relish_profile_context: pilot.profileKind } : {}),
      relish_network_session: token,
      call_type: 'NETWORK_PARTICIPANT_BROWSER',
      agent_id: decrypt(binding.providerAgentIdEnc, 'agentProviderBinding.providerAgentId'),
      // Legacy user_id is a compatibility hint only. Webhook custody exclusively uses the session token.
      // Legacy tools that accept user_id must stay disabled until session-authorised tool endpoints exist.
      user_id: userId
    })
  };
}

export async function resolveSharedNetworkSession(input: {
  bindingId: string; conversationId: string; agentId: string; sessionToken: unknown;
}) {
  if (!configuredSharedBindingId() || input.bindingId !== configuredSharedBindingId()) return null;
  // A session cannot be claimed by an empty or malformed provider conversation ID.
  if (typeof input.conversationId !== 'string' || !input.conversationId.trim() || input.conversationId.length > 240) return null;
  const token = typeof input.sessionToken === 'string' ? input.sessionToken : '';
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null;
  const session = await prisma.networkDorianSession.findUnique({ where: { tokenHash: networkSessionHash(token) } });
  if (!session || session.agentBindingId !== input.bindingId || session.expiresAt < new Date()) return null;
  // Idempotent retry for the same provider conversation, never reuse for a different one.
  if (session.conversationId && session.conversationId !== input.conversationId) return null;
  if (!session.conversationId) {
    const claimed = await prisma.networkDorianSession.updateMany({
      where: { id: session.id, conversationId: null }, data: { conversationId: input.conversationId }
    });
    if (claimed.count !== 1) {
      const fresh = await prisma.networkDorianSession.findUnique({ where: { id: session.id } });
      if (fresh?.conversationId !== input.conversationId) return null;
    }
  }
  // Stage 8.18b: a no-entry telephone session may use its caller's selected
  // private default ContextSpace. Browser-only Network sessions remain General.
  // An agent-supplied context/phone number NEVER controls this lookup.
  const entry = session.pilotEntryId ? await prisma.pilotProfileEntry.findFirst({
    where: { id: session.pilotEntryId, visitorUserId: session.userId },
    include: { profile: { select: { kind: true } } }
  }) : null;
  if (session.pilotEntryId && (!entry || pilotDomainForKind(entry.profile.kind) !== entry.domainKey)) return null;
  const [space, contact] = await Promise.all([
    prisma.contextSpace.findFirst({ where: { id: session.contextSpaceId, ownerUserId: session.userId },
      select: { id: true, domainKey: true } }),
    prisma.contact.findFirst({ where: { id: session.contactId, userId: session.userId,
      contextSpaceId: session.contextSpaceId, linkedUserId: session.userId }, select: { id: true } })
  ]);
  if (!space || !contact || (entry && entry.domainKey !== space.domainKey)) return null;
  if (!entry && space.domainKey !== 'general') {
    const caller = await prisma.networkPhoneCaller.findFirst({ where: { userId: session.userId },
      select: { id: true } });
    // The token was issued for this exact ContextSpace and contact. A subsequently
    // changed default does not invalidate the custody of an in-flight conversation.
    if (!caller) return null;
  }
  const domainKey = space.domainKey;
  return { userId: session.userId, contextSpaceId: session.contextSpaceId, contactId: contact.id,
    domainKey, pilotEntryId: entry?.id || null, sessionId: session.id };
}

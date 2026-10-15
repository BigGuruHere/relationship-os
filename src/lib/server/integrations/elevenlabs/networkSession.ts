// PURPOSE: Resolve a shared Dorian agent's signed webhook into the actual participant's custody.
// SECURITY: Never accept contact/user/context ids from ElevenLabs dynamic variables as authority.
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';

export const networkSessionHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function configuredSharedBindingId() {
  return String(process.env.RELISH_NETWORK_DORIAN_BINDING_ID || '').trim();
}
export async function startSharedNetworkSession(userId: string, contextSpaceId: string) {
  const bindingId = configuredSharedBindingId();
  if (!bindingId) return null;
  const binding = await prisma.agentProviderBinding.findFirst({
    where: { id: bindingId, provider: 'ELEVENLABS', isActive: true, providerAgentIdEnc: { not: null },
      validFrom: { lte: new Date() }, OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
      agentDefinition: { key: 'DORIAN' } },
    select: { id: true, providerAgentIdEnc: true }
  });
  if (!binding?.providerAgentIdEnc) return null;
  const contacts = await prisma.contact.findMany({
    where: { userId, contextSpaceId, linkedUserId: userId }, select: { id: true }, take: 2
  });
  if (contacts.length !== 1) return { status: 'NO_SELF_IDENTITY' as const };
  const token = randomBytes(32).toString('base64url');
  await prisma.networkDorianSession.create({ data: {
    tokenHash: networkSessionHash(token), userId, contextSpaceId, contactId: contacts[0].id,
    agentBindingId: binding.id, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
  }});
  return {
    status: 'READY' as const,
    agentId: decrypt(binding.providerAgentIdEnc, 'agentProviderBinding.providerAgentId'),
    dynamicVariables: JSON.stringify({ relish_network_session: token,
      call_type: 'NETWORK_PARTICIPANT_BROWSER',
      call_instruction: 'Explore what matters to this participant. Do not presume permission to share personal information.' })
  };
}

export async function resolveSharedNetworkSession(input: {
  bindingId: string; conversationId: string; agentId: string; sessionToken: unknown;
}) {
  if (!configuredSharedBindingId() || input.bindingId !== configuredSharedBindingId()) return null;
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
  const [space, contact] = await Promise.all([
    prisma.contextSpace.findFirst({ where: { id: session.contextSpaceId, ownerUserId: session.userId, domainKey: 'general' }, select: { id: true } }),
    prisma.contact.findFirst({ where: { id: session.contactId, userId: session.userId,
      contextSpaceId: session.contextSpaceId, linkedUserId: session.userId }, select: { id: true } })
  ]);
  if (!space || !contact) return null;
  return { userId: session.userId, contextSpaceId: session.contextSpaceId, contactId: contact.id };
}

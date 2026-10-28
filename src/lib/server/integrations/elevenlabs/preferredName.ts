// Stage 8.15.4.7e: Session-authorised provisional preferred-name capture.
// SECURITY: A phone number is not authentication, and the provider cannot select a target contact.
import { prisma } from '$lib/db';
import { encrypt, buildIndexToken } from '$lib/crypto';
import { networkSessionHash, activeSharedDorianBindingId } from './networkSession';
import { conversationalPolicyEnabled, callerHasAcceptedCurrentTerms } from '$lib/server/core/relishCallPolicy';

export function normalizePreferredName(value: unknown) {
  if (typeof value !== 'string') return null;
  const name = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  // Reject controls, markup and names too long for an agent-facing greeting.
  if (name.length < 1 || name.length > 80 || !/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(name)) return null;
  if (name.toLowerCase() === 'telephone caller') return null;
  return name;
}

export async function saveProvisionalPreferredName(input: {
  sessionToken: unknown; conversationId: unknown; preferredName: unknown;
}) {
  const name = normalizePreferredName(input.preferredName);
  if (!name) return { status: 'INVALID_NAME' as const };
  const token = typeof input.sessionToken === 'string' ? input.sessionToken : '';
  const conversationId = typeof input.conversationId === 'string' ? input.conversationId : '';
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token) || !/^conv_[A-Za-z0-9_-]{8,100}$/.test(conversationId)) {
    return { status: 'UNAUTHORISED' as const };
  }
  const bindingId = await activeSharedDorianBindingId();
  if (!bindingId) return { status: 'UNAUTHORISED' as const };
  const session = await prisma.networkDorianSession.findUnique({ where: { tokenHash: networkSessionHash(token) } });
  if (!session || session.conversationId !== conversationId || session.agentBindingId !== bindingId || session.expiresAt <= new Date()) {
    return { status: 'UNAUTHORISED' as const };
  }
  // Don't persist new personal details from the conversation before voice consent.
  if (conversationalPolicyEnabled() && !(await callerHasAcceptedCurrentTerms(session.userId))) {
    return { status: 'POLICY_REQUIRED' as const };
  }
  // All calls use their issued server-owned session as authority. A caller's
  // default may be Business or Dating even when no fresh QR invitation was used.
  const caller = await prisma.networkPhoneCaller.findFirst({ where: { userId: session.userId },
    select: { id: true, contextSpaceId: true, contactId: true } });
  if (!caller) return { status: 'UNAUTHORISED' as const };
  if (!session.pilotEntryId) {
    // A direct call can save a name only to the currently configured default.
    const space = await prisma.contextSpace.findFirst({ where: {
      id: session.contextSpaceId, ownerUserId: session.userId
    }, select: { id: true } });
    if (!space) return { status: 'UNAUTHORISED' as const };
  }
  if (session.pilotEntryId) {
    const entry = await prisma.pilotProfileEntry.findFirst({ where: {
      id: session.pilotEntryId, visitorUserId: session.userId
    }, select: { domainKey: true } });
    if (!entry) return { status: 'UNAUTHORISED' as const };
    const workspace = await prisma.contextSpace.findFirst({ where: {
      id: session.contextSpaceId, ownerUserId: session.userId, domainKey: entry.domainKey
    }, select: { id: true } });
    if (!workspace) return { status: 'UNAUTHORISED' as const };
  }
  const updated = await prisma.contact.updateMany({
    where: { id: session.contactId, userId: session.userId,
      contextSpaceId: session.contextSpaceId, linkedUserId: session.userId },
    data: { fullNameEnc: encrypt(name, 'contact.full_name'), fullNameIdx: buildIndexToken(name) }
  });
  return updated.count === 1 ? { status: 'SAVED' as const, preferredName: name } : { status: 'UNAUTHORISED' as const };
}

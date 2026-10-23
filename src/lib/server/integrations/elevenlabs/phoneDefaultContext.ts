// Stage 8.18b: choose a participant's default conversation custody, not a global General bucket.
// SECURITY: A phone number is only a provisional continuity hint. Every selected ContextSpace
// and self-contact is independently checked against this phone-only User and canonical Person.
import { prisma } from '$lib/db';
import { PERSON_CONVERSATION_SOURCE_CHANNEL } from '$lib/server/core/conversationIngestion';
import { ensurePilotSelfContact } from '$lib/server/pilot';

export type ProvisionalPhoneCaller = {
  id: string; userId: string; contextSpaceId: string; contactId: string;
};

type PhoneScope = { userId: string; contextSpaceId: string; contactId: string; domainKey: string };
const supportedPilotDomains = new Set(['general', 'business', 'dating']);

async function verifiedPhoneScope(caller: ProvisionalPhoneCaller, contextSpaceId: string,
  existingContactId?: string): Promise<PhoneScope | null> {
  const [user, space] = await Promise.all([
    prisma.user.findUnique({ where: { id: caller.userId }, select: { personId: true } }),
    prisma.contextSpace.findFirst({ where: { id: contextSpaceId, ownerUserId: caller.userId },
      select: { id: true, domainKey: true } })
  ]);
  if (!user?.personId || !space) return null;
  // Other domain keys remain supported by the schema, but their conversation ingestion
  // and privacy policy must be implemented before enabling telephone continuity for them.
  if (!supportedPilotDomains.has(space.domainKey)) return null;
  const contacts = await prisma.contact.findMany({ where: {
    userId: caller.userId, contextSpaceId: space.id, linkedUserId: caller.userId
  }, select: { id: true, personId: true }, take: 2 });
  if (contacts.length > 1 || (contacts[0]?.personId && contacts[0].personId !== user.personId)) return null;
  let contactId = contacts[0]?.id;
  if (!contactId || !contacts[0]?.personId) {
    // Creates a private self-contact only; does not copy information from another context.
    const own = await ensurePilotSelfContact(caller.userId, space.domainKey as 'general'|'business'|'dating');
    if (own.contextSpaceId !== space.id) return null;
    contactId = own.contactId;
  }
  // The legacy phone row's contact is authoritative only inside its original space.
  if (existingContactId && contextSpaceId === caller.contextSpaceId && contactId !== existingContactId) return null;
  return { userId: caller.userId, contextSpaceId: space.id, contactId, domainKey: space.domainKey };
}

async function earliestInvitedContext(caller: ProvisionalPhoneCaller): Promise<string | null> {
  // A completed/started provider conversation with a verified pilot entry is stronger
  // evidence of the initial pilot context than the old unused General placeholder.
  const first = await prisma.networkDorianSession.findFirst({ where: {
    userId: caller.userId, pilotEntryId: { not: null }, conversationId: { not: null }
  }, orderBy: { createdAt: 'asc' }, select: { contextSpaceId: true, pilotEntryId: true } });
  if (!first?.pilotEntryId) return null;
  const entry = await prisma.pilotProfileEntry.findFirst({ where: {
    id: first.pilotEntryId, visitorUserId: caller.userId
  }, select: { domainKey: true } });
  const space = await prisma.contextSpace.findFirst({ where: {
    id: first.contextSpaceId, ownerUserId: caller.userId, domainKey: entry?.domainKey || '__none__'
  }, select: { id: true } });
  return space?.id || null;
}

async function initialDefaultId(caller: ProvisionalPhoneCaller, invitationSpaceId?: string) {
  const legacyCalls = await prisma.interaction.count({ where: {
    userId: caller.userId, contextSpaceId: caller.contextSpaceId, contactId: caller.contactId,
    channel: PERSON_CONVERSATION_SOURCE_CHANNEL
  } });
  // Existing direct-phone callers keep the General understanding they already accumulated.
  if (legacyCalls > 0) return caller.contextSpaceId;
  return (await earliestInvitedContext(caller)) || invitationSpaceId || caller.contextSpaceId;
}

export async function establishPhoneDefaultFromInvitation(
  caller: ProvisionalPhoneCaller, invitationSpaceId: string
) {
  const user = await prisma.user.findUnique({ where: { id: caller.userId },
    select: { defaultContextSpaceId: true } });
  if (!user) return null;
  // New invitations never override an already selected default.
  if (user.defaultContextSpaceId) return verifiedPhoneScope(caller, user.defaultContextSpaceId);
  const chosenId = await initialDefaultId(caller, invitationSpaceId);
  const verified = await verifiedPhoneScope(caller, chosenId);
  if (!verified) return null;
  await prisma.user.updateMany({ where: { id: caller.userId, defaultContextSpaceId: null },
    data: { defaultContextSpaceId: verified.contextSpaceId } });
  return verified;
}

export async function resolvePhoneDefaultContext(caller: ProvisionalPhoneCaller): Promise<PhoneScope | null> {
  const user = await prisma.user.findUnique({ where: { id: caller.userId },
    select: { defaultContextSpaceId: true } });
  if (!user) return null;
  if (user.defaultContextSpaceId) return verifiedPhoneScope(caller, user.defaultContextSpaceId,
    user.defaultContextSpaceId === caller.contextSpaceId ? caller.contactId : undefined);
  const chosenId = await initialDefaultId(caller);
  const verified = await verifiedPhoneScope(caller, chosenId,
    chosenId === caller.contextSpaceId ? caller.contactId : undefined);
  if (!verified) return null;
  // Lazy, additive upgrade of old rows, including successful Stage 8.18 QR callbacks.
  await prisma.user.updateMany({ where: { id: caller.userId, defaultContextSpaceId: null },
    data: { defaultContextSpaceId: verified.contextSpaceId } });
  return verified;
}

// Invoked only by an authenticated owner's server action, never by a caller-ID hint.
export async function setOwnedDefaultContextSpace(userId: string, contextSpaceId: string) {
  const owned = await prisma.contextSpace.findFirst({ where: { id: contextSpaceId, ownerUserId: userId },
    select: { id: true } });
  if (!owned) return false;
  await prisma.user.update({ where: { id: userId }, data: { defaultContextSpaceId: owned.id } });
  return true;
}

// PURPOSE: Minimal ContextSpace-local participant identities for relationship applications.
// SECURITY: Every operation is scoped by owner + ContextSpace, with the expected route domain rechecked server-side.

import { prisma } from '$lib/db';
import { buildIndexToken, encrypt, decrypt } from '$lib/crypto';
import { normalizePhoneForIdentity } from '$lib/server/integrations/elevenlabs/phone';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { PERSON_CONVERSATION_SOURCE_CHANNEL } from '$lib/server/core/conversationIngestion';

const AAD = 'interaction.raw_text';

type Scope = { userId: string; contextSpaceId: string };

async function requireOwnedDomainSpace(scope: Scope, domainKey: string) {
  const space = await prisma.contextSpace.findFirst({
    where: { id: scope.contextSpaceId, ownerUserId: scope.userId, domainKey },
    select: { id: true }
  });
  if (!space) throw new Error(`An owned ${domainKey} ContextSpace is required.`);
}

export async function listContextPeople(scope: Scope, domainKey: string) {
  await requireOwnedDomainSpace(scope, domainKey);
  const rows = await prisma.contact.findMany({
    where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId },
    select: { id: true, fullNameEnc: true, phoneEnc: true, linkedUserId: true, createdAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 500
  });
  return Promise.all(rows.map(async row => ({
    id: row.id,
    name: await contactDisplayName(row),
    phone: row.phoneEnc ? decrypt(row.phoneEnc, 'contact.phone') : '',
    createdAt: row.createdAt
  })));
}

export async function createContextPerson(scope: Scope, domainKey: string, rawName: unknown, rawPhone: unknown = '') {
  await requireOwnedDomainSpace(scope, domainKey);
  const name = String(rawName ?? '').trim();
  if (!name) throw new Error('Name is required.');
  if (name.length > 200) throw new Error('Name is too long.');
  const phone = rawPhone ? normalizePhoneForIdentity(rawPhone) : null;
  if (String(rawPhone ?? '').trim() && !phone) throw new Error('Enter a valid phone number.');
  const existing = await prisma.contact.findFirst({
    where: {
      userId: scope.userId,
      contextSpaceId: scope.contextSpaceId,
      fullNameIdx: buildIndexToken(name)
    },
    select: { id: true }
  });
  if (existing) throw new Error('A person with this name already exists in this ContextSpace.');
  return prisma.contact.create({
    data: {
      userId: scope.userId,
      contextSpaceId: scope.contextSpaceId,
      fullNameEnc: encrypt(name, 'contact.full_name'),
      fullNameIdx: buildIndexToken(name),
      phoneEnc: phone ? encrypt(phone, 'contact.phone') : null,
      phoneIdx: phone ? buildIndexToken(phone) : null,
      source: 'MANUAL'
    },
    select: { id: true }
  });
}

export async function loadConversationParticipant(scope: Scope & { contactId: string }, domainKey: string) {
  await requireOwnedDomainSpace(scope, domainKey);
  const contact = await prisma.contact.findFirst({
    where: { id: scope.contactId, userId: scope.userId, contextSpaceId: scope.contextSpaceId },
    select: { id: true, fullNameEnc: true, phoneEnc: true }
  });
  if (!contact) throw new Error('Person is not accessible in this ContextSpace.');
  const rows = await prisma.interaction.findMany({
    where: {
      userId: scope.userId,
      contextSpaceId: scope.contextSpaceId,
      contactId: scope.contactId,
      channel: PERSON_CONVERSATION_SOURCE_CHANNEL
    },
    select: { id: true, occurredAt: true, rawTextEnc: true },
    orderBy: { occurredAt: 'desc' },
    take: 100
  });
  const sources = rows.map(row => {
    const payload = JSON.parse(decrypt(row.rawTextEnc, AAD)) as any;
    if (payload?.kind !== 'CONVERSATION_EXCERPT' || payload?.actor !== 'OPERATOR') {
      throw new Error('Invalid conversation source data.');
    }
    return {
      id: row.id,
      at: row.occurredAt,
      text: String(payload.text || ''),
      speaker: String(payload.speaker || ''),
      provider: String(payload.provider || ''),
      sourceTurnIds: Array.isArray(payload.sourceTurnIds) ? payload.sourceTurnIds.map(String) : []
    };
  });
  return { person: { id: contact.id, name: await contactDisplayName(contact), phone: contact.phoneEnc ? decrypt(contact.phoneEnc, 'contact.phone') : '' }, sources };
}


export async function updateContextPersonPhone(scope: Scope & { contactId: string }, domainKey: string, rawPhone: unknown) {
  await requireOwnedDomainSpace(scope, domainKey);
  const text = String(rawPhone ?? '').trim();
  const phone = text ? normalizePhoneForIdentity(text) : null;
  if (text && !phone) throw new Error('Enter a valid phone number.');
  const contact = await prisma.contact.findFirst({
    where: { id: scope.contactId, userId: scope.userId, contextSpaceId: scope.contextSpaceId },
    select: { id: true }
  });
  if (!contact) throw new Error('Person is not accessible in this ContextSpace.');
  if (phone) {
    const duplicate = await prisma.contact.findFirst({
      where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, phoneIdx: buildIndexToken(phone), NOT: { id: scope.contactId } },
      select: { id: true }
    });
    if (duplicate) throw new Error('That phone number is already assigned to another person in this ContextSpace.');
  }
  await prisma.contact.update({
    where: { id: scope.contactId },
    data: { phoneEnc: phone ? encrypt(phone, 'contact.phone') : null, phoneIdx: phone ? buildIndexToken(phone) : null }
  });
  return { phone: phone || '' };
}

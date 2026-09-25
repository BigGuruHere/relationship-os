// Stage 8.12.1: minimal Relating foundation, deliberately without group UI or sharing APIs.
// SECURITY: Every ID is resolved inside the active owner+ContextSpace before mutation.
import { prisma } from '$lib/db';
import { currentWorkspaceCustody } from '$lib/server/core/contextSpace';
import { encrypt } from '$lib/crypto';

export type RelatingScope = { userId: string; contextSpaceId: string };
export type ParticipantIdentity = { contactId?: string | null; companyId?: string | null };

function requireScope(scope: RelatingScope) {
  const active = currentWorkspaceCustody();
  if (!active || active.userId !== scope.userId || active.contextSpaceId !== scope.contextSpaceId) {
    throw new Error('Relating requires active matching workspace custody.');
  }
  return scope;
}

async function assertMembers(scope: RelatingScope, people: ParticipantIdentity[]) {
  if (!people.length) throw new Error('At least one participant is required.');
  const distinct = new Set<string>();
  for (const person of people) {
    const contactId = person.contactId?.trim() || null;
    const companyId = person.companyId?.trim() || null;
    if (!contactId && !companyId) throw new Error('A participant needs a Contact or Company.');
    const key = `${contactId ?? ''}:${companyId ?? ''}`;
    if (distinct.has(key)) throw new Error('Duplicate participants are not permitted in one request.');
    distinct.add(key);
    if (contactId && !(await prisma.contact.findFirst({ where: { id: contactId, ...scope }, select: { id: true } }))) {
      throw new Error('Contact is not accessible in this context.');
    }
    if (companyId && !(await prisma.company.findFirst({ where: { id: companyId, ...scope }, select: { id: true } }))) {
      throw new Error('Company is not accessible in this context.');
    }
  }
}

// A private administrative history may be created even before a mutual relationship exists.
export async function createRelating(scope: RelatingScope, participants: ParticipantIdentity[], origin = 'MANUAL') {
  requireScope(scope);
  await assertMembers(scope, participants);
  if (!/^[A-Z_]{1,64}$/.test(origin)) throw new Error('Invalid Relating origin.');
  return prisma.$transaction(async (tx) => {
    const relating = await tx.relating.create({ data: { ...scope, origin }, select: { id: true } });
    await tx.relatingParticipant.createMany({
      data: participants.map(p => ({ ...scope, relatingId: relating.id, contactId: p.contactId || null, companyId: p.companyId || null }))
    });
    return relating.id;
  });
}

export async function createTouchpoint(scope: RelatingScope, input: {
  relatingId?: string | null;
  kind: string;
  occurredAt?: Date;
  note?: string;
  // Group membership differs from event attendance. A guest uses direct identity.
  attendees: Array<ParticipantIdentity & { relatingParticipantId?: string | null }>;
}) {
  requireScope(scope);
  const kind = input.kind.trim();
  if (!kind || kind.length > 64) throw new Error('A touchpoint needs a kind of at most 64 characters.');
  if (input.attendees.length === 0) throw new Error('A touchpoint needs at least one attendee.');
  const relatingId = input.relatingId || null;
  if (relatingId && !(await prisma.relating.findFirst({ where: { id: relatingId, ...scope }, select: { id: true } }))) {
    throw new Error('Relating history is not accessible in this context.');
  }
  const direct = input.attendees.filter(p => !p.relatingParticipantId);
  if (direct.length) await assertMembers(scope, direct);
  const groupMemberIds = input.attendees.map(p => p.relatingParticipantId).filter((id): id is string => Boolean(id));
  if (groupMemberIds.length !== new Set(groupMemberIds).size) throw new Error('An attendee cannot appear twice.');
  if (groupMemberIds.length && !relatingId) throw new Error('Group attendance requires a Relating history.');
  if (groupMemberIds.length) {
    const members = await prisma.relatingParticipant.findMany({
      where: { ...scope, relatingId: relatingId!, id: { in: groupMemberIds }, leftAt: null }, select: { id: true }
    });
    if (members.length !== groupMemberIds.length) throw new Error('An attendee is not an active member of this Relating history.');
  }
  for (const p of input.attendees) {
    if (p.relatingParticipantId && (p.contactId || p.companyId)) {
      throw new Error('Supply a member OR a direct attendee identity, not both.');
    }
  }
  return prisma.$transaction(async (tx) => {
    const event = await tx.touchpoint.create({ data: {
      ...scope, relatingId, kind, occurredAt: input.occurredAt || new Date(),
      notesEnc: input.note?.trim() ? encrypt(input.note.trim(), 'touchpoint.notes') : null
    }, select: { id: true } });
    await tx.touchpointParticipant.createMany({
      data: input.attendees.map(p => ({ ...scope, touchpointId: event.id, relatingParticipantId: p.relatingParticipantId || null,
        contactId: p.relatingParticipantId ? null : p.contactId || null,
        companyId: p.relatingParticipantId ? null : p.companyId || null }))
    });
    return event.id;
  });
}

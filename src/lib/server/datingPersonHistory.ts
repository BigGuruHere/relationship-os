// Stage 8.12.2: A person's private history exists without an introduction or even a touchpoint.
// The pilot uses custody-local Contact representations; this does not merge canonical Person data across spaces.
import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/db';
import { encrypt, decrypt } from '$lib/crypto';
import { contactDisplayName } from '$lib/server/contactDisplay';
import { createTouchpoint } from '$lib/server/relating';

export type HistoryScope = { userId: string; contextSpaceId: string; contactId: string };
const PERSONAL_CHANNEL = 'DATING_PERSON_REFLECTION';
const AAD = 'interaction.raw_text';

type ReflectionPayload = { version: 1; kind: 'PERSONAL_REFLECTION'; text: string; touchpointId: string | null; actor: 'OPERATOR' };

export async function requireDatingHistoryContact(scope: HistoryScope) {
  const [space, contact] = await Promise.all([
    prisma.contextSpace.findFirst({ where: { id: scope.contextSpaceId, ownerUserId: scope.userId, domainKey: 'dating' }, select: { id: true } }),
    prisma.contact.findFirst({ where: { id: scope.contactId, userId: scope.userId, contextSpaceId: scope.contextSpaceId }, select: { id: true, fullNameEnc: true } })
  ]);
  if (!space || !contact) throw new Error('Person is not accessible in this Dating space.');
  return contact;
}

// A touchpoint attendee can be a direct Contact or a group member referencing that Contact.
export async function assertAttendedTouchpoint(scope: HistoryScope, touchpointId: string) {
  const event = await prisma.touchpoint.findFirst({ where: {
    id: touchpointId, userId: scope.userId, contextSpaceId: scope.contextSpaceId,
    participants: { some: { userId: scope.userId, contextSpaceId: scope.contextSpaceId,
      OR: [{ contactId: scope.contactId }, { relatingParticipant: { contactId: scope.contactId, userId: scope.userId, contextSpaceId: scope.contextSpaceId } }] } }
  }, select: { id: true } });
  if (!event) throw new Error('This person did not attend an accessible touchpoint.');
  return event.id;
}

export async function createPersonReflection(scope: HistoryScope, input: { text: string; touchpointId?: string | null }) {
  await requireDatingHistoryContact(scope);
  const text = String(input.text ?? '').trim();
  if (!text || text.length > 5000) throw new Error('Write a reflection of 1 to 5000 characters.');
  const touchpointId = input.touchpointId || null;
  if (touchpointId) await assertAttendedTouchpoint(scope, touchpointId);
  const payload: ReflectionPayload = { version: 1, kind: 'PERSONAL_REFLECTION', text, touchpointId, actor: 'OPERATOR' };
  return prisma.interaction.create({ data: {
    userId: scope.userId, contextSpaceId: scope.contextSpaceId, contactId: scope.contactId,
    channel: PERSONAL_CHANNEL, sourceType: 'WORKSPACE',
    externalRef: `dating:personal-reflection:${randomUUID()}`,
    rawTextEnc: encrypt(JSON.stringify(payload), AAD)
  }, select: { id: true } });
}

export async function createPersonTouchpoint(scope: HistoryScope, input: { kind: string; occurredAt?: string; note?: string; attendeeIds: string[]; relatingId?: string | null }) {
  await requireDatingHistoryContact(scope);
  const uniqueIds = [...new Set(input.attendeeIds)];
  if (!uniqueIds.includes(scope.contactId)) throw new Error('The person must attend their own touchpoint.');
  if (!uniqueIds.length || uniqueIds.length > 30) throw new Error('Choose 1 to 30 attendees for this pilot.');
  // No positional A/B limit in the underlying Relating or Touchpoint schema.
  // An owned group alone is not enough: this person's history must actually belong to it.
  if (input.relatingId && !(await prisma.relatingParticipant.findFirst({
    where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, relatingId: input.relatingId, contactId: scope.contactId, leftAt: null },
    select: { id: true }
  }))) throw new Error('This person is not a member of that Relating history.');
  const date = input.occurredAt ? new Date(input.occurredAt) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('Enter a valid encounter date.');
  const id = await createTouchpoint({ userId: scope.userId, contextSpaceId: scope.contextSpaceId }, {
    relatingId: input.relatingId || null, kind: input.kind, occurredAt: date, note: input.note,
    attendees: uniqueIds.map(contactId => ({ contactId }))
  });
  return id;
}

export async function loadPersonHistory(scope: HistoryScope) {
  const person = await requireDatingHistoryContact(scope);
  const query = { userId: scope.userId, contextSpaceId: scope.contextSpaceId };
  const [interactions, touchpoints, groups, contacts, introductions] = await Promise.all([
    prisma.interaction.findMany({ where: { ...query, contactId: scope.contactId, channel: PERSONAL_CHANNEL },
      select: { id: true, occurredAt: true, rawTextEnc: true }, orderBy: { occurredAt: 'desc' }, take: 150 }),
    prisma.touchpoint.findMany({ where: { ...query, participants: { some: {
      ...query, OR: [{ contactId: scope.contactId }, { relatingParticipant: { contactId: scope.contactId, ...query } }]
    } } }, select: { id: true, kind: true, occurredAt: true, relatingId: true,
      participants: { where: query, select: { contactId: true, relatingParticipant: { select: { contactId: true } } } } },
      orderBy: { occurredAt: 'desc' }, take: 100 }),
    prisma.relatingParticipant.findMany({ where: { ...query, contactId: scope.contactId, leftAt: null }, select: { relatingId: true } }),
    prisma.contact.findMany({ where: query, select: { id: true, fullNameEnc: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.introductionParticipant.findMany({ where: { ...query, contactId: scope.contactId,
      introduction: { userId: scope.userId, contextSpaceId: scope.contextSpaceId } },
      select: { introductionId: true, introduction: { select: { occurredAt: true, status: true } } },
      orderBy: { createdAt: 'desc' }, take: 100 })
  ]);
  const contactNames = await Promise.all(contacts.map(async row => ({ id: row.id, name: await contactDisplayName(row) })));
  const nameById = new Map(contactNames.map(p => [p.id, p.name]));
  const reflections = interactions.map(row => {
    const parsed = JSON.parse(decrypt(row.rawTextEnc, AAD)) as ReflectionPayload;
    if (parsed.version !== 1 || parsed.kind !== 'PERSONAL_REFLECTION' || parsed.actor !== 'OPERATOR') {
      throw new Error('Invalid private reflection data.');
    }
    return { id: row.id, text: parsed.text, touchpointId: parsed.touchpointId, at: row.occurredAt, actor: parsed.actor };
  });
  return {
    person: { id: person.id, name: await contactDisplayName(person) },
    reflections,
    touchpoints: touchpoints.map(t => ({ id: t.id, kind: t.kind, occurredAt: t.occurredAt, relatingId: t.relatingId,
      attendees: t.participants.map(p => nameById.get(p.contactId || p.relatingParticipant?.contactId || '') || 'Other participant') })),
    introductions: introductions.map(row => ({ id: row.introductionId, at: row.introduction.occurredAt, status: row.introduction.status })),
    // A single person-first timeline combines independent reflections, encounters and introductions.
    timeline: [
      ...reflections.map(r => ({ id: r.id, type: 'REFLECTION', at: r.at, label: r.touchpointId ? 'Reflection about an encounter' : 'Independent reflection', detail: r.text, href: null })),
      ...touchpoints.map(t => ({ id: t.id, type: 'TOUCHPOINT', at: t.occurredAt, label: t.kind.replaceAll('_', ' '), detail: t.participants.map(p => nameById.get(p.contactId || p.relatingParticipant?.contactId || '') || 'Other participant').join(', '), href: null })),
      ...introductions.map(i => ({ id: i.introductionId, type: 'INTRODUCTION', at: i.introduction.occurredAt, label: 'Introduction', detail: i.introduction.status, href: `/dating/introductions/${i.introductionId}` }))
    ].sort((a, b) => b.at.getTime() - a.at.getTime()),
    groups: [...new Set(groups.map(g => g.relatingId))], contacts: contactNames
  };
}

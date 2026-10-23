// Stage 8.16: first-party operator usage reporting, scoped to profiles the operator owns.
// No transcripts, private understanding, anonymous fingerprint or owner-inaccessible relationship data.
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || locals.user.role !== 'owner' || locals.contextDomainKey !== 'general')
    throw error(403, 'Pilot owner access required.');
  const events = await prisma.productEvent.findMany({ where: { ownerUserId: locals.user.id,
    environment: locals.env }, select: { type: true, domainKey: true, entryId: true,
    visitorUserId: true, value: true, occurredAt: true, profileId: true },
    orderBy: { occurredAt: 'desc' }, take: 4000 });
  const entries = await prisma.pilotProfileEntry.findMany({ where: { ownerUserId: locals.user.id,
    environment: locals.env }, select: { id: true, createdAt: true, profileId: true,
    domainKey: true, visitorUserId: true, sessions: { select: { conversationId: true } } },
    orderBy: { createdAt: 'desc' }, take: 100 });
  const types = ['qr.landing_opened', 'profile.viewed', 'dorian.conversation_requested',
    'dorian.session_issued', 'dorian.conversation_started', 'dorian.conversation_completed', 'dorian.conversation_failed',
    'dorian.conversation_returned', 'value.reported', 'relationship.connection_requested',
    'relationship.connection_accepted', 'sms.invitation_created', 'sms.invitation_received', 'dorian.callback_requested'];
  const metrics = ['business','general','dating'].map(domainKey => {
    const subset = events.filter(e => e.domainKey === domainKey);
    return { domainKey, counts: types.map(type => ({ type, count: subset.filter(e => e.type === type).length })),
      visitors: new Set(subset.filter(e => e.visitorUserId).map(e => e.visitorUserId)).size,
      helpfulYes: subset.filter(e => e.type === 'value.reported' && e.value === true).length,
      helpfulNo: subset.filter(e => e.type === 'value.reported' && e.value === false).length };
  });
  // Pseudonymous IDs only, no conversation contents. Individual journeys are restricted to this operator.
  return { metrics, types, totalEvents: events.length, capped: events.length === 4000,
    recentJourneys: entries.slice(0, 40).map(entry => ({
      id: entry.id, date: entry.createdAt.toISOString(), domainKey: entry.domainKey,
      visitorHint: entry.visitorUserId.slice(0, 8),
      events: events.filter(e => e.entryId === entry.id).map(e => e.type),
      conversations: entry.sessions.filter(s => s.conversationId).length
    })) };
};

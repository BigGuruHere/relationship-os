// PURPOSE: Network pilot entry point. Uses the existing General ContextSpace and personal Profile.
// SECURITY: A public profile is selected only from the authenticated owner's personal profiles.
import { redirect, error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { prisma } from '$lib/db';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const profile = await prisma.profile.findFirst({
    where: { userId: locals.user.id, kind: 'personal' },
    select: { slug: true, displayName: true, headline: true },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
  });
  // SECURITY: The owner can view origins only when participating in the connection.
  // A Network connection is reciprocal: invitees and inviters both see the other person.
  const origins = await prisma.networkConnectionOrigin.findMany({
    where: {
      OR: [{ inviterUserId: locals.user.id }, { visitorUserId: locals.user.id }]
    },
    select: { inviterUserId: true, visitorUserId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  const otherUsers = new Map<string, Date>();
  for (const origin of origins) {
    const otherId = origin.inviterUserId === locals.user.id
      ? origin.visitorUserId
      : origin.inviterUserId;
    if (otherId !== locals.user.id && !otherUsers.has(otherId)) {
      otherUsers.set(otherId, origin.createdAt);
    }
  }
  // SECURITY: This is a user-local visibility choice, not a deletion of the other party's data.
  const removed = await prisma.networkConnectionVisibility.findMany({
    where: { userId: locals.user.id, otherUserId: { in: [...otherUsers.keys()] } },
    select: { otherUserId: true }
  });
  const removedIds = new Set(removed.map(row => row.otherUserId));
  // Present the current self-declared name rather than mutating an owner's encrypted
  // Contact name. Contact perspectives and note history remain independently owned.
  const publicProfiles = await prisma.profile.findMany({
    where: { userId: { in: [...otherUsers.keys()] }, kind: 'personal' },
    select: { userId: true, slug: true, displayName: true, isDefault: true, updatedAt: true },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
  });
  const profileByUserId = new Map<string, (typeof publicProfiles)[number]>();
  for (const publicProfile of publicProfiles) {
    if (!profileByUserId.has(publicProfile.userId)) {
      profileByUserId.set(publicProfile.userId, publicProfile);
    }
  }
  const people = [...otherUsers.entries()].filter(([otherId]) => !removedIds.has(otherId)).map(([otherId, connectedAt]) => {
    const publicProfile = profileByUserId.get(otherId);
    return {
      userId: otherId,
      name: publicProfile?.displayName || 'Network member',
      slug: publicProfile?.slug || null,
      connectedAt: connectedAt.toISOString()
    };
  });
  return { people, profile, hasNetworkContext: locals.contextDomainKey === 'general' && Boolean(locals.contextSpaceId) };
};


export const actions: Actions = {
  remove: async ({ locals, request }) => {
    if (!locals.user) throw error(401, 'Sign in required.');
    const form = await request.formData();
    const otherUserId = String(form.get('otherUserId') ?? '');
    if (!otherUserId || otherUserId === locals.user.id) return fail(400, { error: 'Invalid connection.' });
    // SECURITY: A client-supplied ID is never sufficient. Confirm this user is a participant.
    const existing = await prisma.networkConnectionOrigin.findFirst({
      where: { OR: [
        { inviterUserId: locals.user.id, visitorUserId: otherUserId },
        { inviterUserId: otherUserId, visitorUserId: locals.user.id }
      ] }, select: { id: true }
    });
    if (!existing) return fail(404, { error: 'Connection not found.' });
    await prisma.networkConnectionVisibility.upsert({
      where: { userId_otherUserId: { userId: locals.user.id, otherUserId } },
      create: { userId: locals.user.id, otherUserId },
      update: { removedAt: new Date() }
    });
    throw redirect(303, '/network?removed=1');
  }
};

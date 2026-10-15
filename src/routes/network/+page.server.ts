// PURPOSE: Network pilot entry point. Uses the existing General ContextSpace and personal Profile.
// SECURITY: A public profile is selected only from the authenticated owner's personal profiles.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
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
  const people = [...otherUsers.entries()].map(([otherId, connectedAt]) => {
    const publicProfile = profileByUserId.get(otherId);
    return {
      name: publicProfile?.displayName || 'Network member',
      slug: publicProfile?.slug || null,
      connectedAt: connectedAt.toISOString()
    };
  });
  return { people, profile, hasNetworkContext: locals.contextDomainKey === 'general' && Boolean(locals.contextSpaceId) };
};

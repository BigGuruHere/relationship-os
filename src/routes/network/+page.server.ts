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
  // IT: Show only Network invitations attributable to this user, never another user's notes.
  const inbound = await prisma.networkConnectionOrigin.findMany({
    where: { inviterUserId: locals.user.id },
    select: { visitorUserId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  const people = await Promise.all(inbound.map(async (item) => {
    const publicProfile = await prisma.profile.findFirst({
      where: { userId: item.visitorUserId, kind: 'personal' },
      select: { slug: true, displayName: true },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    });
    return { name: publicProfile?.displayName || 'Network member', slug: publicProfile?.slug || null, connectedAt: item.createdAt.toISOString() };
  }));
  return { people, profile, hasNetworkContext: locals.contextDomainKey === 'general' && Boolean(locals.contextSpaceId) };
};

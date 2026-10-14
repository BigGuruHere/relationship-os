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
  return { profile, hasNetworkContext: locals.contextDomainKey === 'general' && Boolean(locals.contextSpaceId) };
};

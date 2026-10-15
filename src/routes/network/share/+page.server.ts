// PURPOSE: Route Network sharing to the existing QR experience for a personal profile only.
// SECURITY: Never fall back to a Business or Dating profile when none exists.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');
  const profile = await prisma.profile.findFirst({
    where: { userId: locals.user.id, kind: 'personal' },
    select: { slug: true },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
  });
  if (!profile) throw redirect(303, '/settings/profile?kind=personal&entry=network');
  throw redirect(303, `/share?profile=${encodeURIComponent(profile.slug)}&entry=network`);
};

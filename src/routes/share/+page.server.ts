// Select the owner's exact profile. The public QR endpoint renders it for the current origin.
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { absoluteUrlFromOrigin } from '$lib/url';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/auth/login'));

  const profileOptions = await prisma.profile.findMany({
    where: { userId: locals.user.id },
    select: { id: true, slug: true, label: true, displayName: true, isPublished: true },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
  });

  const targetSlug = url.searchParams.get('profile');
  const profile = targetSlug === null ? profileOptions[0] : profileOptions.find(row => row.slug === targetSlug);
  // An explicit selection cannot fall back to the default or resolve another owner's profile.
  if (targetSlug !== null && !profile) throw error(404, 'Profile not found.');
  if (!profile) {
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/settings/profile?mode=edit&first=1&next=preview'));
  }
  return { profile, profileOptions, origin: locals.appOrigin, watchSince: Date.now() };
};

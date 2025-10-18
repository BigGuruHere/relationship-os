// PURPOSE: Smart entrypoint for Share with multi profile support.
// ROUTES TO:
// - /settings/profile in edit mode when there is no profile
// - /u/[slug] when the profile exists but QR is not ready
// - Share page when the profile has QR ready
// MULTI TENANT: Uses locals.user.id
// SECURITY: No PII

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { absoluteUrlFromOrigin } from '$lib/url';

export const load: PageServerLoad = async ({ locals, url }) => {
  // IT: require login
  if (!locals.user) {
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/auth/login'));
  }

  // IT: optional specific profile slug, eg /share?profile=my-business
  const targetSlug = url.searchParams.get('profile') || undefined;

  // IT: choose a profile - prefer explicit slug, else default, else most recent
  const profile = await prisma.profile.findFirst({
    where: {
      userId: locals.user.id,
      ...(targetSlug ? { slug: targetSlug } : {})
    },
    select: { slug: true, qrReady: true },
    orderBy: targetSlug ? undefined : [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
  });

  // IT: if none exists, go create one
  if (!profile || !profile.slug) {
    throw redirect(
      303,
      absoluteUrlFromOrigin(locals.appOrigin, '/settings/profile?mode=edit&first=1&next=preview')
    );
  }

  // IT: if profile exists but QR not ready, preview the public page
  if (!profile.qrReady) {
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, `/u/${profile.slug}`));
  }

  // IT: if profile and QR are ready, render the share page
  return { profile };
};

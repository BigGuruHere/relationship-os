// PURPOSE: Smart entrypoint for Share with multi profile support.
// ROUTES TO:
// - Profile editor in create mode when there is no profile
// - Public profile preview when QR is not ready
// - Share page when QR is ready - includes the stored qrSvg

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { absoluteUrlFromOrigin } from '$lib/url';

export const load: PageServerLoad = async ({ locals, url }) => {
  // IT: require login
  if (!locals.user) {
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/auth/login'));
  }

  // IT: optional explicit profile
  const targetSlug = url.searchParams.get('profile') || undefined;

  // IT: choose profile - prefer explicit slug, else default, else most recent
  const profile = await prisma.profile.findFirst({
    where: {
      userId: locals.user.id,
      ...(targetSlug ? { slug: targetSlug } : {})
    },
    select: {
      slug: true,
      qrReady: true,
      qrSvg: true
    },
    orderBy: targetSlug ? undefined : [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
  });

  // IT: if none exists, go create one
  if (!profile || !profile.slug) {
    throw redirect(
      303,
      absoluteUrlFromOrigin(locals.appOrigin, '/settings/profile?mode=edit&first=1&next=preview')
    );
  }

  // IT: if QR not ready, preview public page
  if (!profile.qrReady) {
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, `/u/${profile.slug}`));
  }

  // IT: render share with svg
  return { profile };
};

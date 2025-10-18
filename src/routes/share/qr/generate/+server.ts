// PURPOSE: Generate QR for a specific profile and redirect to the Share page.
// INPUTS (one of):
// - form field profileId
// - query param slug
// MULTI TENANT: Validates profile belongs to the logged-in user.

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/db';
import { absoluteUrlFromOrigin } from '$lib/url';
// import { generateQrSvg } from '$lib/qr'; // IT: enable if you have a helper

export const POST: RequestHandler = async ({ locals, request, url }) => {
  // IT: require login
  if (!locals.user) {
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/auth/login'));
  }

  const fd = await request.formData();
  const profileId = String(fd.get('profileId') || '');
  const slugFromQuery = url.searchParams.get('slug') || undefined;

  // IT: resolve the profile by id or by slug, but only if it belongs to this user
  const profile = await prisma.profile.findFirst({
    where: {
      userId: locals.user.id,
      ...(profileId ? { id: profileId } : {}),
      ...(slugFromQuery ? { slug: slugFromQuery } : {})
    },
    select: { id: true, slug: true }
  });

  // IT: if no matching profile, bounce to profile setup
  if (!profile) {
    throw redirect(
      303,
      absoluteUrlFromOrigin(locals.appOrigin, '/settings/profile?mode=edit&next=preview')
    );
  }

  const targetUrl = absoluteUrlFromOrigin(locals.appOrigin, `/u/${profile.slug}`);

  // IT: optional SVG generation
  let qrSvg: string | null = null;
  try {
    // qrSvg = await generateQrSvg(targetUrl);
  } catch {
    // IT: non-fatal - we will still mark ready
  }

  try {
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        qrReady: true,
        ...(qrSvg ? { qrSvg } : {})
      }
    });
  } catch (err) {
    console.error('qr generate update failed', err);
    // IT: still continue to Share to avoid trapping the user
  }

  // IT: go to Share for this specific profile so the user can copy and send
  throw redirect(
    303,
    absoluteUrlFromOrigin(
      locals.appOrigin,
      `/share?profile=${encodeURIComponent(profile.slug)}`
    )
  );
};

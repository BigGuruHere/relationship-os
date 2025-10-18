// PURPOSE: Generate QR for a specific profile and redirect to the Share page.
// INPUTS:
// - form field profileId, or
// - query param slug
// MULTI TENANT: Validates profile belongs to the logged-in user.

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/db';
import { absoluteUrlFromOrigin } from '$lib/url';
import { generateQrSvg } from '$lib/qr';

export const POST: RequestHandler = async ({ locals, request, url }) => {
  // IT: require login
  if (!locals.user) {
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/auth/login'));
  }

  const fd = await request.formData();
  const profileId = String(fd.get('profileId') || '');
  const slugFromQuery = url.searchParams.get('slug') || undefined;

  // IT: resolve the profile to update, scoped to the current user
  const profile = await prisma.profile.findFirst({
    where: {
      userId: locals.user.id,
      ...(profileId ? { id: profileId } : {}),
      ...(slugFromQuery ? { slug: slugFromQuery } : {})
    },
    select: { id: true, slug: true }
  });

  if (!profile) {
    // IT: no profile yet - send to editor flow
    throw redirect(
      303,
      absoluteUrlFromOrigin(locals.appOrigin, '/settings/profile?mode=edit&first=1&next=preview')
    );
  }

  // IT: absolute public URL that the QR should open
  const targetUrl = absoluteUrlFromOrigin(locals.appOrigin, `/u/${profile.slug}`);

  // IT: generate SVG using helper
  let qrSvg: string;
  try {
    qrSvg = await generateQrSvg(targetUrl, 256);
  } catch (err) {
    // IT: if generation fails, still move on to Share to avoid trapping the user
    console.error('qr svg generation failed', err);
    throw redirect(
      303,
      absoluteUrlFromOrigin(
        locals.appOrigin,
        `/share?profile=${encodeURIComponent(profile.slug)}`
      )
    );
  }

  // IT: store svg and mark ready with timestamp
  try {
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        qrReady: true,
        qrSvg,
        qrGeneratedAt: new Date()
      }
    });
  } catch (err) {
    console.error('qr persist failed', err);
    // IT: still continue to Share so the user can copy the link
  }

  // IT: open Share for this exact profile
  throw redirect(
    303,
    absoluteUrlFromOrigin(
      locals.appOrigin,
      `/share?profile=${encodeURIComponent(profile.slug)}`
    )
  );
};

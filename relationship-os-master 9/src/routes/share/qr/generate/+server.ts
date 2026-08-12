// PURPOSE: Generate and store the QR SVG for a specific profile, then go to Share.
// INPUTS: profileId as form field, or slug as query param
// MULTI TENANT: Validates the profile belongs to the logged-in user.

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/db';
import { absoluteUrlFromOrigin } from '$lib/url';
import { generateQrSvg } from '$lib/qr';

export const POST: RequestHandler = async ({ locals, request, url }) => {
  // Require login
  if (!locals.user) {
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/auth/login'));
  }

  const fd = await request.formData();
  const profileId = String(fd.get('profileId') || '');
  const slugFromQuery = url.searchParams.get('slug') || undefined;

  // Resolve target profile and ensure it belongs to the current user
  const profile = await prisma.profile.findFirst({
    where: {
      userId: locals.user.id,
      ...(profileId ? { id: profileId } : {}),
      ...(slugFromQuery ? { slug: slugFromQuery } : {})
    },
    select: { id: true, slug: true }
  });

  if (!profile) {
    // No profile yet - send to editor flow
    throw redirect(
      303,
      absoluteUrlFromOrigin(locals.appOrigin, '/settings/profile?mode=edit&first=1&next=preview')
    );
  }

  // Build the absolute public URL to encode in the QR
  const targetUrl = absoluteUrlFromOrigin(locals.appOrigin, `/u/${profile.slug}`);

  // Generate SVG
  let qrSvg: string | null = null;
  try {
    qrSvg = await generateQrSvg(targetUrl, 256);
  } catch (err) {
    console.error('qr svg generation failed', err);
  }

  // Persist qrReady and svg when available
  try {
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        qrReady: true,
        ...(qrSvg ? { qrSvg, qrGeneratedAt: new Date() } : {})
      }
    });
  } catch (err) {
    console.error('qr persist failed', err);
  }

  // Redirect to Share for this exact profile
  throw redirect(
    303,
    absoluteUrlFromOrigin(
      locals.appOrigin,
      `/share?profile=${encodeURIComponent(profile.slug)}`
    )
  );
};

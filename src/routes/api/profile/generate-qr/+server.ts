// PURPOSE: generate a QR code SVG for the owner's public link and store it on the profile.
// FLOW: POST with profileId, verifies ownership, writes qrSvg and qrGeneratedAt, sets qrReady, then redirects to the same profile's QR preview.

// SECURITY: Do not leak host details. Use central origin helpers to avoid cross-env mixups.

import type { RequestHandler } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import QRCode from 'qrcode';

// IT: use shared helpers for origin and URL building
import { absoluteUrlFromOrigin } from '$lib/url';

export const POST: RequestHandler = async ({ request, locals }) => {
  // IT: require auth
  if (!locals.user) throw redirect(303, '/auth/login');

  const form = await request.formData();
  const profileId = form.get('profileId')?.toString();
  if (!profileId) throw redirect(303, '/share');

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: locals.user.id },
    select: { id: true, slug: true, isPublished: true }
  });
  if (!profile) throw error(404, 'Profile not found.');

  // IT: build canonical absolute URL from helpers
  const selected = encodeURIComponent(profile.slug);
  if (!profile.isPublished) throw redirect(303, '/share?profile=' + selected);
  const publicUrl = absoluteUrlFromOrigin(locals.appOrigin, '/u/' + selected);

  const svg = await QRCode.toString(publicUrl, { type: 'svg', margin: 1 });

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      qrSvg: svg,
      qrGeneratedAt: new Date(),
      qrReady: true
    }
  });

  throw redirect(303, '/share/qr?profile=' + selected);
};

// PURPOSE: generate a QR code SVG for the owner's public link and store it on the profile.
// FLOW: POST with profileId, verifies ownership, writes qrSvg and qrGeneratedAt, sets qrReady, 303 to /share/qr.

import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import QRCode from 'qrcode';

const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:5173';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const form = await request.formData();
  const profileId = String(form.get('profileId') || '');

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: locals.user.id },
    select: { id: true, user: { select: { publicSlug: true, id: true } } }
  });

  if (!profile) throw redirect(303, '/share'); // not found or not owner

  const slug = profile.user.publicSlug || profile.user.id;
  const link = `${APP_ORIGIN}/u/${slug}`;

  // Generate an SVG so it scales nicely on screens and print
  const svg = await QRCode.toString(link, { type: 'svg', margin: 2, scale: 6 });

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      qrSvg: svg,
      qrGeneratedAt: new Date(),
      qrReady: true
    }
  });

  throw redirect(303, '/share/qr');
};


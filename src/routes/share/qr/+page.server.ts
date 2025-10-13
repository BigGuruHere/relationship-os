// PURPOSE: show the current user's QR code and share helpers.
// REDIRECTS: if QR not ready, bounce back to /share to re-evaluate the flow.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';

const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:5173';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const user = await prisma.user.findFirst({
    where: { id: locals.user.id },
    select: { id: true, publicSlug: true }
  });
  if (!user) throw redirect(303, '/auth/login');

  const prof = await prisma.profile.findFirst({
    where: { userId: user.id, isDefault: true },
    select: { qrReady: true, qrSvg: true }
  });

  if (!prof || !prof.qrReady || !prof.qrSvg) {
    throw redirect(303, '/share'); // let controller decide next step
  }

  const slug = user.publicSlug || user.id;
  const link = `${APP_ORIGIN}/u/${slug}`;

  const smsUrl = `sms:?&body=${encodeURIComponent(`Hi - here is my link to connect: ${link}`)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Hi - here is my link to connect: ${link}`)}`;
  const vcardUrl = `/api/vcard?name=${encodeURIComponent('Contact')}&link=${encodeURIComponent(link)}`;

  return {
    link,
    qrSvg: prof.qrSvg,
    smsUrl,
    whatsappUrl,
    vcardUrl
  };
};

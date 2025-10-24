// PURPOSE: QR share page loader - now uses the same helper to build a rich vCard URL.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { buildVcardUrl } from '$lib/publicProfile';
import { getAppOriginLoose } from '$lib/appOrigin';


const APP_ORIGIN = getAppOriginLoose();

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  const user = await prisma.user.findFirst({
    where: { id: locals.user.id },
    select: { id: true, publicSlug: true }
  });
  if (!user) throw redirect(303, '/auth/login');

  const prof = await prisma.profile.findFirst({
    where: { userId: user.id, isDefault: true },
    select: {
      qrReady: true,
      qrSvg: true,
      displayName: true,
      company: true,
      title: true,
      emailPublic: true,
      phonePublic: true
    }
  });

  if (!prof || !prof.qrReady || !prof.qrSvg) {
    throw redirect(303, '/share');
  }

  const slug = user.publicSlug || user.id;
  const link = `${APP_ORIGIN}/u/${slug}`;

  // Single source for vCard URL
  const vcardUrl = buildVcardUrl(
    {
      displayName: prof.displayName,
      company: prof.company,
      title: prof.title,
      emailPublic: prof.emailPublic,
      phonePublic: prof.phonePublic
    },
    link
  );

  const smsUrl = `sms:?&body=${encodeURIComponent(`Hi - here is my link to connect: ${link}`)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Hi - here is my link to connect: ${link}`)}`;

  return {
    link,
    qrSvg: prof.qrSvg,
    smsUrl,
    whatsappUrl,
    vcardUrl
  };
};

// src/routes/share/+page.server.ts
// PURPOSE: Smart Share entry with first-visit QR auto-generation.
// MULTI PROFILE: accepts ?profile=<slug>, else picks default or most recent.
// BEHAVIOR:
// - If no profile exists - redirect to editor
// - If profile exists and qrSvg is missing - generate, save, and return it
// - Otherwise just return the stored svg for instant render

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { absoluteUrlFromOrigin } from '$lib/url';
import { generateQrSvg } from '$lib/qr'; // IT: `npm i qrcode` required

export const load: PageServerLoad = async ({ locals, url }) => {
  // IT: require login
  if (!locals.user) {
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/auth/login'));
  }

  // IT: optional explicit profile slug
  const targetSlug = url.searchParams.get('profile') || undefined;

  // IT: choose a profile - prefer explicit slug, else default, else most recent
  let profile = await prisma.profile.findFirst({
    where: {
      userId: locals.user.id,
      ...(targetSlug ? { slug: targetSlug } : {})
    },
    select: {
      id: true,
      slug: true,
      displayName: true,    // IT: add display name so the UI does not fall back to slug
      qrReady: true,
      qrSvg: true,
      updatedAt: true,
      isDefault: true
    },
    orderBy: targetSlug ? undefined : [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
  });

  // IT: no profile yet - send to editor in create mode
  if (!profile || !profile.slug) {
    throw redirect(
      303,
      absoluteUrlFromOrigin(locals.appOrigin, '/settings/profile?mode=edit&first=1&next=preview')
    );
  }

  // IT: if QR not stored yet, generate once, persist, and refresh `profile`
  if (!profile.qrSvg) {
    try {
      // IT: build absolute public URL for this profile
      const targetUrl = absoluteUrlFromOrigin(locals.appOrigin, `/u/${profile.slug}`);

      // IT: generate compact SVG
      const svg = await generateQrSvg(targetUrl, 256);

      // IT: persist svg and mark ready
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          qrReady: true,
          qrSvg: svg,
          qrGeneratedAt: new Date()
        }
      });

      // IT: re-read the row so the page gets the svg immediately
      profile = await prisma.profile.findUnique({
        where: { id: profile.id },
        select: { slug: true, displayName: true, qrReady: true, qrSvg: true }
      });
    } catch (err) {
      console.error('QR auto-generate failed', err);
      // IT: do not block Share - continue without svg
    }
  }

  // IT: return the profile - the client will prefer displayName over slug
  return { profile, origin: locals.appOrigin };
};

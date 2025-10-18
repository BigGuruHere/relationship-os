// PURPOSE: Serve a QR SVG for a given profile slug without storing it.
// INPUT: /api/qr?slug=<profile-slug>
// SECURITY: Only encodes your public /u/<slug> URL. No user-supplied HTML.

import type { RequestHandler } from './$types';
import { generateQrSvg } from '$lib/qr';
import { absoluteUrlFromOrigin } from '$lib/url';
import { prisma } from '$lib/db';

export const GET: RequestHandler = async ({ url, locals }) => {
  const slug = url.searchParams.get('slug');
  if (!slug) {
    return new Response('Missing slug', { status: 400 });
  }

  // IT: make sure slug exists to avoid generating junk
  const exists = await prisma.profile.findFirst({
    where: { slug },
    select: { slug: true }
  });
  if (!exists) {
    return new Response('Not found', { status: 404 });
  }

  const target = absoluteUrlFromOrigin(locals.appOrigin, `/u/${slug}`);
  const svg = await generateQrSvg(target, 256);

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600' // IT: 10 min cache
    }
  });
};

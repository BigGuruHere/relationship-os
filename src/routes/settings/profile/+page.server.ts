// PURPOSE: Profile editor server - saves owner profile and optionally redirects to preview.
// MULTI TENANT: Uses locals.user.id
// SECURITY: Handle only plaintext from the form. Encrypt server side where required.

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { absoluteUrlFromOrigin } from '$lib/url';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/auth/login'));
  }
  const profile = await prisma.profile.findUnique({
    where: { userId: locals.user.id },
    select: { slug: true, publicMeta: true, qrReady: true }
  });
  return { profile };
};

export const actions: Actions = {
  default: async ({ request, locals, url }) => {
    if (!locals.user) {
      throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/auth/login'));
    }

    const fd = await request.formData();
    const slug = String(fd.get('slug') || '').trim();
    const displayName = String(fd.get('displayName') || '').trim();
    const headline = String(fd.get('headline') || '').trim();
    const next = url.searchParams.get('next'); // IT: read next from query string

    if (!slug) return fail(400, { error: 'Slug is required' });
    if (!displayName) return fail(400, { error: 'Display name is required' });

    try {
      await prisma.profile.upsert({
        where: { userId: locals.user.id },
        update: {
          slug,
          publicMeta: { displayName, headline }
        },
        create: {
          userId: locals.user.id,
          slug,
          publicMeta: { displayName, headline },
          qrReady: false
        }
      });
    } catch (err) {
      console.error('profile save failed', err);
      return fail(500, { error: 'Could not save profile' });
    }

    // IT: when coming from the Share router, show the public page preview after first save
    if (next === 'preview') {
      throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, `/u/${slug}`));
    }

    // IT: otherwise remain in the editor
    return { success: true };
  }
};

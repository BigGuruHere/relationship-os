// src/routes/share/+page.server.ts
// PURPOSE:
// - Owner tools to manage public profile and sharing
// - Build env-aware absolute links for QR and copy-link using locals.appOrigin
// NOTES:
// - Uses absoluteUrlFromOrigin so the same code works on local, dev, and prod
// - All IT code is commented and uses normal hyphens

import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { absoluteUrlFromOrigin } from '$lib/url';

export const load: PageServerLoad = async ({ locals }) => {
  // Must be signed in
  if (!locals.user) throw redirect(303, '/auth/login');

  // Fetch or create a default profile for this user
  let profile = await prisma.profile.findFirst({
    where: { userId: locals.user.id }
  });

  if (!profile) {
    profile = await prisma.profile.create({
      data: {
        userId: locals.user.id,
        slug: crypto.randomUUID().slice(0, 8).toLowerCase(), // short slug - adjust as needed
        publicMeta: {}
      }
    });
  }

  // Build env-aware absolute links for sharing and QR
  const profilePath = `/u/${profile.slug}`;
  const profileUrl = absoluteUrlFromOrigin(locals.appOrigin, profilePath);

  // If you render a server generated QR, you can pass profileUrl down to the page
  return {
    profile,
    profileUrl
  };
};

export const actions: Actions = {
  // Example action to regenerate slug
  rotate: async ({ locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    // Create a new slug
    const newSlug = crypto.randomUUID().slice(0, 8).toLowerCase();

    await prisma.profile.update({
      where: { userId: locals.user.id },
      data: { slug: newSlug }
    });

    // Back to share screen
    throw redirect(303, '/share');
  },

  // Example action to update some public fields
  update: async ({ locals, request }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData().catch(() => null);
    if (!form) return fail(400, { error: 'Invalid form' });

    const displayName = String(form.get('displayName') || '').trim();
    const headline = String(form.get('headline') || '').trim();

    await prisma.profile.update({
      where: { userId: locals.user.id },
      data: {
        displayName: displayName || null,
        headline: headline || null
      }
    });

    throw redirect(303, '/share');
  }
};

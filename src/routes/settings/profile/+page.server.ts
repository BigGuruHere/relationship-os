// PURPOSE: create or update your default profile.
// MULTI TENANT: always scoped to locals.user.id.
// All IT code is commented and uses hyphens only.

import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { prisma } from '$lib/db';

function slugifyBase(input: string): string {
  return (input || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'profile';
}

async function ensureUniqueProfileSlug(userId: string, base: string) {
  // try base, then base-2, base-3, then base-rand
  const candidates = [base, `${base}-2`, `${base}-3`, `${base}-${Math.random().toString(36).slice(2, 6)}`];
  for (const slug of candidates) {
    try {
      const created = await prisma.profile.create({
        data: { userId, slug, isDefault: true, label: 'My profile' }
      });
      return created.slug;
    } catch (e: any) {
      if (e?.code === 'P2002') continue;
      throw e;
    }
  }
  throw new Error('Could not allocate a profile slug');
}

export const load: PageServerLoad = async ({ locals }) => {
  // Require login
  if (!locals.user) throw redirect(303, '/auth/login');

  // Read the default profile
  const profile = await prisma.profile.findFirst({
    where: { userId: locals.user.id, isDefault: true }
  });

  // Build absolute origin from .env with a safe dev fallback
  const origin = (process.env.APP_ORIGIN?.trim() || 'http://localhost:5173');

  // Return to page
  return { profile, origin };
};


export const actions: Actions = {
  save: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
    const displayName = String(form.get('displayName') || '');
    const headline = String(form.get('headline') || '');
    const bio = String(form.get('bio') || '');
    const avatarUrl = String(form.get('avatarUrl') || '');
    const company = String(form.get('company') || '');
    const title = String(form.get('title') || '');
    const websiteUrl = String(form.get('websiteUrl') || '');
    const emailPublic = String(form.get('emailPublic') || '');
    const phonePublic = String(form.get('phonePublic') || '');
    const kind = String(form.get('kind') || 'business') as any;

    // Find default profile or create a new one with a unique slug
    let profile = await prisma.profile.findFirst({
      where: { userId: locals.user.id, isDefault: true }
    });

    if (!profile) {
      const base = slugifyBase(displayName || 'profile');
      const slug = await ensureUniqueProfileSlug(locals.user.id, base);
      profile = await prisma.profile.findFirst({ where: { userId: locals.user.id, slug } });
    }

    if (!profile) {
      return fail(500, { error: 'Could not create a profile' });
    }

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        kind,
        label: 'My profile',
        displayName: displayName || null,
        headline: headline || null,
        bio: bio || null,
        avatarUrl: avatarUrl || null,
        company: company || null,
        title: title || null,
        websiteUrl: websiteUrl || null,
        emailPublic: emailPublic || null,
        phonePublic: phonePublic || null,
        isDefault: true
      }
    });

    throw redirect(303, '/share');
  }
};

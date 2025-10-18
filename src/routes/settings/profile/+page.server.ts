// PURPOSE: server for profile editor - reads extras from extra_* inputs
// MULTI TENANT: all reads and writes scoped by locals.user.id
// SECURITY: only public fields are handled here

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { absoluteUrlFromOrigin } from '$lib/url';
import { mergeExtras } from '$lib/publicProfile'; // IT: merges extra_* into existing publicMeta

// IT: simple slugify helper
function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'profile';
  return base;
}

// IT: ensure unique slug per user
async function ensureUniqueSlug(userId: string, wanted: string): Promise<string> {
  let slug = wanted;
  for (let n = 1; n <= 50; n++) {
    const hit = await prisma.profile.findFirst({ where: { userId, slug }, select: { id: true } });
    if (!hit) return slug;
    slug = `${wanted}-${n + 1}`;
  }
  return `${wanted}-${crypto.randomUUID().slice(0, 8)}`;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/auth/login'));
  }

  const profile = await prisma.profile.findFirst({
    where: { userId: locals.user.id },
    select: {
      id: true,
      userId: true,
      slug: true,
      isDefault: true,
      displayName: true,
      headline: true,
      bio: true,
      avatarUrl: true,
      company: true,
      title: true,
      websiteUrl: true,
      emailPublic: true,
      phonePublic: true,
      kind: true,
      publicMeta: true,
      qrReady: true,
      updatedAt: true
    },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
  });

  const mode = url.searchParams.get('mode') || 'edit';
  const first = url.searchParams.get('first') === '1';
  const next = url.searchParams.get('next') || null;

  return { profile: profile || null, mode, first, next };
};

export const actions: Actions = {
  save: async ({ request, locals, url }) => {
    if (!locals.user) {
      throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/auth/login'));
    }

    const fd = await request.formData();

    // IT: core fields
    const profileId  = String(fd.get('profileId') || '').trim();
    const displayName = String(fd.get('displayName') || '').trim();
    const headline    = String(fd.get('headline') || '').trim();
    const bio         = String(fd.get('bio') || '').trim();
    const avatarUrl   = String(fd.get('avatarUrl') || '').trim();
    const company     = String(fd.get('company') || '').trim();
    const title       = String(fd.get('title') || '').trim();
    const websiteUrl  = String(fd.get('websiteUrl') || '').trim();
    const emailPublic = String(fd.get('emailPublic') || '').trim();
    const phonePublic = String(fd.get('phonePublic') || '').trim();
    const kind        = String(fd.get('kind') || 'business').trim();

    if (!displayName) return fail(400, { error: 'Display name is required' });

    // IT: collect extras from inputs named extra_<key>
    const extras: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      const name = String(k);
      if (name.startsWith('extra_')) {
        const key = name.slice('extra_'.length);
        extras[key] = String(v || '');
      }
    }

    // IT: read existing profile if any
    const existing = profileId
      ? await prisma.profile.findFirst({
          where: { id: profileId, userId: locals.user.id },
          select: { id: true, slug: true, isDefault: true, publicMeta: true }
        })
      : await prisma.profile.findFirst({
          where: { userId: locals.user.id },
          select: { id: true, slug: true, isDefault: true, publicMeta: true },
          orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
        });

    try {
      if (existing) {
        // IT: keep slug or generate one
        const nextSlug = existing.slug || (await ensureUniqueSlug(locals.user.id, slugify(displayName)));
        // IT: merge extras into existing publicMeta
        const nextMeta = mergeExtras(existing.publicMeta, extras);

        await prisma.profile.update({
          where: { id: existing.id },
          data: {
            slug: nextSlug,
            kind,
            displayName: displayName || null,
            headline: headline || null,
            bio: bio || null,
            avatarUrl: avatarUrl || null,
            company: company || null,
            title: title || null,
            websiteUrl: websiteUrl || null,
            emailPublic: emailPublic || null,
            phonePublic: phonePublic || null,
            publicMeta: nextMeta
          }
        });
      } else {
        // IT: create new profile - default if none exists yet
        const wanted = slugify(displayName);
        const uniqueSlug = await ensureUniqueSlug(locals.user.id, wanted);

        const hasDefault = await prisma.profile.findFirst({
          where: { userId: locals.user.id, isDefault: true },
          select: { id: true }
        });

        // IT: build initial publicMeta from extras
        const initialMeta = mergeExtras({}, extras);

        await prisma.profile.create({
          data: {
            userId: locals.user.id,
            slug: uniqueSlug,
            isDefault: hasDefault ? false : true,
            kind,
            displayName: displayName || null,
            headline: headline || null,
            bio: bio || null,
            avatarUrl: avatarUrl || null,
            company: company || null,
            title: title || null,
            websiteUrl: websiteUrl || null,
            emailPublic: emailPublic || null,
            phonePublic: phonePublic || null,
            publicMeta: initialMeta,
            qrReady: false
          }
        });
      }
    } catch (err: any) {
      if (err?.code === 'P2002' && Array.isArray(err?.meta?.target) && err.meta.target.includes('slug')) {
        return fail(409, { error: 'This profile URL is already taken. Try a different name.' });
      }
      console.error('profile save failed', err);
      return fail(500, { error: 'Could not save profile' });
    }

    // IT: first run from Share should preview public page
    const nextParam = url.searchParams.get('next');
    if (nextParam === 'preview') {
      // IT: look up the slug to redirect accurately
      const latest = await prisma.profile.findFirst({
        where: { userId: locals.user.id },
        select: { slug: true },
        orderBy: [{ updatedAt: 'desc' }]
      });
      const slug = latest?.slug || 'profile';
      throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, `/u/${encodeURIComponent(slug)}`));
    }

    return { ok: true };
  }
};

// src/routes/u/[slug]/+page.server.ts
// PURPOSE: public page loader with owner-only edit and QR awareness.
// - passes origin to avoid window.location during SSR
// - passes editingRequested and firstVisit flags from query
// - includes profile.qrReady so the page can show Generate QR for the owner

import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { createInviteToken } from '$lib/server/tokens';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, url, locals }) => {
  // IT: resolve the owner either by publicSlug or by direct id
  const owner = await prisma.user.findFirst({
    where: { OR: [{ publicSlug: params.slug }, { id: params.slug }] },
    select: { id: true, publicSlug: true }
  });

  // IT: if no owner is found, surface a 404 status for the page
  if (!owner) {
    return { status: 404 };
  }

  // IT: optional query switches
  const v = url.searchParams.get('v');       // profile kind - optional legacy flag
  const pslug = url.searchParams.get('profile'); // explicit profile slug - optional

  // IT: guard for deployments that may not have the profile model yet
  const hasProfileAPI =
    (prisma as any).profile &&
    typeof (prisma as any).profile.findFirst === 'function';

  let profile: any = null;

  if (hasProfileAPI) {
    // IT: preference order - explicit slug, then kind, then default profile
    if (pslug) {
      profile = await prisma.profile.findFirst({
        where: { slug: pslug, userId: owner.id },
        // IT: include qrReady so the client can show Generate QR for the owner
        select: {
          id: true,
          userId: true,
          slug: true,
          isDefault: true,
          kind: true,
          publicMeta: true,
          qrReady: true
        }
      });
    } else if (v) {
      profile = await prisma.profile.findFirst({
        where: { userId: owner.id, kind: v as any },
        select: {
          id: true,
          userId: true,
          slug: true,
          isDefault: true,
          kind: true,
          publicMeta: true,
          qrReady: true
        }
      });
    } else {
      profile = await prisma.profile.findFirst({
        where: { userId: owner.id, isDefault: true },
        select: {
          id: true,
          userId: true,
          slug: true,
          isDefault: true,
          kind: true,
          publicMeta: true,
          qrReady: true
        }
      });
    }
  }

  // IT: generate a short-lived invite token for the public page flows
  const invite = await createInviteToken({ ownerId: owner.id, ttlMinutes: 30 });

  // IT: detect if the viewer is the owner
  const isOwner = Boolean(locals.user && locals.user.id === owner.id);

  // IT: support query flags for the client to show edit affordances
  const editingRequested = url.searchParams.get('edit') === '1';
  const firstVisit = url.searchParams.get('first') === '1';

  // IT: pass origin so the client can build absolute links without window during SSR
  const origin = url.origin;

  return {
    owner: { id: owner.id, slug: owner.publicSlug ?? params.slug },
    inviteToken: invite.token,
    profile,           // includes qrReady when present
    isOwner,
    editingRequested,
    firstVisit,
    origin
  };
};

export const actions: Actions = {
  // IT: save edits to a profile - owner only
  save: async ({ request, locals }) => {
    // IT: require login
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();

    // IT: collect posted fields
    const profileId = String(form.get('profileId') || '');
    const displayName = String(form.get('displayName') || '');
    const headline = String(form.get('headline') || '');
    const bio = String(form.get('bio') || '');
    const avatarUrl = String(form.get('avatarUrl') || '');
    const company = String(form.get('company') || '');
    const title = String(form.get('title') || '');
    const websiteUrl = String(form.get('websiteUrl') || '');
    const emailPublic = String(form.get('emailPublic') || '');
    const phonePublic = String(form.get('phonePublic') || '');

    // IT: collect dynamic extras from inputs named extra_<key>
    const extras: Record<string, string> = {};
    for (const [k, v] of form.entries()) {
      const name = String(k);
      if (name.startsWith('extra_')) {
        const key = name.slice('extra_'.length);
        extras[key] = String(v || '');
      }
    }

    // IT: verify the profile belongs to the logged-in user
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId: locals.user.id },
      select: { id: true, publicMeta: true }
    });

    if (!profile) {
      // IT: do not leak cross-tenant info
      return fail(403, { error: 'You cannot edit this profile' });
    }

    // IT: merge extras into existing publicMeta using your helper
    const { mergeExtras } = await import('$lib/publicProfile');
    const nextPublicMeta = mergeExtras(profile.publicMeta, extras);

    // IT: persist updates - fields left empty become null so they are not shown publicly
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        displayName: displayName || null,
        headline: headline || null,
        bio: bio || null,
        avatarUrl: avatarUrl || null,
        company: company || null,
        title: title || null,
        websiteUrl: websiteUrl || null,
        emailPublic: emailPublic || null,
        phonePublic: phonePublic || null,
        publicMeta: nextPublicMeta
      }
    });

    // IT: action returns a success object for the client to handle
    return { ok: true };
  }
};

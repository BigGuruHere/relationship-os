// PURPOSE: public page loader with owner-only edit and QR awareness.
// - passes origin to avoid window.location during SSR
// - passes editingRequested and firstVisit flags from query
// - includes profile.qrReady so the page can show Generate QR for the owner

import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { createInviteToken } from '$lib/server/tokens';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, url, locals }) => {
  const owner = await prisma.user.findFirst({
    where: { OR: [{ publicSlug: params.slug }, { id: params.slug }] },
    select: { id: true, publicSlug: true }
  });
  if (!owner) {
    return { status: 404 };
  }

  const v = url.searchParams.get('v');
  const pslug = url.searchParams.get('profile');

  const hasProfileAPI =
    (prisma as any).profile &&
    typeof (prisma as any).profile.findFirst === 'function';

  let profile: any = null;

  if (hasProfileAPI) {
    if (pslug) {
      profile = await prisma.profile.findFirst({ where: { slug: pslug, userId: owner.id } });
    } else if (v) {
      profile = await prisma.profile.findFirst({ where: { userId: owner.id, kind: v as any } });
    } else {
      profile = await prisma.profile.findFirst({ where: { userId: owner.id, isDefault: true } });
    }
  }

  const invite = await createInviteToken({ ownerId: owner.id, ttlMinutes: 30 });
  const isOwner = Boolean(locals.user && locals.user.id === owner.id);
  const editingRequested = url.searchParams.get('edit') === '1';
  const firstVisit = url.searchParams.get('first') === '1';
  const origin = url.origin;

  return {
    owner: { id: owner.id, slug: owner.publicSlug ?? params.slug },
    inviteToken: invite.token,
    profile,
    isOwner,
    editingRequested,
    firstVisit,
    origin
  };
};

export const actions: Actions = {
  save: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();
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

    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId: locals.user.id },
      select: { id: true }
    });
    if (!profile) {
      return fail(403, { error: 'You cannot edit this profile' });
    }

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
        phonePublic: phonePublic || null
      }
    });

    return { ok: true };
  }
};

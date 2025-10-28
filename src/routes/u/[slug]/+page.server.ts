// src/routes/u/[slug]/+page.server.ts
// PURPOSE: public page loader with owner-only edit and QR awareness.
// BEHAVIOR:
// - First try to resolve by profile.slug = params.slug
// - If not found, fall back to user by publicSlug or id
// - Returns profile info, owner info, flags for edit affordances, and origin for SSR-safe links

import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { createInviteToken } from '$lib/server/tokens';
import { fail, redirect, error } from '@sveltejs/kit';
import { absoluteUrlFromOrigin } from '$lib/url';
import { createMutualConnection } from '$lib/connections';


export const load: PageServerLoad = async ({ params, url, locals }) => {
  const slugParam = params.slug;

  // IT: try resolving by profile.slug first
  const profileBySlug = await prisma.profile.findFirst({
    where: { slug: slugParam },
    select: {
      id: true,
      userId: true,
      slug: true,
      isDefault: true,
      kind: true,
      // core public fields
      displayName: true,
      headline: true,
      bio: true,
      avatarUrl: true,
      company: true,
      title: true,
      websiteUrl: true,
      emailPublic: true,
      phonePublic: true,
      // flexible extras
      publicMeta: true,
      // share status
      qrReady: true
    }
  });

  let ownerId: string | null = null;

  if (profileBySlug) {
    ownerId = profileBySlug.userId;
  } else {
    // IT: fall back to user by publicSlug or id for legacy links
    const owner = await prisma.user.findFirst({
      where: { OR: [{ publicSlug: slugParam }, { id: slugParam }] },
      select: { id: true, publicSlug: true }
    });
    if (!owner) {
      throw error(404, 'Profile not found');
    }
    ownerId = owner.id;
  }

  // IT: now that we know the owner id, pick the profile to render
  // - if we matched by profile.slug, use that exact record
  // - else prefer default profile, else most recent
  let profile = profileBySlug;
  if (!profile) {
    profile = await prisma.profile.findFirst({
      where: { userId: ownerId },
      select: {
        id: true,
        userId: true,
        slug: true,
        isDefault: true,
        kind: true,
        displayName: true,
        headline: true,
        bio: true,
        avatarUrl: true,
        company: true,
        title: true,
        websiteUrl: true,
        emailPublic: true,
        phonePublic: true,
        publicMeta: true,
        qrReady: true
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    });
  }

  // IT: generate invite token for guest flow
  const invite = await createInviteToken({ ownerId, ttlMinutes: 30 });

  // IT: viewer ownership and UI flags
  const isOwner = Boolean(locals.user && locals.user.id === ownerId);
  const editingRequested = url.searchParams.get('edit') === '1';
  const firstVisit = url.searchParams.get('first') === '1';
  const origin = url.origin;

  // IT: we also return a safe owner slug for building links
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, publicSlug: true }
  });

  // IT: NEW - check if the visitor is logged in
  const visitorUserId = locals.user?.id ?? null;
  const isVisitorLoggedIn = Boolean(visitorUserId);
  
  // IT: NEW - check if visitor is already connected to this owner
  let isAlreadyConnected = false;
  let visitorProfile = null;
  
  if (isVisitorLoggedIn && ownerId) {
    // Don't connect to yourself
    if (visitorUserId !== ownerId) {
      // Check if owner already has visitor as a contact
      const existingContact = await prisma.contact.findFirst({
        where: {
          userId: ownerId,
          linkedUserId: visitorUserId
        },
        select: { id: true }
      });
      
      isAlreadyConnected = Boolean(existingContact);
      
      // Get visitor's profile for the connect button
      if (!isAlreadyConnected) {
        visitorProfile = await prisma.profile.findFirst({
          where: { userId: visitorUserId },
          select: {
            id: true,
            displayName: true,
            company: true,
            emailPublic: true,
            phonePublic: true
          },
          orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
        });
      }
    }
  }

  return {
    owner: { id: ownerId, slug: owner?.publicSlug ?? slugParam },
    inviteToken: invite.token,
    profile: profile || null,
    isOwner,
    editingRequested,
    firstVisit,
    origin,
    slugParam,
    // IT: NEW - pass visitor login state to page
    isVisitorLoggedIn,
    isAlreadyConnected,
    isSelfView: visitorUserId === ownerId,
    visitorProfile
  };
};

export const actions: Actions = {
  // IT: save edits to a profile - owner only
  save: async ({ request, locals }) => {
    // IT: require login
    if (!locals.user) throw redirect(303, '/auth/login');

    const form = await request.formData();

    // IT: collect posted fields
    const profileId  = String(form.get('profileId') || '');
    const displayName = String(form.get('displayName') || '');
    const headline    = String(form.get('headline') || '');
    const bio         = String(form.get('bio') || '');
    const avatarUrl   = String(form.get('avatarUrl') || '');
    const company     = String(form.get('company') || '');
    const title       = String(form.get('title') || '');
    const websiteUrl  = String(form.get('websiteUrl') || '');
    const emailPublic = String(form.get('emailPublic') || '');
    const phonePublic = String(form.get('phonePublic') || '');

    // IT: extras named extra_<key>
    const extras: Record<string, string> = {};
    for (const [k, v] of form.entries()) {
      const name = String(k);
      if (name.startsWith('extra_')) extras[name.slice('extra_'.length)] = String(v || '');
    }

    // IT: verify ownership and grab slug for redirect
    const existing = await prisma.profile.findFirst({
      where: { id: profileId, userId: locals.user.id },
      select: { id: true, publicMeta: true, slug: true }
    });
    if (!existing) {
      return fail(403, { error: 'You cannot edit this profile' });
    }

    // IT: merge extras and persist
    const { mergeExtras } = await import('$lib/publicProfile');
    const nextPublicMeta = mergeExtras(existing.publicMeta, extras);

    await prisma.profile.update({
      where: { id: existing.id },
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

    // IT: redirect to view mode of the same profile so the UI exits edit state
    const to = absoluteUrlFromOrigin(locals.appOrigin, `/u/${encodeURIComponent(existing.slug || '')}`);
    throw redirect(303, to);
  },

    // IT: NEW - instant connect for logged-in users
    connectUsers: async ({ locals, params }) => {
      // IT: require login
      if (!locals.user) throw redirect(303, '/auth/login');
  
      // IT: resolve owner from slug
      const owner = await resolveOwnerFromSlug(params.slug);
      if (!owner) return fail(404, { error: 'Profile not found' });
  
      // IT: prevent self-connection
      if (owner.id === locals.user.id) {
        return fail(400, { error: 'Cannot connect to yourself' });
      }
  
      // IT: check if already connected
      const existing = await prisma.contact.findFirst({
        where: {
          userId: owner.id,
          linkedUserId: locals.user.id
        },
        select: { id: true }
      });
  
      if (existing) {
        return fail(400, { error: 'Already connected' });
      }
  
      // IT: create bidirectional contacts
      try {
        await createMutualConnection(owner.id, locals.user.id);
      } catch (err) {
        console.error('Failed to create mutual connection:', err);
        return fail(500, { error: 'Failed to connect' });
      }
  
      // IT: redirect to contacts list with success message
      throw redirect(303, `/?connected=${encodeURIComponent(owner.displayName || 'user')}`);
    }
};

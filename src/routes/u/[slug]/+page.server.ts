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
import { getOrCreatePilotVisitor, ensurePilotSelfContact, pilotDomainForKind, pilotSource, recordPilotEvent } from '$lib/server/pilot';
import { issuePilotSmsInvitation, pilotTermsConfig } from '$lib/server/core/pilotSmsCallback';



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
      qrReady: true,
      isPublished: true
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
        qrReady: true,
        isPublished: true
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    });
  }

  // An unpublished profile must never be visible to a public visitor or usable in onboarding.
  if (!profile?.isPublished && locals.user?.id !== ownerId) throw error(404, 'Profile unavailable');
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

  const contextPref = profile ? await prisma.relishContextPreference.findUnique({ where: {
    ownerUserId_domainKey: { ownerUserId: ownerId!, domainKey: pilotDomainForKind(profile.kind) || 'general' }
  } }) : null;

  // IT: NEW - check if the visitor is logged in
  const visitorUserId = locals.user?.id ?? null;
  const isVisitorLoggedIn = Boolean(visitorUserId);
  
  // IT: NEW - check if visitor is already connected to this owner
  let isAlreadyConnected = false;
  let visitorProfile = null;
  
  if (visitorUserId && visitorUserId !== ownerId) {
    // SECURITY: NetworkConnectionOrigin is the durable authoritative link for
    // personal-profile Network connections. Check both directions, because the
    // visitor may have originally been the inviter in a previous scan.
    if (profile?.kind === 'personal') {
      const networkOrigin = await prisma.networkConnectionOrigin.findFirst({
        where: {
          OR: [
            { inviterUserId: ownerId, visitorUserId },
            { inviterUserId: visitorUserId, visitorUserId: ownerId }
          ]
        },
        select: { id: true }
      });
      const removed = networkOrigin ? await prisma.networkConnectionVisibility.findUnique({
        where: { userId_otherUserId: { userId: visitorUserId, otherUserId: ownerId } }, select: { id: true }
      }) : null;
      isAlreadyConnected = Boolean(networkOrigin && !removed);
    } // Business and Dating cannot infer a connection from cross-context Contact rows.

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
    visitorProfile,
    dorianMode: contextPref?.dorianMode || 'SMS_CALLBACK',
    smsReady: pilotTermsConfig().ready,
    pilotTerms: { termsUrl: pilotTermsConfig().termsUrl, privacyUrl: pilotTermsConfig().privacyUrl, version: pilotTermsConfig().version }
  };
};

export const actions: Actions = {
  // One-step SMS request from the QR landing page. The caller still has to press Send.
  // Neither profile opening nor this action records policy acceptance or connection consent.
  requestDorian: async ({ params, request, locals, url }) => {
    const profile = await prisma.profile.findUnique({ where: { slug: params.slug },
      select: { id: true, userId: true, kind: true, isPublished: true } });
    if (!profile?.isPublished) return fail(404, { error: 'This profile is unavailable.' });
    const domainKey = pilotDomainForKind(profile.kind);
    if (!domainKey) return fail(400, { error: 'Telephone onboarding is unavailable for this profile.' });
    if (locals.user?.id === profile.userId) return fail(409, { error: 'Use a different phone to test a new participant.' });
    const preference = await prisma.relishContextPreference.findUnique({ where: {
      ownerUserId_domainKey: { ownerUserId: profile.userId, domainKey }
    } });
    if (preference?.dorianMode === 'BROWSER') return fail(409, { error: 'This profile is configured for browser conversations.' });
    if (!pilotTermsConfig().ready) return fail(503, { error: 'Telephone conversations are not yet configured.' });
    // Refuse speculative requests without browser origin metadata. No phone number is collected here.
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return fail(403, { error: 'Please use the public profile to request a call.' });
    const recent = await prisma.pilotSmsInvitation.count({ where: { profileId: profile.id,
      createdAt: { gte: new Date(Date.now() - 3600000) } } });
    if (recent >= 100) return fail(429, { error: 'Please try again later.' });
    try {
      const issued = await issuePilotSmsInvitation({ profileId: profile.id, ownerUserId: profile.userId,
        domainKey, env: locals.env, source: pilotSource(url.searchParams.get('via')) });
      return { issued };
    } catch {
      return fail(503, { error: 'Could not prepare the SMS. Please try again.' });
    }
  },
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
    const isPublished = form.get('isPublished') === 'on';

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
        isPublished,
        publicMeta: nextPublicMeta
      }
    });

    // IT: redirect to view mode of the same profile so the UI exits edit state
    const to = absoluteUrlFromOrigin(locals.appOrigin, `/u/${encodeURIComponent(existing.slug || '')}`);
    throw redirect(303, to);
  },

// SECURITY: The legacy one-context instant connect cannot safely connect Business/Dating.
// Friendship uses the existing explicit Network join flow, not this endpoint.
connectUsers: async () => fail(410, { error: 'Use the context-specific connection invitation instead.' }),

  // Participant initiation is an explicit opt-in, never a silent relationship assertion.
  startDorian: async ({ locals, cookies, params, url }) => {
    const profile = await prisma.profile.findUnique({ where: { slug: params.slug },
      select: { id: true, slug: true, kind: true, userId: true, isPublished: true } });
    if (!profile?.isPublished) return fail(404, { error: 'Profile unavailable.' });
    const domainKey = pilotDomainForKind(profile.kind);
    if (!domainKey) return fail(400, { error: 'This profile does not support Dorian.' });
    // An owner must not create a visitor relation to themselves.
    if (locals.user?.id === profile.userId) return fail(400, { error: 'Share your profile with someone else.' });
    const visitorUserId = await getOrCreatePilotVisitor({ cookies, env: locals.env,
      authenticatedUserId: locals.user?.id, isHttps: url.protocol === 'https:' });
    try { await ensurePilotSelfContact(visitorUserId, domainKey); }
    catch (e) { console.error('pilot self-contact unavailable', e); return fail(409, { error: 'Private conversation space could not be prepared.' }); }
    const source = pilotSource(url.searchParams.get('via'));
    const previous = await prisma.pilotProfileEntry.count({ where: {
      profileId: profile.id, visitorUserId, domainKey } });
    const entry = await prisma.pilotProfileEntry.create({ data: {
      profileId: profile.id, ownerUserId: profile.userId, visitorUserId, domainKey,
      environment: locals.env, entrySource: source
    }, select: { id: true } });
    await recordPilotEvent({ type: 'dorian.conversation_requested', env: locals.env,
      profileId: profile.id, ownerUserId: profile.userId, visitorUserId,
      domainKey, entryId: entry.id, source });
    if (previous) await recordPilotEvent({ type: 'dorian.conversation_returned', env: locals.env,
      profileId: profile.id, ownerUserId: profile.userId, visitorUserId,
      domainKey, entryId: entry.id, source });
    throw redirect(303, `/pilot/dorian/${entry.id}`);
  }
};

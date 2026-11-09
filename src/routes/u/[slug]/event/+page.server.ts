// Stage 8.22.5 - Temporary, public Tech Walk signup with explicit pilot opt-in.
// SECURITY: Published business profile is the server-authoritative destination.
// Names and contact channels are encrypted before storage. No Relish user is created.
import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { encrypt, buildScopedIndexToken } from '$lib/crypto';
import { buildVcardUrl } from '$lib/publicProfile';

const pilotGroup = 'TECH_NETWORKING_WALK_2026_11_01';

async function publishedBusinessProfile(slug: string) {
  const profile = await prisma.profile.findUnique({
    where: { slug },
    select: {
      id: true, userId: true, slug: true, kind: true, isPublished: true,
      displayName: true, headline: true, avatarUrl: true,
      company: true, title: true, emailPublic: true, phonePublic: true, websiteUrl: true, publicMeta: true
    }
  });
  // SECURITY: This founder-specific event offer must not appear on another user's
  // published profile merely because someone guessed its /event URL.
  if (!profile?.isPublished || profile.kind !== 'business' ||
      process.env.RELISH_EVENT_LANDING_ENABLED === 'NO' ||
      process.env.RELISH_EVENT_PROFILE_SLUG !== profile.slug) {
    throw error(404, 'Event page unavailable');
  }
  return profile;
}

export const load: PageServerLoad = async ({ params, url }) => {
  const profile = await publishedBusinessProfile(params.slug);
  // IT: Only intentionally published profile fields are returned to visitors.
  return {
    profile: {
      displayName: profile.displayName || 'Your new connection',
      headline: profile.headline,
      avatarUrl: profile.avatarUrl,
      company: profile.company,
      title: profile.title,
      emailPublic: profile.emailPublic,
      phonePublic: profile.phonePublic,
      websiteUrl: profile.websiteUrl
    },
    shareDetailsUrl: `/u/${encodeURIComponent(profile.slug)}/share-details?via=event`,
    vcardUrl: buildVcardUrl(profile, `${url.origin}/u/${encodeURIComponent(profile.slug)}`),
    originalUrl: `/u/${encodeURIComponent(profile.slug)}?original=1`
  };
};

export const actions: Actions = {
  join: async ({ params, request, url }) => {
    const profile = await publishedBusinessProfile(params.slug);
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return fail(403, { message: 'Please submit from the event page.' });
    const body = await request.formData();
    // IT: Honeypot blocks basic automated submissions without asking a human for extra steps.
    if (String(body.get('website_check') || '').trim()) return { joined: true };
    const name = String(body.get('name') || '').trim();
    const email = String(body.get('email') || '').trim().toLowerCase();
    const phone = String(body.get('phone') || '').trim();
    const agreed = body.get('pilotContactConsent') === 'yes';
    const values = { name, email, phone };
    if (!name || name.length > 120 || !agreed || (!email && !phone)) {
      return fail(400, { message: 'Please enter your name, email or mobile, and agree to pilot follow-up.', values });
    }
    if (email && (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
      return fail(400, { message: 'Please enter a valid email address.', values });
    }
    if (phone && (phone.length > 40 || !/^\+?[0-9() .-]{7,40}$/.test(phone))) {
      return fail(400, { message: 'Please enter a valid phone number.', values });
    }
    // IT: No PII is written to logs. Bound submissions are naturally deduplicated by HMAC.
    // Count is a coarse abuse cap, not a marketing or conversion requirement.
    const recent = await prisma.relishEventPilotSignup.count({
      where: { profileId: profile.id, createdAt: { gte: new Date(Date.now() - 3600_000) } }
    });
    if (recent >= 150) return fail(429, { message: 'Please try again later.', values });
    const keySource = email ? `email:${email}` : `phone:${phone.replace(/\D/g, '')}`;
    const contactKey = buildScopedIndexToken(keySource, 'event-pilot:contact:v1');
    try {
      await prisma.relishEventPilotSignup.upsert({
        where: { profileId_contactKey: { profileId: profile.id, contactKey } },
        create: {
          ownerUserId: profile.userId, profileId: profile.id, contactKey,
          nameEnc: encrypt(name, 'event-pilot.name'),
          emailEnc: email ? encrypt(email, 'event-pilot.email') : null,
          phoneEnc: phone ? encrypt(phone, 'event-pilot.phone') : null,
          interestGroup: pilotGroup
        },
        // IT: An existing opt-in updates provided details while retaining its original consent date.
        update: {
          nameEnc: encrypt(name, 'event-pilot.name'),
          ...(email ? { emailEnc: encrypt(email, 'event-pilot.email') } : {}),
          ...(phone ? { phoneEnc: encrypt(phone, 'event-pilot.phone') } : {})
        }
      });
    } catch (err) {
      console.error('[event-pilot] signup storage failed', err instanceof Error ? err.name : 'UnknownError');
      return fail(503, { message: 'We could not save your details. Please try again.', values });
    }
    return { joined: true };
  }
};

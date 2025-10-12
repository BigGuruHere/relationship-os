// src/routes/share/+page.server.ts
// PURPOSE: share options page - always provision a random publicSlug and a base profile first.
// MULTI TENANT: reads and writes only the current user.
// All IT code is commented and uses hyphens only.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { ensureRandomPublicSlug } from '$lib/server/slug';
import { ensureBaseProfile } from '$lib/server/profile';

const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:5173';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  // 1) Make sure a slug exists for this user
  const slug = await ensureRandomPublicSlug(locals.user.id);

  // 2) Make sure a base profile exists and get it back
  const profile = await ensureBaseProfile(locals.user.id);

  // 3) Compose universal link and share helpers
  const link = `${APP_ORIGIN}/u/${slug}`;
  const smsBody = encodeURIComponent(`Hi - here is my link to connect: ${link}`);
  const smsUrl = `sms:?&body=${smsBody}`;
  const waText = encodeURIComponent(`Hi - here is my link to connect: ${link}`);
  const whatsappUrl = `https://wa.me/?text=${waText}`;
  const vcardUrl = `/api/vcard?name=${encodeURIComponent(profile.displayName || 'Contact')}&link=${encodeURIComponent(link)}`;

  // Signal whether the profile is still blank so the UI can nudge the user
  const isBlank =
    !profile.displayName &&
    !profile.headline &&
    !profile.company &&
    !profile.title &&
    !profile.websiteUrl &&
    !profile.emailPublic &&
    !profile.phonePublic &&
    !profile.avatarUrl &&
    !profile.bio;

  return {
    link,
    smsUrl,
    whatsappUrl,
    vcardUrl,
    profile: {
      id: profile.id,
      slug: profile.slug,
      isBlank
    }
  };
};

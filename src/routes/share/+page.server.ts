// PURPOSE: controller - decide where the user should land when they click Share.
// - if no profile yet: go to /u/{slug}?edit=1&first=1
// - if profile but no QR: go to /u/{slug}
// - if profile and QR: go to /share/qr
// TENANCY: only uses locals.user.id. No PII.
// NOTE: this route does not render a page - it always redirects.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { ensureRandomPublicSlug } from '$lib/server/slug';
import { ensureBaseProfile } from '$lib/server/profile';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) throw redirect(303, '/auth/login');

  // 1) ensure the user has a slug
  const slug = await ensureRandomPublicSlug(locals.user.id);

  // 2) ensure there is at least one profile
  const profile = await ensureBaseProfile(locals.user.id);

  // 3) decide where to send them
  if (!profile.displayName && !profile.headline && !profile.company && !profile.title && !profile.websiteUrl && !profile.emailPublic && !profile.phonePublic && !profile.avatarUrl && !profile.bio) {
    throw redirect(303, `/u/${slug}?edit=1&first=1`);
  }

  if (!profile.qrReady) {
    throw redirect(303, `/u/${slug}`);
  }

  throw redirect(303, '/share/qr');
};

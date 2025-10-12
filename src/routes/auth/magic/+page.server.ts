// PURPOSE: consume a magic link token and sign the user in by setting your session cookie.
// SECURITY: token is single use and short lived. Cookie is httpOnly.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { verifyMagicToken, markMagicTokenUsed } from '$lib/server/tokens';
import { createSessionCookie } from '$lib/server/session';

export const load: PageServerLoad = async ({ url, cookies }) => {
  const token = url.searchParams.get('token') || '';
  const payload = await verifyMagicToken(token);
  if (!payload) {
    throw redirect(303, '/auth/login?e=invalid_magic');
  }

  const cookie = await createSessionCookie(payload.userId);
  cookies.set(cookie.name, cookie.value, cookie.options);

  await markMagicTokenUsed(payload.id);
  // IT: send the guest to a simple welcome page
  throw redirect(303, '/guest/welcome');
};

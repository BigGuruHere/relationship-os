// PURPOSE: handle magic link sign in at /auth/magic?token=... and set a session cookie.
// This version does not import src/lib/server/session. It uses your existing auth helpers.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { verifyMagicToken, createSessionCookie } from '$lib/server/auth'; // you already used these in the API version
import { prisma } from '$lib/db';

export const load: PageServerLoad = async ({ url, cookies }) => {
  // 1 - Get token from query string
  const token = url.searchParams.get('token') || '';

  // 2 - Validate token
  const payload = await verifyMagicToken(token);
  if (!payload) {
    // Invalid token - send to login
    throw redirect(303, '/auth/login?error=magic');
  }

  // 3 - Look up user
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true }
  });
  if (!user) {
    throw redirect(303, '/auth/login?error=nouser');
  }

  // 4 - Mint httpOnly session cookie
  const cookie = await createSessionCookie(user.id);
  cookies.set(cookie.name, cookie.value, cookie.options);

  // 5 - Land in app
  throw redirect(303, '/');
};

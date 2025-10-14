// PURPOSE: handle /auth/magic?token=... without importing $lib/server/auth.
// STRATEGY: proxy the token to your API endpoint that actually verifies the token
// and sets the session cookie. We do a same-origin POST and then redirect.
// This avoids build-time imports of non-existent modules.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, fetch, cookies }) => {
  // Read token from the query string
  const token = url.searchParams.get('token') || '';

  if (!token) {
    // No token - send to login
    throw redirect(303, '/auth/login?error=missing_token');
  }

  // Call the API endpoint that issues the session cookie
  // - must exist at /api/auth/magic-link with a POST handler that verifies token
  // - must set an httpOnly cookie on success
  const res = await fetch('/api/auth/magic-link', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
    // include ensures cookies set by the API are persisted in the browser
    credentials: 'include'
  });

  if (!res.ok) {
    // Bubble a simple error redirect - keeps the page tiny
    const code = res.status;
    throw redirect(303, `/auth/login?error=magic_${code}`);
  }

  // Land in the app
  throw redirect(303, '/');
};

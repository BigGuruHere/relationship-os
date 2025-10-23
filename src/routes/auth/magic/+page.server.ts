// src/routes/auth/magic/+page.server.ts
// PURPOSE: handle /auth/magic?token=... without importing server-only auth code.
// STRATEGY: POST the token to /api/auth/magic-link which verifies it and sets the session cookie.
// NOTES: keeps this page minimal - the API endpoint performs post-auth lead linking.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, fetch }) => {
  // IT: read token from the query string
  const token = url.searchParams.get('token') || '';
  if (!token) {
    // IT: no token - send to login
    throw redirect(303, '/auth/login?error=missing_token');
  }

  // IT: call the API endpoint that verifies the token and sets an httpOnly session cookie
  // - credentials: 'include' ensures the cookie set by the API is persisted
  let res: Response;
  try {
    res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include'
    });
  } catch {
    // IT: network or server error - bounce to login with a generic flag
    throw redirect(303, '/auth/login?error=magic_fetch');
  }

  if (!res.ok) {
    // IT: bubble a simple error code - the API already avoided leaking details
    const code = res.status;
    throw redirect(303, `/auth/login?error=magic_${code}`);
  }

  // IT: success - the API has set the session cookie already
  throw redirect(303, '/');
};

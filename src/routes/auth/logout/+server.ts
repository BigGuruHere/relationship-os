// src/routes/auth/logout/+server.ts
// PURPOSE:
// - Destroy the server session and clear the browser cookie using env-aware config
// NOTES:
// - Uses clearSessionCookie so the name and flags match the current environment
// - All IT code is commented and uses normal hyphens

import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { destroySession, clearSessionCookie } from '$lib/auth';

export const POST: RequestHandler = async ({ locals, cookies, url, request }) => {
  // Destroy server-side session if present
  if (locals.sessionId) {
    await destroySession(locals.sessionId);
  }

  // Clear the browser cookie - env-aware name and flags from locals
  clearSessionCookie(cookies, locals);

  // Allow caller to specify where to go next, else default to login
  // - supports either query string ?redirect=/ or form field <input name="redirect" />
  const qsRedirect = url.searchParams.get('redirect');
  const form = await request.formData().catch(() => null);
  const formRedirect = form?.get('redirect')?.toString();
  const next = qsRedirect || formRedirect || '/auth/login';

  // 303 is the correct redirect after POST
  throw redirect(303, next);
};

// Optional: if someone visits /auth/logout with GET, just bounce them away without side effects
export const GET: RequestHandler = async () => {
  throw redirect(303, '/');
};

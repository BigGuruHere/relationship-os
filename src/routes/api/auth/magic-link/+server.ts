// src/routes/api/auth/magic-link/+server.ts
// PURPOSE: verify a magic-link token, create a session, and set the cookie
// SECURITY:
// - Verifies a signed token issued by your server
// - Uses encrypted email fields only - equality lookup via deterministic HMAC index
// - Decrypts email server-side only when needed for lead linking
// CONTRACT:
// - Input: POST JSON { token: string }
// - Success: 204 No Content with session cookie set
// - Failure: 4xx with no session cookie
//
// TOKEN EXPECTATIONS:
// - $lib/server/tokens.verifyInviteToken(token) should return:
//   { userId?: string, email?: string, meta?: Record<string, any> }
// - If userId is present, we log in that user.
// - Else if email is present, we upsert a user by encrypted email and log in.
// - If neither exists, we return 400.

import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { createSession, setSessionCookie } from '$lib/auth';
import { verifyMagicToken, markMagicTokenUsed } from '$lib/server/tokens';

// IT: encrypted email helpers

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
  // 1 - parse body
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }
  const token = String(body?.token || '');
  if (!token) throw error(400, 'Missing token');

  // 2 - verify token issued by our server
  let payload: { id: string; userId: string } | null = null;
  try {
    payload = await verifyMagicToken(token);
  } catch {
    throw error(400, 'Invalid or expired token');
  }
  if (!payload) throw error(400, 'Invalid or expired token');

  // 3 - resolve or create the user without using plaintext email
  let userId: string;

  // Magic tokens are issued to an existing userId. Resolve that user and consume the token
  // before creating a session so the link remains single-use.
  const u = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true } });
  if (!u) throw error(400, 'Invalid token user');
  userId = u.id;
  await markMagicTokenUsed(payload.id);

  // 4 - create a first party session and set the env aware cookie
  const { cookie, expiresAt } = await createSession(userId);
  setSessionCookie(cookies, locals, cookie, expiresAt);

  // 6 - done
  return new Response(null, { status: 204 });
};

// Optional GET handler - helpful for quick manual testing in a browser
export const GET: RequestHandler = async () => {
  return json({ ok: true, use: 'POST with { "token": "<token>" }' });
};

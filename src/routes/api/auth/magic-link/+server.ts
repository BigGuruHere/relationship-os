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
import { linkLeadsForUser } from '$lib/leads/link';
import { verifyInviteToken } from '$lib/server/tokens';

// IT: encrypted email helpers
import {
  normalizeEmail,
  encrypt
} from '$lib/crypto';
import {
  findUserByEmail,
  setUserEmail,
  decryptUserEmail
} from '$lib/server/userEmail';

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
  let payload: { userId?: string; email?: string; meta?: Record<string, any> } | null = null;
  try {
    payload = await verifyInviteToken(token);
  } catch {
    throw error(400, 'Invalid or expired token');
  }
  if (!payload) throw error(400, 'Invalid or expired token');

  // 3 - resolve or create the user without using plaintext email
  let userId: string;

  if (payload.userId) {
    // IT: direct user lookup by id
    const u = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true }
    });
    if (!u) throw error(400, 'Invalid token user');
    userId = u.id;
  } else if (payload.email) {
    // IT: upsert by encrypted email
    const emailNorm = normalizeEmail(payload.email);

    // 3a - try to find existing user by deterministic index
    const existing = await findUserByEmail(emailNorm);
    if (existing) {
      userId = existing.id;
    } else {
      // 3b - create a lightweight user record, then set encrypted email fields
      const created = await prisma.user.create({
        data: {},
        select: { id: true }
      });
      await setUserEmail(created.id, emailNorm);
      userId = created.id;
    }
  } else {
    throw error(400, 'Token does not contain a login identity');
  }

  // 4 - create a first party session and set the env aware cookie
  const { cookie, expiresAt } = await createSession(userId);
  setSessionCookie(cookies, locals, cookie, expiresAt);

  // 5 - post auth hook - link any pending leads captured via public forms
  // - linkLeadsForUser currently expects an email string
  // - decrypt on the server, never expose to client
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { email_Enc: true }
    });
    const emailPlain = decryptUserEmail(u?.email_Enc ?? null);
    if (emailPlain) {
      await linkLeadsForUser(userId, emailPlain);
    }
  } catch (e) {
    // Never block auth on linking - log and continue
    console.warn('linkLeadsForUser failed after magic link:', e);
  }

  // 6 - done
  return new Response(null, { status: 204 });
};

// Optional GET handler - helpful for quick manual testing in a browser
export const GET: RequestHandler = async () => {
  return json({ ok: true, use: 'POST with { "token": "<token>" }' });
};

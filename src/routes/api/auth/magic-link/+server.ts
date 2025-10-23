// src/routes/api/auth/magic-link/+server.ts
// PURPOSE: verify a magic-link token, create a session, and set the cookie
// SECURITY:
// - Verifies a signed token issued by your server
// - Does not accept PII other than what is inside the token
// - Links pending Leads after successful login
// CONTRACT:
// - Input: POST JSON { token: string }
// - Success: 204 No Content with session cookie set
// - Failure: 4xx with no session cookie
//
// TOKEN EXPECTATIONS:
// - Your $lib/server/tokens.verifyInviteToken(token) should return an object with:
//   { userId?: string, email?: string, meta?: Record<string, any> }
// - If userId is present, we log in that user.
// - Else if email is present, we upsert a user by email and log in.
// - If neither exists, we return 400.
// - Adjust the import or field names to match your tokens helper if they differ.

import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { createSession, setSessionCookie } from '$lib/auth';
import { linkLeadsForUser } from '$lib/leads/link';
import { verifyInviteToken } from '$lib/server/tokens';

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
  // Parse body
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }
  const token = String(body?.token || '');
  if (!token) throw error(400, 'Missing token');

  // Verify token - must be a server issued signed token
  let payload: { userId?: string; email?: string; meta?: Record<string, any> } | null = null;
  try {
    payload = await verifyInviteToken(token);
  } catch (e) {
    // Do not leak internals to clients
    throw error(400, 'Invalid or expired token');
  }
  if (!payload) throw error(400, 'Invalid or expired token');

  // Resolve or create the user
  let user = null as null | { id: string; email: string | null };
  if (payload.userId) {
    user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true }
    });
    if (!user) throw error(400, 'Invalid token user');
  } else if (payload.email) {
    // Upsert by email if present - creates a lightweight account that can be completed later
    const email = payload.email.toLowerCase();
    user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
      select: { id: true, email: true }
    });
  } else {
    // If your token payload does not carry email or userId, you cannot mint a session here
    // In that case, redirect the flow to a normal signup instead of using this endpoint
    throw error(400, 'Token does not contain a login identity');
  }

  // Create a first party session and set the env aware cookie
  const { cookie, expiresAt } = await createSession(user.id);
  setSessionCookie(cookies, locals, cookie, expiresAt);

  // Post auth hook - link any pending leads captured via public forms
  try {
    if (user.email) await linkLeadsForUser(user.id, user.email);
  } catch (e) {
    // Never block auth on linking - log and continue
    console.warn('linkLeadsForUser failed after magic link:', e);
  }

  // Done - no body needed. The page that called this will redirect the user.
  return new Response(null, { status: 204 });
};

// Optional GET handler - helpful for quick manual testing in a browser
export const GET: RequestHandler = async () => {
  return json({ ok: true, use: 'POST with { "token": "<token>" }' });
};

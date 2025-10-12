// src/routes/api/guest/start/+server.ts
// PURPOSE: start a temporary guest session from a public invite token.
// MULTI TENANT: inviteToken ties the session to the correct owner.
// SECURITY: session cookie is httpOnly. We also set a short lived non sensitive cookie
//           connect_owner that the client can read to show who they are connecting with.
// NOTE: all IT code is commented and no em dashes are used.

import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { verifyInviteToken } from '$lib/server/tokens';
import { createSessionCookie } from '$lib/server/session';

export const POST: RequestHandler = async ({ request, cookies }) => {
  // Accept either JSON or form posts - keeps the public page simple
  const contentType = request.headers.get('content-type') || '';
  let inviteToken = '';

  if (contentType.includes('application/json')) {
    const body = await request.json();
    inviteToken = String(body.inviteToken || '');
  } else {
    const form = await request.formData();
    inviteToken = String(form.get('inviteToken') || '');
  }

  if (!inviteToken) {
    return new Response(JSON.stringify({ error: 'Missing invite token' }), { status: 400 });
  }

  // Validate the invite - this binds the session to the owner they are connecting with
  const invite = await verifyInviteToken(inviteToken);
  if (!invite) {
    return new Response(JSON.stringify({ error: 'Invalid or expired invite' }), { status: 400 });
  }

  // Create a lightweight user account with role guest
  // No PII yet - they can share details later to receive a magic link
  const guest = await prisma.user.create({
    data: { role: 'guest' },
    select: { id: true }
  });

  // Mint the httpOnly session cookie for the guest user
  const sess = await createSessionCookie(guest.id);
  cookies.set(sess.name, sess.value, sess.options);

  // Store owner id in a non sensitive cookie for 1 minute
  // - path / so all routes can read it if needed
  // - httpOnly false so the client can read and show a friendly message
  // - sameSite lax for normal navigation
  // - maxAge 60 seconds so it clears after 1 minute
  cookies.set('connect_owner', invite.ownerId, {
    path: '/',
    maxAge: 60,
    httpOnly: false,
    sameSite: 'lax'
  });

  // Optional: if you also want to store the public slug, you can look it up here
  // and set another short lived cookie. Safe to skip if you prefer.
  // const owner = await prisma.user.findFirst({ where: { id: invite.ownerId }, select: { publicSlug: true } });
  // if (owner?.publicSlug) {
  //   cookies.set('connect_owner_slug', owner.publicSlug, {
  //     path: '/',
  //     maxAge: 60,        // 1 minute to match the owner id cookie
  //     httpOnly: false,
  //     sameSite: 'lax'
  //   });
  // }

  // Redirect to the guest welcome page
  throw redirect(303, '/guest/welcome');
};

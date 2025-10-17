// PURPOSE: start a lightweight guest flow from the public /u/[slug] page.
// INPUT: form POST with inviteToken.
// ACTIONS:
// - verify the invite token
// - set a short lived, non sensitive cookie with the owner id so the UI can personalize
// - redirect back to the owner's public page
// SECURITY: no privileged session is created here.

import type { RequestHandler } from './$types';
import { prisma } from '$lib/db';
import { verifyInviteToken } from '$lib/server/tokens';
import { redirect } from '@sveltejs/kit';

const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:5173';

export const POST: RequestHandler = async ({ request, cookies }) => {
  // Read the form body
  const form = await request.formData();
  const inviteToken = String(form.get('inviteToken') || '');

  if (!inviteToken) {
    // No token provided - send to home
    throw redirect(303, '/');
  }

  // Verify the invite token - this binds the action to a specific owner
  const payload = await verifyInviteToken(inviteToken);
  if (!payload) {
    throw redirect(303, '/');
  }

  // Find the owner to compute their public link
  const owner = await prisma.user.findUnique({
    where: { id: payload.ownerId },
    select: { id: true, publicSlug: true }
  });

  if (!owner) {
    throw redirect(303, '/');
  }

  // Set a short lived, non sensitive cookie the client can read
  // This is useful for small UX touches, not for auth
  cookies.set('connect_owner', owner.id, {
    path: '/',
    maxAge: 60, // one minute
    httpOnly: false,
    sameSite: 'lax',
  });

  const slug = owner.publicSlug || owner.id;
  const link = `${APP_ORIGIN}/u/${slug}`;

  // Redirect back to the public page
  throw redirect(303, link);
};

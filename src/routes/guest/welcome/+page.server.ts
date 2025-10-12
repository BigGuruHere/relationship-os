// src/routes/guest/welcome/+page.server.ts
// PURPOSE: show a simple confirmation for a guest session and, if available,
//          display who they are connecting with based on the short lived cookie.
// SECURITY: requires a logged in session. Reads only minimal public info.
// TENANCY: this page is not tenant scoped to data writes - it reads just the owner slug for display.

import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  // Require a session - if someone opens this directly without the flow, send them to login
  if (!locals.user) throw redirect(303, '/auth/login');

  // Read the short lived cookie that was set in /api/guest/start
  const ownerId = cookies.get('connect_owner') || null;

  // If present, look up a minimal public field - the public slug
  let ownerSlug: string | null = null;
  if (ownerId) {
    const row = await prisma.user.findFirst({
      where: { id: ownerId },
      select: { publicSlug: true }
    });
    ownerSlug = row?.publicSlug || null;
  }

  // Return data for the page
  return {
    owner: {
      id: ownerId,
      slug: ownerSlug
    }
  };
};

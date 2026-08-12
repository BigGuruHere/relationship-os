// src/routes/api/guest/claim-linkedin/+server.ts
// PURPOSE: accept viewer provided LinkedIn URL and attach to a pending lead
// SECURITY: normalize URL and use deterministic index - tenant scoped by owner

import type { RequestHandler } from './$types';
import { prisma } from '$lib/db';
import { buildIndexToken } from '$lib/crypto';
import { normalizeLinkedInUrl } from '$lib/publicProfile';
import { linkLeadsForUserFlexible } from '$lib/leads/link';

export const POST: RequestHandler = async ({ request, locals }) => {
  // REQUIRE login for the viewer if you want to immediately link to their userId
  if (!locals.user) return new Response('unauthorized', { status: 401 });

  const form = await request.formData();
  const raw = String(form.get('linkedinUrl') || '');
  const cleaned = normalizeLinkedInUrl(raw);
  if (!cleaned) return new Response('bad url', { status: 400 });

  // Option A - just claim any pending leads referencing this LinkedIn when they exist
  await linkLeadsForUserFlexible(locals.user.id, { linkedinUrl: cleaned });

  return new Response(null, { status: 303, headers: { location: '/thank-you?claimed=1' } });
};

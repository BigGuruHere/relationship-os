// src/routes/+page.server.ts
// PURPOSE: load the signed-in user's contacts and compute a safe display name
// SECURITY:
// - Decrypt PII on the server only
// - Tenant scoped queries by locals.user.id
// NOTES:
// - Uses a live fallback name when stored name is a placeholder and linkedUserId exists
// - AAD must match writer exactly for decrypt calls

import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { redirect } from '@sveltejs/kit';
import { getBestDisplayName } from '$lib/server/names';

// IT: basic helper to detect placeholders you might have saved earlier
function isPlaceholderName(name: string | null | undefined): boolean {
  const s = (name || '').trim().toLowerCase();
  return !s || s === 'new connection' || s === 'relish user';
}

export const load: PageServerLoad = async ({ locals }) => {
  // Require login
  if (!locals.user) throw redirect(303, '/auth/login');

  // Tenant scoped query - fetch only what we need for the list
  const rows = await prisma.contact.findMany({
    where: { userId: locals.user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, fullNameEnc: true, linkedUserId: true, createdAt: true }
  });

  // Decrypt on the server, never in the browser
  const contacts = await Promise.all(
    rows.map(async (r) => {
      let name = '';
      try {
        name = r.fullNameEnc ? decrypt(r.fullNameEnc, 'contact.full_name') : '';
      } catch {
        name = '';
      }

      // IT: live fallback for linked users when stored name is a placeholder
      if (r.linkedUserId && isPlaceholderName(name)) {
        try {
          name = await getBestDisplayName(r.linkedUserId);
        } catch {
          // Leave name as is if fallback fails
        }
      }

      // IT: final guard
      if (!name) name = 'Relish user';

      return { id: r.id, name, createdAt: r.createdAt };
    })
  );

  return { contacts };
};

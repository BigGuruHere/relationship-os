// src/routes/api/tags/+server.ts
// PURPOSE: GET /api/tags?q=prefix returns up to 10 matching tags for autocomplete.
// MULTI TENANT: Requires login and filters by userId so each tenant only sees their vocabulary.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) return json({ tags: [] });

  const q = (url.searchParams.get('q') || '').toLowerCase().trim();
  const where = q
    ? {
        userId: locals.user.id,
        OR: [{ slug: { contains: q } }, { name: { contains: q, mode: 'insensitive' } }]
      }
    : { userId: locals.user.id };

  const rows = await prisma.tag.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 10,
    select: { name: true, slug: true }
  });

  return json({ tags: rows });
};

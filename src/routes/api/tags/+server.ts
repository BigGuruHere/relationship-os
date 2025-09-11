// src/routes/api/tags/+server.ts
// PURPOSE: GET /api/tags?q=prefix returns up to 10 matching tags for autocomplete.
// SECURITY: public read of tag names is OK since tags are generic.

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/db';

export const GET: RequestHandler = async ({ url }) => {
  const q = (url.searchParams.get('q') || '').toLowerCase().trim();
  const where = q
    ? { OR: [{ slug: { contains: q } }, { name: { contains: q, mode: 'insensitive' } }] }
    : {};

  const rows = await prisma.tag.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 10,
    select: { name: true, slug: true }
  });

  return json({ tags: rows });
};

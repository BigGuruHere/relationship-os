// src/routes/deals/[id]/delete/+server.ts
// PURPOSE: Delete a deal owned by the signed-in user.
// SECURITY: Tenant scoped delete. DealContact rows cascade from Deal.

import type { RequestHandler } from './$types';
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';
import { absoluteUrlFromOrigin } from '$lib/url';

export const POST: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/auth/login'));

  try {
    await prisma.deal.deleteMany({
      where: { id: params.id, userId: locals.user.id }
    });
  } catch (err) {
    console.error('[deals:delete] failed', err);
  }

  throw redirect(303, absoluteUrlFromOrigin(locals.appOrigin, '/deals'));
};

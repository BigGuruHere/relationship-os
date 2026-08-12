// src/routes/contacts/[id]/interactions/[iid]/suggest-tags/+server.ts
// PURPOSE: Return tag suggestions from the existing Tag list using pgvector.
// SECURITY: Tenant scoped by userId. No persistence here. All IT code is commented.

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { suggestTagsForInteraction } from '$lib/tag_suggestions';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  // IT: require login
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // IT: optional overrides from the request body
  let topK = 8;
  let minScore = 0.25;
  try {
    const body = await request.json();
    if (typeof body?.topK === 'number') topK = Math.max(1, body.topK);
    if (typeof body?.minScore === 'number') minScore = body.minScore;
  } catch {
    // IT: ignore parse errors - defaults are fine
  }

  // IT: compute suggestions using InteractionEmbedding.vec and Tag.embedding_vec
  const suggestions = await suggestTagsForInteraction({
    userId: locals.user.id,
    interactionId: params.iid,
    topK,
    minScore
  });

  return json({ suggestions });
};
